import { User, UserRole } from '../types';

const TOKEN_KEY = 'token';
const USER_KEY = 'sm_user';
export const SESSION_EXPIRED_EVENT = 'stockflow:session-expired';
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode / quota) – session stays in memory only */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// In-memory copies so every request does not re-read and re-parse localStorage.
let cachedToken: string | null = safeStorage.get(TOKEN_KEY);
let cachedUser: User | null = parseUser(safeStorage.get(USER_KEY));

function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    if (!user || typeof user.id !== 'number' || !user.role || !user.name) return null;
    return user;
  } catch {
    return null;
  }
}

/** Returns true when the JWT carries an `exp` claim that is already in the past. */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' && json.exp * 1000 <= Date.now();
  } catch {
    return false; // not a decodable JWT – let the server decide
  }
}

export const session = {
  getToken: () => cachedToken,
  getUser: () => cachedUser,

  /** Restores a stored session, discarding it if it is incomplete or expired. */
  restore(): User | null {
    if (!cachedToken || !cachedUser || isTokenExpired(cachedToken)) {
      session.clear();
      return null;
    }
    return cachedUser;
  },

  save(user: User, token: string) {
    cachedToken = token;
    cachedUser = user;
    safeStorage.set(TOKEN_KEY, token);
    safeStorage.set(USER_KEY, JSON.stringify(user));
  },

  clear() {
    cachedToken = null;
    cachedUser = null;
    safeStorage.remove(TOKEN_KEY);
    safeStorage.remove(USER_KEY);
  },

  isAdmin: () => Boolean(cachedToken) && cachedUser?.role === UserRole.ADMIN,

  /** Called by the API layer on HTTP 401: clears the session and notifies the app shell. */
  expire() {
    const hadSession = Boolean(cachedToken);
    session.clear();
    if (hadSession) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  },
};
