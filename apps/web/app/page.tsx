import Link from "next/link";

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
