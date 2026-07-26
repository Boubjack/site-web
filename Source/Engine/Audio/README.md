# Module: Audio

## Structure
- `IAudioBackend.hpp` — device-facing interface (`SoundHandle`, `AudioChannel`).
- `NullAudioBackend.hpp` — fully-functional headless backend (default).
- `AudioSystem.hpp/.cpp` — engine-facing facade over a backend.

## Description
The audio facade owns a backend (Null by default) and keeps the master/channel
volume model. Game code talks to `AudioSystem` only. A real device backend
(SDL2/OpenAL) is added later behind `IAudioBackend` **without any caller change**
— the Null backend is legitimate infrastructure, not a temporary stub.

## Responsibilities
- Load and play sounds through the active backend.
- Maintain per-channel and master gains (clamped to [0, 1]).
- Isolate the rest of the engine from the concrete audio device.

## Dependencies
- **Core/Types**, **Math** (clamp), **Logging**. Layer L3. Extend by injecting an
  `IAudioBackend` via `AudioSystem::SetBackend` before `Initialize`.
