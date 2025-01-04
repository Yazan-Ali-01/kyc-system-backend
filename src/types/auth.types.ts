import { UserRole } from "@/types/user.types";

export interface TokenPayload {
  userId: string;
  role: UserRole;
  tokenId: string;
  type: "access" | "refresh";
}

export interface SessionInfo {
  tokenId: string;
  deviceInfo: string;
  ipAddress: string;
  lastUsed: Date;
  expiryTime: Date;
}

export interface UserSession {
  userId: string;
  sessions: SessionInfo[];
}

export interface RefreshTokenData {
  tokenHash: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: Date;
  expiryTime: Date;
}

export interface RateLimitInfo {
  count: number;
  resetTime: Date;
}
