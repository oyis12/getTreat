import express from "express";
import { getServices } from "../controllers/service-catalog.controller.js";

const router = express.Router();

router.get("/", getServices);

export default router;
