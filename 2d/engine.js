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

  // Bio-clinic actions — the present-day entries that change the *operative*
  // rather than Ukraine. The tree and its costs live in the augments section.
  const clinicAction = (id, title, description, narrative) => ({
    id, era: PRESENT, title, description,
    deltas: {}, faction_deltas: {}, flags: [], narrative,
    requires: [], blocked_by: [],
  });
  const INSTALL_LONGEVITY_LATTICE = clinicAction(
    "install_longevity_lattice", "Install a longevity lattice",
    "Have a lattice grown through the skeleton — the frame the rest bolts to.",
    "The lattice takes root through your bones. Decades you had not counted on settle in."
  );
  const INSTALL_NEURAL_GOVERNOR = clinicAction(
    "install_neural_governor", "Install a neural governor",
    "Let a governor smooth the spikes a Chronos Jump leaves in your signature.",
    "The governor comes online. To the Mesh, your passages through the continuum read as weather."
  );
  const INSTALL_FUSION_WEAVE = clinicAction(
    "install_fusion_weave", "Install a fusion cell weave",
    "Thread grid-grade cells through the chest cavity — carry your own charge.",
    "Cells thread through your chest and warm. You are, in a small way, part of the grid now."
  );
  const INSTALL_CHRONO_MARROW = clinicAction(
    "install_chrono_marrow", "Install chrono-stabilised marrow",
    "Rebuild the marrow to absorb wormhole shear instead of passing it on.",
    "They replace your marrow while you watch. The shear of the next jump lands somewhere softer."
  );
  const USE_RECOVERY_POD = clinicAction(
    "use_recovery_pod", "Use a recovery pod",
    "Sleep off the damage in a pod until the Looped markers fade back down.",
    "The pod closes over you. Hours later the tremor is gone and the mirror looks like you again."
  );

  // Relocations — the present-day entries that move the operative between the
  // three flagship zones. The dust field and the fares live further down; these
  // are only the log entries that carry a move.
  const RELOCATE_KYIV = clinicAction(
    "relocate_kyiv", "Ride the maglev to Kyiv",
    "Return to the megacity — the Chronos anchor, and the thickest air in Canton.",
    "The maglev drops you under Kyiv. The dust here is old and thorough; it knows you came back."
  );
  const RELOCATE_CARPATHIANS = clinicAction(
    "relocate_carpathians", "Ride the maglev to the Carpathians",
    "Go up into the mycelial uplands, where the seeding budget never reached.",
    "The line climbs into the Mesh. Above the treeline the air stops listening, and the wormhole gets further away."
  );
  const RELOCATE_ODESA = clinicAction(
    "relocate_odesa", "Ride the maglev to Odesa",
    "Work out of the hydro-dome, instrumented where the cargo is and nowhere else.",
    "The dome closes over the port. The dust here follows freight, not people — mostly."
  );

  const PRESENT_ACTIONS = [
    LAY_LOW, BUY_BATTERY_BOOST, BUY_MESH_SCRUB,
    INSTALL_LONGEVITY_LATTICE, INSTALL_NEURAL_GOVERNOR, INSTALL_FUSION_WEAVE,
    INSTALL_CHRONO_MARROW, USE_RECOVERY_POD,
    RELOCATE_KYIV, RELOCATE_CARPATHIANS, RELOCATE_ODESA,
  ];

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

  // ---- powers (emergent blocs, mirrors reverse/powers.py) -----------------
  // The four powers nobody votes into being: derived from the world the way
  // regions and the bio-social split are, never moved by a choice's deltas.
  const POWERS = ["resistance", "liquidators", "synergists", "cartels"];
  const POWER_NAMES = {
    resistance: "Right-to-Work Resistance",
    liquidators: "Quantum Liquidators",
    synergists: "DIYA-OMEGA Synergists",
    cartels: "Cyber-Oligarch Cartels",
  };
  const POWER_FLAVOR = {
    resistance: "Picket lines and sabotage cells — Canton argues about who gets to work.",
    liquidators: "Predictive sweeps run the streets; the Network polices its own future.",
    synergists: "Civic assemblies and the Network pull the same way — governance feels effortless.",
    cartels: "Contracts are written between the smart-contracts; access has an owner again.",
  };
  // Exactly what the untouched Autonomous Hegemony yields — the offsets below
  // are read against these, so they are constants, not magic numbers.
  const AUTOMATION_BASE = 58;
  const POWER_BASE = { resistance: 15, liquidators: 55, synergists: 60, cartels: 12 };

  // 0-100: how much of Canton's work and governance runs without human hands.
  function automationIndex(ws) {
    const f = ws.flags;
    return clampVal(floorDiv(ws.ai_autonomy * 3 + ws.bio_social.synths * 2, 5)
      + (f.has("singularity") ? 8 : 0)
      + (f.has("upload_commons") ? 5 : 0)
      - (f.has("regrounded") ? 10 : 0)
      - (f.has("ai_rights_curbed") ? 6 : 0));
  }

  function powerBlocs(ws) {
    const f = ws.flags;
    const automation = automationIndex(ws);
    // Machines took the work; the surplus and the vote were kept from you.
    const resistance = POWER_BASE.resistance
      + floorDiv(automation - AUTOMATION_BASE, 2)
      + floorDiv(85 - ws.prosperity, 3)
      + floorDiv(75 - ws.freedom, 4)
      + (f.has("ai_rights_curbed") ? 10 : 0)
      + (f.has("looped_purged") ? 8 : 0)
      - (f.has("regrounded") ? 6 : 0);
    // Pre-crime is their mandate; abolishing it takes the mandate away.
    const liquidators = POWER_BASE.liquidators
      + floorDiv(ws.ai_autonomy - 80, 2)
      + floorDiv(75 - ws.freedom, 3)
      + (f.has("singularity") ? 10 : 0)
      - (f.has("data_rights") ? 8 : 0)
      - (f.has("precrime_abolished") ? 30 : 0);
    // A Network that visibly delivers; graft is what discredits it.
    const synergists = POWER_BASE.synergists
      + floorDiv(ws.prosperity - 85, 2)
      + floorDiv(10 - ws.corruption, 2)
      + (f.has("ai_rights_ratified") ? 8 : 0)
      + (f.has("energy_commons") ? 6 : 0)
      - (f.has("ai_rights_curbed") ? 12 : 0);
    // Capital returns through the gaps the Network leaves behind.
    const cartels = POWER_BASE.cartels
      + floorDiv((ws.corruption - 10) * 2, 3)
      + floorDiv(80 - ws.ai_autonomy, 3)
      + (f.has("energy_cartel") ? 20 : 0)
      - (f.has("energy_commons") ? 6 : 0)
      - (f.has("data_rights") ? 5 : 0);
    const values = [resistance, liquidators, synergists, cartels];
    const out = {};
    POWERS.forEach((p, i) => { out[p] = clampVal(values[i]); });
    return out;
  }

  // Strongest emergent power; ties break by the fixed POWERS order.
  function ascendantPower(ws) {
    const blocs = powerBlocs(ws);
    let best = POWERS[0];
    for (const p of POWERS) if (blocs[p] > blocs[best]) best = p;
    return best;
  }

  // ---- smart dust (surveillance field, mirrors reverse/dust.py) -----------
  // Canton's air is instrumented. Sits before temporal because the field is
  // what the heat analytics actually read, and before energy because the quiet
  // zones sit far from the Chronos anchor and every jump pays for the distance.
  const ZONES = ["kyiv", "carpathians", "odesa"];
  const HOME_ZONE = "kyiv";
  const ZONE_NAMES = {
    kyiv: "Kyiv Megacity",
    carpathians: "Carpathian Mesh",
    odesa: "Odesa Hydro-Dome",
  };
  const BASELINE_DENSITY = { kyiv: 62, carpathians: 26, odesa: 41 };
  // How the past re-seeds the field: these are the flags whose whole point was
  // who gets to watch whom, so surveillance is where they land hardest.
  const FLAG_DENSITY = {
    precrime_abolished: -20, data_rights: -14, regrounded: -10,
    orbital_solar: 8, looped_purged: 9, upload_commons: 10,
    energy_cartel: 12, singularity: 16,
  };
  // Canton's weather programme: [label, density shift], one phase per
  // present-day action. The order is the tuning — buying a maglev ticket is
  // itself an action, so relocating and jumping straight away lands you under
  // the inversion; the quiet window is one action further on.
  const WEATHER_CYCLE = [
    ["clear skies", 0], ["thermal inversion", 18], ["ion storm", -16], ["seeding rain", -6],
  ];
  // [lower bound, label, heat per jump]. Kyiv's baseline sits in `dense`, which
  // is worth zero, so an untouched run is exactly as loud as it was before.
  const DUST_BANDS = [
    [70, "saturated", 3], [45, "dense", 0], [20, "thin", -1], [0, "swept", -3],
  ];
  const ZONE_ANCHOR = { kyiv: 0, odesa: 4, carpathians: 9 };
  const ZONE_FARE = { kyiv: 10, odesa: 14, carpathians: 18 };
  const RELOCATE_PREFIX = "relocate_";

  const relocateId = (zone) => `${RELOCATE_PREFIX}${zone}`;
  function zoneOf(choiceId) {
    if (!choiceId.startsWith(RELOCATE_PREFIX)) return "";
    const zone = choiceId.slice(RELOCATE_PREFIX.length);
    return zone in ZONE_ANCHOR ? zone : "";
  }
  // Where the operative is standing now — the last relocation, or home.
  function currentZone(timeline) {
    let zone = HOME_ZONE;
    for (const c of timeline) {
      const moved = zoneOf(c.id);
      if (moved) zone = moved;
    }
    return zone;
  }
  // One phase per present-day action: a jump returns you to the moment you
  // left, so the only time that passes in 2226 is time spent in 2226.
  function weatherPhase(timeline) {
    let n = 0;
    for (const c of timeline) if (c.era === PRESENT) n += 1;
    return n % WEATHER_CYCLE.length;
  }
  const weather = (timeline) => WEATHER_CYCLE[weatherPhase(timeline)];
  function forecast(timeline, ahead = 3) {
    const start = weatherPhase(timeline), out = [];
    for (let n = 1; n <= ahead; n += 1) out.push(WEATHER_CYCLE[(start + n) % WEATHER_CYCLE.length]);
    return out;
  }
  function dustDensity(zone, timeline) {
    let seeded = BASELINE_DENSITY[zone];
    for (const f of accumulatedFlags(timeline)) seeded += FLAG_DENSITY[f] || 0;
    return Math.max(0, Math.min(100, seeded));
  }
  const effectiveDensity = (zone, timeline) =>
    Math.max(0, Math.min(100, dustDensity(zone, timeline) + weather(timeline)[1]));
  function dustBand(value) {
    for (const [t, label] of DUST_BANDS) if (value >= t) return label;
    return "swept";
  }
  function bandHeat(value) {
    for (const [t, , h] of DUST_BANDS) if (value >= t) return h;
    return DUST_BANDS[DUST_BANDS.length - 1][2];
  }
  const jumpExposure = (timeline) => bandHeat(effectiveDensity(currentZone(timeline), timeline));
  const anchorSurcharge = (timeline) => ZONE_ANCHOR[currentZone(timeline)];
  const relocateReason = (zone, timeline) =>
    (currentZone(timeline) === zone ? "you are already there" : "");
  // The zone board: [zone, effective density, band, anchor surcharge].
  const fieldReport = (timeline) => ZONES.map((z) => {
    const reading = effectiveDensity(z, timeline);
    return [z, reading, dustBand(reading), ZONE_ANCHOR[z]];
  });

  // ---- temporal (heat + spacetime stability, mirrors reverse/temporal.py) --
  const HEAT_TIERS = [
    [38, "Liquidation Order"], [26, "Hunted"], [16, "Flagged"], [8, "Logged"], [0, "Unnoticed"],
  ];
  const HUNTED_AT = 26;
  // When the squads deploy is not fixed: it bends with how strong the
  // Liquidator bloc grew in the timeline you built (see powerBlocs above).
  const LIQUIDATOR_PIVOT = 55, HUNT_SHIFT = 5, HUNT_FLOOR = 8, HUNT_CEILING = 44;
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
    // Walked with its index rather than filtered down to jumps: a jump is as
    // loud as the air it was launched through, and the field is read at that
    // moment in the log (see the smart dust section).
    for (let i = 0; i < timeline.length; i += 1) {
      const c = timeline[i];
      if (c.era === PRESENT) continue;
      // Severity of the tear already open in this era when the jump lands.
      const prior = strain[c.era] || 0;
      const severity = prior >= ANOMALY_AT ? 1 + floorDiv(prior - ANOMALY_AT, ANOMALY_STEP) : 0;
      score += 4 + floorDiv(audacity(c), 15) + ANOMALY_HEAT * severity
        + jumpExposure(timeline.slice(0, i));
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
  // Heat at which Liquidator squads deploy, given who holds this Canton.
  function huntThreshold(ws) {
    const shifted = HUNTED_AT - floorDiv(powerBlocs(ws).liquidators - LIQUIDATOR_PIVOT, HUNT_SHIFT);
    return Math.max(HUNT_FLOOR, Math.min(HUNT_CEILING, shifted));
  }
  const isHunted = (timeline, ws) => heat(timeline) >= huntThreshold(ws);
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

  // ---- augments (bio-hacking progression, mirrors reverse/augments.py) ----
  // The one axis that changes the operative instead of the world. Sits after
  // temporal because riding a torn era is what damages a body, and before
  // energy/trust because those are the systems the tree buys modifiers to.
  const BASE_LIFESPAN = 150, ANOMALY_STRAIN = 4, POD_RELIEF = 14;
  const POD_ID = "use_recovery_pod", POD_PRICE = 30;
  // What each augment buys, as offsets against the owning system's constant.
  const GOVERNOR_EROSION = 1, WEAVE_CEILING = 22, MARROW_DIVISOR = 18;

  const BIO_BANDS = [[45, "Looped"], [30, "Synthetic"], [15, "Augmented"], [0, "Pure"]];
  // Standing the Mesh withholds from a body it no longer reads as baseline
  // human — augments cost trust, trust prices services, and round it goes.
  const BAND_TRUST_PENALTY = { Pure: 0, Augmented: 2, Synthetic: 7, Looped: 15 };

  const AUGMENTS = [
    { id: "install_longevity_lattice", name: "Longevity lattice", price: 34,
      strain: 9, lifespan: 30,
      effect: "+30 years — the frame every other augment is bolted to",
      requires: [] },
    { id: "install_neural_governor", name: "Neural governor", price: 38,
      strain: 11, lifespan: 5,
      effect: `jumps erode ${GOVERNOR_EROSION} trust instead of 2 — your temporal `
        + "signature reads as noise",
      requires: ["install_longevity_lattice"] },
    { id: "install_fusion_weave", name: "Fusion cell weave", price: 44,
      strain: 12, lifespan: 8,
      effect: `+${WEAVE_CEILING} battery ceiling — you carry a slice of the grid`,
      requires: ["install_longevity_lattice"] },
    // The deep node: only a governed nervous system survives a marrow rebuild.
    { id: "install_chrono_marrow", name: "Chrono-stabilised marrow", price: 52,
      strain: 16, lifespan: 12,
      effect: `wormhole shear absorbed: divergence divisor ${MARROW_DIVISOR} instead of 12`,
      requires: ["install_neural_governor"] },
  ];
  const AUGMENT_BY_ID = {};
  for (const a of AUGMENTS) AUGMENT_BY_ID[a.id] = a;

  const installed = (timeline) =>
    timeline.filter((c) => AUGMENT_BY_ID[c.id]).map((c) => c.id);
  const hasAugment = (id, timeline) =>
    !!AUGMENT_BY_ID[id] && timeline.some((c) => c.id === id);

  // Damage taken from jumping into eras that were already torn, read at the
  // moment of each jump — a later rift cannot have damaged an earlier passage.
  function anomalyExposure(timeline) {
    let total = 0;
    timeline.forEach((c, i) => {
      if (c.era !== PRESENT)
        total += ANOMALY_STRAIN * anomalySeverity(c.era, timeline.slice(0, i));
    });
    return total;
  }

  function bioStrain(timeline) {
    let installs = 0;
    for (const id of installed(timeline)) installs += AUGMENT_BY_ID[id].strain;
    const pods = timeline.filter((c) => c.id === POD_ID).length;
    return Math.max(0, installs + anomalyExposure(timeline) - POD_RELIEF * pods);
  }
  function bioBand(strain) {
    for (const [t, label] of BIO_BANDS) if (strain >= t) return label;
    return "Pure";
  }
  const bioTrustPenalty = (timeline) => BAND_TRUST_PENALTY[bioBand(bioStrain(timeline))];

  // Baseline + what the tree granted - what it cost. Only the lattice pays for
  // itself in years; the pod is how the others are paid back.
  function lifespan(timeline) {
    let granted = 0;
    for (const id of installed(timeline)) granted += AUGMENT_BY_ID[id].lifespan;
    return BASE_LIFESPAN + granted - bioStrain(timeline);
  }

  const ceilingBonus = (timeline) =>
    hasAugment("install_fusion_weave", timeline) ? WEAVE_CEILING : 0;

  // Body-side gating only — creds and standing are the economy's business.
  function installReason(augment, timeline) {
    if (hasAugment(augment.id, timeline)) return "already installed";
    const missing = augment.requires
      .filter((r) => !hasAugment(r, timeline))
      .map((r) => AUGMENT_BY_ID[r].name);
    return missing.length ? `needs ${missing.join(" and ")}` : "";
  }
  const podReason = (timeline) =>
    bioStrain(timeline) > 0 ? "" : "your body is undamaged";

  // ---- energy v2 (quantum batteries, mirrors reverse/energy.py) -----------
  // Sits after temporal because a jump's price includes the anomaly surcharge
  // of the era it lands in — one authoritative cost, checked and billed alike.
  const MAX_ENERGY = 150, BASE_COST = 18, DISTANCE_COST = 6;
  const DIVERGENCE_DIVISOR = 12, GRID_YIELD_CAP = 18;

  // How many era-steps back from the present an era sits: 1 for the nearest.
  const eraReach = (era) => ERAS.length - ERAS.indexOf(era);
  const distanceCost = (era) => DISTANCE_COST * (eraReach(era) - 1);

  // How loudly history has been edited so far. Present-day actions never touch
  // the past, so they cost the continuum nothing.
  function divergence(timeline) {
    let total = 0;
    for (const c of timeline) if (c.era !== PRESENT) total += audacity(c);
    return total;
  }

  // Chrono-stabilised marrow absorbs the wormhole's shear, so a loud timeline
  // stops compounding as steeply (see the augments section above).
  const divergenceDivisor = (timeline) =>
    hasAugment("install_chrono_marrow", timeline) ? MARROW_DIVISOR : DIVERGENCE_DIVISOR;

  // The last term is where you launch from: the anchor is under Kyiv, so the
  // quiet zones hold the wormhole throat open across more ground.
  const jumpCost = (era, timeline) =>
    BASE_COST + distanceCost(era) + floorDiv(divergence(timeline), divergenceDivisor(timeline))
    + jumpSurcharge(era, timeline) + anchorSurcharge(timeline);

  // Each jump priced at the divergence and scars that existed at that moment,
  // so a later edit cannot retroactively re-price an earlier jump.
  function chargeSpent(timeline) {
    let total = 0;
    for (let i = 0; i < timeline.length; i++)
      if (timeline[i].era !== PRESENT) total += jumpCost(timeline[i].era, timeline.slice(0, i));
    return total;
  }

  // The butterfly reaching back to the player: a healthier Canton runs a
  // healthier fusion grid, and a healthier grid holds more charge.
  function gridYield(ws) {
    const raw = floorDiv(ws.prosperity - 85, 2) + floorDiv(ws.stability - 80, 3)
      + floorDiv(ws.ecology - 80, 4);
    return Math.max(-GRID_YIELD_CAP, Math.min(GRID_YIELD_CAP, raw));
  }
  // Two contributions, one from the world and one from the body: the grid's
  // health, plus whatever cells the operative had woven into their own chest.
  const batteryCeiling = (ws, timeline = []) =>
    MAX_ENERGY + gridYield(ws) + ceilingBonus(timeline);

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
  // A neural governor launders the operative's temporal signature, so the Mesh
  // takes less standing for each jump made after it went in.
  const jumpErosion = (timeline) =>
    hasAugment("install_neural_governor", timeline) ? GOVERNOR_EROSION : JUMP_EROSION;

  function trustMesh(timeline) {
    let score = BASE_TRUST;
    timeline.forEach((c, i) => {
      if (c.era === PRESENT) score -= TRUST_COST[c.id] || 0;
      else score += floorDiv(civicValue(c), 10) - jumpErosion(timeline.slice(0, i));
    });
    // What the operative has *become* is withheld at the end: the Mesh reads a
    // Looped body with measurably less warmth.
    score -= bioTrustPenalty(timeline);
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

  // The [m] market: what the grid and the grey market sell for the *run*.
  const MARKET_SERVICES = [
    { id: "buy_battery_boost", name: "Fusion-grid battery boost", base_price: 40,
      effect: `+${BOOST_CHARGE} quantum charge`,
      grey_market: false, min_band: "Watched", max_band: null },
    // Priced so a scrub is reachable once you have heat worth scrubbing, but
    // costs nearly the whole wallet — it hurts somewhere other than standing.
    { id: "buy_mesh_scrub", name: "Grey-market Mesh scrub", base_price: 55,
      effect: "sheds Temporal Heat without spending trust",
      grey_market: true, min_band: null, max_band: "Trusted" },
  ];

  // The bio-clinic: what the same wallet buys for the *operative*. Built from
  // the augment tree rather than re-typed, so price, effect and prerequisites
  // have exactly one home. Medicine is universal in Canton — no band gates —
  // but the Mesh modifier still prices it, which is how standing bites.
  const CLINIC_SERVICES = AUGMENTS.map((a) => ({
    id: a.id, name: a.name, base_price: a.price, effect: a.effect,
    grey_market: false, min_band: null, max_band: null,
  })).concat([
    { id: POD_ID, name: "Recovery-pod session", base_price: POD_PRICE,
      effect: `flushes ${POD_RELIEF} bio-strain`,
      grey_market: false, min_band: null, max_band: null },
  ]);

  // Maglev transit: what the same wallet buys for the *ground under your feet*.
  // Built from the zone table so a fourth region would price itself. Official
  // pricing, no band gate — Canton does not ration movement, it watches it.
  const TRANSIT_SERVICES = ZONES.map((z) => ({
    id: relocateId(z), name: `Maglev to ${ZONE_NAMES[z]}`, base_price: ZONE_FARE[z],
    effect: `dust ${BASELINE_DENSITY[z]} baseline, +${ZONE_ANCHOR[z]} charge per jump`,
    grey_market: false, min_band: null, max_band: null,
  }));

  // Everything the wallet can be spent on — the ledger walks this, not a board.
  const SERVICES = MARKET_SERVICES.concat(CLINIC_SERVICES).concat(TRANSIT_SERVICES);
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

  // The ceiling is the fusion grid's, not a constant: a healthier Canton holds
  // a bigger charge (see batteryCeiling).
  function charge(timeline, ws) {
    const ceiling = batteryCeiling(ws, timeline);
    const boosts = timeline.filter((c) => c.id === "buy_battery_boost").length;
    return Math.max(0, Math.min(ceiling, ceiling - chargeSpent(timeline) + BOOST_CHARGE * boosts));
  }
  const canJump = (era, timeline, ws) => charge(timeline, ws) >= jumpCost(era, timeline);

  function bandAllows(service, band) {
    const rank = BAND_ORDER.indexOf(band);
    if (service.min_band && rank < BAND_ORDER.indexOf(service.min_band)) return false;
    if (service.max_band && rank > BAND_ORDER.indexOf(service.max_band)) return false;
    return true;
  }

  // Why the operative's *body* refuses a service: prerequisites, a double
  // install, an undamaged body. Creds and standing are handled below.
  function bodyReason(service, timeline) {
    const augment = AUGMENT_BY_ID[service.id];
    if (augment) return installReason(augment, timeline);
    if (service.id === POD_ID) return podReason(timeline);
    return "";
  }

  // Why a maglev ticket is pointless right now — you are already standing there.
  function transitReason(service, timeline) {
    const zone = zoneOf(service.id);
    return zone ? relocateReason(zone, timeline) : "";
  }

  function availability(service, timeline, ws) {
    const blocked = bodyReason(service, timeline) || transitReason(service, timeline);
    if (blocked) return [false, blocked];
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

  // A board: each service as {service, price, available, reason}.
  const boardFor = (services, timeline, ws) => services.map((s) => {
    const [available, reason] = availability(s, timeline, ws);
    return { service: s, price: price(s, timeline), available, reason };
  });
  const offers = (timeline, ws) => boardFor(MARKET_SERVICES, timeline, ws);
  const clinicOffers = (timeline, ws) => boardFor(CLINIC_SERVICES, timeline, ws);
  const transitOffers = (timeline, ws) => boardFor(TRANSIT_SERVICES, timeline, ws);

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
      // Both read the world as well as the log: the Canton you made decides
      // how loud you may be before squads deploy.
      hunt_threshold: huntThreshold(ws), hunted: isHunted(timeline, ws),
      spacetime: space, spacetime_band: stabilityBand(space),
      anomalies: Object.keys(zones).map(Number).sort((a, b) => a - b).map((era) => ({
        era, severity: zones[era], label: anomalyLabel(zones[era]),
      })),
      creds: credBalance(timeline, ws),
      creds_allowance: allowance(timeline, ws),
      creds_spent: spent(timeline),
      // The ceiling is the fusion grid's *and* the operative's own hardware, so
      // it moves with the world and with the augments worn.
      charge: charge(timeline, ws),
      charge_ceiling: batteryCeiling(ws, timeline),
      divergence: divergence(timeline),
      // The bio-hacking axis: the only thing here describing the body rather
      // than the record.
      body: {
        strain: bioStrain(timeline),
        band: bioBand(bioStrain(timeline)),
        lifespan: lifespan(timeline),
        augments: installed(timeline),
      },
      // Where the operative is standing and what the air there is doing — the
      // Smart Dust field, which prices the next jump twice.
      zone: currentZone(timeline),
      dust: {
        density: effectiveDensity(currentZone(timeline), timeline),
        band: dustBand(effectiveDensity(currentZone(timeline), timeline)),
        weather: weather(timeline)[0],
        forecast: forecast(timeline).map(([label]) => label),
        anchor_surcharge: anchorSurcharge(timeline),
      },
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
      // Derived from the world rather than stored on it, so the powers ride
      // alongside the serialized state instead of inside it (no schema bump).
      powers: {
        automation: automationIndex(ws),
        blocs: powerBlocs(ws),
        ascendant: ascendantPower(ws),
      },
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
    MAX_ENERGY, BASE_COST, DISTANCE_COST, DIVERGENCE_DIVISOR, GRID_YIELD_CAP,
    eraReach, distanceCost, divergence, jumpCost, chargeSpent,
    gridYield, batteryCeiling, canJump,
    POWERS, POWER_NAMES, POWER_FLAVOR, POWER_BASE, AUTOMATION_BASE,
    automationIndex, powerBlocs, ascendantPower,
    audacity, heat, heatTier, isHunted, huntThreshold, HUNTED_AT,
    LIQUIDATOR_PIVOT, HUNT_SHIFT, HUNT_FLOOR, HUNT_CEILING,
    stability, stabilityBand,
    ANOMALY_SURCHARGE, ANOMALY_HEAT, eraStrain, anomalies, anomalyLabel,
    anomalySeverity, jumpSurcharge,
    BASE_TRUST, LAY_LOW_COST, JUMP_EROSION, civicValue, trustMesh, trustBand,
    canLayLow, jumpErosion,
    BASE_LIFESPAN, ANOMALY_STRAIN, POD_RELIEF, POD_ID, POD_PRICE,
    GOVERNOR_EROSION, WEAVE_CEILING, MARROW_DIVISOR, BIO_BANDS, BAND_TRUST_PENALTY,
    AUGMENTS, AUGMENT_BY_ID, installed, hasAugment, anomalyExposure, bioStrain,
    bioBand, bioTrustPenalty, lifespan, ceilingBonus, installReason, podReason,
    divergenceDivisor,
    ZONES, HOME_ZONE, ZONE_NAMES, BASELINE_DENSITY, FLAG_DENSITY, WEATHER_CYCLE,
    DUST_BANDS, ZONE_ANCHOR, ZONE_FARE, relocateId, zoneOf, currentZone,
    weatherPhase, weather, forecast, dustDensity, effectiveDensity, dustBand,
    bandHeat, jumpExposure, anchorSurcharge, relocateReason, fieldReport,
    CIVIC_ALLOWANCE, JUMP_DRAW, BOOST_CHARGE, BAND_MODIFIER, BAND_ORDER,
    SERVICES, MARKET_SERVICES, CLINIC_SERVICES, TRANSIT_SERVICES, SERVICE_BY_ID,
    allowance, price,
    spent, credBalance, charge, bandAllows, availability, offers, clinicOffers,
    transitOffers,
    reputation, standing, patronFaction, dominantBloc, blocEpithet, FACTION_FLAVOR,
    generateQuest, ENDINGS, flavoredEnding, isVictory, narrate, PROLOGUE,
    operativeState, snapshot,
  };

  root.REVerse = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
