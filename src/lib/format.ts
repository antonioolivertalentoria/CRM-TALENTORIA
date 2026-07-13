const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatTime(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function todayISO(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}
