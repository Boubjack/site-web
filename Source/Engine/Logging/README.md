# Module: Logging

## Structure
- `LogLevel.hpp` — severity enum + `ToString`.
- `LogSink.hpp` — `ILogSink` interface, `ConsoleSink`, `FileSink`.
- `Logger.hpp/.cpp` — the logger, process-wide default, and `INF_LOG_*` macros.

## Description
A thread-safe logger that formats a message (timestamp + level) once and fans it
out to every registered sink above the active level threshold. The `INF_LOG_*`
macros stream to a process-wide default logger for convenience.

## Responsibilities
- Filter messages by level and format them consistently.
- Dispatch to any number of sinks, thread-safely.
- Degrade gracefully (a failed file open never crashes logging).

## Dependencies
- **Core/Types**. Layer L1 — the most foundational service (other subsystems may
  log). Extend by implementing `ILogSink`.
