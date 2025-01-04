import { TokenService } from "@/services/token.service";
import { TokenPayload } from "@/types/auth.types";
import { UserRole } from "@/types/user.types";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/utils/errors/custom-errors";
import Logger from "@/utils/logger";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export class AuthMiddleware {
  private static instance: AuthMiddleware;
  private tokenService: TokenService;

  private constructor() {
    this.tokenService = TokenService.getInstance();
  }

  public static getInstance(): AuthMiddleware {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }
    return AuthMiddleware.instance;
  }

  public verifyAccessToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = req.cookies["access_token"];

    if (!token) {
      throw new UnauthorizedError("Access token not found");
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET!
      ) as TokenPayload;

      if (decoded.type !== "access") {
        throw new UnauthorizedError("Invalid token type");
      }

      Logger.debug(`Verifying access token: ${decoded.tokenId}`);
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(
        decoded.tokenId
      );

      if (isBlacklisted) {
        Logger.info(
          `Blocked request with blacklisted token: ${decoded.tokenId}`
        );
        throw new UnauthorizedError("Token has been invalidated");
      }

      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        tokenId: decoded.tokenId,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Access token expired");
      }
      Logger.error("Token verification failed:", error);
      throw error;
    }
  };
  public verifyRefreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = req.cookies["refresh_token"];

    if (!token) {
      throw new UnauthorizedError("Refresh token not found");
    }

    try {
      const decoded = await this.tokenService.validateRefreshToken(token);

      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        tokenId: decoded.tokenId,
      };

      next();
    } catch (error) {
      Logger.error("Refresh token verification failed:", error);
      throw new UnauthorizedError("Invalid refresh token");
    }
  };

  public checkRole = (roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new UnauthorizedError("User not authenticated");
      }

      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError("Insufficient permissions");
      }

      next();
    };
  };
}
