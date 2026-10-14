import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import {
  cancelAdminAppointment,
  createAdminAppointmentType,
  getAdminAppointment,
  listAdminAppointmentTypes,
  listAdminAppointments,
  updateAdminAppointmentType,
} from "../controllers/appointment.controller.js";
import {
  validateAdminAppointmentCancellation,
  validateAdminAppointmentListQuery,
  validateAdminAppointmentTypeListQuery,
  validateAppointmentId,
  validateAppointmentTypeCreate,
  validateAppointmentTypeUpdate,
} from "../validators/appointment.validator.js";

const router = express.Router();
router.use(protect, adminOnly, requireAdminPermission("manage_appointments"));

router.get("/types", validateAdminAppointmentTypeListQuery, listAdminAppointmentTypes);
router.post("/types", validateAppointmentTypeCreate, createAdminAppointmentType);
router.patch("/types/:typeId", validateAppointmentTypeUpdate, updateAdminAppointmentType);
router.get("/", validateAdminAppointmentListQuery, listAdminAppointments);
router.get("/:appointmentId", validateAppointmentId, getAdminAppointment);
router.post("/:appointmentId/cancel", validateAdminAppointmentCancellation, cancelAdminAppointment);

export default router;
