import assert from 'node:assert/strict';
import test from 'node:test';

import { getPhoneVerificationRedirect } from './phoneVerificationRoute.ts';

test('keeps the phone verification route open even when profile says verified', () => {
  assert.equal(getPhoneVerificationRedirect(true, 'phone-verification'), null);
});

test('redirects an unverified customer from protected routes to verification', () => {
  assert.equal(getPhoneVerificationRedirect(false, 'account'), '/phone-verification');
  assert.equal(getPhoneVerificationRedirect(false, 'home'), '/phone-verification');
});

test('does not redirect a verified customer from other protected routes', () => {
  assert.equal(getPhoneVerificationRedirect(true, 'account'), null);
  assert.equal(getPhoneVerificationRedirect(true, 'phone-verification-success'), null);
});
