import Link from "next/link";
import type { RoomMessage } from "@didactic-robot/types";

const sampleMessage: RoomMessage<string> = {
  type: "welcome",
  payload: "Multiplayer ready",
};

export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 px-6 text-center text-slate-100">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Didactic Robot</h1>
        <p className="max-w-xl text-base text-slate-300 sm:text-lg">
          Kickstart your multiplayer experience with a Next.js front end and a Colyseus powered server. Shared
          types keep every client synchronized — for example: <code>{JSON.stringify(sampleMessage)}</code>.
        </p>
      </div>
      <Link
        href="/play"
        className="rounded-full bg-sky-500 px-6 py-3 text-lg font-semibold text-white shadow-lg transition hover:bg-sky-400"
      >
        Enter Playtest
      </Link>
    </main>
  );
}
