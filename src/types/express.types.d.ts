import { UserRole } from "@/types/user.types";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      userId: string;
      role: UserRole;
      tokenId: string;
    };
  }
}

declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
    }
  }
}
