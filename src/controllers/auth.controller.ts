// src/controllers/auth.controller.ts
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

    // Generate verification token
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

    // TODO: Send verification email
    // For now, I'll automatically verify the account
    await this.userRepository.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: undefined,
    });
    const { password: _, ...userWithoutPass } = user;
    const formattedResponse = ResponseFormatter.success(
      userWithoutPass,
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
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedError(
        "Account is temporarily locked. Please try again later"
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await this.userRepository.incrementLoginAttempts(email);
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check email verification
    if (!user.isEmailVerified) {
      throw new UnauthorizedError("Please verify your email before logging in");
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedError("Account is disabled");
    }

    // Check session limit
    const sessionCount = await this.tokenService.getUserSessionCount(user.id);
    if (sessionCount >= AUTH_CONSTANTS.MAX_SESSIONS_PER_USER) {
      throw new BadRequestError("Maximum sessions reached");
    }

    // Reset login attempts on successful login
    await this.userRepository.resetLoginAttempts(email);

    // Generate tokens
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

    // Store refresh token and session info
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

    // Set cookies
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

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const { userId, role, tokenId } = req.user!;
    const deviceInfo = req.headers["user-agent"] || "unknown";
    const ipAddress = normalizeIpAddress(
      req.ip || req.socket.remoteAddress || "unknown"
    );

    const user = await this.userRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Generate new tokens
    const accessToken = this.tokenService.generateAccessToken(userId, role);
    const refreshToken = this.tokenService.generateRefreshToken(userId, role);

    // Blacklist old refresh token
    await this.tokenService.blacklistToken(
      tokenId,
      AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY
    );

    // Store new refresh token and update session
    const sessionInfo: SessionInfo = {
      tokenId: req.user!.tokenId,
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
        tokenId,
        refreshToken,
        deviceInfo,
        ipAddress
      ),
      this.tokenService.storeUserSession(userId, sessionInfo),
    ]);

    // Set new cookies
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

    // Revoke session and blacklist tokens
    await this.tokenService.revokeUserSession(userId, tokenId);

    // Clear cookies
    res.clearCookie("access_token", AUTH_CONSTANTS.COOKIE_OPTIONS);
    res.clearCookie("refresh_token", AUTH_CONSTANTS.COOKIE_OPTIONS);

    res.json(ResponseFormatter.success(null, "Logged out successfully", 200));
  };

  public logoutAll = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.user!;

    // Revoke all sessions
    await this.tokenService.revokeAllUserSessions(userId);

    // Clear cookies
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
