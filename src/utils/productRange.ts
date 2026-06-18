import type { Product } from "../types";

export type NumericRange = {
  min: number;
  max: number;
};

export const catalogAgeYearsRange: NumericRange = {
  min: 1,
  max: 18,
};

export const catalogAgeMonthsRange: NumericRange = {
  min: catalogAgeYearsRange.min * 12,
  max: catalogAgeYearsRange.max * 12,
};

export const catalogWeightKgRange: NumericRange = {
  min: 5,
  max: 40,
};

type ProductRangeFields = Pick<
  Product,
  | "ageGroup"
  | "ageMinMonths"
  | "ageMaxMonths"
  | "weightRange"
  | "weightMinKg"
  | "weightMaxKg"
>;

export function getProductAgeRange(product: ProductRangeFields) {
  return (
    normalizeNumericRangeFromValues(product.ageMinMonths, product.ageMaxMonths) ||
    parseAgeRangeToMonths(product.ageGroup)
  );
}

export function getProductWeightRange(product: ProductRangeFields) {
  return (
    normalizeNumericRangeFromValues(product.weightMinKg, product.weightMaxKg) ||
    parseWeightRangeToKg(product.weightRange)
  );
}

export function parseAgeRangeToMonths(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|đến|to)?\s*(\d+(?:[.,]\d+)?)?\s*(tháng|tuổi)?/,
  );

  if (!match) {
    return null;
  }

  const firstValue = parseLocalizedNumber(match[1]);
  const secondValue = match[2] ? parseLocalizedNumber(match[2]) : firstValue;
  const multiplier = match[3] === "tháng" ? 1 : 12;

  return normalizeNumericRange({
    min: firstValue * multiplier,
    max: secondValue * multiplier,
  });
}

export function parseWeightRangeToKg(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|đến|to)?\s*(\d+(?:[.,]\d+)?)?\s*(?:kg)?/,
  );

  if (!match) {
    return null;
  }

  const firstValue = parseLocalizedNumber(match[1]);
  const secondValue = match[2] ? parseLocalizedNumber(match[2]) : firstValue;

  return normalizeNumericRange({
    min: firstValue,
    max: secondValue,
  });
}

export function normalizeNumericRange(range: NumericRange) {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    return null;
  }

  return {
    min: Math.min(range.min, range.max),
    max: Math.max(range.min, range.max),
  };
}

export function normalizeNumericRangeFromValues(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (min === null || min === undefined || max === null || max === undefined) {
    return null;
  }

  return normalizeNumericRange({ min, max });
}

export function rangeIncludesValue(range: NumericRange | null, value: number) {
  return Boolean(range && value >= range.min && value <= range.max);
}

export function formatAgeMonths(value: number) {
  if (value < 12) {
    return `${formatNumber(value)} tháng`;
  }

  if (value % 12 === 0) {
    return `${formatNumber(value / 12)} tuổi`;
  }

  const years = Math.floor(value / 12);
  const months = value % 12;

  return `${years} tuổi ${formatNumber(months)} tháng`;
}

export function formatAgeYears(value: number) {
  return `${formatNumber(value)} tuổi`;
}

export function formatWeightKg(value: number) {
  return `${formatNumber(value)}kg`;
}

export function formatAgeRangeLabel(range: NumericRange | null) {
  if (!range) {
    return "";
  }

  if (range.min === range.max) {
    return formatAgeMonths(range.min);
  }

  const minYears = range.min / 12;
  const maxYears = range.max / 12;

  if (Number.isInteger(minYears) && Number.isInteger(maxYears)) {
    return `${formatNumber(minYears)}-${formatNumber(maxYears)} tuổi`;
  }

  return `${formatAgeMonths(range.min)}-${formatAgeMonths(range.max)}`;
}

export function formatWeightRangeLabel(range: NumericRange | null) {
  if (!range) {
    return "";
  }

  if (range.min === range.max) {
    return formatWeightKg(range.min);
  }

  return `${formatNumber(range.min)}-${formatNumber(range.max)}kg`;
}

function parseLocalizedNumber(value: string) {
  return Number(value.replace(",", "."));
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}
