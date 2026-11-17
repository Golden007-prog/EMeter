export interface LocalDateTimeCandidate {
  iso: string
  instant: number
  offsetMinutes: number
  label: string
}

const santiago = 'America/Santiago'
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: santiago,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function partsAt(instant: number) {
  const parts = formatter.formatToParts(new Date(instant))
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function localEpoch(parts: ReturnType<typeof parseLocalDateTime>) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  )
  if (!match) throw new RangeError('Selecciona una fecha y hora válidas.')
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  }
  const date = new Date(localEpoch(parts))
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() + 1 !== parts.month ||
    date.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new RangeError('Selecciona una fecha y hora válidas.')
  }
  return parts
}

function sameParts(
  a: ReturnType<typeof parseLocalDateTime>,
  b: ReturnType<typeof partsAt>,
) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  )
}

function offsetLabel(offsetMinutes: number) {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

export function localDateTimeCandidates(
  value: string,
): LocalDateTimeCandidate[] {
  const parts = parseLocalDateTime(value)
  const wallTime = localEpoch(parts)
  const offsets = new Set<number>()
  for (let delta = -36; delta <= 36; delta += 3) {
    const sample = wallTime + delta * 60 * 60 * 1000
    const local = partsAt(sample)
    offsets.add(Math.round((localEpoch(local) - sample) / 60_000))
  }
  const candidates = [...offsets]
    .map((offsetMinutes) => ({
      instant: wallTime - offsetMinutes * 60_000,
      offsetMinutes,
    }))
    .filter(({ instant }) => sameParts(parts, partsAt(instant)))
    .sort((a, b) => a.instant - b.instant)
  return candidates.map(({ instant, offsetMinutes }) => ({
    instant,
    offsetMinutes,
    iso: `${value.length === 16 ? `${value}:00` : value}${offsetLabel(offsetMinutes).replace('UTC', '')}`,
    label: offsetLabel(offsetMinutes),
  }))
}

export function dateTimeInputValue(iso: string, includeSeconds = false) {
  const parts = partsAt(new Date(iso).getTime())
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}${includeSeconds ? `:${String(parts.second).padStart(2, '0')}` : ''}`
}
