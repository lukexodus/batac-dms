import { create } from 'zustand';

// Mirrors the identity payload from AuthResponseSchema (E3 Part 2)
// plus the role/office data resolved after login.
// Deviation from F2: added `committeeIds` to prevent regression of LOG-0085.
export interface ActiveUserIdentity {
  userId: string;                      // UUID
  username: string;
  displayName: string;                 // computed from employee first+last, or username fallback
  sessionId: string;                   // UUID from AuthResponseSchema
  expiresAt: string;                   // ISO 8601; used to detect expiry client-side
  roleCodes: string[];                 // e.g. ["sp_secretary"], ["dept_encoder"], etc.
  officeScopeId: string | null;        // UUID of the office this role is scoped to
  officeCode: string | null;           // e.g. "SP_SEC", for display in headers
  committeeIds: string[];              // Added explicitly per TASK-WF-FE-006 (see LOG-0085)
}

interface SessionState {
  identity: ActiveUserIdentity | null; // null = unauthenticated
  isHydrated: boolean;                 // true once the store has checked initial session
}

interface SessionActions {
  setIdentity: (identity: ActiveUserIdentity) => void;
  clearIdentity: () => void;
  setHydrated: () => void;
}

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  identity: null,
  isHydrated: false,
  
  setIdentity: (identity) => set({ identity }),
  clearIdentity: () => set({ identity: null }),
  setHydrated: () => set({ isHydrated: true }),
}));
