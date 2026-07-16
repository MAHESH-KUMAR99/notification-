// The client-side localStorage flag (see components/useAdmin.js) only
// controls whether the ⭐ button is rendered — it's trivially editable by
// anyone via devtools, so it is NOT a security boundary. This check, run on
// the server for every toggle request, is the actual boundary: the request
// must carry the real PIN (compared against the server-only env var) or it
// gets rejected regardless of what the client's UI state claims.
export function isValidAdminPin(pin) {
  const expected = process.env.ADMIN_PIN;
  return Boolean(expected) && pin === expected;
}
