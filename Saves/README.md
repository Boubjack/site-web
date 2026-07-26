# Saves/

Runtime save-game directory. The Save subsystem writes save slots here
(e.g. `slot0.sav`, `autosave.sav`) using a write-to-temp-then-rename strategy so
a crash mid-write never corrupts an existing save.

Save files are generated at runtime and **ignored by git**; only this README and
the `.gitignore` are tracked so the folder always exists.
