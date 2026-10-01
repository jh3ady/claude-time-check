# Privacy policy

Effective date: October 1, 2026.

Time Check is a Claude Code plugin published by Jean-Denis Vidot. This policy describes the data it handles.

## Data the plugin stores

The plugin keeps the following values in its local store, a file under your Claude Code configuration directory:

- The time windows you configure with `/time-check`.
- The time of your last acknowledgement.
- The end time of a snooze until the current window ends.

For the duration of a session, it also keeps in memory whether you muted it for that session and, while the
acknowledgement pane is open, the text of the prompt it holds. That text is cleared as soon as you pick an option.

## Data the plugin sends

None. The plugin makes no network request and runs no external process. The only prompt it submits is the one you
typed, unchanged, to your own Claude Code session once you acknowledge the time.

## Data the plugin does not collect

The plugin does not collect personal data, credentials, analytics, or telemetry, and does not share any data with the
author or with third parties.

## Retention and deletion

Stored values remain on your machine until you uninstall the plugin or delete its store file. Session values are
discarded when the session ends.

## Contact

Questions about this policy can be raised in the repository's issue tracker:
<https://github.com/jh3ady/claude-time-check/issues>.
