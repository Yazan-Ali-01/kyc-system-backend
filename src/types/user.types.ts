export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export enum KYCStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface IUserBase {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
}

export interface IUserDocument extends IUserBase {
  password: string;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface KYCDocument {
  id: string;
  userId: string;
  name: string;
  email: string;
  documentUrl: string;
  status: KYCStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
