import test from 'node:test';
import assert from 'node:assert/strict';
import AdminProfile, { adminPermissionKeys } from '../models/admin-profile.model.js';
import { validateCreateAdmin, validateUpdateAdmin } from '../validators/admin-management.validator.js';
import { requireAdminPermission } from '../middlewares/admin-permission.middleware.js';

const runValidator = (validator, req) => new Promise((resolve, reject) => {
  validator(req, {}, (error) => error ? reject(error) : resolve(req));
});

test('admin profile links to a User and has explicit false-by-default permissions', async () => {
  const profile = new AdminProfile({
    user: '507f1f77bcf86cd799439011',
    created_by: '507f1f77bcf86cd799439012',
  });
  await assert.doesNotReject(profile.validate());
  assert.equal(profile.admin_type, 'control_admin');
  for (const key of adminPermissionKeys) assert.equal(profile.permissions[key], false);
  assert.ok(adminPermissionKeys.includes('manage_appointments'));
  assert.equal(profile.permissions.manage_appointments, false);
});

test('super-admin create-admin request requires valid identity, password and explicit permission values', async () => {
  const req = { body: {
    fullname: 'Admin User',
    email: 'ADMIN@example.com',
    password: 'a-secure-password',
    permissions: { manage_providers: true, manage_patients: false },
  } };
  await runValidator(validateCreateAdmin, req);
  assert.equal(req.body.email, 'admin@example.com');
  assert.equal(req.body.role, undefined);
});

test('admin creation rejects role escalation and non-boolean permission values', async () => {
  const req = { body: {
    fullname: 'Admin User',
    email: 'admin@example.com',
    password: 'a-secure-password',
    role: 'super_admin',
    permissions: { manage_providers: true },
  } };
  await assert.rejects(runValidator(validateCreateAdmin, req), /Unknown admin account field/);

  const invalidPermission = { body: { permissions: { manage_providers: 'true' } }, params: { adminProfileId: '507f1f77bcf86cd799439011' } };
  await assert.rejects(runValidator(validateUpdateAdmin, invalidPermission), /must be a boolean/);
});

test('super admins bypass admin permission scopes while non-admin roles are denied', async () => {
  const middleware = requireAdminPermission('manage_providers');
  const superAdminNext = await new Promise((resolve) => middleware(
    { user: { role: 'super_admin' } }, {}, (error) => resolve(error ?? null)
  ));
  assert.equal(superAdminNext, null);

  const patientError = await new Promise((resolve) => middleware(
    { user: { role: 'patient' } }, {}, (error) => resolve(error ?? null)
  ));
  assert.equal(patientError.statusCode, 403);
});

test('appointment management permission is an explicit admin grant and super-admin bypass applies', async () => {
  assert.ok(adminPermissionKeys.includes('manage_appointments'));
  const middleware = requireAdminPermission('manage_appointments');
  const superAdminError = await new Promise((resolve) => middleware({ user: { role: 'super_admin' } }, {}, (error) => resolve(error ?? null)));
  assert.equal(superAdminError, null);
  const patientError = await new Promise((resolve) => middleware({ user: { role: 'patient' } }, {}, (error) => resolve(error ?? null)));
  assert.equal(patientError.statusCode, 403);
});
