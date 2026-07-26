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

    // The ceiling is the fusion grid's and the operative's own: a healthier
    // Canton holds more charge, and so does a woven-in fusion cell.
    const charge = E.charge(timeline, world);  // includes bought battery boosts
    const ceiling = E.batteryCeiling(world, timeline);
    $("charge-fill").style.width = (charge / ceiling) * 100 + "%";
    $("charge-num").textContent = charge + "/" + ceiling;

    const mBox = $("metrics");
    mBox.innerHTML = "";
    for (const m of E.METRICS) mBox.appendChild(bar(m, world[m], metricColor(m, world[m])));

    const rBox = $("regions");
    rBox.innerHTML = "";
    for (const r of E.REGIONS)
      rBox.appendChild(bar(r, world.regions[r], metricColor(r, world.regions[r])));

    const space = E.stability(timeline), ht = E.heat(timeline);
    const tr = E.trustMesh(timeline);
    // Heat is shown against the deploy threshold, because the threshold moves
    // with how strong the Liquidators grew in this timeline.
    $("temporal").innerHTML =
      `◈ Spacetime: <b>${space}</b> (${E.stabilityBand(space)}) · ` +
      `Heat: <b>${ht}</b>/${E.huntThreshold(world)} (${E.heatTier(ht)}) · ` +
      `Trust Mesh: <b>${tr}</b> (${E.trustBand(tr)})` +
      (E.isHunted(timeline, world) ? ' · <b style="color:var(--danger)">⚠ Quantum Liquidators deployed</b>' : "");

    // The pursuit itself: not whether they are after you, but how close they
    // have got. Silent until there is something to say.
    const pres = E.pressure(timeline), stage = E.huntStage(timeline);
    $("pursuit").innerHTML = (pres === 0 && !E.huntedAt(timeline)) ? ""
      : `<b style="color:var(--danger)">☠ Pursuit: ${pres}/${E.LIQUIDATED_AT}`
        + ` (${stage})</b> — ${E.STAGE_FLAVOR[stage]}`;

    const zones = E.anomalies(timeline);
    const eras = Object.keys(zones);
    $("anomalies").innerHTML = eras.length
      ? "✷ Anomaly zones: " + eras
          .map((y) => `<b>${y}</b> ${E.anomalyLabel(zones[y])} (+${E.jumpSurcharge(Number(y), timeline)} charge)`)
          .join(" · ")
      : "";

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

    // Population shares of Pures / Synths / Looped — headcount, not influence.
    const bBox = $("bio-social");
    bBox.innerHTML = "";
    for (const g of E.BIO_SOCIAL)
      bBox.appendChild(bar(g, world.bio_social[g], "var(--gold)", world.bio_social[g] + "%"));

    // Blocs nobody voted into being — derived from the world, never chosen.
    // Drift against the untouched timeline is the readable part, so it is shown.
    const blocs = E.powerBlocs(world);
    const pBox = $("powers");
    pBox.innerHTML = "";
    for (const p of E.POWERS) {
      const drift = blocs[p] - E.POWER_BASE[p];
      const sign = drift > 0 ? "+" : "";
      pBox.appendChild(bar(p, blocs[p], "var(--cyan)",
        `${blocs[p]} ${drift ? `(${sign}${drift})` : ""}`));
    }
    const top = E.ascendantPower(world);
    $("ascendant").innerHTML =
      `▲ Ascendant: <b>${E.POWER_NAMES[top]}</b> — ${E.POWER_FLAVOR[top]}` +
      `<br>⚙ Automation index: <b>${E.automationIndex(world)}</b>`;

    const creds = E.credBalance(timeline, world);
    const strain = E.bioStrain(timeline);
    $("wallet").innerHTML =
      `⌬ Energy Creds: <b>${creds}</b> ` +
      `(allowance ${E.allowance(timeline, world)}, drawn ${E.spent(timeline)})` +
      `<br>⚡ Fusion grid: <b>${E.gridYield(world) >= 0 ? "+" : ""}${E.gridYield(world)}</b> ` +
      `charge · timeline divergence <b>${E.divergence(timeline)}</b>` +
      // The one line about the operative's body rather than their record.
      `<br>⚕ Body: <b>${E.bioBand(strain)}</b> (strain ${strain}) · ` +
      `${E.installed(timeline).length}/${E.AUGMENTS.length} augments · ` +
      `lifespan <b>${E.lifespan(timeline)}</b>y` +
      // ...and the one about the ground they are standing on.
      `<br>◈ Zone: <b>${E.ZONE_NAMES[E.currentZone(timeline)]}</b> · ` +
      `dust ${E.effectiveDensity(E.currentZone(timeline), timeline)} ` +
      `(${E.dustBand(E.effectiveDensity(E.currentZone(timeline), timeline))}, ` +
      `${E.jumpExposure(timeline) >= 0 ? "+" : ""}${E.jumpExposure(timeline)} heat/jump) · ` +
      `sky <b>${E.weather(timeline)[0]}</b>`;

    $("act-rewind").disabled = timeline.length === 0;
    // Eras are priced differently now, so the button asks about the cheapest
    // door and quotes it — "no charge" means no era at all is reachable.
    const cheapest = Math.min(...E.ERAS.map((y) => E.jumpCost(y, timeline)));
    const canJump = charge >= cheapest;
    $("act-jump").disabled = !canJump;
    $("act-jump").textContent = canJump
      ? `⟲ Chronos Jump (from −${cheapest})`
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
    for (const g of E.BIO_SOCIAL) row(`people:${g}`, before.bio_social[g], after.bio_social[g]);
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
    const have = E.charge(timeline, world);
    openDrawer("Chronos Jump — choose an era", (d) => {
      const grid = document.createElement("div");
      grid.className = "era-grid";
      for (const y of E.ERAS) {
        // Era distance, divergence and any scar are all inside jumpCost, so
        // the button shows exactly what will leave the batteries.
        const severity = E.anomalySeverity(y, timeline);
        const cost = E.jumpCost(y, timeline);
        const affordable = have >= cost;
        const b = document.createElement("button");
        b.className = "btn";
        b.innerHTML = severity
          ? `${y}<small> ${E.anomalyLabel(severity)} · −${cost}</small>`
          : `${y}<small> −${cost}</small>`;
        b.disabled = !affordable;
        b.title = affordable
          ? `Costs ${cost} charge (${E.eraReach(y)} era-steps back)`
          : `Needs ${cost} charge — you have ${have}`;
        b.onclick = () => pickChoice(y);
        grid.appendChild(b);
      }
      d.appendChild(grid);
    });
  }

  // All three boards are the same wallet: the market spends on the run, the
  // clinic on the operative, transit on the ground under them (see engine.js).
  function boardFlow(title, header, board) {
    openDrawer(title, (d) => {
      d.insertAdjacentHTML("beforeend", `<p class="narrative-flash">${header}</p>`);
      for (const offer of board) {
        const b = document.createElement("button");
        b.className = "choice";
        b.innerHTML = `<b>${offer.service.name} — ${offer.price} creds</b>` +
          `<small>${offer.available ? offer.service.effect : "locked — " + offer.reason}</small>`;
        b.disabled = !offer.available;
        b.onclick = () => buy(offer);
        d.appendChild(b);
      }
    });
  }

  function marketFlow() {
    boardFlow("Market — Energy Creds",
      `⌬ Balance: ${E.credBalance(timeline, world)} creds · ` +
      `${E.trustBand(E.trustMesh(timeline))} standing`,
      E.offers(timeline, world));
  }

  function clinicFlow() {
    const strain = E.bioStrain(timeline);
    boardFlow("Bio-clinic — augments & recovery",
      `⌬ Balance: ${E.credBalance(timeline, world)} creds · ` +
      `body <b>${E.bioBand(strain)}</b> (strain ${strain}, lifespan ${E.lifespan(timeline)}y)`,
      E.clinicOffers(timeline, world));
  }

  // The dust board is the whole decision on one screen: what each zone's air
  // reads right now, what a jump out of it costs, and what the sky does next —
  // the quiet window is scheduled, not stumbled into.
  function zonesFlow() {
    const here = E.currentZone(timeline);
    const sky = E.weather(timeline)[0];
    const ahead = E.forecast(timeline).map(([label]) => label).join(" → ");
    openDrawer("Smart Dust — the surveillance field", (d) => {
      d.insertAdjacentHTML("beforeend",
        `<p class="narrative-flash">◈ ${E.ZONE_NAMES[here]} · sky <b>${sky}</b>` +
        `<br>forecast: ${ahead}</p>`);
      const grid = document.createElement("div");
      for (const [zone, reading, band, anchor] of E.fieldReport(timeline)) {
        const exposure = E.bandHeat(reading);
        grid.insertAdjacentHTML("beforeend",
          `<div class="quest-field"><span>${zone === here ? "▸ " : ""}${E.ZONE_NAMES[zone]}</span> ` +
          `dust ${reading} (${band}) · ${exposure >= 0 ? "+" : ""}${exposure} heat/jump · ` +
          `+${anchor} charge/jump</div>`);
      }
      d.appendChild(grid);
      for (const offer of E.transitOffers(timeline, world)) {
        const b = document.createElement("button");
        b.className = "choice";
        b.innerHTML = `<b>${offer.service.name} — ${offer.price} creds</b>` +
          `<small>${offer.available ? offer.service.effect : "locked — " + offer.reason}</small>`;
        b.disabled = !offer.available;
        b.onclick = () => buy(offer);
        d.appendChild(b);
      }
    });
  }

  function buy(offer) {
    const action = E.CHOICE_BY_ID[offer.service.id];
    const clinical = !!E.AUGMENT_BY_ID[action.id] || action.id === E.POD_ID;
    const moved = !!E.zoneOf(action.id);
    timeline.push(action);
    // Purchases never rewrite the world — only the operative moves. A clinic
    // visit moves a different set of numbers than a market run, so it reports
    // the body and the standing it just cost.
    openDrawer(clinical ? "Bio-clinic" : moved ? "Maglev" : "Purchase", (d) => {
      const strain = E.bioStrain(timeline);
      const zone = E.currentZone(timeline);
      const reading = E.effectiveDensity(zone, timeline);
      d.insertAdjacentHTML("beforeend",
        `<p class="narrative-flash">» ${action.narrative}</p>` +
        `<div class="quest-field"><span>Paid</span> ${offer.price} creds</div>` +
        `<div class="quest-field"><span>Balance</span> ${E.credBalance(timeline, world)} creds</div>` +
        (clinical
          ? `<div class="quest-field"><span>Body</span> ${E.bioBand(strain)} (strain ${strain})</div>` +
            `<div class="quest-field"><span>Lifespan</span> ${E.lifespan(timeline)} years</div>` +
            `<div class="quest-field"><span>Trust Mesh</span> ${E.trustMesh(timeline)} (${E.trustBand(E.trustMesh(timeline))})</div>`
          : "") +
        // A move buys air, so it reports the air it bought — and the sky, which
        // the ticket itself just advanced.
        (moved
          ? `<div class="quest-field"><span>Zone</span> ${E.ZONE_NAMES[zone]}</div>` +
            `<div class="quest-field"><span>Dust</span> ${reading} (${E.dustBand(reading)}) · ` +
            `${E.jumpExposure(timeline) >= 0 ? "+" : ""}${E.jumpExposure(timeline)} heat/jump</div>` +
            `<div class="quest-field"><span>Sky</span> ${E.weather(timeline)[0]}</div>`
          : "") +
        `<div class="quest-field"><span>Charge</span> ${E.charge(timeline, world)}/${E.batteryCeiling(world, timeline)}</div>` +
        `<div class="quest-field"><span>Heat</span> ${E.heat(timeline)} (${E.heatTier(E.heat(timeline))})</div>`);
    });
    render();
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
    // Present-day actions aren't tampering — only real jumps resolve a timeline.
    // Being caught resolves one whatever the archetype says (the fail state).
    return E.liquidated(timeline)
      || (E.jumps(timeline).length > 0 && RESOLVED.has(E.archetype(world)[0]));
  }
  function showEnding() {
    const caught = E.liquidated(timeline);
    const [name, blurb] = E.archetype(world);
    const [tag, text] = caught ? E.LIQUIDATED : [E.ENDINGS[name] ? E.ENDINGS[name][0] : "★", blurb];
    document.querySelector(".victory-badge").textContent = tag.trim().charAt(0);
    $("victory-title").textContent = caught
      ? "LIQUIDATION ORDER EXECUTED" : E.flavoredEnding(world).toUpperCase();
    $("victory-blurb").textContent = text;
    document.querySelector(".victory-note").textContent = caught
      ? `The squads closed at ${E.LIQUIDATED_AT} pursuit. Rewind releases the last`
        + " move; Reset restores the continuum."
      : name === "Solar Utopia"
        ? "You rewrote the past and reassembled the ideal future."
        : "A different continuum — humanity chose another path entirely.";
    $("victory").classList.toggle("liquidated", caught);
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
    $("act-market").onclick = marketFlow;
    $("act-clinic").onclick = clinicFlow;
    $("act-zones").onclick = zonesFlow;
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
