# Module: Events

## Structure
- `EventBus.hpp/.cpp` — type-indexed publish/subscribe with `Subscription` tokens.

## Description
A decoupled communication channel. Any copyable struct is an event type — there
is no base class to inherit. `Emit<T>` delivers synchronously to every current
subscriber; subscribers can (un)subscribe safely during delivery.

## Responsibilities
- Register/unregister typed handlers and return revocable subscriptions.
- Dispatch events synchronously and safely (snapshot during emit).
- Report subscriber counts (useful for tests and diagnostics).

## Dependencies
- **Core/Types**. Layer L1. Extend simply by defining new event structs.
