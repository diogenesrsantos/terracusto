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
