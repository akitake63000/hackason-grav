import type { Metadata } from "next";
import "./globals.css";

// Validate environment variables at build/startup time
import { validateAllEnvVars } from "@/lib/env-validator";
validateAllEnvVars();

export const metadata: Metadata = {
  title: "HairGuard Agent",
  description: "薄毛対策の継続を支える介入型エージェント（MVP）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
