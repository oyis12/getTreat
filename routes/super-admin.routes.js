import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { superAdminOnly } from '../middlewares/role.middleware.js';
import { createAdmin, listAdmins, updateAdmin } from '../controllers/admin-management.controller.js';
import { validateAdminListQuery, validateCreateAdmin, validateUpdateAdmin } from '../validators/admin-management.validator.js';
import { getPlatformFinancialSettings, updatePlatformFee } from '../controllers/system.controller.js';
import { validatePlatformFeeUpdate } from '../validators/financial.validator.js';

const router = express.Router();
router.use(protect, superAdminOnly);
router.get('/platform-financial-settings', getPlatformFinancialSettings);
router.patch('/platform-financial-settings', validatePlatformFeeUpdate, updatePlatformFee);
router.get('/admins', validateAdminListQuery, listAdmins);
router.post('/admins', validateCreateAdmin, createAdmin);
router.patch('/admins/:adminProfileId', validateUpdateAdmin, updateAdmin);

export default router;
