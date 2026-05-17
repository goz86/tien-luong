const LOCK_KEY = 'duhoc-mate-local-app-lock';

export const LOCAL_APP_LOCK_CHANGED = 'duhoc-mate-local-app-lock-changed';
export const LOCAL_APP_LOCK_NOW = 'duhoc-mate-local-app-lock-now';

export type LocalAppLockConfig = {
  enabled: boolean;
  salt: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: number | null;
  updatedAt: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function emitChanged() {
  window.dispatchEvent(new Event(LOCAL_APP_LOCK_CHANGED));
}

export function getLocalAppLockConfig(): LocalAppLockConfig | null {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalAppLockConfig>;
    if (!parsed.enabled || !parsed.salt || !parsed.pinHash) return null;
    return {
      enabled: true,
      salt: parsed.salt,
      pinHash: parsed.pinHash,
      failedAttempts: Number(parsed.failedAttempts || 0),
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveLocalAppLockConfig(config: LocalAppLockConfig) {
  window.localStorage.setItem(LOCK_KEY, JSON.stringify(config));
  emitChanged();
}

export function isLocalAppLockEnabled() {
  return Boolean(getLocalAppLockConfig()?.enabled);
}

export async function enableLocalAppLock(pin: string) {
  const salt = randomSalt();
  const pinHash = await hashPin(pin, salt);
  saveLocalAppLockConfig({
    enabled: true,
    salt,
    pinHash,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function verifyLocalAppLockPin(pin: string) {
  const config = getLocalAppLockConfig();
  if (!config) return false;

  if (config.lockedUntil && Date.now() < config.lockedUntil) return false;

  const nextHash = await hashPin(pin, config.salt);
  const ok = nextHash === config.pinHash;
  if (ok) {
    saveLocalAppLockConfig({ ...config, failedAttempts: 0, lockedUntil: null });
    return true;
  }

  const failedAttempts = config.failedAttempts + 1;
  const lockedUntil = failedAttempts >= 5 ? Date.now() + 30_000 : null;
  saveLocalAppLockConfig({ ...config, failedAttempts, lockedUntil });
  return false;
}

export async function disableLocalAppLock(pin: string) {
  const ok = await verifyLocalAppLockPin(pin);
  if (!ok) return false;
  window.localStorage.removeItem(LOCK_KEY);
  emitChanged();
  return true;
}

export async function changeLocalAppLockPin(currentPin: string, nextPin: string) {
  const ok = await verifyLocalAppLockPin(currentPin);
  if (!ok) return false;
  await enableLocalAppLock(nextPin);
  return true;
}

export function requestLocalAppLockNow() {
  window.dispatchEvent(new Event(LOCAL_APP_LOCK_NOW));
}

export function getLocalAppLockDelayMs() {
  const lockedUntil = getLocalAppLockConfig()?.lockedUntil;
  return lockedUntil && lockedUntil > Date.now() ? lockedUntil - Date.now() : 0;
}
