import { Schema, model, Model, Types } from 'mongoose';
import { comparePassword } from '../utils/password';

export type GlobalRole = 'ADMIN' | 'USER';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface UserProfileResponse {
  _id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const toUserProfile = (user: IUser): UserProfileResponse => ({
  _id: user._id.toString(),
  email: user.email,
  fullName: user.fullName,
  avatarUrl: user.avatarUrl ?? null,
  globalRole: user.globalRole,
  isActive: user.isActive,
  createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
  updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
});

const userSchema = new Schema<IUser, {}, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    globalRole: {
      type: String,
      enum: ['ADMIN', 'USER'],
      default: 'USER',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

// Note: email index is created via { unique: true } in field definition
userSchema.index({ globalRole: 1 });

userSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  return comparePassword(candidatePassword, this.passwordHash);
};

export type UserModel = Model<IUser, {}, IUserMethods>;

export const User = model<IUser, UserModel>('User', userSchema);
