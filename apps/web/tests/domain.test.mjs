import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, stringify, LosslessNumber } from 'lossless-json'
import {
  losslessDecimal,
  parseMeterReadingInput,
} from '../src/shared/lib/decimal.ts'
import {
  localDateTimeCandidates,
  dateTimeInputValue,
} from '../src/shared/lib/dateTime.ts'

test('decimal admite todo numeric(18,2) sin redondear ni rechazar 16 dígitos', () => {
  for (const value of [
    '0',
    '12,34',
    '1000000000000000',
    '9999999999999999.99',
    '0001.20',
  ]) {
    const exact = losslessDecimal(value)
    assert.equal(
      parse(stringify({ value: exact })).value.toString(),
      parseMeterReadingInput(value),
    )
  }
  assert.equal(
    stringify({ value: losslessDecimal('9999999999999999,99') }),
    '{"value":9999999999999999.99}',
  )
  assert.equal(
    new LosslessNumber('9999999999999999.99').toString(),
    '9999999999999999.99',
  )
})
test('decimal rechaza valores fuera del contrato sin truncarlos', () => {
  for (const value of [
    '-1',
    '1.234',
    '10000000000000000',
    '00010000000000000000',
    '999999999999999999',
    'NaN',
    '1e4',
    '',
  ])
    assert.throws(() => parseMeterReadingInput(value))
})
test('Santiago respeta invierno, verano, horas inexistentes y repetidas', () => {
  assert.equal(
    localDateTimeCandidates('2026-01-15T12:30')[0].iso,
    '2026-01-15T12:30:00-03:00',
  )
  assert.equal(
    localDateTimeCandidates('2026-07-15T12:30')[0].iso,
    '2026-07-15T12:30:00-04:00',
  )
  assert.equal(localDateTimeCandidates('2026-09-06T00:30').length, 0)
  assert.equal(localDateTimeCandidates('2026-04-04T23:30').length, 2)
  assert.throws(() => localDateTimeCandidates('2026-02-30T12:00'))
  assert.equal(dateTimeInputValue('2026-07-15T16:30:00Z'), '2026-07-15T12:30')
})
