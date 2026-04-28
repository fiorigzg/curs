import { create } from "zustand";

import type { User } from "@/shared/api/types";

import * as storage from "./secure-storage";

const ACCESS_KEY = "curs.access";
const REFRESH_KEY = "curs.refresh";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (p: { accessToken: string; refreshToken: string; user?: User }) => Promise<void>;
  setTokens: (p: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (u: User) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  setSession: async ({ accessToken, refreshToken, user }) => {
    await storage.setItem(ACCESS_KEY, accessToken);
    await storage.setItem(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken, ...(user ? { user } : {}) });
  },

  setTokens: async ({ accessToken, refreshToken }) => {
    await storage.setItem(ACCESS_KEY, accessToken);
    await storage.setItem(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await storage.deleteItem(ACCESS_KEY);
    await storage.deleteItem(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        storage.getItem(ACCESS_KEY),
        storage.getItem(REFRESH_KEY),
      ]);
      set({ accessToken, refreshToken, hydrated: true });
    } catch {
      // На редкие сбои стораджа — поднимаем приложение в не-аутентифицированном состоянии,
      // лучше показать Login, чем висеть на спиннере.
      set({ accessToken: null, refreshToken: null, hydrated: true });
    }
  },
}));

// Не-реактивные геттеры для использования в API-клиенте.
export const authGetters = {
  access: () => useAuth.getState().accessToken,
  refresh: () => useAuth.getState().refreshToken,
};
