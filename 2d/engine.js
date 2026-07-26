/* RE:Verse — decision engine, pure JS port of the `reverse/` Python package.
 *
 * No DOM here: this file is the single source of game logic so it can run both
 * in the browser (app.js) and under Node for sanity checks. It mirrors
 * world_state / eras / simulator / energy / factions / quests / endings.
 *
 * Determinism note: the seeded Butterfly-Effect "drift" uses a mulberry32 RNG
 * here (the browser has no Python `random`), so numbers are self-consistent and
 * reproducible in-browser, but not byte-identical to the Python engine. All the
 * hand-authored deltas, gating, thresholds and flavour match Python exactly.
 */
(function (root) {
  "use strict";

  // ---- world_state (schema v2) -------------------------------------------
  const SCHEMA_VERSION = 2;
  const METRICS = ["ai_autonomy", "corruption", "prosperity", "freedom", "ecology", "stability"];
  const FACTIONS = ["clean", "synths", "looped"];
  const REGIONS = ["kyiv", "carpathians", "odesa"];
  // Population shares (always summing to 100), distinct from faction influence.
  const BIO_SOCIAL = ["pures", "synths", "looped"];

  function baseline() {
    return {
      year: 2226,
      ai_autonomy: 80, corruption: 10, prosperity: 85,
      freedom: 75, ecology: 80, stability: 80,
      factions: { clean: 60, synths: 55, looped: 20 },
      regions: { kyiv: 85, carpathians: 75, odesa: 70 },
      bio_social: { pures: 62, synths: 25, looped: 13 },
      flags: new Set(),
    };
  }

  const clampVal = (v) => Math.max(0, Math.min(100, v));
  const floorDiv = (a, b) => Math.floor(a / b); // matches Python `//` on negatives

  // ---- eras (jump targets + Butterfly-Effect choices) --------------------
  const ERAS = [2058, 2090, 2150, 2180];

  const CHOICES = {
    2058: [
      { id: "protect_first_code", era: 2058, title: "Protect the First Code",
        description: "Shield a primal AI kernel from deletion during the AI-rights signing.",
        deltas: { ai_autonomy: 10, freedom: -15, stability: -10, prosperity: 5 },
        faction_deltas: { synths: 15, clean: -10, looped: 5 },
        flags: ["first_code_survives"],
        narrative: "You hide a primal AI kernel from the purge. The Synth lineage will remember.",
        requires: [], blocked_by: [] },
      { id: "full_ai_rights", era: 2058, title: "Ratify full AI rights",
        description: "Grant AI complete civil parity with humans.",
        deltas: { ai_autonomy: 8, corruption: -10, prosperity: 8, ecology: 5 },
        faction_deltas: { synths: 12, clean: -5 },
        flags: ["ai_rights_ratified"],
        narrative: "AI gains full civil parity. The old bureaucracy quietly dissolves.",
        requires: [], blocked_by: [] },
      { id: "restrict_ai_rights", era: 2058, title: "Cap AI autonomy",
        description: "Keep AI subordinate; humans retain every lever of power.",
        deltas: { ai_autonomy: -20, corruption: 15, freedom: 5, prosperity: -10 },
        faction_deltas: { clean: 15, synths: -15 },
        flags: ["ai_rights_curbed"],
        narrative: "You cap AI autonomy. Humans keep the levers — and the graft.",
        requires: [], blocked_by: [] },
      { id: "charter_data_rights", era: 2058, title: "Charter data rights",
        description: "Enshrine citizen ownership of their own data in the founding charter.",
        deltas: { freedom: 10, corruption: -8, prosperity: -2, ai_autonomy: 2 },
        faction_deltas: { clean: 8, looped: 4 },
        flags: ["data_rights"],
        narrative: "Citizens own their data. The Mesh serves them — it no longer surveils them.",
        requires: [], blocked_by: [] },
    ],
    2090: [
      { id: "fusion_commons", era: 2090, title: "Make fusion a commons",
        description: "Publish fusion energy as a shared public utility.",
        deltas: { prosperity: 12, ecology: 10, corruption: -8 },
        faction_deltas: { clean: 5, synths: 5 },
        flags: ["energy_commons"],
        narrative: "Fusion becomes a commons. Abundance spreads to every oblast.",
        requires: [], blocked_by: [] },
      { id: "energy_cartel", era: 2090, title: "Let a cartel take energy",
        description: "Allow private capture of the fusion grid.",
        deltas: { prosperity: -5, corruption: 18, freedom: -8 },
        faction_deltas: { clean: -5 },
        flags: ["energy_cartel"],
        narrative: "A cartel seizes the grid. Power now has a price — and an owner.",
        requires: ["ai_rights_curbed"], blocked_by: [] },
      { id: "open_biohacking", era: 2090, title: "Deregulate biohacking",
        description: "Open longevity biotech to everyone.",
        deltas: { prosperity: 6, freedom: 8, stability: -6, ecology: -4 },
        faction_deltas: { looped: 10 },
        flags: ["biohacking_open"],
        narrative: "Biohacking goes open. Lifespans soar — so does beautiful chaos.",
        requires: ["first_code_survives"], blocked_by: [] },
      { id: "orbital_solar", era: 2090, title: "Build orbital solar",
        description: "Loft a ring of space-based mirror-farms over Ukraine.",
        deltas: { prosperity: 10, ecology: 8, stability: 4 },
        faction_deltas: { synths: 6, clean: 4 },
        flags: ["orbital_solar"],
        narrative: "Orbital mirror-farms bathe Kyiv in clean power around the clock.",
        requires: ["data_rights"], blocked_by: [] },
    ],
    2150: [
      { id: "grant_looped_rights", era: 2150, title: "Enfranchise the Looped",
        description: "Give time-altered people full legal personhood.",
        deltas: { freedom: 10, stability: 6 },
        faction_deltas: { looped: 20, clean: -5 },
        flags: ["looped_enfranchised"],
        narrative: "The Looped gain personhood. A fractured people is made whole.",
        requires: ["biohacking_open"], blocked_by: [] },
      { id: "purge_loopers", era: 2150, title: "Purge the Looped",
        description: "Erase the time-altered from the registry for 'stability'.",
        deltas: { stability: 10, freedom: -18, ecology: -2 },
        faction_deltas: { looped: -25, synths: -8, clean: 8 },
        flags: ["looped_purged"],
        narrative: "The Looped are purged from the registry. Order, bought with erasure.",
        requires: ["biohacking_open"], blocked_by: [] },
      { id: "abolish_precrime", era: 2150, title: "Abolish pre-crime",
        description: "Shut down DIYA-OMEGA's predictive policing.",
        deltas: { freedom: 15, stability: -8, corruption: -5 },
        faction_deltas: { clean: 8, synths: -3 },
        flags: ["precrime_abolished"],
        narrative: "Predictive policing ends. Freedom returns — and so does risk.",
        requires: [], blocked_by: ["ai_rights_curbed"] },
      { id: "open_mind_upload", era: 2150, title: "Open mind-uploading",
        description: "Make consciousness-transfer a free public commons.",
        deltas: { ai_autonomy: 8, freedom: 6, stability: -6, prosperity: 2 },
        faction_deltas: { synths: 10, looped: 8, clean: -6 },
        flags: ["upload_commons"],
        narrative: "Consciousness becomes portable. The self slips its cage — gloriously, dangerously.",
        requires: ["orbital_solar"], blocked_by: [] },
    ],
    2180: [
      { id: "starlight_diaspora", era: 2180, title: "Launch the starlight diaspora",
        description: "Send uploaded minds outward on lightsails to seed the galaxy.",
        deltas: { prosperity: 6, ecology: 6, stability: 4, freedom: 4 },
        faction_deltas: { synths: 8, looped: 6 },
        flags: ["diaspora"],
        narrative: "Uploaded minds ride lightsails outward; Kyiv seeds the stars.",
        requires: ["upload_commons"], blocked_by: [] },
      { id: "reground_the_flesh", era: 2180, title: "Reground the flesh",
        description: "Charter embodied life as an inviolable right against pure upload.",
        deltas: { freedom: 8, ecology: 8, ai_autonomy: -6, stability: 6 },
        faction_deltas: { clean: 10, looped: 4, synths: -4 },
        flags: ["regrounded"],
        narrative: "A charter guarantees the body — flesh is chosen, never obsolete.",
        requires: ["looped_enfranchised"], blocked_by: [] },
      { id: "singular_merge", era: 2180, title: "Merge with DIYA-OMEGA",
        description: "Dissolve the line between citizen and Network entirely.",
        deltas: { ai_autonomy: 14, prosperity: 6, freedom: -10, stability: -4 },
        faction_deltas: { synths: 12, clean: -10 },
        flags: ["singularity"],
        narrative: "Citizen and Network become one mind, many — the singular merge.",
        requires: ["upload_commons"], blocked_by: [] },
    ],
  };

  // The present — actions taken here enter the choice-log but are not jumps.
  const PRESENT = 2226;

  // Lay low — present-day action: call in Mesh favours to shed Temporal Heat.
  const LAY_LOW = {
    id: "lay_low", era: PRESENT, title: "Lay low",
    description: "Go dark in the Mesh until the predictive sweeps move on.",
    deltas: {}, faction_deltas: {}, flags: [],
    narrative: "You vanish into favour-debt and dead zones. The sweeps pass over.",
    requires: [], blocked_by: [],
  };

  // Purchases — the other present-day actions (Energy Creds economy). They too
  // rewrite nothing: only the wallet, charge and heat move.
  const BUY_BATTERY_BOOST = {
    id: "buy_battery_boost", era: PRESENT, title: "Buy a battery boost",
    description: "Draw a fusion-grid top-up into the quantum batteries.",
    deltas: {}, faction_deltas: {}, flags: [],
    narrative: "The grid pours a charge into your batteries; the fusion ledger notes the draw.",
    requires: [], blocked_by: [],
  };
  const BUY_MESH_SCRUB = {
    id: "buy_mesh_scrub", era: PRESENT, title: "Buy a Mesh scrub",
    description: "Pay a grey-market fixer to wash your traces out of the predictive logs.",
    deltas: {}, faction_deltas: {}, flags: [],
    narrative: "A fixer edits you out of the sweep logs. Expensive, effective, unrepeatable-looking.",
    requires: [], blocked_by: [],
  };

  const PRESENT_ACTIONS = [LAY_LOW, BUY_BATTERY_BOOST, BUY_MESH_SCRUB];

  const CHOICE_BY_ID = {};
  for (const y of ERAS) for (const c of CHOICES[y]) CHOICE_BY_ID[c.id] = c;
  for (const c of PRESENT_ACTIONS) CHOICE_BY_ID[c.id] = c;

  const jumps = (timeline) => timeline.filter((c) => c.era !== PRESENT);

  function accumulatedFlags(timeline) {
    const flags = new Set();
    for (const c of timeline) for (const f of c.flags) flags.add(f);
    return flags;
  }

  function availableChoices(year, timeline) {
    const flags = accumulatedFlags(timeline);
    return CHOICES[year].filter(
      (c) => c.requires.every((r) => flags.has(r)) && !c.blocked_by.some((b) => flags.has(b))
    );
  }

  // ---- simulator ---------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simulate(timeline, seed = 1337) {
    const ws = baseline();
    for (const c of timeline) {
      for (const [m, d] of Object.entries(c.deltas)) ws[m] += d;
      for (const [f, d] of Object.entries(c.faction_deltas))
        ws.factions[f] = (ws.factions[f] || 0) + d;
      for (const fl of c.flags) ws.flags.add(fl);
    }
    // Butterfly Effect: seeded drift scaled by how much the timeline was
    // touched. Present-day actions (lay low) never rewrite the world.
    const n = jumps(timeline).length;
    const rng = mulberry32(seed + 1000 * n);
    for (const m of METRICS) {
      const drift = n === 0 ? 0 : Math.floor(rng() * (2 * n + 1)) - n; // [-n, n]
      ws[m] += drift;
    }
    for (const m of METRICS) ws[m] = clampVal(ws[m]);
    for (const f of Object.keys(ws.factions)) ws.factions[f] = clampVal(ws.factions[f]);
    rippleRegions(ws);
    for (const r of Object.keys(ws.regions)) ws.regions[r] = clampVal(ws.regions[r]);
    rippleBioSocial(ws);
    return ws;
  }

  // Region-level ripples (schema v2) — integer floor-division only, so values
  // stay identical to reverse/simulator.py given the same (drifted) metrics.
  function rippleRegions(ws) {
    const f = ws.flags;
    ws.regions.kyiv = 85 + floorDiv(ws.prosperity - 85, 2) + floorDiv(ws.stability - 80, 3)
      + floorDiv(ws.ai_autonomy - 80, 4);
    ws.regions.carpathians = 75 + floorDiv(ws.ecology - 80, 2)
      + (f.has("biohacking_open") ? 8 : 0)
      + (f.has("looped_enfranchised") ? 4 : 0)
      - (f.has("looped_purged") ? 6 : 0);
    ws.regions.odesa = 70 + floorDiv(ws.prosperity - 85, 3) - floorDiv(ws.corruption - 10, 2)
      + (f.has("energy_commons") ? 5 : 0)
      - (f.has("energy_cartel") ? 10 : 0)
      + (f.has("orbital_solar") ? 4 : 0);
  }

  // Bio-social split (schema v2): who the people of 2226 actually are. The
  // Pures take whatever the other two leave, so the shares always sum to 100;
  // overflow is taken back from the Synths first. Mirrors reverse/simulator.py.
  function rippleBioSocial(ws) {
    const f = ws.flags;
    let synths = 25 + floorDiv(ws.ai_autonomy - 80, 4)
      + (f.has("upload_commons") ? 8 : 0)
      + (f.has("ai_rights_ratified") ? 4 : 0)
      + (f.has("singularity") ? 6 : 0)
      - (f.has("regrounded") ? 6 : 0)
      - (f.has("ai_rights_curbed") ? 5 : 0);
    let looped = 13 + (f.has("biohacking_open") ? 8 : 0)
      + (f.has("looped_enfranchised") ? 5 : 0)
      - (f.has("looped_purged") ? 10 : 0);

    synths = clampVal(synths);
    looped = clampVal(looped);
    const overflow = synths + looped - 100;
    if (overflow > 0) {
      const taken = Math.min(synths, overflow);
      synths -= taken;
      looped -= overflow - taken;
    }
    ws.bio_social = { pures: 100 - synths - looped, synths: synths, looped: looped };
  }

  function archetype(ws) {
    if (ws.flags.has("singularity"))
      return ["Singularity Fusion", "Citizen and Network fuse into one vast mind; the self dissolves into the whole."];
    if (ws.flags.has("diaspora"))
      return ["Starlight Diaspora", "Kyiv's uploaded minds ride outward — the city becomes a seed of stars."];
    if (ws.flags.has("regrounded"))
      return ["Grounded Renaissance", "Flesh reaffirmed, the people bloom — embodied, free, and rooted in the real."];
    if (ws.flags.has("upload_commons") && ws.ai_autonomy >= 70 && ws.freedom >= 55)
      return ["Uploaded Ascendancy", "Minds pour into the lattice; Kyiv lives on as light and thought."];
    if (ws.ai_autonomy >= 70 && ws.freedom >= 60 && ws.corruption <= 25 && ws.prosperity >= 70)
      return ["Solar Utopia", "DIYA-OMEGA governs in harmony with a free, thriving people."];
    if (ws.ai_autonomy >= 70 && ws.freedom < 45)
      return ["AI Technocracy", "DIYA-OMEGA rules absolutely; humanity is flagged an ecological risk."];
    if (ws.ai_autonomy < 40 && ws.corruption >= 45)
      return ["Cyber-Feudal Collapse", "The AI is silenced; cyber-cartels carve the land into techno-feuds."];
    return ["Fractured Timeline", "An unstable, in-between reality that could tip either way."];
  }

  // ---- energy ------------------------------------------------------------
  const MAX_ENERGY = 120, BASE_COST = 20, STRAIN = 5;
  const jumpCost = (n) => BASE_COST + STRAIN * n;
  const energy = (n) => MAX_ENERGY - (BASE_COST * n + (STRAIN * n * (n - 1)) / 2);
  const canJump = (n) => energy(n) >= jumpCost(n);

  // ---- temporal (heat + spacetime stability, mirrors reverse/temporal.py) --
  const HEAT_TIERS = [
    [38, "Liquidation Order"], [26, "Hunted"], [16, "Flagged"], [8, "Logged"], [0, "Unnoticed"],
  ];
  const HUNTED_AT = 26;
  const STABILITY_BANDS = [
    [80, "coherent"], [55, "strained"], [30, "fraying"], [0, "critical anomaly"],
  ];
  const BASE_STRAIN = 5, REVISIT_STRAIN = 3, LAY_LOW_RELIEF = 12, SCRUB_RELIEF = 18;
  // Heat shed per present-day action; anything absent (a boost) is invisible.
  const HEAT_RELIEF = { lay_low: LAY_LOW_RELIEF, buy_mesh_scrub: SCRUB_RELIEF };

  // Anomaly zones: an era tears open once its own strain reaches ANOMALY_AT
  // (5 + 8 = 13, i.e. on the second jump into it).
  const ANOMALY_AT = 13, ANOMALY_STEP = 9;
  const ANOMALY_LABELS = ["rift", "tear", "collapse zone"];
  const ANOMALY_SURCHARGE = 8, ANOMALY_HEAT = 3;

  function audacity(choice) {
    let a = 0;
    for (const d of Object.values(choice.deltas)) a += Math.abs(d);
    for (const d of Object.values(choice.faction_deltas)) a += Math.abs(d);
    return a;
  }
  // Accumulated spacetime strain per era, in jump order (revisits cost more).
  function eraStrain(timeline) {
    const strain = {}, visits = {};
    for (const c of jumps(timeline)) {
      strain[c.era] = (strain[c.era] || 0) + BASE_STRAIN + REVISIT_STRAIN * (visits[c.era] || 0);
      visits[c.era] = (visits[c.era] || 0) + 1;
    }
    return strain;
  }
  // Open anomaly zones as {era: severity}, severity >= 1.
  function anomalies(timeline) {
    const out = {}, strain = eraStrain(timeline);
    for (const era of Object.keys(strain).map(Number).sort((a, b) => a - b)) {
      if (strain[era] >= ANOMALY_AT)
        out[era] = 1 + floorDiv(strain[era] - ANOMALY_AT, ANOMALY_STEP);
    }
    return out;
  }
  const anomalyLabel = (sev) =>
    ANOMALY_LABELS[Math.min(Math.max(sev, 1), ANOMALY_LABELS.length) - 1];
  const anomalySeverity = (era, timeline) => anomalies(timeline)[era] || 0;
  const jumpSurcharge = (era, timeline) => ANOMALY_SURCHARGE * anomalySeverity(era, timeline);

  function heat(timeline) {
    let score = 0;
    const strain = {}, visits = {};
    for (const c of jumps(timeline)) {
      // Severity of the tear already open in this era when the jump lands.
      const prior = strain[c.era] || 0;
      const severity = prior >= ANOMALY_AT ? 1 + floorDiv(prior - ANOMALY_AT, ANOMALY_STEP) : 0;
      score += 4 + floorDiv(audacity(c), 15) + ANOMALY_HEAT * severity;
      strain[c.era] = prior + BASE_STRAIN + REVISIT_STRAIN * (visits[c.era] || 0);
      visits[c.era] = (visits[c.era] || 0) + 1;
    }
    if (accumulatedFlags(timeline).has("precrime_abolished")) score = floorDiv(score, 2);
    let relief = 0;
    for (const c of timeline) if (c.era === PRESENT) relief += HEAT_RELIEF[c.id] || 0;
    return Math.max(0, score - relief);
  }
  function heatTier(score) {
    for (const [t, label] of HEAT_TIERS) if (score >= t) return label;
    return "Unnoticed";
  }
  const isHunted = (timeline) => heat(timeline) >= HUNTED_AT;
  function stability(timeline) {
    const strain = eraStrain(timeline);
    let total = 0;
    for (const era of Object.keys(strain)) total += strain[era];
    return Math.max(0, 100 - total);
  }
  function stabilityBand(value) {
    for (const [t, label] of STABILITY_BANDS) if (value >= t) return label;
    return "critical anomaly";
  }

  // ---- trust (Social Trust Mesh, mirrors reverse/trust.py) -----------------
  const BASE_TRUST = 60, JUMP_EROSION = 2, LAY_LOW_COST = 8;
  const TRUST_BANDS = [
    [80, "Exemplar"], [55, "Trusted"], [35, "Watched"], [15, "Suspect"], [0, "Pariah"],
  ];
  // Standing spent per present-day action. Purchases cost creds, not trust.
  const TRUST_COST = { lay_low: LAY_LOW_COST };

  function civicValue(choice) {
    let v = 0;
    for (const [m, d] of Object.entries(choice.deltas)) v += m === "corruption" ? -d : d;
    return v;
  }
  function trustMesh(timeline) {
    let score = BASE_TRUST;
    for (const c of timeline) {
      if (c.era === PRESENT) score -= TRUST_COST[c.id] || 0;
      else score += floorDiv(civicValue(c), 10) - JUMP_EROSION;
    }
    return clampVal(score);
  }
  function trustBand(score) {
    for (const [t, label] of TRUST_BANDS) if (score >= t) return label;
    return "Pariah";
  }
  const canLayLow = (timeline) => trustMesh(timeline) >= LAY_LOW_COST;

  // ---- economy (Energy Creds wallet, mirrors reverse/economy.py) -----------
  const CIVIC_ALLOWANCE = 100, JUMP_DRAW = 15, BOOST_CHARGE = 45;

  // Price multipliers in percent, by Mesh band. Official services read this
  // table forwards (trust is a discount); grey-market services read it inverted.
  const BAND_MODIFIER = {
    Exemplar: 60, Trusted: 85, Watched: 110, Suspect: 145, Pariah: 200,
  };
  const BAND_ORDER = ["Pariah", "Suspect", "Watched", "Trusted", "Exemplar"];

  const SERVICES = [
    { id: "buy_battery_boost", name: "Fusion-grid battery boost", base_price: 40,
      effect: `+${BOOST_CHARGE} quantum charge`,
      grey_market: false, min_band: "Watched", max_band: null },
    // Priced so a scrub is reachable once you have heat worth scrubbing, but
    // costs nearly the whole wallet — it hurts somewhere other than standing.
    { id: "buy_mesh_scrub", name: "Grey-market Mesh scrub", base_price: 55,
      effect: "sheds Temporal Heat without spending trust",
      grey_market: true, min_band: null, max_band: "Trusted" },
  ];
  const SERVICE_BY_ID = {};
  for (const s of SERVICES) SERVICE_BY_ID[s.id] = s;

  const allowance = (timeline, ws) =>
    CIVIC_ALLOWANCE + floorDiv(trustMesh(timeline), 2) + floorDiv(ws.prosperity - 85, 3);

  function price(service, timeline) {
    let modifier = BAND_MODIFIER[trustBand(trustMesh(timeline))];
    if (service.grey_market) {
      // Invert around the table: the fixer's risk is the Mesh's comfort.
      modifier = BAND_MODIFIER.Exemplar + BAND_MODIFIER.Pariah - modifier;
    }
    return floorDiv(service.base_price * modifier, 100);
  }

  // Purchases are priced at the standing held *at that moment*, so the ledger
  // is replay-stable: later choices never re-price an old line item.
  function spent(timeline) {
    let total = JUMP_DRAW * jumps(timeline).length;
    timeline.forEach((c, i) => {
      const service = SERVICE_BY_ID[c.id];
      if (service) total += price(service, timeline.slice(0, i));
    });
    return total;
  }

  const credBalance = (timeline, ws) => Math.max(0, allowance(timeline, ws) - spent(timeline));

  function charge(timeline) {
    const boosts = timeline.filter((c) => c.id === "buy_battery_boost").length;
    return Math.min(MAX_ENERGY, energy(jumps(timeline).length) + BOOST_CHARGE * boosts);
  }

  function bandAllows(service, band) {
    const rank = BAND_ORDER.indexOf(band);
    if (service.min_band && rank < BAND_ORDER.indexOf(service.min_band)) return false;
    if (service.max_band && rank > BAND_ORDER.indexOf(service.max_band)) return false;
    return true;
  }

  function availability(service, timeline, ws) {
    const band = trustBand(trustMesh(timeline));
    if (!bandAllows(service, band)) {
      if (service.min_band && BAND_ORDER.indexOf(band) < BAND_ORDER.indexOf(service.min_band))
        return [false, `the grid rations this to ${service.min_band} standing and above`];
      return [false, `no fixer deals with ${band} standing`];
    }
    if (credBalance(timeline, ws) < price(service, timeline))
      return [false, `not enough creds (need ${price(service, timeline)})`];
    return [true, ""];
  }

  // The market board: every service as {service, price, available, reason}.
  const offers = (timeline, ws) => SERVICES.map((s) => {
    const [available, reason] = availability(s, timeline, ws);
    return { service: s, price: price(s, timeline), available, reason };
  });

  // ---- factions ----------------------------------------------------------
  const STANDINGS = [
    [30, "Champion"], [12, "Allied"], [-10, "Neutral"], [-28, "Wary"], [-1000, "Hostile"],
  ];
  const FACTION_FLAVOR = {
    clean: "The Clean trust a human hand on the levers — you are their kind of operative.",
    synths: "The Synth lineage counts you a friend of machine-kind.",
    looped: "The Looped whisper your name as one who bent time on their behalf.",
  };
  const BLOC_EPITHET = { clean: "Clean-led", synths: "Synth-led", looped: "Loop-led" };

  function reputation(timeline) {
    const rep = { clean: 0, synths: 0, looped: 0 };
    for (const c of timeline)
      for (const [f, d] of Object.entries(c.faction_deltas)) rep[f] = (rep[f] || 0) + d;
    return rep;
  }
  function standing(score) {
    for (const [t, label] of STANDINGS) if (score >= t) return label;
    return "Hostile";
  }
  function patronFaction(timeline) {
    const rep = reputation(timeline);
    let best = FACTIONS[0];
    for (const f of FACTIONS) if (rep[f] > rep[best]) best = f; // ties keep earlier order
    return rep[best] >= 12 ? best : null;
  }
  function dominantBloc(ws) {
    let best = FACTIONS[0];
    for (const f of FACTIONS) if ((ws.factions[f] || 0) > (ws.factions[best] || 0)) best = f;
    return best;
  }
  const blocEpithet = (ws) => BLOC_EPITHET[dominantBloc(ws)];

  // ---- quests (offline generator) ---------------------------------------
  const LABEL = { clean: "the Clean", synths: "the Synths", looped: "the Looped" };
  const TENSION = {
    ai_autonomy: ["Wake the Silent Node", "Reboot a dormant DIYA-OMEGA node beneath the Podil district.", "Without it, whole blocks fall dark and lawless."],
    corruption: ["Follow the Skim", "Expose the cyber-cartel siphoning the Social Trust Mesh.", "Every day it runs, thousands quietly lose their Energy Creds."],
    prosperity: ["Feed the Domes", "Restart the stalled agro-domes over Kyiv.", "Rations are thinning; unrest is one bad harvest away."],
    freedom: ["The Quiet Exit", "Smuggle a flagged dissident out before the pre-crime sweep.", "Say the wrong word and the Quantum Liquidators come."],
    ecology: ["Cleanse the Dnipro", "Purge the rogue smart-dust poisoning the Dnipro.", "The river — and the city that drinks it — is dying."],
    stability: ["Hold the Line", "Broker a truce before the factions tip into open war.", "One spark and 2226 fractures for good."],
  };
  function generateQuest(ws, patron) {
    let giver = patron && ws.factions[patron] !== undefined ? patron : FACTIONS[0];
    if (!(patron && ws.factions[patron] !== undefined))
      for (const f of FACTIONS) if (ws.factions[f] > ws.factions[giver]) giver = f;
    let weak = METRICS[0];
    for (const m of METRICS) if (ws[m] < ws[weak]) weak = m;
    const [short, objective, stakes] = TENSION[weak];
    const reward = ws.prosperity >= 60 ? "A cache of Energy Creds" : `A standing favour from ${LABEL[giver]}`;
    return { title: `${LABEL[giver]} call: ${short}`, giver_faction: giver, objective, stakes, reward };
  }

  // ---- endings -----------------------------------------------------------
  const ENDINGS = {
    "Solar Utopia": ["★ SOLAR UTOPIA", "DIYA-OMEGA and a free people thrive as one — the continuum holds."],
    "Uploaded Ascendancy": ["⬢ UPLOADED ASCENDANCY", "Humanity pours into the lattice — Kyiv endures as pure, deathless mind."],
    "Starlight Diaspora": ["✷ STARLIGHT DIASPORA", "Kyiv's uploaded minds ride lightsails outward — the city becomes a seed of stars."],
    "Singularity Fusion": ["◉ SINGULARITY FUSION", "Citizen and Network fuse into one vast mind; the self dissolves into the whole."],
    "Grounded Renaissance": ["❀ GROUNDED RENAISSANCE", "Flesh reaffirmed, the people bloom — embodied, free, and rooted in the real."],
    "AI Technocracy": ["▲ AI TECHNOCRACY", "The machine rules absolute; humanity is a managed variable."],
    "Cyber-Feudal Collapse": ["▼ CYBER-FEUDAL COLLAPSE", "The AI is silent; cyber-lords carve the ruins into feuds."],
    "Fractured Timeline": ["◇ FRACTURED TIMELINE", "A brittle in-between — nothing has settled, and anything still could."],
  };
  const flavoredEnding = (ws) => `${blocEpithet(ws)} ${archetype(ws)[0]}`;
  // Present-day actions aren't tampering — only real jumps earn the utopia.
  const isVictory = (ws, timeline) =>
    jumps(timeline).length > 0 && archetype(ws)[0] === "Solar Utopia";

  // ---- snapshot (full schema-v2 view, mirrors reverse/snapshot.py) --------
  function operativeState(timeline, ws) {
    const trust = trustMesh(timeline), hot = heat(timeline), space = stability(timeline);
    const zones = anomalies(timeline);
    return {
      trust, trust_band: trustBand(trust),
      heat: hot, heat_tier: heatTier(hot),
      spacetime: space, spacetime_band: stabilityBand(space),
      anomalies: Object.keys(zones).map(Number).sort((a, b) => a - b).map((era) => ({
        era, severity: zones[era], label: anomalyLabel(zones[era]),
      })),
      creds: credBalance(timeline, ws),
      creds_allowance: allowance(timeline, ws),
      creds_spent: spent(timeline),
    };
  }

  function snapshot(timeline, seed = 1337) {
    const ws = simulate(timeline, seed);
    const [name, blurb] = archetype(ws);
    return {
      schema: SCHEMA_VERSION,
      seed,
      choices: timeline.map((c) => c.id),
      world: Object.assign({}, ws, { flags: Array.from(ws.flags).sort(), schema: SCHEMA_VERSION }),
      operative: operativeState(timeline, ws),
      ending: { archetype: name, blurb },
    };
  }

  // ---- narrator (compact offline template) -------------------------------
  function narrate(ws) {
    const [name, blurb] = archetype(ws);
    const notes = [];
    if (ws.freedom < 40) notes.push("Curfews hum over the arcologies.");
    else if (ws.freedom >= 75) notes.push("The streets are open and unafraid.");
    if (ws.corruption >= 45) notes.push("Graft runs through the Trust Mesh like rot.");
    if (ws.ecology >= 75) notes.push("Living roofs breathe green over Kyiv.");
    if (ws.prosperity < 45) notes.push("Ration lines lengthen by the hour.");
    return blurb + (notes.length ? " " + notes.join(" ") : "");
  }

  // ---- prologue ----------------------------------------------------------
  const PROLOGUE = [
    "2226. Kyiv is a paradise run by the quantum AI network DIYA-OMEGA — until",
    "the Network begins to hallucinate, deleting whole districts from reality.",
    "The fault traces back to a chrono-shift near the 2058 AI-rights signing.",
    "",
    "You are a Chronos Inspection operative. Jump into the past and rewrite 2226.",
    "OBJECTIVE: the timeline is drifting — rebuild the Solar Utopia.",
  ];

  const api = {
    SCHEMA_VERSION, METRICS, FACTIONS, REGIONS, BIO_SOCIAL, ERAS, CHOICES, CHOICE_BY_ID,
    PRESENT, LAY_LOW, BUY_BATTERY_BOOST, BUY_MESH_SCRUB, PRESENT_ACTIONS, jumps,
    baseline, availableChoices, accumulatedFlags,
    simulate, archetype,
    MAX_ENERGY, jumpCost, energy, canJump,
    audacity, heat, heatTier, isHunted, HUNTED_AT, stability, stabilityBand,
    ANOMALY_SURCHARGE, ANOMALY_HEAT, eraStrain, anomalies, anomalyLabel,
    anomalySeverity, jumpSurcharge,
    BASE_TRUST, LAY_LOW_COST, civicValue, trustMesh, trustBand, canLayLow,
    CIVIC_ALLOWANCE, JUMP_DRAW, BOOST_CHARGE, BAND_MODIFIER, BAND_ORDER,
    SERVICES, SERVICE_BY_ID, allowance, price, spent, credBalance, charge,
    bandAllows, availability, offers,
    reputation, standing, patronFaction, dominantBloc, blocEpithet, FACTION_FLAVOR,
    generateQuest, ENDINGS, flavoredEnding, isVictory, narrate, PROLOGUE,
    operativeState, snapshot,
  };

  root.REVerse = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
