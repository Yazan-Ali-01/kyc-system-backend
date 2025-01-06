import { AUTH_CONSTANTS } from "@/constants/auth.constants";
import { UserRepository } from "@/repositories/user.repository";
import { TokenService } from "@/services/token.service";
import { SessionInfo } from "@/types/auth.types";
import { normalizeIpAddress } from "@/utils/core";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "@/utils/errors/custom-errors";
import { ResponseFormatter } from "@/utils/response-formatter";
import { randomBytes } from "crypto";
import { Request, Response } from "express";

export class AuthController {
  private static instance: AuthController;
  private tokenService: TokenService;
  private userRepository: UserRepository;

  private constructor() {
    this.tokenService = TokenService.getInstance();
    this.userRepository = UserRepository.getInstance();
  }

  public static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController();
    }
    return AuthController.instance;
  }

  public register = async (req: Request, res: Response): Promise<void> => {
    const { email, password, firstName, lastName, role } = req.body;

    const verificationToken = randomBytes(32).toString("hex");
    const user = await this.userRepository.createUser({
      email,
      password,
      firstName,
      lastName,
      role,
      verificationToken,
      isEmailVerified: false,
    });

    await this.userRepository.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: undefined,
    });

    const tokenId = randomBytes(16).toString("hex");
    const accessToken = this.tokenService.generateAccessToken(
      user.id,
      user.role,
      tokenId
    );
    const refreshToken = this.tokenService.generateRefreshToken(
      user.id,
      user.role
    );

    const deviceInfo = req.headers["user-agent"] || "unknown";
    const ipAddress = normalizeIpAddress(
      req.ip || req.socket.remoteAddress || "unknown"
    );

    const sessionInfo: SessionInfo = {
      tokenId,
      deviceInfo,
      ipAddress,
      lastUsed: new Date(),
      expiryTime: new Date(
        Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000
      ),
    };

    await Promise.all([
      this.tokenService.storeRefreshToken(
        user.id,
        tokenId,
        refreshToken,
        deviceInfo,
        ipAddress
      ),
      this.tokenService.storeUserSession(user.id, sessionInfo),
    ]);

    res.cookie("access_token", accessToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000,
    });

    const formattedResponse = ResponseFormatter.success(
      {
        userId: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },

      "User registered successfully",
      201
    );
    res.status(201).json(formattedResponse);
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const deviceInfo = req.headers["user-agent"] || "unknown";
    const ipAddress = normalizeIpAddress(
      req.ip || req.socket.remoteAddress || "unknown"
    );

    const user = await this.userRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Email not found");
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedError(
        "Account is temporarily locked. Please try again later"
      );
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await this.userRepository.incrementLoginAttempts(email);
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedError("Please verify your email before logging in");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is disabled");
    }

    const sessionCount = await this.tokenService.getUserSessionCount(user.id);
    if (sessionCount >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
      throw new BadRequestError("Maximum sessions reached");
    }

    await this.userRepository.resetLoginAttempts(email);

    const tokenId = randomBytes(16).toString("hex");
    const accessToken = this.tokenService.generateAccessToken(
      user.id,
      user.role,
      tokenId
    );

    const refreshToken = this.tokenService.generateRefreshToken(
      user.id,
      user.role
    );

    const sessionInfo: SessionInfo = {
      tokenId,
      deviceInfo,
      ipAddress,
      lastUsed: new Date(),
      expiryTime: new Date(
        Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000
      ),
    };

    await Promise.all([
      this.tokenService.storeRefreshToken(
        user.id,
        tokenId,
        refreshToken,
        deviceInfo,
        ipAddress
      ),
      this.tokenService.storeUserSession(user.id, sessionInfo),
    ]);

    res.cookie("access_token", accessToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000,
    });

    res.json(
      ResponseFormatter.success(
        {
          userId: user.id,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        "Login successful",
        200
      )
    );
  };

  public getCurrentUser = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const { userId } = req.user!;

    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    res.json(
      ResponseFormatter.success(
        {
          userId: user.id,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        "User retrieved successfully",
        200
      )
    );
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const { userId, role, tokenId: oldTokenId } = req.user!;
    const deviceInfo = req.headers["user-agent"] || "unknown";
    const ipAddress = normalizeIpAddress(
      req.ip || req.socket.remoteAddress || "unknown"
    );

    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    const newTokenId = randomBytes(16).toString("hex");

    const accessToken = this.tokenService.generateAccessToken(
      userId,
      role,
      newTokenId
    );
    const refreshToken = this.tokenService.generateRefreshToken(userId, role);

    await this.tokenService.blacklistToken(
      oldTokenId,
      AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY
    );

    const sessionInfo: SessionInfo = {
      tokenId: newTokenId,
      deviceInfo,
      ipAddress,
      lastUsed: new Date(),
      expiryTime: new Date(
        Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000
      ),
    };

    await Promise.all([
      this.tokenService.storeRefreshToken(
        userId,
        newTokenId,
        refreshToken,
        deviceInfo,
        ipAddress
      ),
      this.tokenService.storeUserSession(userId, sessionInfo),
    ]);

    res.cookie("access_token", accessToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      ...AUTH_CONSTANTS.COOKIE_OPTIONS,
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY * 1000,
    });

    res.json(
      ResponseFormatter.success(
        {
          userId: user.id,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        "Tokens refreshed successfully",
        200
      )
    );
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const { userId, tokenId } = req.user!;

    await this.tokenService.revokeUserSession(userId, tokenId);

    res.clearCookie("access_token", AUTH_CONSTANTS.COOKIE_OPTIONS);
    res.clearCookie("refresh_token", AUTH_CONSTANTS.COOKIE_OPTIONS);

    res.json(ResponseFormatter.success(null, "Logged out successfully", 200));
  };

  public logoutAll = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;

    await this.tokenService.revokeAllUserSessions(userId);

    res.clearCookie("access_token", AUTH_CONSTANTS.COOKIE_OPTIONS);
    res.clearCookie("refresh_token", AUTH_CONSTANTS.COOKIE_OPTIONS);

    res.json(
      ResponseFormatter.success(
        null,
        "Logged out from all devices successfully",
        200
      )
    );
  };

  public getSessions = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const sessions = await this.tokenService.getUserSessions(userId);

    res.json(
      ResponseFormatter.success(
        sessions,
        "Active sessions retrieved successfully",
        200
      )
    );
  };

  public updateUser = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { email, firstName, lastName } = req.body;

    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (email && email !== user.email) {
      const existingUser = await this.userRepository.findUserByEmail(email);
      if (existingUser) {
        throw new BadRequestError("Email already in use");
      }
    }

    const updatedUser = await this.userRepository.updateUser(userId, {
      ...(email && { email }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
    });

    if (!updatedUser) {
      throw new NotFoundError("User not found");
    }

    res.json(
      ResponseFormatter.success(
        {
          userId: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
        },
        "User updated successfully",
        200
      )
    );
  };

  public revokeSession = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { sessionId } = req.params;

    const sessions = await this.tokenService.getUserSessions(userId);
    const sessionExists = sessions.some(
      (session) => session.tokenId === sessionId
    );

    if (!sessionExists) {
      throw new NotFoundError("Session not found");
    }

    await this.tokenService.revokeUserSession(userId, sessionId);

    res.json(
      ResponseFormatter.success(null, "Session revoked successfully", 200)
    );
  };
}
