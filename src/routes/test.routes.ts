// src/routes/test.routes.ts
import Logger from "@/utils/logger";
import { Router } from "express";
import { TestController } from "../controllers/test.controller";

Logger.info("Initializing test routes"); // Add this line
const router = Router();

// Add debug route to verify the router is working
router.get("/debug", (req, res) => {
  Logger.info("Debug route hit");
  res.json({ message: "Test routes are mounted" });
});

router.get("/success", TestController.getSuccess); // Simplify this route

Logger.info("Test routes initialized"); // Add this line

export default router;
