"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { href: string; children: React.ReactNode };

/** Header link that marks its own page. The path is request-time data, hence Suspense. */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<Base {...props} active={false} />}>
      <Active {...props} />
    </Suspense>
  );
}

function Active(props: Props) {
  return <Base {...props} active={usePathname() === props.href} />;
}

function Base({ href, children, active }: Props & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="text-sm text-muted underline-offset-4 hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline"
    >
      {children}
    </Link>
  );
}
