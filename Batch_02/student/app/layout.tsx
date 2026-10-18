import type { Metadata } from "next";
import "./globals.css";
import "./scene3d.css";

export const metadata: Metadata = {
  title: "QuestEd — Your learning adventure",
  description: "Learn daily. Build momentum. Level up together.",
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased"><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('quested-theme')==='light'?'light':'dark'}catch{}"}} />{children}</body>
    </html>
  );
}
