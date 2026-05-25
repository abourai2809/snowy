export const MAX_GELATO_PAN_WEIGHT_KG = 6;

interface WeightValidationOptions {
  fieldName?: string;
  allowZero?: boolean;
}

export function validateGelatoPanWeightKg(
  weightKg: number,
  { fieldName = "Gelato pan weight", allowZero = false }: WeightValidationOptions = {},
): string | null {
  if (!Number.isFinite(weightKg)) {
    return `${fieldName} must be a number.`;
  }

  if (weightKg < 0 || (!allowZero && weightKg === 0)) {
    return allowZero ? `${fieldName} must be zero or more.` : `${fieldName} must be greater than 0 kg.`;
  }

  if (weightKg > MAX_GELATO_PAN_WEIGHT_KG) {
    return `${fieldName} looks too high. Enter kilograms, not grams. Use 6 instead of 6000.`;
  }

  return null;
}
