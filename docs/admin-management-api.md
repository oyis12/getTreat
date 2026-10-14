# Admin and Super Admin API

This implementation covers super-admin bootstrapping, Control Admin account
management, explicit admin permission records, admin sign-in OTP verification, and
permission gates for provider approval and health-condition configuration. It does not
implement every admin dashboard section in the Figma exports.

## 1. Bootstrap the initial Super Admin

Public signup only accepts `patient` and `provider`. Bootstrap the first super admin
from an operator-controlled terminal connected to a non-production database. Set
environment variables for the command; do not commit their values:

```powershell
$env:ALLOW_SUPER_ADMIN_BOOTSTRAP = "true"
$env:SUPER_ADMIN_FULLNAME = "Platform Owner"
$env:SUPER_ADMIN_EMAIL = "owner@example.com"
$env:SUPER_ADMIN_PASSWORD = "Use-a-long-unique-password"
npm run bootstrap:super-admin
```

The command creates an active, email-verified `super_admin`. It refuses to elevate an
existing non-super-admin account. If any super-admin already exists, it makes no
changes. The password is hashed before storage. Clear these environment variables
after use.

## 2. Admin authentication

Admins and super admins use the existing signin route. Password sign-in sends a
short-lived one-time code; no tokens are issued until the code is verified.

```http
POST {{base_url}}/api/auth/signin
Content-Type: application/json
```

```json
{ "email": "owner@example.com", "password": "your-password" }
```

The response data for an admin contains `requires_2fa: true`, their email, and the
expiry window. Verify the code:

```http
POST {{base_url}}/api/auth/admin/2fa/verify
Content-Type: application/json
```

```json
{ "email": "owner@example.com", "code": "123456" }
```

On success, the response contains the normal sanitized user object and access and
refresh tokens. Resend is limited to once per minute:

```http
POST {{base_url}}/api/auth/admin/2fa/resend
Content-Type: application/json
```

```json
{ "email": "owner@example.com" }
```

A newly created admin first verifies the account creation email code through
`POST /api/auth/verify`; admin 2FA is a separate challenge after password sign-in.

## 3. Create and manage Control Admin accounts

Only an authenticated `super_admin` can use these routes. A Control Admin is stored as
role `admin` with an `AdminProfile` linked to the central `User`. New accounts require
email verification. The caller cannot provide or override `role`.

Create an admin:

```http
POST {{base_url}}/api/super-admin/admins
Authorization: Bearer {{super_admin_access_token}}
Content-Type: application/json
```

```json
{
  "fullname": "Admin Name",
  "email": "admin@example.com",
  "password": "Use-a-long-unique-password",
  "permissions": {
    "manage_patients": true,
    "manage_providers": true,
    "manage_content": false,
    "manage_notifications": false,
    "manage_support": false,
    "manage_assessments": false,
    "manage_community": false,
    "manage_transactions": false,
    "manage_appointments": false,
    "manage_admins": false
  }
}
```

All permission keys are booleans. `manage_admins` is stored for future use; admin
account management remains super-admin-only.

List admins:

```http
GET {{base_url}}/api/super-admin/admins?page=1&limit=20&search=admin
Authorization: Bearer {{super_admin_access_token}}
```

Update selected permissions and/or account status. Use the admin profile `id` returned
by create/list. Supported account states are `active`, `suspended`, and `deactivated`.

```http
PATCH {{base_url}}/api/super-admin/admins/{{admin_profile_id}}
Authorization: Bearer {{super_admin_access_token}}
Content-Type: application/json
```

```json
{
  "permissions": { "manage_providers": true },
  "account_status": "active"
}
```

## 4. Current admin permission gates

- `GET /api/admin/providers` and provider approval require `manage_providers` for an
  `admin`; a `super_admin` can use them directly.
- `/api/admin/health-conditions` requires `manage_assessments` for an `admin`; a
  `super_admin` can use it directly.
- Admin account creation, listing, and updates always require `super_admin`.
- Patient management, content, community, support, reporting, settings, and transaction
  admin APIs remain future mapped work.
- `403` indicates role or permission denial; `409` indicates the email already belongs
  to an account.
