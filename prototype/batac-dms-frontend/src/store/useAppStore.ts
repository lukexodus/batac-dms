import { create } from "zustand";

interface AppState {
  page: string;
  setPage: (page: string) => void;
  userRole: "mayor" | "sp";
  setUserRole: (role: "mayor" | "sp") => void;
}

export const useAppStore = create<AppState>((set) => ({
  page: new URLSearchParams(window.location.search).get("page") || "sp", // Default to SP
  setPage: (page) => {
    set({ page });
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set("page", page);
    window.history.pushState({}, "", url.toString());
  },
  userRole: "mayor",
  setUserRole: (userRole) => set({ userRole }),
}));
