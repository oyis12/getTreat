import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/user.model.js';
import Verification from '../models/verification.model.js';
import RefreshToken from '../models/refresh-token.model.js';
import { hashOtp } from '../utils/otp.js';
import { verifyAdminLoginCode } from '../services/auth.service.js';

const setupChallenge = (t, { attempts = 0 } = {}) => {
  const user = new User({
    fullname: 'Control Admin',
    email: 'admin@example.com',
    role: 'admin',
    emailVerified: true,
    accountStatus: 'active',
    page: 'dashboard',
  });
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(user, 'save', async () => user);

  const verification = {
    codeHash: hashOtp('123456'),
    expiresAt: new Date(Date.now() + 60_000),
    attempts,
    maxAttempts: 5,
    verifiedAt: null,
    save: async () => {},
    deleteOne: async () => {},
  };
  t.mock.method(Verification, 'findOne', () => ({
    sort() { return this; },
    select: async () => verification,
  }));
  return { user, verification };
};

test('admin 2FA rejects an incorrect code and counts the attempt', async (t) => {
  const { verification } = setupChallenge(t);
  await assert.rejects(
    verifyAdminLoginCode('admin@example.com', '000000', {}),
    { statusCode: 401 }
  );
  assert.equal(verification.attempts, 1);
});

test('admin 2FA issues tokens only after a valid one-time code', async (t) => {
  const { verification } = setupChallenge(t);
  let tokenRecord;
  t.mock.method(RefreshToken, 'create', async (payload) => { tokenRecord = payload; return payload; });

  const result = await verifyAdminLoginCode('admin@example.com', '123456', {
    ip: '127.0.0.1',
    get: () => 'unit-test-agent',
  });

  assert.equal(result.user.role, 'admin');
  assert.ok(result.access_token);
  assert.ok(result.refresh_token);
  assert.equal(verification.verifiedAt instanceof Date, true);
  assert.equal(tokenRecord.user.toString(), result.user.id);
});
