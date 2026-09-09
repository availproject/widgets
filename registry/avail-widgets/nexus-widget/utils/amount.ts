import Decimal from "decimal.js";

// Read the amount as one number. Removing all nonnumeric characters would turn
// a legacy balance label such as "10 USDT0" into "100".
const AMOUNT_PATTERN = /^[\s$€£¥≈<>]*([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s+\S+|%)?\s*$/i;

export const parseAmount = (value: unknown): Decimal | undefined => {
  if (Decimal.isDecimal(value)) return value.isFinite() ? value : undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const match = String(value).trim().match(AMOUNT_PATTERN);
  if (!match) return undefined;
  try {
    const amount = new Decimal(match[1].replace(/,/g, ""));
    return amount.isFinite() ? amount : undefined;
  } catch {
    return undefined;
  }
};
