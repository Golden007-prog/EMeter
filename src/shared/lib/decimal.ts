import { isLosslessNumber, LosslessNumber } from 'lossless-json'
import { z } from 'zod'

export type ExactDecimal = number | LosslessNumber

export const exactDecimalSchema = z.union([
  z.number(),
  z.instanceof(LosslessNumber),
  z
    .string()
    .regex(/^-?\d+(?:\.\d+)?$/)
    .transform((value) => new LosslessNumber(value)),
])

export function decimalText(value: ExactDecimal): string {
  return isLosslessNumber(value) ? value.toString() : String(value)
}

export function parseMeterReadingInput(input: string): string {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new RangeError('Usa un número no negativo con hasta dos decimales.')
  }
  const [integerPart, fraction] = normalized.split('.')
  const significant = integerPart.replace(/^0+/, '') || '0'
  if (significant.length > 16) {
    throw new RangeError('El valor debe ser menor que 10^16.')
  }
  return significant + (fraction === undefined ? '' : `.${fraction}`)
}

export function losslessDecimal(input: string): LosslessNumber {
  return new LosslessNumber(parseMeterReadingInput(input))
}

export function formatDecimalInput(value: ExactDecimal): string {
  return decimalText(value).replace('.', ',')
}
