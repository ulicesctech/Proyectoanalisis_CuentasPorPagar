// Aritmética decimal para reproducir ROUND de Oracle sin sumar importes binarios.
function parts(value: number): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value)) throw new RangeError('El importe debe ser finito');
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const negative = mantissa.startsWith('-');
  const [whole, fraction = ''] = mantissa.replace('-', '').split('.');
  const scale = fraction.length - Number(exponent);
  const coefficient = BigInt(whole + fraction) * (negative ? -1n : 1n);
  return scale < 0 ? { coefficient: coefficient * 10n ** BigInt(-scale), scale: 0 } : { coefficient, scale };
}

function divideRound(value: bigint, divisor: bigint): bigint {
  const sign = value < 0n ? -1n : 1n;
  const positive = value * sign;
  return ((positive + divisor / 2n) / divisor) * sign;
}

export function cxpScaled(value: number, scale = 2): bigint {
  const decimal = parts(value);
  const difference = scale - decimal.scale;
  return difference >= 0
    ? decimal.coefficient * 10n ** BigInt(difference)
    : divideRound(decimal.coefficient, 10n ** BigInt(-difference));
}

export function cxpFromScaled(value: bigint, scale = 2): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('El importe supera la precisión admitida por la aplicación');
  }
  return Number(value) / 10 ** scale;
}

export function cxpMoneySum(...values: number[]): number {
  return cxpFromScaled(values.reduce((total, value) => total + cxpScaled(value), 0n));
}

export function cxpMoneyMultiply(a: number, b: number): number {
  const left = parts(a);
  const right = parts(b);
  const scale = left.scale + right.scale;
  const product = left.coefficient * right.coefficient;
  return cxpFromScaled(scale > 2 ? divideRound(product, 10n ** BigInt(scale - 2)) : product * 10n ** BigInt(2 - scale));
}

export function cxpDecimalFits(value: number, precision?: number, scale?: number): boolean {
  if (!Number.isFinite(value)) return false;
  const decimal = parts(value);
  if (scale !== undefined && decimal.scale > scale) return false;
  const targetScale = scale ?? decimal.scale;
  const scaled = cxpScaled(value, targetScale);
  const absolute = scaled < 0n ? -scaled : scaled;
  return absolute <= BigInt(Number.MAX_SAFE_INTEGER) && (precision === undefined || absolute < 10n ** BigInt(precision));
}
