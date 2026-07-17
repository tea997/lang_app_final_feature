import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { aiChat, summarizeChat } from "../controllers/ai.controller.js";

const router = express.Router();

router.use(protectRoute);

router.post("/chat", aiChat);
router.post("/summarize", summarizeChat);

export default router;
