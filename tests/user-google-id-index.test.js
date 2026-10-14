import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/user.model.js';

test('local users do not store a null Google ID', () => {
  const first = new User({
    fullname: 'Local User One',
    email: 'one@example.com',
    password: 'hashed-password',
    role: 'provider',
    auth: { providers: { local: { enabled: true }, google: { enabled: false } } },
  });
  const second = new User({
    fullname: 'Local User Two',
    email: 'two@example.com',
    password: 'hashed-password',
    role: 'provider',
    auth: { providers: { local: { enabled: true }, google: { enabled: false } } },
  });

  assert.equal(first.auth.providers.google.googleId, undefined);
  assert.equal(second.auth.providers.google.googleId, undefined);
});

test('Google IDs remain uniquely indexed only when a string ID is present', () => {
  const googleIdIndex = User.schema.indexes().find(
    ([fields]) => fields['auth.providers.google.googleId'] === 1
  );

  assert.ok(googleIdIndex);
  assert.equal(googleIdIndex[1].unique, true);
  assert.deepEqual(googleIdIndex[1].partialFilterExpression, {
    'auth.providers.google.googleId': { $type: 'string' },
  });

  const googleUser = new User({
    fullname: 'Google User',
    email: 'google@example.com',
    auth: {
      providers: {
        local: { enabled: false },
        google: { enabled: true, googleId: 'google-account-123' },
      },
    },
  });
  assert.equal(googleUser.auth.providers.google.googleId, 'google-account-123');
});
