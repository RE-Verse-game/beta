<p align="center">
  <img src="media/hero.png" alt="RE:Verse" width="100%" />
</p>

<h1 align="center">RE:VERSE — public beta</h1>

<p align="center">
  <b>Rewrite the universe, one choice at a time.</b><br />
  A Ukrainian solarpunk / cyberpunk time-travel game built around an embedded <b>Chronos-LLM</b>.
</p>

<p align="center">
  <a href="https://re-verse-game.github.io/beta/"><b>▶ PLAY IN THE BROWSER</b></a>
  &nbsp;·&nbsp; no install &nbsp;·&nbsp; no sign-up &nbsp;·&nbsp; works on desktop &amp; mobile
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.0.1-orange" alt="version" />
  <img src="https://img.shields.io/badge/status-public%20beta-blue" alt="status" />
  <img src="https://img.shields.io/badge/build-no--build%20static-brightgreen" alt="build" />
  <img src="https://img.shields.io/badge/license-BSL%201.1-lightgrey" alt="license" />
</p>

---

## What is this?

You jump into Ukraine's past eras (**2058 · 2090 · 2150 · 2180**), make
**Butterfly-Effect** choices, and the present of **2226** rewrites itself in
real time. Every jump drains your **quantum batteries**, choices **cascade
across eras** (what you change in 2058 unlocks or locks options in 2090+), and
your goal is to reassemble the **★ Solar Utopia** — while dodging the
AI-Technocracy, Cyber-Feudal Collapse and Fractured-Timeline endings.

This repository hosts the **browser vertical slice** — a self-contained,
no-build front-end that runs the exact same deterministic decision engine as
the full prototype (a faithful JS port of the Python/C# core).

> This is a **playable beta**, not the final AAA game. It is the *core hook*,
> distilled to something anyone can open and feel in under a minute.

## Play

**→ [re-verse-game.github.io/beta](https://re-verse-game.github.io/beta/)**

Prologue → **Enter the Continuum** → **Chronos Jump** into an era → pick a
choice → watch 2226's metric &amp; faction bars rewrite → chase the ★ Solar
Utopia victory.

| Action | What it does |
| --- | --- |
| **⟲ Chronos Jump** | Travel to an era and change one thing (costs charge, rising per jump) |
| **◈ Quest** | Generate a side-quest from the current world-state |
| **≡ Timeline** | Review every change you've made |
| **↶ Rewind** | Undo your last change and release its energy |
| **⟳ Reset** | Restore the pristine timeline and full charge |
| **▼ Save / ▲ Load** | Persist your run to the browser's `localStorage` |

## Screenshots

<p align="center">
  <img src="media/poster.png" alt="RE:Verse poster" width="42%" />
  &nbsp;&nbsp;
  <img src="media/avatar.png" alt="RE:Verse emblem — Chronos-LLM, Ukraine 2226" width="42%" />
</p>

## Run it locally

It's a static site — no server or build needed.

```bash
git clone https://github.com/RE-Verse-game/beta.git
cd beta
xdg-open index.html      # Linux  (or just double-click index.html)
```

Optional sanity checks (Node):

```bash
node engine.test.js      # engine parity checks mirroring the Python invariants
```

## What's inside

```
index.html        # the game shell (prologue, metrics, factions, victory)
style.css         # Ukrainian solarpunk / cyberpunk theme
engine.js         # pure decision engine — deterministic, no DOM
app.js            # DOM controller wiring the engine to the UI
engine.test.js    # Node sanity checks
media/            # key art (hero, poster, emblem)
```

## Changelog

See **[CHANGELOG.md](CHANGELOG.md)**. Current release: **v0.0.1** — first public
browser beta of the Chronos core loop.

## About the full project

RE:Verse is a first-person, open-world game set in a Ukrainian solarpunk /
cyberpunk **2226**, built around an embedded **Chronos-LLM** that mutates a
structured world-state from the choices you make in the past. Beyond this
browser slice there is also a CLI prototype and a Unity first-person 3D slice
(with a WebGL export), all sharing one engine.

## Credits &amp; license

RE:Verse — concept, design, engine and key art © 2026 **Alex Korchenko**.

Licensed under the **Business Source License 1.1** (BSL 1.1) — see
**[LICENSE](LICENSE)**. In short: you may play and evaluate the game for
personal, non-commercial purposes and host an unmodified copy for playtesting;
any commercial or hosted-for-third-parties use needs a separate commercial
license. On the **Change Date (2030-07-24)** the work converts to the
**Apache License, Version 2.0**. BSL is not an Open Source license, but this
work will become open source on that date.

For commercial licensing, contact **geekojinetwork@gmail.com**.
