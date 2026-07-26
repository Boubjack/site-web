# Glossary

Domain and technical terms used across Infinity Football.

## Technical

| Term                | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Engine**          | `inf::core::Engine`, the composition root owning and wiring all subsystems.                  |
| **Subsystem**       | A self-contained module (Config, Logging, Events, ...) under `Source/Engine`.                |
| **Composition root**| The single place (Engine) that constructs and connects concrete implementations.            |
| **Backend**         | A swappable implementation behind an interface (e.g. `NullAudioBackend`).                    |
| **Null backend**    | A fully-functional headless backend used by default and in tests; not a temporary stub.     |
| **Sink**            | A log destination implementing `ILogSink` (console, file, ...).                              |
| **EventBus**        | Type-indexed publish/subscribe used for decoupled communication.                            |
| **Resource**        | Any cached, ref-counted asset handled by the `ResourceManager`.                             |
| **Handle**          | A `shared_ptr` reference to a resource; keeps it alive while held.                           |
| **Slot**            | A named save file (`slot0`, `autosave`) managed by `SaveManager`.                           |
| **Action**          | A named, rebindable input intent (`Confirm`, `MenuUp`) decoupled from physical keys.        |
| **State machine**   | `inf::loading::StateMachine` driving coarse app flow (Boot → MainMenu → Loading → ...).      |
| **Fixed timestep**  | Advancing the simulation by a constant delta (1/60 s) for determinism.                       |
| **Result / Status** | C++20 success-or-error return types (stand-in for `std::expected`).                          |

## Domain (football — defined here, implemented in later missions)

| Term            | Meaning                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| **Independent ball** | The ball is a free physical object, never attached to a player.        |
| **Man of the match** | Post-match award for the best-performing player.                       |
| **Career mode** | Long-term mode managing a club/manager across seasons.                       |
| **Broadcast**   | The TV-style presentation layer: cameras, replays, graphics.                |
| **Fixture**     | A scheduled match within a competition's calendar.                          |
| **Kit**         | A team's playing strip (home/away/third).                                   |
| **Scout / Scouting** | Career-mode discovery and assessment of players.                       |
| **Added time**  | Extra minutes added by the referee for stoppages.                           |
