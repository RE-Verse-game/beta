# Changelog

All notable changes to the RE:Verse public browser beta are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
- This is a vertical slice of the core hook, not the full AAA game.

[v0.0.1]: https://github.com/RE-Verse-game/beta/releases/tag/v0.0.1
