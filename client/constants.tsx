import { User, UserRole } from './types';

export const GOOGLE_CLIENT_ID = "110932809392-l2ki70uvd6a0en9034lj1nojufmemd9e.apps.googleusercontent.com";

export const MOCK_USERS: User[] = [
  { id: 'u-1', name: 'Admin User', email: 'admin@system.com', role: UserRole.ADMIN },
  { id: 'u-2', name: 'John Refiller', email: 'john@system.com', role: UserRole.REFILLER, outletId: 'ot-1' },
  { id: 'u-3', name: 'Priya Refiller', email: 'priya@system.com', role: UserRole.REFILLER, outletId: 'ot-2' },
  { id: 'u-4', name: 'Amit Refiller', email: 'amit@system.com', role: UserRole.REFILLER, outletId: 'ot-3' },
];
