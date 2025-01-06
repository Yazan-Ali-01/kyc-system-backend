import { KycRoutes } from "@/routes/kyc.routes";
import { ReportsRoutes } from "@/routes/reports.routes";
import { Router } from "express";
import { AuthRoutes } from "./auth.routes";

const router = Router();

const authRoutes = new AuthRoutes();

router.use("/auth", authRoutes.getRouter());

router.use("/kyc", new KycRoutes().getRouter());

router.use("/reports", new ReportsRoutes().getRouter());

export default router;
