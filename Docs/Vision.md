# Vision

> This document summarizes the project's direction. The authoritative source is
> [`/INFINITY_FOOTBALL.md`](../INFINITY_FOOTBALL.md); nothing here may contradict
> it.

## What Infinity Football is

Infinity Football is an **offline PC football simulation** with its own identity
— not a clone of FC or eFootball. It aims to be the best offline football game on
a **mid-range PC**, where **gameplay feel matters more than graphics**.

## Pillars

- **Simulation, not arcade.** Realistic, immersive, fast and fluid.
- **An independent ball.** The ball is never glued to a player; every contact is
  physical (mass, spin, bounce, friction, deflection).
- **Thinking players.** Each player, goalkeeper and coach has its own behaviour
  and decision-making.
- **Distinct identities.** Each team plays and feels like itself.

## Scope of the game (long term)

Match presentation (pre-match, anthems, kickoff, half-time, stats, man of the
match), broadcast (cameras, replays, TV graphics), the 10 most-followed leagues
with their teams/stadiums/kits/squads/fixtures, stadiums with weather and
atmosphere, a deep career mode, referees, weather, audio and a clean
keyboard-and-gamepad UI. Automatic and manual saving with no data loss.

## Non-goals

- No arcade mechanics.
- No online/multiplayer focus (the game is offline-first).
- No dependency on high-end hardware.

## Where Mission 1 fits

Mission 1 delivers the **foundation only**: the project structure, the software
architecture, and the working engine subsystems every future feature builds on.
**No gameplay** is implemented yet — see [`Roadmap.md`](Roadmap.md) for how the
game is built up from here, and [`FoundationReport.md`](../FoundationReport.md)
for what this mission produced.
