export const money = (value: unknown) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(Number(value || 0));

export const number = (value: unknown, digits = 2) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}).format(Number(value || 0));

export const date = (value: Date | string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Bahia",
}).format(new Date(value));

export const monthStart = (value: string | Date) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export const businessToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), 12));
};

export const dateInput = (value: Date) => value.toISOString().slice(0, 10);

export const timeInput = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(value) : "";
