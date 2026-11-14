import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Clinic Booking",
  description: "Book an appointment with the clinic.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-foreground">
                +
              </span>
              Clinic Booking
            </Link>
            <div className="flex gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-muted hover:bg-background hover:text-foreground">
                Book
              </Link>
              <Link href="/my-bookings" className="rounded-md px-3 py-1.5 text-muted hover:bg-background hover:text-foreground">
                My bookings
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
