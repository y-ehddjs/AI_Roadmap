import { validateEmail, validatePassword } from '../lib/auth';

test('accepts a well-formed email', () => {
  expect(validateEmail('user@example.com')).toBe(true);
});

test('rejects an email without an @', () => {
  expect(validateEmail('userexample.com')).toBe(false);
});

test('accepts an 8-character password', () => {
  expect(validatePassword('abcd1234')).toBe(true);
});

test('rejects a password shorter than 8 characters', () => {
  expect(validatePassword('abc123')).toBe(false);
});
