# Module: Rules

## Structure
- `RuleBook.hpp/.cpp` — out-of-play → restart decisions (`RestartType`,
  `RestartDecision`) and kickoff.
- `Offside.hpp/.cpp` — `OffsideResolver` (offside line + position evaluation).
- `Discipline.hpp/.cpp` — fouls, advantage, yellow/red cards (`DisciplineSystem`).

## Description
The Laws of the Game. `RuleBook` is stateless: given the ball position and the
last team to touch it, it decides the restart (throw-in, corner, goal kick) or
reports the ball still in play. `Offside` provides the full offside pipeline —
computing the second-last-defender line and evaluating whether an attacker is in
an offside position — the algorithm is simplified but the infrastructure is
complete. `Discipline` turns a foul's severity and location into an outcome
(advantage / free kick / penalty) and a card, with two yellows becoming a red.

## Responsibilities
- Decide restarts from ball position and last touch.
- Compute and evaluate the offside line.
- Judge fouls and manage cards / sendings-off.

## Dependencies
- Engine: **Math**, **Core/Types**. Football: **Common**, **Terrain**.
