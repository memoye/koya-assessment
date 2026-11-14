// Muted tints so each doctor is recognisable at a glance without looking loud.
const TINTS = [
  ["#e7efe9", "#1f5135"],
  ["#f1e9df", "#7a4a1d"],
  ["#e5ecf4", "#1f4a7a"],
  ["#f3e7ec", "#7a2a4a"],
  ["#ebe8f4", "#46377a"],
];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letters = name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [bg, fg] = TINTS[hash % TINTS.length];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-serif font-medium"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.42 }}
    >
      {letters}
    </span>
  );
}
