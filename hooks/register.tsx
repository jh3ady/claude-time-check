import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PendingPrompt } from '../types'
import { DAYS, type ScheduleConfig, describeSchedule, invalidEntries, parseSchedule, warningWindow, windowEnd } from './schedule'

const PANE = 'time-check'
const SETTINGS_PANE = 'time-check-settings'
const FIELDS = ['default', ...DAYS] as const
const DEFAULT_SCHEDULE: ScheduleConfig = { default: '22:00-06:00' }
const pending = atom({ plugin: 'time-check', key: 'pending' } as const, null)
const isSessionMuted = atom({ plugin: 'time-check', key: 'isSessionMuted' } as const, false)
const feedback = atom({ plugin: 'time-check', key: 'feedback' } as const, null)

type Choice = 'hour' | 'window' | 'session'

const twoDigits = (value: number) => String(value).padStart(2, '0')

async function acknowledge($: EngineInterface, choice: Choice) {
  const prompt = await read($, pending)
  const now = await $.clock.now()

  if (choice === 'hour') {
    await $.store.set('lastAckAt', now)
  } else if (choice === 'window' && prompt) {
    await $.store.set('snoozedUntil', windowEnd(prompt.window, new Date(now)).getTime())
  } else if (choice === 'session') {
    await update($, isSessionMuted, () => true)
  }

  await update($, pending, () => null)
  await $.ui.close({ id: PANE })

  if (prompt) {
    await $.prompt.submit({ text: prompt.text, asUser: true })
  }
}

async function readSchedule($: EngineInterface): Promise<ScheduleConfig> {
  return ((await $.store.get('schedule')) as ScheduleConfig | undefined) ?? DEFAULT_SCHEDULE
}

async function saveField($: EngineInterface, field: (typeof FIELDS)[number], value: string) {
  const invalid = invalidEntries(value)

  if (invalid.length > 0) {
    await update($, feedback, () => `${field}: not saved, ${invalid.join(', ')} is not HH:MM-HH:MM`)

    return
  }

  await $.store.set('schedule', { ...(await readSchedule($)), [field]: value.trim() })
  await update($, feedback, () => `${field} saved.`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'time-check', description: 'Edit the time windows that ask you to acknowledge the time' })

    return next(e)
  })

  on('command.run', { command: 'time-check' }, async $ => {
    await update($, feedback, () => null)
    await $.ui.open({ id: SETTINGS_PANE, title: 'Time check settings', focus: true, closeOnEscape: true, rows: 10 })

    return { text: 'Time check settings opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer') {
      return next(e)
    }

    const now = new Date(await $.clock.now())
    const { days } = parseSchedule(await readSchedule($))
    const window = warningWindow(days, now, {
      lastAckAt: (await $.store.get('lastAckAt')) as number | undefined,
      snoozedUntil: (await $.store.get('snoozedUntil')) as number | undefined,
      isSessionMuted: await read($, isSessionMuted),
    })

    if (!window) {
      return next(e)
    }

    // ponytail: the held prompt keeps its text only; pasted images are not resent, keep them in the prompt itself if that matters.
    const prompt: PendingPrompt = {
      text: e.text,
      clock: `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`,
      window,
    }
    await update($, pending, () => prompt)
    await $.ui.open({ id: PANE, title: 'Time check', focus: true, rows: 3 })

    return { drop: 'Acknowledge the time in the Time check pane; your prompt is sent right after.' }
  })

  on('ui.close', async ($, e, next) => {
    const isHeld = e.id === PANE && e.origin.kind === 'person' && (await read($, pending)) !== null

    if (isHeld) {
      return { deny: 'Pick one of the options to send your prompt.' }
    }

    const closed = await next(e)

    if (e.id === SETTINGS_PANE) {
      for (const line of ['Time windows applied:', ...describeSchedule(await readSchedule($))]) {
        $.ui.log(line)
      }
    }

    return closed
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const prompt = await read($, pending)

    if (!prompt) {
      return <Text dimColor>Nothing to acknowledge.</Text>
    }

    return (
      <Box flexDirection="column">
        <Text bold>
          It is {prompt.clock}, inside your {prompt.window.label} time window.
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button key="hour" label="Remind me in 1 hour" onPress={() => acknowledge($, 'hour')} />
          <Button key="window" label="Don't disturb until this window ends" onPress={() => acknowledge($, 'window')} />
          <Button key="session" label="Don't disturb this session" onPress={() => acknowledge($, 'session')} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)

      return <Text>Time windows can be edited from a terminal or desktop session.</Text>
    }

    const { Box, Input, Text } = $.ui.resolve(e)
    const schedule = await readSchedule($)
    const message = await read($, feedback)

    return (
      <Box flexDirection="column">
        <Text dimColor>HH:MM-HH:MM windows, comma-separated. Enter saves a field. Empty day uses default, off disables.</Text>
        {FIELDS.map(field => (
          <Input
            key={field}
            label={field.padEnd(10)}
            value={schedule[field] ?? ''}
            placeholder={field === 'default' ? 'off' : 'default'}
            submitLabel="save"
            autoFocus={field === 'default' ? true : undefined}
            onSubmit={(value: string) => saveField($, field, value)}
          />
        ))}
        {message && <Text>{message}</Text>}
      </Box>
    )
  })
}
