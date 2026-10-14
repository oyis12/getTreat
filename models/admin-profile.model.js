import mongoose from 'mongoose';

const { Schema } = mongoose;

export const adminPermissionKeys = [
  'manage_patients',
  'manage_providers',
  'manage_content',
  'manage_notifications',
  'manage_support',
  'manage_assessments',
  'manage_community',
  'manage_transactions',
  'manage_admins',
];

const permissionSchema = new Schema(
  Object.fromEntries(adminPermissionKeys.map((key) => [key, { type: Boolean, default: false }])),
  { _id: false }
);

const adminProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    admin_type: { type: String, enum: ['control_admin'], default: 'control_admin', required: true },
    permissions: { type: permissionSchema, default: () => ({}) },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    modified_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'modifiedAt' }, versionKey: false }
);

const AdminProfile = mongoose.model('AdminProfile', adminProfileSchema);
export default AdminProfile;
