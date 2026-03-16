export type UserRole = "super_admin" | "admin";

export interface AuthSession {
  username: string;
  displayName: string;
  role: UserRole;
  loginAt: string;
}

interface CredentialRecord {
  username: string;
  displayName: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
}

const AUTH_STORAGE_KEY = "dashboardAuthSession";

// Passwords are stored as salted hashes (demo-only client-side auth).
const CREDENTIALS: CredentialRecord[] = [
  {
    username: "vb",
    displayName: "Super Admin",
    role: "super_admin",
    salt: "rbg-super-2026",
    passwordHash: "706b00cc8a4ae121cf629ca8e603e705f61514ba1547331233bef0790dfeafa0",
  },
  {
    username: "coersuser",
    displayName: "Admin",
    role: "admin",
    salt: "rbg-admin-2026",
    passwordHash: "871b474c338e799ac1ad4ebff74b16235c6c72dbcf9bfedcdc6746e833e72f1c",
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateUser(username: string, password: string): Promise<AuthSession | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const record = CREDENTIALS.find((item) => item.username === normalizedUsername);

  if (!record) {
    return null;
  }

  const computedHash = await sha256Hex(`${record.salt}:${password}`);
  if (!timingSafeEqual(computedHash, record.passwordHash)) {
    return null;
  }

  return {
    username: record.username,
    displayName: record.displayName,
    role: record.role,
    loginAt: new Date().toISOString(),
  };
}

export function storeSession(session: AuthSession): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.username || !parsed?.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
}
