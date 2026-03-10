/**
 * Normalize phone to digits only. Optionally strip leading 55 (Brazil) so
 * 5511999999991 and 11999999991 match.
 */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Normalize phone: digits only; strip leading 55 if present so comparison is consistent. */
export function normalizePhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
}
