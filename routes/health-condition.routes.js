import express from "express";
import {
  getHealthConditions,
  getHealthConditionBySlug,
} from "../controllers/health-condition.controller.js";

const router = express.Router();

router.get("/", getHealthConditions);
router.get("/:slug", getHealthConditionBySlug);

export default router;
