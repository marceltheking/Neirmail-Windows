import { create } from "zustand";
import type { NavKind } from "../api/types";

interface MailNav {
  kind: NavKind;
  folderId: string | null;
}

interface MailState {
  nav: MailNav;
  selectedEmailId: string | null;
  selectedIds: Set<string>;
  setNav: (nav: MailNav) => void;
  openEmail: (id: string | null) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  selectAll: (ids: string[]) => void;
}

export const useMailStore = create<MailState>((set, get) => ({
  nav: { kind: "inbox", folderId: null },
  selectedEmailId: null,
  selectedIds: new Set(),

  setNav: (nav) =>
    set((state) =>
      state.nav.kind === nav.kind && state.nav.folderId === nav.folderId
        ? state
        : { nav, selectedEmailId: null, selectedIds: new Set() },
    ),

  openEmail: (id) => set({ selectedEmailId: id }),

  toggleSelected: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next });
  },

  clearSelected: () => set({ selectedIds: new Set() }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
}));
