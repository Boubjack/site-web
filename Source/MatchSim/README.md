# MatchSim

A headless executable that runs a **complete football match** through the
`MatchEngine` and prints the final score, possession and statistics.

Because this mission has **no gameplay AI**, MatchSim supplies a short,
deterministic script of ball impulses — each exercising one engine path (a shot
that scores, a ball out over a touchline, a ball over the goal line) — and then
lets the match clock run to full time. Everything after each impulse (collisions,
goal detection, restarts, clock, possession, statistics, save) is handled by the
engine itself.

## Run

```sh
cmake --build Builds
./Builds/Source/MatchSim/MatchSim
```

Expected: a goal, a throw-in and a goal kick are reported, the match reaches full
time (~95'), a final 1–0 scoreline with statistics is printed, the match is saved
to `Saves/match_latest.sav`, and the process exits 0.
