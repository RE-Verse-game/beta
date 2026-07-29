# Changelog

All notable changes to the RE:Verse public browser beta are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## Unreleased

Documentation only — the playable build is unchanged, so there is no version
bump. What changed is what the documentation claims the game is.

### Changed
- **Art direction re-baseline (2226-15 pivot).** The project stopped describing
  itself as a AAA photoreal open-world game and started describing what one
  part-time developer can finish: **stylized low-poly with flat-shaded
  elements**, closed interiors, Unity 6.x LTS + URP, 40–60 modular kit pieces
  plus 15–20 hero props, baked GI with 2–4 real-time lights, and a post stack
  carrying roughly 70 % of the look. No human faces, no facial animation, no
  open world, no daylight exteriors; characters are robots, drones and
  opaque-visor suits. Third-party assets are CC0 only.
- The 3D slice is now labelled a **greybox** everywhere it appears. It always
  was one — geometry composed from Unity primitives in C# — but the screenshots
  were captioned as if they were the target look.
- Launcher metadata says v0.0.6, matching the README badge and this file. The
  page title had read v0.0.1 since the first release.

## [v0.0.6] — 2026-07-26

The Quantum Liquidators stop being a warning label — and the console gains its
first way to *lose* (JS 34 tests, value-identical to Python and C#).

### Added
- **The Temporal Terrorist arc** — crossing the Temporal Heat threshold used to
  print a warning and nothing else. Now a pursuit opens and tightens with
  everything you do while it is running: a Chronos Jump under an active sweep is
  a flare, a quiet day in 2226 is not, and the Smart Dust over your zone decides
  how much of either the analytics actually see. Running for the swept air of
  the Carpathians became a survival move, not just a discount on heat.
- **The pursuit ladder** — Sweep → Cordon → Interception → Liquidation, shown
  live under the heat readout. It only ever climbs on a run that buys no relief,
  so you are warned three times before the end.
- **Escape** — laying low and a grey-market Mesh scrub now shed *banked* pursuit
  pressure, not just heat. A cordon is something you get out of on purpose,
  paid for in standing and creds.
- **A fail state** — at 30 pressure the squads land and the run is over. It
  outranks the archetype: a perfect Solar Utopia you are not alive in is not a
  victory, and the ending overlay says so in red. Rewind still releases the last
  move; Reset still restores the continuum.

## [v0.0.5] — 2026-07-26

Smart Dust — the console's engine gains the system that makes *where* you jump
from a decision (JS 33 tests, value-identical to Python and C#).

### Added
- **Smart Dust field** — Canton's air is a sensor mesh, and it is not the same
  everywhere: thickest in the Kyiv megacity, thinnest in the Carpathian uplands
  the seeding budget never reached. The past re-seeds it, so abolishing
  pre-crime thins the field across the whole country while letting a cartel take
  the fusion grid saturates it. Where you launch a jump from now decides how
  loud that jump is.
- **The weather grid** — Canton schedules its own sky and publishes the
  forecast, because Canton owns it. Four phases: clear, a thermal inversion that
  pins the dust to the street, an ion storm that drops it out of the air, and
  seeding rain. The programme advances only while you spend time in 2226 — a
  Chronos Jump returns you to the moment you left, so it costs no weather.
- **◈ Zones and the maglev** — ride between Kyiv, the Carpathians and Odesa. One
  zone and one phase reach the quiet `swept` band — the Carpathians under an ion
  storm — and reaching it takes two present-day actions, because buying the
  ticket advances the sky as well. Stealth is not free: the Chronos anchor is
  under Kyiv, so every jump out of the quiet zones costs extra charge. The same
  2058 jump runs 8 heat / 36 charge from home and 5 heat / 45 charge from the
  storm.

## [v0.0.4] — 2026-07-26

Two-cycle catch-up — the console had fallen behind the main repo's engine by the
emergent-powers and quantum-battery-v2 cycles, and now carries both plus the new
bio-hacking progression (JS 32 tests, value-identical to Python and C#).

### Added
- **Emergent power blocs** — a Right-to-Work Resistance, Quantum Liquidators,
  DIYA-OMEGA Synergists and Cyber-Oligarch Cartels, none of which anyone votes
  into being: they are folded out of the world the way regions are. Let machines
  take every job and a Resistance grows whether you wanted one or not. The
  stronger the Liquidators, the *sooner* the same Heat gets you hunted — Heat now
  reads against a live threshold instead of a fixed number.
- **Quantum battery v2** — a jump is priced, not flat: reaching further back
  costs more (2180 is the cheap door, 2058 the expensive one), and the louder you
  have already edited history the dearer every later jump gets. Against that, a
  prosperous, stable, green Canton runs a healthier fusion grid that holds a
  bigger charge.
- **Bio-clinic** — the first system that spends creds on *you*: four augments in
  a tree (longevity lattice → neural governor / fusion weave → chrono marrow),
  each buying a permanent modifier and each leaving bio-strain behind. So does
  jumping into an era you already tore — the Looped are the anomaly-damaged, and
  this is how you become one. Enough strain and the Mesh withholds standing,
  which raises every price you pay. Recovery pods flush it; lifespan is the
  running total.

### Fixed
- The anomaly surcharge was quoted at the era picker and printed in the message
  but never actually left the batteries — jumps into torn eras were free of the
  penalty they advertised.

## [v0.0.3] — 2026-07-26

Economy & anomaly sync — the console now carries the finished M2 engine from the
main repo (Python 95 / JS 22 tests, value-identical).

### Added
- **Energy Creds** — the post-scarcity wallet: a civic allowance lifted by your
  Trust Mesh standing and by how prosperous the timeline you built is, drawn
  down by wormhole billing and purchases.
- **Market** — spend creds on a fusion-grid battery boost (+45 charge) or a
  grey-market Mesh scrub (sheds Heat for creds instead of trust). Your standing
  *discounts* official services and *inflates* grey-market ones — a fixer
  charges a model citizen a fortune and a Pariah a pittance.
- **Anomaly zones** — jump into the same era twice and the continuum tears
  there for good (rift → tear → collapse zone). Re-entering a torn era costs
  extra charge and extra Heat; the era buttons show the surcharge up front.
- **People of 2226** — population shares of Pures / Synths / Looped, rippled
  from the timeline: open biohacking makes the Looped, the purge unmakes them,
  capping AI thins the Synths.

### Fixed
- The grey-market Mesh scrub was priced out of the game — at 140 creds against
  a wallet that starts at 130 and only falls, no reachable run could ever buy
  it. Retuned so it is affordable once you have Heat worth scrubbing, while
  still costing most of your creds.
- Every present-day entry in the choice-log was treated as a lay-low, shedding
  Heat and Trust it never paid for; purchases now settle their own costs.
- Buying something no longer counts as tampering with the timeline for the
  purposes of the ending overlay.

## [v0.0.2] — 2026-07-25

M2 core-systems sync — the public 2D console now carries the same engine as the
main repo (Python 66 / JS 17 tests, value-identical).

### Added
- **Social Trust Mesh** — a 0–100 reputation rating (Exemplar → Pariah) as the
  post-scarcity currency; rises with the civic value of your choices, erodes
  with each jump.
- **Temporal Heat** — predictive-security score with tiers (Unnoticed →
  Liquidation Order); loud edits summon the Quantum Liquidators.
- **Lay low** — spend Trust Mesh to shed Heat and clear your name; a present-day
  action logged for save/replay, it never rewrites the world.
- **Spacetime stability** — each jump strains the continuum (revisiting an era
  strains it harder), with bands coherent → critical anomaly.
- **Regions (schema v2)** — live vitality bars for Kyiv / Carpathians / Odesa,
  rippled deterministically from world metrics and timeline flags.

## [v0.0.1] — 2026-07-24

First **public browser beta** of RE:Verse — the Chronos core loop, playable by
anyone at <https://re-verse-game.github.io/beta/> with no install.

### Added
- **Chronos Jump loop** — jump into an era (2058 / 2090 / 2150 / 2180), make a
  Butterfly-Effect choice, and watch the 2226 present rewrite itself.
- **Live world metrics** — colour-coded bars for every world metric (corruption
  correctly inverted: high = bad).
- **Faction system** — per-faction reputation and standing chips, your **patron
  bloc**, and the **dominant bloc** in 2226.
- **Cross-era gating** — earlier choices unlock or lock the options available in
  later eras; a still-locked era says so.
- **Energy economy** — a **chrono-charge** meter; each jump costs more than the
  last (spatial-decay strain), and *Rewind* releases energy back.
- **Side-quests** — a quest generated from the current world-state and your
  patron faction.
- **Timeline / Rewind / Reset** — review all changes, undo the last one, or
  restore the pristine timeline.
- **Save / Load** — runs persist to the browser's `localStorage` and replay
  deterministically from seed + choice log.
- **Endings** — ★ Solar Utopia victory plus alternate endings (Uploaded
  Ascendancy, Starlight Diaspora, Singularity Fusion, Grounded Renaissance).
- **Prologue overlay**, Ukrainian solarpunk/cyberpunk theme, scanline shader,
  and a social preview (Open Graph image + favicon).
- **Zero-build hosting** — GitHub Pages deploy workflow; the entire game is
  static HTML/CSS/JS.

### Notes
- The browser engine is a faithful port of the Python/C# core and mirrors the
  same deterministic invariants (verified by `engine.test.js`).
- This is a vertical slice of the core hook, not the full game.

[v0.0.6]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.6
[v0.0.5]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.5
[v0.0.4]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.4
[v0.0.3]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.3
[v0.0.2]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.2
[v0.0.1]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.1
