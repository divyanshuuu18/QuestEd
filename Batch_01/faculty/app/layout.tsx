import type { Metadata } from "next";
import "./globals.css";
import "./scene3d.css";

export const metadata: Metadata = {
  title: "QuestEd Faculty",
  description: "Your teaching workspace. Track student progress, publish coursework and review submissions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
