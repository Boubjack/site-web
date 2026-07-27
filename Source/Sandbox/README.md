# Sandbox

A small, headless executable that boots the engine and exercises every
foundation subsystem once (config, logging, events, resources, menu, audio,
input, loading, save, camera, and a few engine frames), then shuts down cleanly.

It contains **no gameplay** — it is a smoke test and a living example of the
engine API, useful both as a manual sanity check and (indirectly) as
documentation of how the subsystems fit together.

## Run

```sh
cmake --build Builds
./Builds/Source/Sandbox/Sandbox
```

Expected: it prints an init/step/shutdown log and exits with code 0.
