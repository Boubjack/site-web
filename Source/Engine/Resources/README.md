# Module: Resources

## Structure
- `Resource.hpp` — base resource type + `ResourceId`.
- `ResourceManager.hpp/.cpp` — cache, `shared_ptr` handles, per-type loaders.

## Description
Caches resources by id and shares ownership through `std::shared_ptr`, giving
automatic reference counting. Loaders are registered per resource type via a
factory callback, so new asset kinds are added without editing the manager.

## Responsibilities
- Load-on-first-request and cache resources by id.
- Reference-count via shared handles; `PurgeUnused()` reclaims unreferenced ones.
- Keep asset decoding out of gameplay code (registered loaders own it).

## Dependencies
- **Core/Types**, **Resource**. Layer L2. Extend with `RegisterLoader<T>`.
