import express from "express";
import {
  getSubscriptions,
  getPreferredChoices,
  getPreferredChoice,
} from "../controllers/system.controller.js";

const router = express.Router();

router.get("/subscriptions", getSubscriptions);
router.get("/preferred-choice", getPreferredChoices);
router.get("/preferred-choice/:id", getPreferredChoice);

export default router;
