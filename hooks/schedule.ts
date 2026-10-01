export const HOUR_MS = 60 * 60 * 1000

export type TimeWindow = { label: string; start: number; end: number }

export type Quiet = {
  lastAckAt: number | undefined
  snoozedUntil: number | undefined
  isSessionMuted: boolean
}

const WINDOW = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/

export function parseWindows(text: string): { windows: TimeWindow[]; invalid: string[] } {
  const windows: TimeWindow[] = []
  const invalid: string[] = []

  for (const entry of text.split(',').map(part => part.trim()).filter(Boolean)) {
    const match = WINDOW.exec(entry)
    const start = match ? Number(match[1]) * 60 + Number(match[2]) : 0
    const end = match ? Number(match[3]) * 60 + Number(match[4]) : 0

    if (match && start !== end) {
      windows.push({ label: entry, start, end })
    } else {
      invalid.push(entry)
    }
  }

  return { windows, invalid }
}

export const invalidEntries = (text: string): string[] =>
  text.trim() === 'off' ? [] : parseWindows(text).invalid

// Indexed like Date.getDay(): Sunday first.
export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export type ScheduleConfig = { default?: string } & { [day in (typeof DAYS)[number]]?: string }

export function parseSchedule(config: ScheduleConfig): { days: TimeWindow[][]; invalid: string[] } {
  const fallback = parseWindows(config.default === 'off' ? '' : (config.default ?? ''))
  const invalid = fallback.invalid.map(entry => `default: ${entry}`)

  const days = DAYS.map(day => {
    const text = config[day]?.trim() ?? ''

    if (text === '') {
      return fallback.windows
    }

    const parsed = parseWindows(text === 'off' ? '' : text)
    invalid.push(...parsed.invalid.map(entry => `${day}: ${entry}`))

    return parsed.windows
  })

  return { days, invalid }
}

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes()

const crossesMidnight = (window: TimeWindow) => window.start > window.end

// A window crossing midnight belongs to the day it starts: its morning half is found on the day before.
function activeWindow(days: TimeWindow[][], now: Date): TimeWindow | undefined {
  const minute = minuteOfDay(now)
  const today = days[now.getDay()] ?? []
  const yesterday = days[(now.getDay() + 6) % 7] ?? []

  return (
    today.find(window => minute >= window.start && (crossesMidnight(window) || minute < window.end)) ??
    yesterday.find(window => crossesMidnight(window) && minute < window.end)
  )
}

export function warningWindow(days: TimeWindow[][], now: Date, quiet: Quiet): TimeWindow | undefined {
  const time = now.getTime()
  const isAcknowledged = quiet.lastAckAt !== undefined && time - quiet.lastAckAt < HOUR_MS
  const isSnoozed = quiet.snoozedUntil !== undefined && time < quiet.snoozedUntil

  if (quiet.isSessionMuted || isAcknowledged || isSnoozed) {
    return undefined
  }

  return activeWindow(days, now)
}

export function windowEnd(window: TimeWindow, now: Date): Date {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, window.end)

  if (crossesMidnight(window) && minuteOfDay(now) >= window.start) {
    end.setDate(end.getDate() + 1)
  }

  return end
}

// Monday first, as people read a week; the stored keys stay day names.
const WEEK = [...DAYS.slice(1), DAYS[0]]

export function describeSchedule(config: ScheduleConfig): string[] {
  const fallback = config.default?.trim() || 'off'
  const days = WEEK.map(day => {
    const own = config[day]?.trim()

    return `${day.padEnd(10)} ${own || `${fallback} (default)`}`
  })

  return [`${'default'.padEnd(10)} ${fallback}`, ...days]
}
