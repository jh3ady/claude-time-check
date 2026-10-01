export type PendingPrompt = {
  text: string
  clock: string
  window: { label: string; start: number; end: number }
}

declare module 'claude-code' {
  interface PluginState {
    'time-check': { pending: PendingPrompt | null; isSessionMuted: boolean }
  }
}
