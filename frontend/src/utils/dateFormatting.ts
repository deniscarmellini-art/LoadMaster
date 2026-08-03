const parseDateOnly = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const parseOptionalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? parseDateOnly(normalized) : new Date(normalized);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const formatOptionalDate = (value: unknown): string => {
  const date = parseOptionalDate(value);
  return date ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "—";
};
