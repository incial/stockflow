import { User, UserRole } from './types';

export const GOOGLE_CLIENT_ID = "110932809392-l2ki70uvd6a0en9034lj1nojufmemd9e.apps.googleusercontent.com";

export const MOCK_USERS: User[] = [
  { id: 1001, name: 'Admin User', email: 'admin@system.com', role: UserRole.ADMIN },
  { id: 1002, name: 'Rajesh Kumar', email: 'rajesh@system.com', role: UserRole.REFILLER, outletId: 101 },
  { id: 1003, name: 'Priya Sharma', email: 'priya@system.com', role: UserRole.REFILLER, outletId: 102 },
  { id: 1004, name: 'Amit Patel', email: 'amit@system.com', role: UserRole.REFILLER, outletId: 103 },
  { id: 1005, name: 'Sneha Reddy', email: 'sneha@system.com', role: UserRole.REFILLER, outletId: 104 },
  { id: 1006, name: 'Vikram Singh', email: 'vikram@system.com', role: UserRole.REFILLER, outletId: 105 },
];
