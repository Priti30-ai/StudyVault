import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, comparePassword } from '../src/utils/password.js';

describe('Password Utilities', () => {
  test('hashPassword hashes password and does not match plain text', async () => {
    const plain = 'SecretPassword123';
    const hash = await hashPassword(plain);

    assert.notEqual(hash, plain);
    assert.ok(hash.startsWith('$2'));
  });

  test('comparePassword returns true for matching password and false for wrong password', async () => {
    const plain = 'SecretPassword123';
    const hash = await hashPassword(plain);

    const matches = await comparePassword(plain, hash);
    const doesNotMatch = await comparePassword('WrongPassword456', hash);

    assert.equal(matches, true);
    assert.equal(doesNotMatch, false);
  });
});
