"use client";

import { useEffect, useState } from "react";
import { createGameClient } from "../lib/net/client";

export function ConnectionBanner() {
  const [latency, setLatency] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = createGameClient();
    let handle: ReturnType<typeof setInterval> | undefined;

    function updateLatency() {
      const value = client.getLatency();
      setLatency(Number.isFinite(value) ? Math.round(value) : null);
    }

    const unsubConnection = client.subscribeConnection((isConnected) => {
      setConnected(isConnected);
    });

    handle = setInterval(updateLatency, 1000);
    updateLatency();

    return () => {
      unsubConnection();
      if (handle) clearInterval(handle);
    };
  }, []);

  return (
    <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-sm text-slate-200">
      <span className="font-semibold">Connection</span>
      <span
        className={
          connected ? "text-emerald-400" : "animate-pulse text-amber-400"
        }
      >
        {connected ? "Online" : "Reconnecting"}
      </span>
      <span className="text-slate-400">
        {latency !== null ? `${latency} ms` : "--"}
      </span>
    </div>
  );
}
