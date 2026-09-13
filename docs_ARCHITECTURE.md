# GetTreat backend domain architecture

## Identity vs domain profiles

`User` is the central identity/account model. It contains authentication,
account state, role and other identity-level data.

Role-specific data belongs in role/domain models:

```text
User
 ├── PatientProfile
 ├── ProviderProfile
 └── AdminProfile / SuperAdmin permissions
```

A role-specific profile references the owning `User` through `user`.

Do not put pregnancy, baby, provider professional data, appointments,
transactions or other domain records directly on `User`.

## Current refactor

Patient accounts now create a `PatientProfile` during signup.

Legacy patient profile fields that were previously stored on `User` are
migrated with:

```bash
npm run migrate:patient-profiles
```

The migration reads the legacy fields directly from the MongoDB collection,
creates the corresponding `PatientProfile`, then removes the legacy fields
from the `User` document.

Run the migration once against the existing database before relying on the
new schema for existing patient accounts.

New patient signups automatically create their `PatientProfile`.

Provider/Admin domain models should be added only after their approved
Figma flows and requirements are mapped, so their schemas are not invented
prematurely.
