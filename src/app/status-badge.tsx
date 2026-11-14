export function StatusBadge({ status }: { status: "confirmed" | "cancelled" }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "confirmed" ? "bg-accent-soft text-accent" : "bg-border text-muted"
      }`}
    >
      {status === "confirmed" ? "Confirmed" : "Cancelled"}
    </span>
  );
}
