import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { hashPassword } from '../utils/password';

const adminSeedSchema = z.object({
  ADMIN_EMAIL: z
    .string({ message: 'ADMIN_EMAIL is required' })
    .email('ADMIN_EMAIL must be a valid email address')
    .trim()
    .toLowerCase(),
  ADMIN_PASSWORD: z
    .string({ message: 'ADMIN_PASSWORD is required' })
    .min(8, 'ADMIN_PASSWORD must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'ADMIN_PASSWORD must contain at least one letter')
    .regex(/[0-9]/, 'ADMIN_PASSWORD must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'ADMIN_PASSWORD must contain at least one special character'),
  ADMIN_NAME: z
    .string({ message: 'ADMIN_NAME is required' })
    .trim()
    .min(1, 'ADMIN_NAME cannot be empty'),
});

export const seedAdmin = async (): Promise<void> => {
  try {
    // 1. Validate environment configuration
    const parsed = adminSeedSchema.safeParse({
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      ADMIN_NAME: process.env.ADMIN_NAME,
    });

    if (!parsed.success) {
      console.error('❌ Admin bootstrap configuration invalid:');
      const errors = parsed.error.flatten().fieldErrors;
      for (const [field, messages] of Object.entries(errors)) {
        if (messages && messages.length > 0) {
          console.error(`  - ${field}: ${messages.join(', ')}`);
        }
      }
      process.exit(1);
    }

    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = parsed.data;

    // 2. Connect to database
    await connectDatabase();

    // 3. Check if any Administrator already exists (idempotency safeguard)
    const existingAdmin = await User.findOne({ globalRole: 'ADMIN' });
    if (existingAdmin) {
      console.log(`ℹ️ An Organization Administrator already exists (${existingAdmin.email}).`);
      console.log('   Bootstrap skipped to preserve security and prevent multiple administrators.');
      await disconnectDatabase();
      process.exit(0);
    }

    // 4. Check if the email is already in use by a regular user
    const existingUser = await User.findOne({ email: ADMIN_EMAIL });
    if (existingUser) {
      console.error(`❌ Cannot bootstrap administrator: email ${ADMIN_EMAIL} is already in use by a standard user account.`);
      await disconnectDatabase();
      process.exit(1);
    }

    // 5. Hash password with bcryptjs (cost factor 12)
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    // 6. Create administrator record
    const admin = await User.create({
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_NAME,
      avatarUrl: null,
      globalRole: 'ADMIN',
      isActive: true,
    });

    console.log('✅ Initial Organization Administrator created successfully.');
    console.log(`   Admin ID:    ${admin._id.toString()}`);
    console.log(`   Admin Email: ${admin.email}`);
    console.log(`   Admin Name:  ${admin.fullName}`);
    console.log(`   Role:        ${admin.globalRole}`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to bootstrap administrator:', (error as Error).message);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
};

// Execute if run directly from CLI
if (require.main === module) {
  seedAdmin();
}
