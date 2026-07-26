# Module: Loading

## Structure
- `LoadingQueue.hpp/.cpp` — sequential task queue with monotonic progress.
- `StateMachine.hpp/.cpp` — coarse application flow states + enter/exit hooks.

## Description
Drives loading as a sequence of small steps so a loading screen can show real,
monotonic progress, and models coarse application flow (`Boot`, `MainMenu`,
`Loading`, `InGame`, `Paused`, `Shutdown`). These are engine-flow constructs, not
gameplay: match/session logic is added later by registering callbacks and
extending `GameState`.

## Responsibilities
- Run queued loading tasks one at a time and report progress in [0, 1].
- Transition between flow states, firing exit/enter callbacks.

## Dependencies
- **Core/Types**. Layer L2. The concrete work performed by tasks is supplied by
  callers.
