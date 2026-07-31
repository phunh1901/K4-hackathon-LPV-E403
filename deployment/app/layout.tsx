import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "https://vlearn-study-focus.example";

  return {
    title: "VLearn Study Focus",
    description:
      "Read course slides, ask grounded questions, summarize lessons, and inspect visual regions with an AI study tutor.",
    icons: {
      icon: "/logo/vinuni-mark.png",
      shortcut: "/logo/vinuni-mark.png",
    },
    openGraph: {
      title: "VLearn Study Focus",
      description: "A context-aware AI study tutor grounded in your course slides.",
      images: [`${origin}/og.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "VLearn Study Focus",
      description: "A context-aware AI study tutor grounded in your course slides.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
