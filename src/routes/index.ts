import { KycRoutes } from "@/routes/kyc.routes";
import { Router } from "express";
import { AuthRoutes } from "./auth.routes";
// import { TestRoutes } from "./test.routes";

const router = Router();

// Initialize route handlers
const authRoutes = new AuthRoutes();

// Mount routes
router.use("/auth", authRoutes.getRouter());

router.use("/kyc", new KycRoutes().getRouter());

export default router;
