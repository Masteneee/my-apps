// Pure functions that check what users type. "Pure" means: same input, same
// output, no network or storage. That makes them easy to test (validation.test.ts).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const DISPLAY_NAME_MAX = 50;
export const PASSWORD_MIN = 6; // Supabase's default minimum

// Starts with a letter, then letters, digits or underscores, 3 to 20 chars total.
// KEEP IN SYNC with the `check` constraint in supabase/migrations/*_profiles.sql,
// so the browser and the database agree on what a valid username is.
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

// Names that would be confusing as a profile (/u/admin) or that we may want for
// pages later. Only checked here, not in the database.
export const RESERVED_USERNAMES = [
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "me",
  "media",
  "onboarding",
  "settings",
  "signup",
  "support",
  "u",
];

/** Usernames are case-insensitive: "Amasten " and "amasten" are the same name. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// A "result" type: either ok with the cleaned value, or not ok with a message
// we can show the user as-is.
export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

export function validateUsername(raw: string): ValidationResult {
  const username = normalizeUsername(raw);

  if (username.length < USERNAME_MIN) {
    return { ok: false, error: `Username must be at least ${USERNAME_MIN} characters.` };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Username must be at most ${USERNAME_MAX} characters.` };
  }
  if (!/^[a-z]/.test(username)) {
    return { ok: false, error: "Username must start with a letter." };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "Use only letters, numbers and underscores (_)." };
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return { ok: false, error: "That username is reserved. Try another one." };
  }
  return { ok: true, value: username };
}

/** Display name is optional. Empty means "no display name" (we show the username). */
export function validateDisplayName(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Display name must be at most ${DISPLAY_NAME_MAX} characters.` };
  }
  return { ok: true, value: name };
}

/**
 * Turns an email into a starting suggestion for the username field,
 * e.g. "Amasten.B-99@mail.com" becomes "amasten_b_99". The user can still change it.
 */
export function suggestUsername(email: string): string {
  const beforeAt = email.split("@")[0] ?? "";
  let name = beforeAt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // anything that isn't a letter/digit becomes "_"
    .replace(/^[^a-z]+/, "") // must start with a letter, so drop leading digits/_
    .replace(/_+$/, "") // no trailing underscores
    .slice(0, USERNAME_MAX);

  // Pad short names so the suggestion is always at least valid in length.
  while (name.length > 0 && name.length < USERNAME_MIN) name += "_";
  return name;
}

/** Basic checks before we even ask the backend. The backend checks again. */
export function validateCredentials(email: string, password: string): string | null {
  const trimmed = email.trim();
  // Not a perfect email check (none is), just catches obvious typos.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Please enter a valid email address.";
  }
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  return null; // null = no problem
}
