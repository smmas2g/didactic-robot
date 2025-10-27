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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
