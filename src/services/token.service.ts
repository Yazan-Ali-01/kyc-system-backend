import { AUTH_CONSTANTS } from "@/constants/auth.constants";
import {
  RefreshTokenData,
  SessionInfo,
  TokenPayload,
} from "@/types/auth.types";
import { UserRole } from "@/types/user.types";
import Logger from "@/utils/logger";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { RedisService } from "./redis.service";

export class TokenService {
  private static instance: TokenService;
  private redisClient: RedisService;

  private constructor() {
    this.redisClient = RedisService.getInstance();
  }

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  public generateAccessToken(userId: string, role: UserRole): string {
    const tokenId = crypto.randomBytes(16).toString("hex");
    const payload: TokenPayload = {
      userId,
      role,
      tokenId,
      type: "access",
    };

    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY,
      issuer: AUTH_CONSTANTS.TOKEN_ISSUER,
    });
  }

  public generateRefreshToken(userId: string, role: UserRole): string {
    const tokenId = crypto.randomBytes(16).toString("hex");
    const payload: TokenPayload = {
      userId,
      role,
      tokenId,
      type: "refresh",
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY,
      issuer: AUTH_CONSTANTS.TOKEN_ISSUER,
    });
  }

  public async storeRefreshToken(
    userId: string,
    tokenId: string,
    token: string,
    deviceInfo: string,
    ipAddress: string
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const refreshTokenData: RefreshTokenData = {
      tokenHash,
      deviceInfo,
      ipAddress,
      createdAt: new Date(),
      expiryTime: new Date(
        Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000
      ),
    };

    const client = this.redisClient.getClient();
    const key = `refresh_token:${userId}:${tokenId}`;

    await client.set(key, JSON.stringify(refreshTokenData));
    await client.expire(key, AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY);
  }

  public async storeUserSession(
    userId: string,
    sessionInfo: SessionInfo
  ): Promise<void> {
    const client = this.redisClient.getClient();
    const key = `user_sessions:${userId}`;

    try {
      await client.hSet(key, sessionInfo.tokenId, JSON.stringify(sessionInfo));
      await client.expire(key, AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY);
    } catch (error) {
      Logger.error("Error storing user session:", error);
      throw error;
    }
  }

  public async blacklistToken(
    tokenId: string,
    expiryTime: number
  ): Promise<void> {
    const client = this.redisClient.getClient();
    const key = `blacklisted_tokens:${tokenId}`;

    await client.set(key, "1");
    await client.expire(key, expiryTime);
  }

  public async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const client = this.redisClient.getClient();
    const exists = await client.exists(`blacklisted_tokens:${tokenId}`);
    return exists === 1;
  }

  public async validateRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET!
      ) as TokenPayload;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      const isBlacklisted = await this.isTokenBlacklisted(decoded.tokenId);
      if (isBlacklisted) {
        throw new Error("Token has been blacklisted");
      }

      return decoded;
    } catch (error) {
      Logger.error("Refresh token validation failed:", error);
      throw error;
    }
  }

  public async revokeUserSession(
    userId: string,
    tokenId: string
  ): Promise<void> {
    const client = this.redisClient.getClient();

    await Promise.all([
      client.hDel(`user_sessions:${userId}`, tokenId),
      this.blacklistToken(tokenId, AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY),
    ]);
  }

  public async revokeAllUserSessions(userId: string): Promise<void> {
    const client = this.redisClient.getClient();
    const sessions = await client.hGetAll(`user_sessions:${userId}`);

    const blacklistPromises = Object.keys(sessions).map((tokenId) =>
      this.blacklistToken(tokenId, AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY)
    );

    await Promise.all([
      client.del(`user_sessions:${userId}`),
      ...blacklistPromises,
    ]);
  }

  public async getUserSessionCount(userId: string): Promise<number> {
    const client = this.redisClient.getClient();
    const sessions = await client.hGetAll(`user_sessions:${userId}`);
    return Object.keys(sessions).length;
  }

  public async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const client = this.redisClient.getClient();
    const sessions = await client.hGetAll(`user_sessions:${userId}`);

    return Object.values(sessions).map((sessionStr) => {
      const session = JSON.parse(sessionStr);
      return {
        ...session,
        lastUsed: new Date(session.lastUsed),
        expiryTime: new Date(session.expiryTime),
      };
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
