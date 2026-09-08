export function peso(amount: number | string | { toFixed(n: number): string }): string {
  return typeof amount === 'object'
    ? `₱${amount.toFixed(2)}`
    : `₱${Number(amount).toFixed(2)}`;
}

// Display range across barbers: "₱300.00 – ₱350.00", or a single price when uniform.
export function priceRange(base: number | string, customs: (number | string | null | undefined)[]): string {
  const values = [Number(base), ...customs.filter((c) => c != null).map(Number)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return peso(min);
  return `₱${min.toFixed(2)} – ₱${max.toFixed(2)}`;
}
