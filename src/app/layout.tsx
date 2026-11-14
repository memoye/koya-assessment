import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = { title: "Clinic" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="font-sans">
        <nav className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 text-sm">
          <Link href="/" className="font-semibold">
            Clinic
          </Link>
          <Link href="/my-bookings" className="text-muted hover:text-foreground">
            My bookings
          </Link>
        </nav>
        <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">{children}</main>
      </body>
    </html>
  );
}
