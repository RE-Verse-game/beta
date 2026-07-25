/* RE:Verse browser front — wires the pure engine (engine.js) to the DOM.
   Same loop as the CLI: jump into an era, pick a Butterfly-Effect choice,
   watch 2226 rewrite itself, chase the Solar Utopia. */
(function () {
  "use strict";
  const E = window.REVerse;
  const $ = (id) => document.getElementById(id);
  const SEED = 1337;
  const SAVE_KEY = "reverse_save_v1";

  let timeline = [];
  let world = E.simulate(timeline, SEED);

  // ---------- helpers ----------
  const metricColor = (m, v) => {
    // corruption is inverted: high = bad. Everything else: high = good.
    const good = m === "corruption" ? 100 - v : v;
    if (good >= 66) return "var(--green)";
    if (good >= 40) return "var(--gold)";
    return "var(--danger)";
  };

  function bar(name, value, color, valText) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<span class="bar-name">${name}</span>` +
      `<div class="bar-track"><div class="bar-fill" style="width:${value}%;background:${color}"></div></div>` +
      `<span class="bar-val">${valText != null ? valText : value}</span>`;
    return row;
  }

  // ---------- render ----------
  function render() {
    const [name] = E.archetype(world);
    $("archetype").textContent = name;
    $("narration").textContent = E.narrate(world);

    const n = E.jumps(timeline).length; // lay-low entries cost no charge
    const charge = E.energy(n);
    $("charge-fill").style.width = (charge / E.MAX_ENERGY) * 100 + "%";
    $("charge-num").textContent = charge + "/" + E.MAX_ENERGY;

    const mBox = $("metrics");
    mBox.innerHTML = "";
    for (const m of E.METRICS) mBox.appendChild(bar(m, world[m], metricColor(m, world[m])));

    const rBox = $("regions");
    rBox.innerHTML = "";
    for (const r of E.REGIONS)
      rBox.appendChild(bar(r, world.regions[r], metricColor(r, world.regions[r])));

    const space = E.stability(timeline), ht = E.heat(timeline);
    const tr = E.trustMesh(timeline);
    $("temporal").innerHTML =
      `◈ Spacetime: <b>${space}</b> (${E.stabilityBand(space)}) · ` +
      `Heat: <b>${ht}</b> (${E.heatTier(ht)}) · ` +
      `Trust Mesh: <b>${tr}</b> (${E.trustBand(tr)})` +
      (E.isHunted(timeline) ? ' · <b style="color:var(--danger)">⚠ Quantum Liquidators deployed</b>' : "");

    const laylow = $("act-laylow");
    laylow.disabled = ht === 0 || !E.canLayLow(timeline);
    laylow.title = ht === 0
      ? "Your trail is already cold."
      : (E.canLayLow(timeline) ? `Shed heat (−trust ${E.LAY_LOW_COST})` : "The Mesh won't hide you — trust spent.");

    const rep = E.reputation(timeline);
    const fBox = $("factions");
    fBox.innerHTML = "";
    for (const f of E.FACTIONS) {
      const st = E.standing(rep[f]);
      const row = bar(f, world.factions[f], "var(--cyan)", world.factions[f]);
      const chip = document.createElement("span");
      chip.className = "chip " + st;
      chip.textContent = st + " " + (rep[f] >= 0 ? "+" : "") + rep[f];
      row.querySelector(".bar-name").appendChild(chip);
      fBox.appendChild(row);
    }
    const patron = E.patronFaction(timeline);
    $("patron").innerHTML =
      (patron ? "◈ Patron: " + E.FACTION_FLAVOR[patron] : "◈ Patron: none yet — no bloc calls you ally.") +
      `<br>▣ Dominant bloc in 2226: <b>${E.dominantBloc(world)}</b>`;

    $("act-rewind").disabled = n === 0;
    const canJump = E.canJump(n);
    $("act-jump").disabled = !canJump;
    $("act-jump").textContent = canJump
      ? `⟲ Chronos Jump (−${E.jumpCost(n)})`
      : "⟲ No charge";
  }

  function openDrawer(title, buildBody) {
    const d = $("drawer");
    d.classList.remove("hidden");
    d.innerHTML = `<button class="btn drawer-close" data-close="1">✕</button><h3>${title}</h3>`;
    buildBody(d);
    d.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeDrawer() { $("drawer").classList.add("hidden"); }

  // ---------- actions ----------
  function showDiff(before, after, host) {
    const row = (label, b, a) => {
      const d = a - b;
      if (!d) return;
      const p = document.createElement("div");
      p.className = "diff" + (d < 0 ? " neg" : "");
      p.textContent = `  ${label}: ${b} → ${a} (${d > 0 ? "+" : ""}${d})`;
      host.appendChild(p);
    };
    for (const m of E.METRICS) row(m, before[m], after[m]);
    for (const r of E.REGIONS) row(`region:${r}`, before.regions[r], after.regions[r]);
  }

  function commitChoice(choice) {
    const before = world;
    timeline.push(choice);
    world = E.simulate(timeline, SEED);
    openDrawer("The present rewrites itself", (d) => {
      const flash = document.createElement("p");
      flash.className = "narrative-flash";
      flash.textContent = "» " + choice.narrative;
      d.appendChild(flash);
      const anyDiff = document.createElement("div");
      showDiff(before, world, anyDiff);
      d.appendChild(anyDiff.children.length ? anyDiff : Object.assign(document.createElement("p"), { className: "locked", textContent: "(no measurable change)" }));
    });
    render();
    if (isEnding()) showEnding();
  }

  function jumpFlow() {
    openDrawer("Chronos Jump — choose an era", (d) => {
      const grid = document.createElement("div");
      grid.className = "era-grid";
      for (const y of E.ERAS) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = y;
        b.onclick = () => pickChoice(y);
        grid.appendChild(b);
      }
      d.appendChild(grid);
    });
  }

  function pickChoice(year) {
    const opts = E.availableChoices(year, timeline);
    openDrawer(`${year} — what do you change?`, (d) => {
      if (!opts.length) {
        d.insertAdjacentHTML("beforeend",
          `<p class="locked">${year} is still locked — your earlier choices haven't opened any options here yet.</p>`);
        return;
      }
      for (const c of opts) {
        const b = document.createElement("button");
        b.className = "choice";
        b.innerHTML = `<b>${c.title}</b><small>${c.description}</small>`;
        b.onclick = () => commitChoice(c);
        d.appendChild(b);
      }
    });
  }

  function questFlow() {
    const q = E.generateQuest(world, E.patronFaction(timeline));
    openDrawer("Side-quest", (d) => {
      d.insertAdjacentHTML("beforeend",
        `<p class="narrative-flash">◈ ${q.title}</p>` +
        `<div class="quest-field"><span>Giver</span> ${q.giver_faction}</div>` +
        `<div class="quest-field"><span>Objective</span> ${q.objective}</div>` +
        `<div class="quest-field"><span>Stakes</span> ${q.stakes}</div>` +
        `<div class="quest-field"><span>Reward</span> ${q.reward}</div>`);
    });
  }

  function timelineFlow() {
    openDrawer("Timeline of changes", (d) => {
      if (!timeline.length) {
        d.insertAdjacentHTML("beforeend", `<p class="locked">Your timeline is pristine — no changes made.</p>`);
        return;
      }
      timeline.forEach((c, i) => {
        d.insertAdjacentHTML("beforeend",
          `<div class="timeline-item">${i + 1}. [${c.era}] ${c.title}</div>`);
      });
    });
  }

  function layLowFlow() {
    if (E.heat(timeline) === 0 || !E.canLayLow(timeline)) return;
    timeline.push(E.LAY_LOW);
    world = E.simulate(timeline, SEED); // world is untouched by design; keeps state in sync
    openDrawer("Laying low", (d) => {
      d.insertAdjacentHTML("beforeend",
        `<p class="narrative-flash">» ${E.LAY_LOW.narrative}</p>` +
        `<div class="quest-field"><span>Heat</span> ${E.heat(timeline)} (${E.heatTier(E.heat(timeline))})</div>` +
        `<div class="quest-field"><span>Trust Mesh</span> ${E.trustMesh(timeline)} (${E.trustBand(E.trustMesh(timeline))})</div>`);
    });
    render();
  }

  function rewind() {
    if (!timeline.length) return;
    timeline.pop();
    world = E.simulate(timeline, SEED);
    closeDrawer();
    render();
  }
  function reset() {
    timeline = [];
    world = E.simulate(timeline, SEED);
    closeDrawer();
    render();
  }
  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, seed: SEED, ids: timeline.map((c) => c.id) }));
    flashToast("Timeline saved (" + timeline.length + " change(s)).");
  }
  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return flashToast("No saved timeline found.");
    try {
      const data = JSON.parse(raw);
      timeline = (data.ids || []).map((id) => E.CHOICE_BY_ID[id]).filter(Boolean);
      world = E.simulate(timeline, SEED);
      closeDrawer();
      render();
      flashToast("Replayed " + timeline.length + " change(s).");
      if (isEnding()) showEnding();
    } catch (_) { flashToast("Load failed — save was corrupt."); }
  }

  function flashToast(msg) {
    openDrawer("Console", (d) => { d.insertAdjacentHTML("beforeend", `<p class="narrative-flash">${msg}</p>`); });
  }

  // Solar Utopia is the win; Uploaded Ascendancy is an alternate ending — both
  // fly the overlay, so the browser shows the same endings as the CLI/Unity.
  const RESOLVED = new Set([
    "Solar Utopia", "Uploaded Ascendancy", "Starlight Diaspora",
    "Singularity Fusion", "Grounded Renaissance",
  ]);
  function isEnding() {
    return timeline.length > 0 && RESOLVED.has(E.archetype(world)[0]);
  }
  function showEnding() {
    const [name, blurb] = E.archetype(world);
    const tag = (E.ENDINGS[name] && E.ENDINGS[name][0]) || "★";
    document.querySelector(".victory-badge").textContent = tag.trim().charAt(0);
    $("victory-title").textContent = E.flavoredEnding(world).toUpperCase();
    $("victory-blurb").textContent = blurb;
    document.querySelector(".victory-note").textContent =
      name === "Solar Utopia"
        ? "You rewrote the past and reassembled the ideal future."
        : "A different continuum — humanity chose another path entirely.";
    $("victory").classList.remove("hidden");
  }

  // ---------- boot ----------
  function boot() {
    $("prologue-text").textContent = E.PROLOGUE.join("\n");
    $("start-btn").onclick = () => {
      $("prologue").classList.add("hidden");
      $("game").classList.remove("hidden");
      render();
    };
    $("victory-close").onclick = () => $("victory").classList.add("hidden");
    $("act-jump").onclick = jumpFlow;
    $("act-quest").onclick = questFlow;
    $("act-laylow").onclick = layLowFlow;
    $("act-timeline").onclick = timelineFlow;
    $("act-rewind").onclick = rewind;
    $("act-reset").onclick = reset;
    $("act-save").onclick = save;
    $("act-load").onclick = load;
    document.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close) closeDrawer();
    });
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
