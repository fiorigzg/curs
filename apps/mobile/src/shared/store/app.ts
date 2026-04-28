/**
 * Global app state — соответствует useState'ам из `app.jsx` эталона:
 *   route, activePortfolio + состояние модалок.
 * Хранится в Zustand, чтобы быть доступным и в Sidebar/TopBar, и в любых экранах.
 *
 * Тема и язык вынесены в отдельный settings-store (см. store/settings.ts).
 */
import { create } from "zustand";

import type { Plan, Transaction } from "@/shared/api/types";

/** Минимум для редактирования портфеля (есть и в Summary, и в Detail). */
export interface EditablePortfolio {
  id: string;
  name: string;
  color: string;
}

export type Route = "dashboard" | "portfolio" | "analytics" | "settings";

/** Модалка добавления работает в двух режимах: сделка (сейчас) и план (будущее). */
export type TxMode = "deal" | "plan";

interface AppState {
  route: Route;
  activePortfolio: string | null;
  addTxOpen: boolean;
  addTxMode: TxMode;
  addTxPresetPortfolio: string | null;
  /** Сделка в режиме редактирования (null → модалка создаёт новую). */
  editTx: Transaction | null;
  /** План в режиме редактирования (null → модалка создаёт новый). */
  editPlan: Plan | null;
  addPortfolioOpen: boolean;
  /** Портфель в режиме редактирования (null → модалка создаёт новый). */
  editPortfolio: EditablePortfolio | null;

  setRoute: (r: Route) => void;
  setActivePortfolio: (id: string | null) => void;

  openAddTx: (presetPortfolio?: string | null) => void;
  openEditTx: (tx: Transaction) => void;
  openAddPlan: (presetPortfolio?: string | null) => void;
  openEditPlan: (plan: Plan) => void;
  closeAddTx: () => void;
  openAddPortfolio: () => void;
  openEditPortfolio: (p: EditablePortfolio) => void;
  closeAddPortfolio: () => void;
}

export const useApp = create<AppState>((set) => ({
  route: "dashboard",
  activePortfolio: null,
  addTxOpen: false,
  addTxMode: "deal",
  addTxPresetPortfolio: null,
  editTx: null,
  editPlan: null,
  addPortfolioOpen: false,
  editPortfolio: null,

  setRoute: (route) => set({ route }),
  setActivePortfolio: (id) => set({ activePortfolio: id }),

  openAddTx: (presetPortfolio = null) =>
    set({ addTxOpen: true, addTxMode: "deal", addTxPresetPortfolio: presetPortfolio, editTx: null, editPlan: null }),
  openEditTx: (tx) =>
    set({ addTxOpen: true, addTxMode: "deal", addTxPresetPortfolio: null, editTx: tx, editPlan: null }),
  openAddPlan: (presetPortfolio = null) =>
    set({ addTxOpen: true, addTxMode: "plan", addTxPresetPortfolio: presetPortfolio, editTx: null, editPlan: null }),
  openEditPlan: (plan) =>
    set({ addTxOpen: true, addTxMode: "plan", addTxPresetPortfolio: null, editTx: null, editPlan: plan }),
  closeAddTx: () =>
    set({ addTxOpen: false, addTxPresetPortfolio: null, editTx: null, editPlan: null }),
  openAddPortfolio: () => set({ addPortfolioOpen: true, editPortfolio: null }),
  openEditPortfolio: (p) => set({ addPortfolioOpen: true, editPortfolio: p }),
  closeAddPortfolio: () => set({ addPortfolioOpen: false, editPortfolio: null }),
}));
