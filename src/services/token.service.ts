import { AUTH_CONSTANTS } from "@/constants/auth.constants";
import {
  RefreshTokenData,
  SessionInfo,
  TokenPayload,
} from "@/types/auth.types";
import { UserRole } from "@/types/user.types";
import { NotFoundError } from "@/utils/errors/custom-errors";
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

  public generateAccessToken(
    userId: string,
    role: UserRole,
    tokenId?: string
  ): string {
    const finalTokenId = tokenId || crypto.randomBytes(16).toString("hex");
    Logger.debug(`Generating access token with tokenId: ${finalTokenId}`);

    const payload: TokenPayload = {
      userId,
      role,
      tokenId: finalTokenId,
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
    const key = `blacklisted_token:${tokenId}`;
    console.log("blacklisted here");

    await client.set(key, "1");
    await client.expire(key, expiryTime);
  }

  public async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const client = this.redisClient.getClient();
    const key = `blacklisted_token:${tokenId}`;
    const result = await client.get(key);
    console.log("Checking blacklist for token:", tokenId, "Result:", result);
    return !!result;
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

    const sessionData = await client.hGet(`user_sessions:${userId}`, tokenId);
    if (!sessionData) {
      throw new NotFoundError("Session not found");
    }

    const session = JSON.parse(sessionData);

    await Promise.all([
      this.blacklistToken(tokenId, AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY),
      client.hDel(`user_sessions:${userId}`, tokenId),
      client.del(`refresh_token:${userId}:${tokenId}`),
    ]);

    Logger.info(`Session revoked for user ${userId} with token ${tokenId}`);
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

    return Object.entries(sessions).map(([tokenId, sessionStr]) => {
      const session = JSON.parse(sessionStr);
      return {
        tokenId,
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
