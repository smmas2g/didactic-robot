"use client";

import { create } from "zustand";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface UiState {
  connectionStatus: ConnectionStatus;
  ping: number | null;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPing: (ping: number | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  connectionStatus: "disconnected",
  ping: null,
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setPing: (ping) => set({ ping }),
}));
