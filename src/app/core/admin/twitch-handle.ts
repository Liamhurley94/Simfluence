/** Mirror of the backend's isValidTwitchLogin (_shared/twitch.ts): Twitch
 *  logins allow only letters, numbers and underscores, max 25 chars. Input
 *  may arrive as '@Name' or mixed case – validate the normalized login.
 *  One invalid stored handle used to poison its whole nightly Helix lookup
 *  batch (the 2026-08 `@bmsjoël` incident), so bad input is rejected at the
 *  door here as well as pre-batch server-side. */
export function isValidTwitchHandleInput(raw: string): boolean {
  const login = raw.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,25}$/.test(login);
}
