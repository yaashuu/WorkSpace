import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { sanitizeMongoUri } from '../config/database';

// 1. Explicitly load server/.env regardless of invoking directory
const serverEnvPath = path.resolve(__dirname, '../../.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath, override: true });
} else if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath, override: true });
} else {
  dotenv.config({ override: true });
}

// 2. Validation schema for required environment variables
const syncConfigSchema = z.object({
  ADMIN_EMAIL: z
    .string({ message: 'ADMIN_EMAIL is required' })
    .email('ADMIN_EMAIL must be a valid email address')
    .trim()
    .toLowerCase(),
  ADMIN_PASSWORD: z
    .string({ message: 'ADMIN_PASSWORD is required' })
    .min(8, 'ADMIN_PASSWORD must be at least 8 characters long'),
  MONGODB_URI: z
    .string({ message: 'MONGODB_URI is required' })
    .min(1, 'MONGODB_URI cannot be empty'),
});

export const syncAdminCredentials = async (): Promise<void> => {
  try {
    // 3. Read and validate environment configuration (never logging credential values)
    const parsed = syncConfigSchema.safeParse({
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      MONGODB_URI: process.env.MONGODB_URI,
    });

    if (!parsed.success) {
      console.error('❌ Configuration validation failed:');
      const errors = parsed.error.flatten().fieldErrors;
      for (const [field, messages] of Object.entries(errors)) {
        if (messages && messages.length > 0) {
          console.error(`  - ${field}: ${messages.join(', ')}`);
        }
      }
      process.exit(1);
    }

    const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = parsed.data;

    // 4. Connect to MongoDB
    console.log(`Connecting to MongoDB at ${sanitizeMongoUri(MONGODB_URI)}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB database.');

    // 5. Find the existing administrator account
    const existingAdmins = await User.find({ globalRole: 'ADMIN' });
    if (existingAdmins.length === 0) {
      console.error('❌ Abort: No administrator account with globalRole "ADMIN" found in database.');
      await mongoose.disconnect();
      process.exit(1);
    }

    let admin: (typeof existingAdmins)[0];
    if (existingAdmins.length === 1) {
      admin = existingAdmins[0];
    } else {
      // If multiple admin records exist, target the one matching ADMIN_EMAIL
      const matched = existingAdmins.find(
        (a) => a.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
      if (matched) {
        admin = matched;
      } else {
        console.error(
          `❌ Abort: Found ${existingAdmins.length} administrator accounts in database and none match target email "${ADMIN_EMAIL}". Ambiguous update target.`
        );
        await mongoose.disconnect();
        process.exit(1);
      }
    }

    // Safety verify that the target account has globalRole ADMIN
    if (admin.globalRole !== 'ADMIN') {
      console.error(
        `❌ Abort: Target account "${admin.email}" does not have globalRole ADMIN (current role: ${admin.globalRole}).`
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    // 6. Check whether ADMIN_EMAIL is already used by another user account
    const conflictUser = await User.findOne({
      email: ADMIN_EMAIL,
      _id: { $ne: admin._id },
    });

    if (conflictUser) {
      console.error(
        `❌ Abort: Cannot update administrator email. The email "${ADMIN_EMAIL}" is already in use by another user account (User ID: ${conflictUser._id.toString()}, Global Role: ${conflictUser.globalRole}).`
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    // Capture baseline metrics to guarantee no duplicate admin/user creation and field preservation
    const totalUsersBefore = await User.countDocuments();
    const totalAdminsBefore = await User.countDocuments({ globalRole: 'ADMIN' });

    const originalId = admin._id.toString();
    const originalEmail = admin.email;
    const originalFullName = admin.fullName;
    const originalAvatarUrl = admin.avatarUrl;
    const originalRole = admin.globalRole;
    const originalIsActive = admin.isActive;
    const originalCreatedAt = admin.createdAt ? new Date(admin.createdAt).toISOString() : null;
    const originalPasswordHash = admin.passwordHash;

    // 7. Hash the new password using the existing hashPassword() utility (bcrypt cost 12)
    const newPasswordHash = await hashPassword(ADMIN_PASSWORD);

    // 8. Update ONLY the two fields: email and passwordHash
    await User.updateOne(
      { _id: admin._id },
      {
        $set: {
          email: ADMIN_EMAIL,
          passwordHash: newPasswordHash,
        },
      }
    );

    // 9. Re-fetch and verify the updated record
    const updatedAdmin = await User.findById(admin._id);
    if (!updatedAdmin) {
      throw new Error('Verification failed: Updated administrator record not found.');
    }

    // 9a. Verify email matches ADMIN_EMAIL
    if (updatedAdmin.email !== ADMIN_EMAIL) {
      throw new Error(
        `Verification failed: Email does not match target. Expected "${ADMIN_EMAIL}", found "${updatedAdmin.email}".`
      );
    }

    // 9b. Verify password using comparePassword utility from ../utils/password
    const isPasswordValid = await comparePassword(ADMIN_PASSWORD, updatedAdmin.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Verification failed: Updated password failed bcrypt comparison with comparePassword().');
    }

    // 9c. Verify comparePassword method on User document
    const isModelPasswordValid = await updatedAdmin.comparePassword(ADMIN_PASSWORD);
    if (!isModelPasswordValid) {
      throw new Error('Verification failed: Updated password failed User model comparePassword() method.');
    }

    // 9d. Verify passwordHash is a valid bcrypt hash
    if (!updatedAdmin.passwordHash || !updatedAdmin.passwordHash.startsWith('$2')) {
      throw new Error('Verification failed: Updated passwordHash is not a valid bcrypt hash.');
    }

    // 10. Integrity check: Preserve administrator's _id, globalRole, isActive, and other fields
    if (updatedAdmin._id.toString() !== originalId) {
      throw new Error(`Integrity check failed: _id changed from ${originalId} to ${updatedAdmin._id.toString()}`);
    }
    if (updatedAdmin.globalRole !== originalRole) {
      throw new Error(`Integrity check failed: globalRole changed from ${originalRole} to ${updatedAdmin.globalRole}`);
    }
    if (updatedAdmin.isActive !== originalIsActive) {
      throw new Error(`Integrity check failed: isActive changed from ${originalIsActive} to ${updatedAdmin.isActive}`);
    }
    if (updatedAdmin.fullName !== originalFullName) {
      throw new Error(`Integrity check failed: fullName changed from "${originalFullName}" to "${updatedAdmin.fullName}"`);
    }
    if (updatedAdmin.avatarUrl !== originalAvatarUrl) {
      throw new Error(`Integrity check failed: avatarUrl changed from "${originalAvatarUrl}" to "${updatedAdmin.avatarUrl}"`);
    }
    if (originalCreatedAt && updatedAdmin.createdAt) {
      const updatedCreatedAt = new Date(updatedAdmin.createdAt).toISOString();
      if (updatedCreatedAt !== originalCreatedAt) {
        throw new Error('Integrity check failed: createdAt timestamp was unexpectedly modified.');
      }
    }

    // 11. Integrity check: Guarantee no duplicate administrators or users were created
    const totalUsersAfter = await User.countDocuments();
    const totalAdminsAfter = await User.countDocuments({ globalRole: 'ADMIN' });

    if (totalUsersAfter !== totalUsersBefore) {
      throw new Error(
        `Integrity check failed: Total user count changed from ${totalUsersBefore} to ${totalUsersAfter}.`
      );
    }

    if (totalAdminsAfter !== totalAdminsBefore) {
      throw new Error(
        `Integrity check failed: Administrator count changed from ${totalAdminsBefore} to ${totalAdminsAfter}. Duplicate admin prevented.`
      );
    }

    // Status calculations for user summary (without exposing secrets)
    const emailWasChanged = originalEmail !== updatedAdmin.email;
    const didOldHashWorkWithNewPassword = await comparePassword(ADMIN_PASSWORD, originalPasswordHash);
    const passwordWasChanged = !didOldHashWorkWithNewPassword;

    console.log('✅ Administrator credentials synchronized successfully:');
    console.log(`   User ID:          ${updatedAdmin._id.toString()}`);
    console.log(`   Email:            ${updatedAdmin.email} (${emailWasChanged ? `updated from ${originalEmail}` : 'unchanged'})`);
    console.log(`   Full Name:        ${updatedAdmin.fullName} (preserved)`);
    console.log(`   Global Role:      ${updatedAdmin.globalRole} (preserved)`);
    console.log(`   Account Active:   ${updatedAdmin.isActive} (preserved)`);
    console.log(`   Password Status:  ${passwordWasChanged ? 'Password updated and verified via bcrypt compare' : 'Password hash refreshed and verified'}`);
    console.log(`   Total Admins:     ${totalAdminsAfter} (no duplicate created)`);

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to synchronize administrator credentials:', (error as Error).message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    process.exit(1);
  }
};

// Execute if run directly from CLI
if (require.main === module) {
  syncAdminCredentials();
}
