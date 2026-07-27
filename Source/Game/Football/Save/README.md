# Module: Save

## Structure
- `MatchState.hpp/.cpp` — `SaveMatchToSlot` / `LoadMatchFromSlot`.

## Description
Persists a match (teams, score, time, statistics) to a save slot by bridging
`MatchEngine::SaveState`/`LoadState` with the engine's `SaveManager`. It reuses
the foundation's atomic, versioned save I/O — no new on-disk format is
introduced — so a match can be saved and restored without data loss.

## Responsibilities
- Write the current match state to a slot atomically.
- Restore match score/time/statistics from a slot.

## Dependencies
- Engine: **Save**, **Core/Result**, **Core/Types**. Football: **Match**.
