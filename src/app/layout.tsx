import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { NavLink } from "./nav-link";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = { title: "Clinic" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} antialiased`}>
      <body className="font-sans text-[15px]">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
            <Link href="/" className="font-serif text-lg font-medium">
              Clinic
            </Link>
            <NavLink href="/my-bookings">My bookings</NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-xl px-4 pt-8 pb-24">{children}</main>
      </body>
    </html>
  );
}
