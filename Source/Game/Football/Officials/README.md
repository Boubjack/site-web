# Module: Officials

## Structure
- `Officials.hpp` — `Referee`, `AssistantReferee`, `FourthOfficial`,
  `MatchOfficials`.

## Description
The match crew. The `Referee` owns the match's `DisciplineSystem` (one authority
for all cards) and exposes a thin `JudgeFoul` surface that delegates to it. Two
`AssistantReferee`s patrol the touchlines and the `FourthOfficial` covers
substitutions and added time. There is deliberately **no complex AI** — officials
are identities plus a decision surface over the rules/discipline systems.

## Responsibilities
- Provide the officiating identities for a match.
- Route disciplinary decisions through a single referee/discipline authority.

## Dependencies
- Engine: **Core/Types**. Football: **Common**, **Rules** (Discipline).
