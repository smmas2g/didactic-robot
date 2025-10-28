import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Didactic Robot",
  description: "Colyseus-powered multiplayer starter"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
          {children}
        </main>
      </body>

export const metadata: Metadata = {
  title: "Didactic Robot",
  description: "Multiplayer roam & tag sandbox prototype",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Didactic Robot",
  description: "Multiplayer playground powered by Colyseus",
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
