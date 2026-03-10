const MASK_LENGTH = 14; // (11)98765-4321
const DIGITS_LENGTH = 11;

/**
 * Formats a string as Brazilian mobile phone: (XX)XXXXX-XXXX.
 * Strips non-numeric characters and limits to 11 digits before applying the mask.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, DIGITS_LENGTH);
  if (digits.length <= 2) {
    return digits.length === 0 ? "" : `(${digits}`;
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Maximum length of the formatted phone string (including parentheses and hyphen).
 */
export const PHONE_MASK_MAX_LENGTH = MASK_LENGTH;
