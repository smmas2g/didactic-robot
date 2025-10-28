import Link from "next/link";
import type { RoomMessage } from "@didactic/types";

const sampleMessage: RoomMessage<string> = {
  type: "welcome",
  payload: "Multiplayer ready"
};

export default function Home() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Welcome to Didactic Robot
      </h1>
      <p className="max-w-xl text-base text-slate-300 sm:text-lg">
        Kickstart your multiplayer experience with a Next.js front end and a Colyseus
        powered server. Share types from a central package to keep clients in sync.
      </p>
      <p className="text-sm text-slate-400">
        Example shared message type: <code>{JSON.stringify(sampleMessage)}</code>
      </p>
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
      </div>
    </section>

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Didactic Robot</h1>
        <p className="text-lg text-slate-300">
          A fast multiplayer roam &amp; tag sandbox prototype.
        </p>
      </div>
      <Link
        href="/play"
        className="rounded-full bg-sky-500 px-6 py-3 text-lg font-semibold text-white shadow-lg transition hover:bg-sky-400"
      >
        Enter Playtest
      </Link>
export default function HomePage(): JSX.Element {
  return (
    <main className="home-hero">
      <h1>Didactic Robot</h1>
      <p>
        Head over to <code>/play</code> to join the action.
      </p>
    </main>
  );
}
