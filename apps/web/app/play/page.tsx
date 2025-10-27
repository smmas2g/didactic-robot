"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ConnectionBanner } from "../../components/ConnectionBanner";

const GameCanvas = dynamic(() => import("../../components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-300">
      Booting arena...
    </div>
  ),
});

export default function PlayPage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <ConnectionBanner />
      <div className="flex-1">
        <Suspense fallback={<div className="p-8 text-slate-300">Loading...</div>}>
          <GameCanvas />
        </Suspense>
      </div>
    </main>
  );
}
