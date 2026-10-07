/**
 * Device Authentication Utility for Formare 3D
 * Requires entering the master key 'JoRgEchorch' once per device/browser.
 * Once verified, the device is authorized permanently in localStorage.
 */

const AUTH_STORAGE_KEY = 'formare3d_device_auth_v1';
const MASTER_KEY = 'JoRgEchorch';

// Deterministic signature for valid authorization
const VALID_TOKEN_PREFIX = 'f3d_auth_granted_';

function generateDeviceSignature(): string {
  const ts = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${VALID_TOKEN_PREFIX}${ts}_${randomPart}`;
}

/**
 * Checks if this device/browser has already been authorized.
 */
export function isDeviceAuthorized(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!token) return false;
    return token.startsWith(VALID_TOKEN_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Attempts to authorize the device with the provided access code.
 * Returns true if successful, false otherwise.
 */
export function verifyAndAuthorizeDevice(inputCode: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const cleanInput = inputCode.trim();
  if (cleanInput === MASTER_KEY) {
    try {
      const signature = generateDeviceSignature();
      localStorage.setItem(AUTH_STORAGE_KEY, signature);
      // Secondary fallback
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, signature);
      } catch {
        // ignore
      }
      return true;
    } catch (e) {
      console.error('Error saving device authorization:', e);
      return false;
    }
  }

  return false;
}

/**
 * Optional: Revoke device authorization (for security or testing).
 */
export function revokeDeviceAuthorization(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}
