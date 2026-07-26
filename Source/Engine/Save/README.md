# Module: Save

## Structure
- `SaveData.hpp/.cpp` — versioned key/value container with typed accessors.
- `Serializer.hpp/.cpp` — text (de)serialization with escaping and a header.
- `SaveManager.hpp/.cpp` — slot files, atomic writes, autosave hook.

## Description
Persists game state with **no data loss**: writes go to a temporary file that is
atomically renamed into place, so an interrupted write never corrupts an existing
save. Data is versioned so future schema changes can migrate old saves.

## Responsibilities
- Model save contents as versioned typed key/values.
- Serialize/deserialize to a human-inspectable, escaped text format.
- Manage named slots and autosave; reject corrupt/foreign files on load.

## Dependencies
- **Core/Types**, **Core/Result**, **Logging**, `std::filesystem`. Layer L2.
