export function peso(amount: number | string | { toFixed(n: number): string }): string {
  return typeof amount === 'object'
    ? `₱${amount.toFixed(2)}`
    : `₱${Number(amount).toFixed(2)}`;
}
