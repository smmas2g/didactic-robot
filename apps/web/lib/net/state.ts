"use client";

import { create } from "zustand";
import type { ClientStateSnapshot } from "@didactic-robot/types";

interface GameStore {
  snapshot: ClientStateSnapshot | null;
  setSnapshot: (snapshot: ClientStateSnapshot | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
