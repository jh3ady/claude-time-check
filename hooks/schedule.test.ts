import { describe, expect, test } from 'claude-code/testing'

import {
  HOUR_MS,
  describeSchedule,
  type TimeWindow,
  invalidEntries,
  parseSchedule,
  parseWindows,
  warningWindow,
  windowEnd,
} from './schedule'

// 2026-10-01 is a Thursday, 2026-10-02 a Friday, 2026-10-03 a Saturday.
const at = (hours: number, minutes = 0, day = 1) => new Date(2026, 9, day, hours, minutes)
const quiet = { lastAckAt: undefined, snoozedUntil: undefined, isSessionMuted: false }

describe('parseWindows', () => {
  test('reads several windows and reports malformed entries', () => {
    const { windows, invalid } = parseWindows('22:00-06:00, 13:00-14:30, nope, 10:00-10:00')

    expect(windows.map(window => window.label)).toEqual(['22:00-06:00', '13:00-14:30'])
    expect(invalid).toEqual(['nope', '10:00-10:00'])
  })
})

describe('invalidEntries', () => {
  test('accepts windows, off and an empty field', () => {
    expect(invalidEntries('22:00-06:00, 13:00-14:00')).toEqual([])
    expect(invalidEntries('off')).toEqual([])
    expect(invalidEntries('  ')).toEqual([])
  })

  test('lists what is not a window', () => {
    expect(invalidEntries('22:00-06:00, 25:00-26:00, soon')).toEqual(['25:00-26:00', 'soon'])
  })
})

describe('parseSchedule', () => {
  test('uses the default for empty days, the override otherwise, and nothing for off', () => {
    const { days } = parseSchedule({ default: '22:00-06:00', saturday: '00:00-09:00', sunday: 'off' })

    expect(days[4]?.map(window => window.label)).toEqual(['22:00-06:00'])
    expect(days[6]?.map(window => window.label)).toEqual(['00:00-09:00'])
    expect(days[0]).toEqual([])
  })

  test('reports malformed entries with their field name', () => {
    expect(parseSchedule({ default: '22:00-06:00', monday: 'nope' }).invalid).toEqual(['monday: nope'])
  })
})

describe('describeSchedule', () => {
  test('lists the windows each day applies, marking the ones from the default', () => {
    expect(describeSchedule({ default: '21:00-06:00', saturday: '00:00-09:00', sunday: 'off' })).toEqual([
      'default    21:00-06:00',
      'monday     21:00-06:00 (default)',
      'tuesday    21:00-06:00 (default)',
      'wednesday  21:00-06:00 (default)',
      'thursday   21:00-06:00 (default)',
      'friday     21:00-06:00 (default)',
      'saturday   00:00-09:00',
      'sunday     off',
    ])
  })

  test('shows an empty default as off', () => {
    expect(describeSchedule({})[0]).toBe('default    off')
  })
})

describe('warningWindow', () => {
  const { days } = parseSchedule({ default: '22:00-06:00, 13:00-14:00' })

  test('warns inside a window that crosses midnight', () => {
    expect(warningWindow(days, at(23, 30), quiet)?.label).toBe('22:00-06:00')
    expect(warningWindow(days, at(5, 59), quiet)?.label).toBe('22:00-06:00')
  })

  test('warns inside a daytime window, end excluded', () => {
    expect(warningWindow(days, at(13, 0), quiet)?.label).toBe('13:00-14:00')
    expect(warningWindow(days, at(14, 0), quiet)).toBeUndefined()
  })

  test('stays silent outside every window', () => {
    expect(warningWindow(days, at(10), quiet)).toBeUndefined()
  })

  test('stays silent for an hour after an acknowledgement', () => {
    const now = at(23)
    const recent = { ...quiet, lastAckAt: now.getTime() - HOUR_MS + 1 }
    const old = { ...quiet, lastAckAt: now.getTime() - HOUR_MS }

    expect(warningWindow(days, now, recent)).toBeUndefined()
    expect(warningWindow(days, now, old)?.label).toBe('22:00-06:00')
  })

  test('stays silent while snoozed or muted for the session', () => {
    const now = at(23)

    expect(warningWindow(days, now, { ...quiet, snoozedUntil: now.getTime() + 1 })).toBeUndefined()
    expect(warningWindow(days, now, { ...quiet, isSessionMuted: true })).toBeUndefined()
  })
})

describe('warningWindow per day', () => {
  const { days } = parseSchedule({ default: 'off', friday: '22:00-06:00', saturday: '10:00-12:00' })

  test('a window crossing midnight belongs to the day it starts', () => {
    expect(warningWindow(days, at(23, 0, 2), quiet)?.label).toBe('22:00-06:00')
    expect(warningWindow(days, at(5, 0, 3), quiet)?.label).toBe('22:00-06:00')
  })

  test('the next day does not inherit the evening half of that window', () => {
    expect(warningWindow(days, at(23, 0, 3), quiet)).toBeUndefined()
    expect(warningWindow(days, at(5, 0, 2), quiet)).toBeUndefined()
  })

  test('each day keeps its own windows', () => {
    expect(warningWindow(days, at(11, 0, 3), quiet)?.label).toBe('10:00-12:00')
    expect(warningWindow(days, at(11, 0, 2), quiet)).toBeUndefined()
  })
})

describe('windowEnd', () => {
  const [night, lunch] = parseWindows('22:00-06:00, 13:00-14:00').windows as [TimeWindow, TimeWindow]

  test('ends tomorrow when the window started today and crosses midnight', () => {
    expect(windowEnd(night, at(23)).getTime()).toBe(at(6, 0, 2).getTime())
  })

  test('ends today otherwise', () => {
    expect(windowEnd(night, at(2)).getTime()).toBe(at(6).getTime())
    expect(windowEnd(lunch, at(13, 30)).getTime()).toBe(at(14).getTime())
  })
})
