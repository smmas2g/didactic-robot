"use client";

import { useEffect, useState } from "react";
import { getGameClient } from "../lib/net/client";

export function ConnectionBanner(): JSX.Element {
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const client = getGameClient();
    const unsubscribeConnection = client.subscribeConnection(setConnected);
    const unsubscribeLatency = client.subscribeLatency((nextLatency) => {
      setLatency(Number.isFinite(nextLatency) ? Math.round(nextLatency) : null);
    });
    return () => {
      unsubscribeConnection();
      unsubscribeLatency();
    };
  }, []);

  return (
    <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-sm text-slate-200">
      <span className="font-semibold">Connection</span>
      <span className={connected ? "text-emerald-400" : "animate-pulse text-amber-400"}>
        {connected ? "Online" : "Reconnecting"}
      </span>
      <span className="text-slate-400">{latency !== null ? `${latency} ms` : "--"}</span>
    </div>
  );
}
