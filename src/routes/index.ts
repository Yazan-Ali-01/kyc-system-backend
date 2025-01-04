import { Router } from "express";
import { AuthRoutes } from "./auth.routes";
// import { TestRoutes } from "./test.routes";

const router = Router();

// Initialize route handlers
const authRoutes = new AuthRoutes();
// const testRoutes = new TestRoutes();

// Mount routes
router.use("/auth", authRoutes.getRouter());
// router.use("/test", testRoutes.getRouter());

export default router;
