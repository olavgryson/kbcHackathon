/** Lowercase, eerste woord zonder cijfers/leestekens. */
export function normalizeMerchant(raw: string): string {
  const s = raw.slice(0, 120).toLowerCase();
  const m = /[a-zà-ÿ]+/.exec(s);
  return m ? m[0] : "onbekend";
}

export function eur(n: number): string {
  return `€${n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export function monthNameNl(isoDate: string): string {
  return MONTHS_NL[Number(isoDate.slice(5, 7)) - 1] ?? isoDate.slice(0, 7);
}

/** ms-timestamp voor date + optionele HH:mm (lokale tijd, enkel voor verschillen). */
export function toMs(date: string, time?: string): number {
  return Date.parse(`${date}T${time ?? "12:00"}:00Z`);
}
