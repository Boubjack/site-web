# Assets/

Game content consumed at runtime by the Resource subsystem: textures, models,
audio banks, fonts, localization tables, stadium/team data, and so on.

No assets are shipped in Mission 1 (foundation only). This folder documents the
intended layout so future missions have a home for content.

## Planned layout

```
Assets/
  Audio/          Sound banks, music, ambience, commentary
  Fonts/          UI and broadcast fonts
  Models/         Meshes (players, stadiums, ball)
  Textures/       Materials, kits, pitches
  Data/           Leagues, teams, players, calendars (data-driven)
  Localization/   Per-language string tables
```

Assets are referenced by relative path through the Resource subsystem, never
loaded ad hoc from gameplay code.
