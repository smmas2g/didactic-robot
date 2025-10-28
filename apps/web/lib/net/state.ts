"use client";

import { create } from "zustand";
import type { GameStateSnapshot } from "@didactic/types";

interface GameStore {
  snapshot: GameStateSnapshot | null;
  setSnapshot: (snapshot: GameStateSnapshot | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
