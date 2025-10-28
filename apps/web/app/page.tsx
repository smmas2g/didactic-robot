import Link from "next/link";
import type { RoomMessage } from "@didactic/types";

const sampleMessage: RoomMessage<string> = {
  type: "welcome",
  payload: "Multiplayer ready",
};

export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to Didactic Robot
        </h1>
        <p className="max-w-xl text-base text-slate-300 sm:text-lg">
          Kickstart your multiplayer experience with a Next.js front end and a
          Colyseus powered server. Share types from a central package to keep
          clients in sync.
        </p>
        <p className="text-sm text-slate-400">
          Example shared message type: <code>{JSON.stringify(sampleMessage)}</code>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="https://nextjs.org/docs"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
        >
          Next.js Docs
        </Link>
        <Link
          href="https://docs.colyseus.io/"
          className="rounded-md border border-slate-200/40 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-200"
        >
          Colyseus Docs
        </Link>
        <Link
          href="/play"
          className="rounded-md border border-slate-200/40 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-200"
        >
          Enter Playtest
        </Link>
      </div>
    </main>
  );
}
