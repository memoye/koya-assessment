import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-5 -ml-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft size={16} aria-hidden />
      {children}
    </Link>
  );
}
