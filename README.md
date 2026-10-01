# Time Check

A Claude Code plugin that asks you to acknowledge the time before your prompt is sent, inside time windows you configure
for each day of the week.

- **Non-blocking**: your prompt is held, not lost. It is sent as soon as you pick an option.
- **Per-day windows**: one default, overridden day by day, with windows that may cross midnight.
- **Three answers**: remind me in 1 hour, stay quiet until this window ends, or stay quiet for this session.

## Installation

From the Claude Code plugin directory, or from this repository:

```text
/plugin marketplace add jh3ady/claude-time-check
/plugin install time-check@claude-time-check
```

## Usage

Run `/time-check` to open the settings pane. Each field takes comma-separated `HH:MM-HH:MM` windows and is saved with
Enter:

- `default` applies to every day left empty, for example `22:00-06:00, 13:00-14:00`.
- `monday` to `sunday` override the default; `off` disables a day.
- A window crossing midnight belongs to the day it starts: `friday 22:00-06:00` covers Saturday until 06:00.

Closing the pane with Escape prints the windows applied to each day. Settings and acknowledgements are stored locally
and shared by every session.

The plugin uses the Claude Code function hooks API, which is in early access.

## Privacy and hooks

The plugin sends nothing outside your machine. Its settings, the time of your last acknowledgement and the end of a
snooze live in the plugin's local store.

The only prompt it submits is the one you typed: when a prompt is held, its text is kept in the session and submitted
unchanged, as your own words, once you pick an option. Nothing is added to it, and no other conversation data is read
or sent. Pasted images are not resent with a held prompt.

What each hook does:

- `prompt.submit`: holds a prompt you typed inside an active window, opens the acknowledgement pane, and lets every
  other prompt through untouched (notifications, other plugins, its own resubmission).
- `command.run`: answers only `/time-check`, registered at `session.start`, and opens the settings pane. Other commands
  are passed on unchanged.
- `ui.close`: keeps the acknowledgement pane open until you pick an option, and prints the windows applied when the
  settings pane closes. Other panes are passed on unchanged.
- `ui.render`: draws the plugin's own two panes.

## License

[MIT](LICENSE)
