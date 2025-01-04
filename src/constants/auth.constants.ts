export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  MAX_SESSIONS_PER_USER: 50,
  RATE_LIMIT_WINDOW: 15 * 60, // 15 minutes in seconds
  RATE_LIMIT_MAX_ATTEMPTS: 5,
  TOKEN_ISSUER: "kyc-system",
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  },
};