// Email sign-up is invite-only: public sign-up goes through Google. A person
// who prefers email + password enters a private access code, sent by the
// operator, in the sign-up form. Fail closed: with no EMAIL_SIGNUP_ACCESS_CODE
// configured, email sign-up is disabled for everyone. Existing accounts and
// Google sign-up are unaffected.

// Compares without short-circuiting on the first differing character.
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isEmailSignupAllowed(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  const expectedCode = (expected ?? "").trim();
  if (!expectedCode) return false;
  return constantTimeEqual((provided ?? "").trim(), expectedCode);
}
