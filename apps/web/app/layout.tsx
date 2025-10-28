import type { Metadata } from "next";
import "./globals.css";

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
