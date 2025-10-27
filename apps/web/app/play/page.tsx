"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { useUiStore } from "../../stores/uiStore";
import type { ConnectionStatus } from "../../stores/uiStore";

const GameCanvas = dynamic(() => import("../../components/GameCanvas"), {
  ssr: false,
});

const statusColors: Record<ConnectionStatus, string> = {
  disconnected: "#ef4444",
  connecting: "#f59e0b",
  connected: "#22c55e",
  error: "#ef4444",
};

const PlayPage = () => {
  const connectionStatus = useUiStore((state) => state.connectionStatus);
  const ping = useUiStore((state) => state.ping);
  const setConnectionStatus = useUiStore((state) => state.setConnectionStatus);
  const setPing = useUiStore((state) => state.setPing);

  useEffect(() => {
    setConnectionStatus("connecting");

    const timeout = setTimeout(() => {
      setConnectionStatus("connected");
      setPing(42);
    }, 1200);

    return () => {
      clearTimeout(timeout);
      setConnectionStatus("disconnected");
      setPing(null);
    };
  }, [setConnectionStatus, setPing]);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "2rem",
        maxWidth: "960px",
        margin: "0 auto",
        color: "#f8fafc",
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>Play</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            fontSize: "0.95rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "0.75rem",
                height: "0.75rem",
                borderRadius: "50%",
                background: statusColors[connectionStatus],
                boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
              }}
            />
            <span>Connection: {connectionStatus}</span>
          </div>
          <div>Ping: {ping === null ? "--" : `${ping}ms`}</div>
        </div>
      </header>

      <section>
        <GameCanvas width={800} height={600} />
      </section>
    </main>
  );
};

export default PlayPage;
