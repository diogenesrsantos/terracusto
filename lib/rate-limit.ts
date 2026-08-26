type Attempt = { count: number; since: number };
const globalAttempts = globalThis as unknown as { loginAttempts?: Map<string, Attempt> };
const attempts = globalAttempts.loginAttempts ?? new Map<string, Attempt>();
globalAttempts.loginAttempts = attempts;

const WINDOW = 15 * 60 * 1000;
const LIMIT = 8;

export function checkLoginRate(ip: string) {
  const current = attempts.get(ip);
  if (!current || Date.now() - current.since > WINDOW) return true;
  return current.count < LIMIT;
}
export function recordLoginFailure(ip: string) {
  const current = attempts.get(ip);
  if (!current || Date.now() - current.since > WINDOW) attempts.set(ip, { count: 1, since: Date.now() });
  else current.count += 1;
}
export function resetLoginRate(ip: string) { attempts.delete(ip); }
