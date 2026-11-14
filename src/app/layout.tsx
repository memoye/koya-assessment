import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { Stethoscope } from "lucide-react";
import { NavLink } from "./nav-link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = { title: "Clinic" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="font-sans">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
                <Stethoscope size={17} aria-hidden />
              </span>
              Clinic
            </Link>
            <NavLink href="/my-bookings">My bookings</NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-2xl px-4 pt-8 pb-24">{children}</main>
      </body>
    </html>
  );
}
