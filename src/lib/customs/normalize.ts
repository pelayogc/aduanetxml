export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function compactAlnum(value: unknown) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, "");
}

export function parseDecimal(value: unknown) {
  const text = String(value ?? "")
    .replace(/kg/gi, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".")
    .trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositiveInteger(value: unknown) {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeTariff(value: unknown) {
  const compact = String(value ?? "").replace(/[^\d]/g, "");
  if (compact === "4901") return "49,01";
  if (compact.startsWith("4901")) return "49,01";
  return String(value ?? "").trim() || null;
}

export function isBooksTariff(value: unknown) {
  const compact = String(value ?? "").replace(/[^\d]/g, "");
  return compact === "4901" || compact.startsWith("4901");
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dateToIso(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 10) : null;
}
