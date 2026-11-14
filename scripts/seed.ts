/**
 * Seeds demo slots through the public API (POST /reset — wipes existing bookings).
 *
 *   BASE_URL=https://your-app.vercel.app API_KEY=... npm run seed
 *
 * Creates 30-minute slots for three providers over the next 5 weekdays.
 */
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY is required");

const providers = [
  { name: "Dr Ade", hours: [9, 10, 11, 14, 15] },
  { name: "Dr Bello", hours: [9, 11, 13, 16] },
  { name: "Dr Chen", hours: [10, 12, 14, 15, 16] },
];

const slots: { id: string; provider: string; start: string; end: string }[] = [];
const day = new Date();
day.setUTCHours(0, 0, 0, 0);
let added = 0;
while (added < 5) {
  day.setUTCDate(day.getUTCDate() + 1);
  if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
  added++;
  for (const p of providers) {
    for (const h of p.hours) {
      for (const m of [0, 30]) {
        const start = new Date(day);
        start.setUTCHours(h, m);
        const end = new Date(start.getTime() + 30 * 60_000);
        const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
        slots.push({ id: `s${slots.length + 1}`, provider: p.name, start: fmt(start), end: fmt(end) });
      }
    }
  }
}

async function main() {
  const res = await fetch(`${BASE_URL}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
    body: JSON.stringify({ slots }),
  });
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
}

main();
