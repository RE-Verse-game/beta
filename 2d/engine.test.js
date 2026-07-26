/* Node sanity checks for the browser engine: run `node web/engine.test.js`.
 * Mirrors the invariants the Python test-suite guards, so the JS port can't
 * silently drift from the game's rules. */
const E = require("./engine.js");
const assert = require("node:assert");

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error("FAIL " + name + ": " + e.message); process.exitCode = 1; }
}

check("baseline 2226 is a Solar Utopia", () => {
  assert.strictEqual(E.archetype(E.simulate([]))[0], "Solar Utopia");
});

check("the deep past costs more than the near past", () => {
  // Value-identical to tests/test_energy.py: era distance prices the picker.
  assert.deepStrictEqual(E.ERAS.map(E.eraReach), [4, 3, 2, 1]);
  assert.deepStrictEqual(E.ERAS.map((y) => E.jumpCost(y, [])), [36, 30, 24, 18]);
  assert.strictEqual(E.jumpCost(E.ERAS[3], []), E.BASE_COST);
});

check("divergence counts audacity, not jumps", () => {
  const PFC = E.CHOICE_BY_ID["protect_first_code"];
  assert.strictEqual(E.divergence([]), 0);
  assert.strictEqual(E.divergence([PFC]), E.audacity(PFC));
  assert.strictEqual(E.divergence([PFC, E.LAY_LOW]), E.audacity(PFC));
  // A loud edit prices the next jump above a quiet one.
  const loud = [E.CHOICE_BY_ID["restrict_ai_rights"]];
  const quiet = [E.CHOICE_BY_ID["charter_data_rights"]];
  assert.ok(E.jumpCost(2090, loud) > E.jumpCost(2090, quiet));
});

check("the anomaly surcharge is actually billed", () => {
  // It used to gate the jump and print in the message, never leaving the batteries.
  const torn = ["protect_first_code", "full_ai_rights"].map((id) => E.CHOICE_BY_ID[id]);
  const third = E.chargeSpent(torn.concat([E.CHOICE_BY_ID["restrict_ai_rights"]]))
              - E.chargeSpent(torn);
  assert.strictEqual(third, E.jumpCost(2058, torn));
  assert.ok(third > E.jumpCost(2058, torn.slice(0, 1)));
});

check("both chains to 2180 stay completable, and the wall still exists", () => {
  const quiet = ["charter_data_rights", "orbital_solar", "open_mind_upload", "starlight_diaspora"];
  const loud = ["restrict_ai_rights", "energy_cartel", "purge_loopers", "singular_merge"];
  for (const ids of [quiet, loud]) {
    const tl = [];
    for (const id of ids) {
      const c = E.CHOICE_BY_ID[id];
      assert.ok(E.canJump(c.era, tl, E.simulate(tl)), id + " unaffordable");
      tl.push(c);
    }
  }
  const spent = loud.map((id) => E.CHOICE_BY_ID[id]);
  const ws = E.simulate(spent);
  assert.ok(!E.ERAS.some((y) => E.canJump(y, spent, ws)));   // the pacing wall
  // The surgical route leaves more in the tank than the sweeping one.
  const q = quiet.map((id) => E.CHOICE_BY_ID[id]);
  assert.ok(E.charge(q, E.simulate(q)) > E.charge(spent, ws));
});

check("a healthier Canton holds a bigger charge", () => {
  assert.strictEqual(E.gridYield(E.baseline()), 0);
  assert.strictEqual(E.batteryCeiling(E.baseline()), E.MAX_ENERGY);
  const rich = Object.assign(E.baseline(), { prosperity: 100, stability: 100, ecology: 100 });
  const poor = Object.assign(E.baseline(), { prosperity: 20, stability: 20, ecology: 20 });
  assert.ok(E.gridYield(poor) < 0 && E.gridYield(rich) > 0);
  assert.ok(Math.abs(E.gridYield(poor)) <= E.GRID_YIELD_CAP);
});

check("cross-era gating unlocks biohacking only after First Code survives", () => {
  const before = E.availableChoices(2090, []).map((c) => c.id);
  assert.ok(!before.includes("open_biohacking"));
  const tl = [E.CHOICE_BY_ID["protect_first_code"]];
  const after = E.availableChoices(2090, tl).map((c) => c.id);
  assert.ok(after.includes("open_biohacking"));
});

check("reputation earns a Synth patron; quest giver follows it", () => {
  const tl = [E.CHOICE_BY_ID["protect_first_code"]]; // synths +15
  assert.strictEqual(E.patronFaction(tl), "synths");
  const ws = E.simulate(tl);
  assert.strictEqual(E.generateQuest(ws, E.patronFaction(tl)).giver_faction, "synths");
});

check("rebuilding utopia is a victory, being born into it is not", () => {
  const tl = [E.CHOICE_BY_ID["full_ai_rights"]];
  assert.strictEqual(E.isVictory(E.simulate(tl), tl), true);
  assert.strictEqual(E.isVictory(E.simulate([]), []), false);
});

check("flavored ending names the ruling bloc", () => {
  const ws = E.simulate([E.CHOICE_BY_ID["full_ai_rights"]]);
  assert.ok(/-led /.test(E.flavoredEnding(ws)));
});

check("simulate is deterministic for a given timeline", () => {
  const tl = [E.CHOICE_BY_ID["restrict_ai_rights"], E.CHOICE_BY_ID["energy_cartel"]];
  assert.deepStrictEqual(E.simulate(tl), E.simulate(tl));
});

check("2180 flag endings resolve to their archetypes", () => {
  const a = (ids) => E.archetype(E.simulate(ids.map((i) => E.CHOICE_BY_ID[i])))[0];
  assert.strictEqual(a(["charter_data_rights", "orbital_solar", "open_mind_upload", "starlight_diaspora"]), "Starlight Diaspora");
  assert.strictEqual(a(["charter_data_rights", "orbital_solar", "open_mind_upload", "singular_merge"]), "Singularity Fusion");
  assert.strictEqual(a(["protect_first_code", "open_biohacking", "grant_looped_rights", "reground_the_flesh"]), "Grounded Renaissance");
});

check("2180 era is gated and opens via the upload chain", () => {
  const ids = (y, tl) => E.availableChoices(y, tl).map((c) => c.id);
  assert.ok(E.ERAS.includes(2180));
  assert.strictEqual(ids(2180, []).length, 0);
  const tl = ["charter_data_rights", "orbital_solar", "open_mind_upload"].map((id) => E.CHOICE_BY_ID[id]);
  const a = ids(2180, tl);
  assert.ok(a.includes("starlight_diaspora") && a.includes("singular_merge") && !a.includes("reground_the_flesh"));
});

check("upload chain yields the Uploaded Ascendancy ending", () => {
  const tl = ["charter_data_rights", "orbital_solar", "open_mind_upload"].map((id) => E.CHOICE_BY_ID[id]);
  assert.strictEqual(E.archetype(E.simulate(tl))[0], "Uploaded Ascendancy");
  assert.ok("Uploaded Ascendancy" in E.ENDINGS);
});

check("baseline regions match schema v2 and stay clamped", () => {
  const ws = E.simulate([]);
  assert.deepStrictEqual(ws.regions, { kyiv: 85, carpathians: 75, odesa: 70 });
  const tl = ["restrict_ai_rights", "energy_cartel"].map((id) => E.CHOICE_BY_ID[id]);
  for (const v of Object.values(E.simulate(tl).regions)) assert.ok(v >= 0 && v <= 100);
});

check("region ripples: cartel hits Odesa, biohacking boosts the Carpathians", () => {
  const base = E.simulate([]).regions;
  const cartel = ["restrict_ai_rights", "energy_cartel"].map((id) => E.CHOICE_BY_ID[id]);
  assert.ok(E.simulate(cartel).regions.odesa < base.odesa);
  const bio = ["protect_first_code", "open_biohacking"].map((id) => E.CHOICE_BY_ID[id]);
  assert.ok(E.simulate(bio).regions.carpathians > base.carpathians);
});

check("temporal heat is value-identical to the Python engine", () => {
  // Drift-free pure functions — exact parity: heat([PFC]) = 4 + 70//15 = 8.
  const PFC = E.CHOICE_BY_ID["protect_first_code"];
  assert.strictEqual(E.audacity(PFC), 70);
  assert.strictEqual(E.heat([]), 0);
  assert.strictEqual(E.heat([PFC]), 8);
  assert.strictEqual(E.heatTier(8), "Logged");
  assert.strictEqual(E.heatTier(E.HUNTED_AT), "Hunted");
});

check("power blocs are value-identical to the Python engine", () => {
  // Hand-authored numbers, drift-free — exact parity with tests/test_powers.py.
  const base = E.baseline();
  assert.strictEqual(E.automationIndex(base), E.AUTOMATION_BASE);
  assert.deepStrictEqual(E.powerBlocs(base), E.POWER_BASE);
  assert.strictEqual(E.ascendantPower(base), "synergists");
});

check("automation drives the resistance, and floors like Python on negatives", () => {
  const low = Object.assign(E.baseline(), {
    ai_autonomy: 30, bio_social: { pures: 90, synths: 5, looped: 5 },
  });
  const high = Object.assign(E.baseline(), {
    ai_autonomy: 100, bio_social: { pures: 40, synths: 55, looped: 5 },
  });
  assert.ok(E.automationIndex(low) < E.automationIndex(high));
  assert.ok(E.powerBlocs(low).resistance < E.powerBlocs(high).resistance);
  // freedom 76 -> (75 - 76) // 4 == -1 in Python; truncation would give 0.
  assert.strictEqual(
    E.powerBlocs(Object.assign(E.baseline(), { freedom: 76 })).resistance,
    E.POWER_BASE.resistance - 1);
  // corruption 9 -> (9 - 10) * 2 // 3 == -1; truncation would give 0.
  assert.strictEqual(
    E.powerBlocs(Object.assign(E.baseline(), { corruption: 9 })).cartels,
    E.POWER_BASE.cartels - 1);
});

check("the same heat is hunted in one Canton and not another", () => {
  const police = Object.assign(E.baseline(), {
    ai_autonomy: 100, freedom: 10, flags: new Set(["singularity"]),
  });
  const blinded = Object.assign(E.baseline(), {
    flags: new Set(["precrime_abolished", "data_rights"]),
  });
  assert.strictEqual(E.huntThreshold(E.baseline()), E.HUNTED_AT);
  const tl = ["protect_first_code", "full_ai_rights", "restrict_ai_rights"]
    .map((id) => E.CHOICE_BY_ID[id]);
  assert.ok(E.huntThreshold(police) <= E.heat(tl));
  assert.ok(E.heat(tl) < E.huntThreshold(blinded));
  assert.strictEqual(E.isHunted(tl, police), true);
  assert.strictEqual(E.isHunted(tl, blinded), false);
});

check("trust mesh is value-identical to the Python engine", () => {
  // Drift-free pure functions — exact parity with tests/test_trust.py.
  const FAR = E.CHOICE_BY_ID["full_ai_rights"], RAR = E.CHOICE_BY_ID["restrict_ai_rights"];
  assert.strictEqual(E.trustMesh([]), E.BASE_TRUST);
  assert.strictEqual(E.civicValue(FAR), 31);   // corruption -10 counts as +10
  assert.strictEqual(E.civicValue(RAR), -40);
  assert.strictEqual(E.trustMesh([FAR]), 61);  // 60 + 31//10 - 2
  assert.strictEqual(E.trustMesh([RAR]), 54);
  assert.strictEqual(E.trustBand(54), "Watched");
});

check("lay low sheds heat, spends trust, and is not a jump", () => {
  const PFC = E.CHOICE_BY_ID["protect_first_code"];
  const tl = [PFC, E.LAY_LOW];
  assert.strictEqual(E.heat([PFC]), 8);
  assert.strictEqual(E.heat(tl), 0);                       // 8 - 12, floored
  assert.strictEqual(E.trustMesh(tl), E.trustMesh([PFC]) - E.LAY_LOW_COST);
  assert.strictEqual(E.jumps(tl).length, 1);               // no charge, no strain
  assert.strictEqual(E.stability(tl), E.stability([PFC]));
  assert.deepStrictEqual(E.simulate(tl), E.simulate([PFC])); // world untouched
  assert.ok(E.canLayLow([PFC]) && E.CHOICE_BY_ID["lay_low"] === E.LAY_LOW);
});

check("abolishing pre-crime halves heat; revisits strain spacetime harder", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const loud = [id("charter_data_rights"), id("fusion_commons")];
  assert.ok(E.heat([...loud, id("abolish_precrime")]) < E.heat(loud));
  const spread = [id("protect_first_code"), id("fusion_commons")]; // 2 eras
  const stacked = [id("protect_first_code"), id("full_ai_rights")]; // same era
  assert.strictEqual(E.stability(spread), 90);
  assert.strictEqual(E.stability(stacked), 87);
  assert.strictEqual(E.stabilityBand(87), "coherent");
  assert.strictEqual(E.stabilityBand(29), "critical anomaly");
});

check("data-rights chain unlocks orbital solar then mind-upload", () => {
  const ids = (y, tl) => E.availableChoices(y, tl).map((c) => c.id);
  assert.ok(!ids(2090, []).includes("orbital_solar"));       // gated by default
  const tl1 = [E.CHOICE_BY_ID["charter_data_rights"]];
  assert.ok(ids(2090, tl1).includes("orbital_solar"));
  assert.ok(!ids(2150, tl1).includes("open_mind_upload"));   // needs orbital first
  const tl2 = [E.CHOICE_BY_ID["charter_data_rights"], E.CHOICE_BY_ID["orbital_solar"]];
  assert.ok(ids(2150, tl2).includes("open_mind_upload"));
});

check("bio-social shares always sum to 100 and react to the timeline", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  assert.deepStrictEqual(E.baseline().bio_social, { pures: 62, synths: 25, looped: 13 });
  const timelines = [
    [], [id("protect_first_code")],
    [id("protect_first_code"), id("open_biohacking")],
    [id("protect_first_code"), id("open_biohacking"), id("purge_loopers")],
    Array(6).fill(id("restrict_ai_rights")),
  ];
  for (const tl of timelines) {
    const bs = E.simulate(tl).bio_social;
    assert.strictEqual(bs.pures + bs.synths + bs.looped, 100);
    assert.ok(Object.values(bs).every((v) => v >= 0));
  }
  const opened = E.simulate([id("protect_first_code"), id("open_biohacking")]).bio_social;
  const purged = E.simulate([id("protect_first_code"), id("open_biohacking"),
                             id("purge_loopers")]).bio_social;
  assert.ok(purged.looped < opened.looped);
  assert.ok(E.simulate([id("restrict_ai_rights")]).bio_social.synths
            < E.simulate([]).bio_social.synths);
});

check("a second jump into an era tears an anomaly zone open", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const PFC = id("protect_first_code"), FAR = id("full_ai_rights");
  assert.deepStrictEqual(E.anomalies([PFC]), {});
  assert.deepStrictEqual(E.anomalies([PFC, id("fusion_commons")]), {}); // two eras
  assert.deepStrictEqual(E.anomalies([PFC, FAR]), { 2058: 1 });
  assert.strictEqual(E.anomalyLabel(1), "rift");
  assert.strictEqual(E.anomalyLabel(99), "collapse zone");   // label clamps
  assert.strictEqual(E.jumpSurcharge(2058, [PFC, FAR]), E.ANOMALY_SURCHARGE);
  assert.strictEqual(E.jumpSurcharge(2090, [PFC, FAR]), 0);
  // Landing on a torn era is louder than the jump that tore it.
  const CDR = id("charter_data_rights"), RAR = id("restrict_ai_rights");
  const intact = E.heat([CDR, RAR]) - E.heat([CDR]);
  const torn = E.heat([CDR, RAR, RAR]) - E.heat([CDR, RAR]);
  assert.strictEqual(torn, intact + E.ANOMALY_HEAT);
});

check("Energy Creds price official services down and grey-market ones up", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const boost = E.SERVICE_BY_ID["buy_battery_boost"];
  const scrub = E.SERVICE_BY_ID["buy_mesh_scrub"];
  assert.strictEqual(E.price(boost, []), Math.floor(40 * E.BAND_MODIFIER.Trusted / 100));

  const sunk = Array(10).fill(id("restrict_ai_rights"));
  assert.strictEqual(E.trustBand(E.trustMesh(sunk)), "Pariah");
  assert.ok(E.price(boost, sunk) > E.price(boost, []));   // the grid punishes
  assert.ok(E.price(scrub, sunk) < E.price(scrub, []));   // the fixer welcomes

  assert.ok(E.bandAllows(boost, "Trusted") && !E.bandAllows(boost, "Suspect"));
  assert.ok(E.bandAllows(scrub, "Watched") && !E.bandAllows(scrub, "Exemplar"));
  assert.deepStrictEqual(E.availability(boost, [], E.simulate([])), [true, ""]);
  assert.strictEqual(E.availability(boost, sunk, E.simulate(sunk))[0], false);
  // Three boards, one service table: the market sells to the run, the clinic to
  // the operative, transit to the ground, and nothing may go missing from all.
  const world = E.simulate([]);
  assert.strictEqual(E.offers([], world).length, E.MARKET_SERVICES.length);
  assert.strictEqual(E.clinicOffers([], world).length, E.CLINIC_SERVICES.length);
  assert.strictEqual(E.transitOffers([], world).length, E.TRANSIT_SERVICES.length);
  assert.strictEqual(
    E.MARKET_SERVICES.length + E.CLINIC_SERVICES.length + E.TRANSIT_SERVICES.length,
    Object.keys(E.SERVICE_BY_ID).length);
});

check("no dead content: every service is reachable on some legal timeline", () => {
  // Pricing and the wallet are tuned independently, so a service can end up
  // priced out of every balance a player can actually reach (the grey-market
  // scrub was, at base 80). Walk the legal choice-tree and insist otherwise.
  // Purchases are part of the walk, not just jumps: the clinic's deep nodes are
  // only reachable *through* earlier purchases, and the chain has to fit inside
  // one run's wallet or the bottom of the tree is dead content. Same for the
  // maglev home: a ticket back to Kyiv is only offered to someone who already
  // bought a ticket out of it.
  const reachable = new Set();
  let frontier = [[]];
  for (let depth = 0; depth < 5; depth++) {
    const bought = [], following = [];
    for (const tl of frontier) {
      const ws = E.simulate(tl);
      const board = E.offers(tl, ws).concat(E.clinicOffers(tl, ws), E.transitOffers(tl, ws));
      for (const offer of board)
        if (offer.available) {
          reachable.add(offer.service.id);
          bought.push(tl.concat([E.CHOICE_BY_ID[offer.service.id]]));
        }
      for (const y of E.ERAS)
        for (const c of E.availableChoices(y, tl)) following.push(tl.concat([c]));
    }
    // Purchase paths first: the breadth cap would otherwise trim exactly the
    // timelines that spend, which are the ones under test.
    frontier = bought.concat(following).slice(0, 300);
  }
  for (const id of Object.keys(E.SERVICE_BY_ID))
    assert.ok(reachable.has(id), "unreachable service: " + id);

  // And the scrub must stay a real sacrifice, not pocket change.
  const tl = [E.CHOICE_BY_ID["protect_first_code"], E.CHOICE_BY_ID["full_ai_rights"]];
  const ws = E.simulate(tl);
  const before = E.credBalance(tl, ws);
  assert.ok(E.price(E.SERVICE_BY_ID["buy_mesh_scrub"], tl) > Math.floor(before / 2));
  assert.ok(E.credBalance(tl.concat([E.BUY_MESH_SCRUB]), ws) < Math.floor(before / 4));
});

check("purchases move charge and heat but never the world or the ledger's past", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const PFC = id("protect_first_code"), FAR = id("full_ai_rights");
  const tl = [PFC, FAR];

  // Boost tops up charge, capped at the grid's ceiling; scrub sheds heat free.
  const world = E.simulate(tl);   // purchases never rewrite it, so one world serves both
  assert.strictEqual(E.charge(tl.concat([E.BUY_BATTERY_BOOST]), world),
                     E.charge(tl, world) + E.BOOST_CHARGE);
  const empty = E.simulate([]);
  assert.strictEqual(E.charge([E.BUY_BATTERY_BOOST, E.BUY_BATTERY_BOOST,
                               E.BUY_BATTERY_BOOST], empty), E.batteryCeiling(empty));
  assert.ok(E.heat(tl.concat([E.BUY_MESH_SCRUB])) < E.heat(tl));
  assert.strictEqual(E.trustMesh(tl.concat([E.BUY_MESH_SCRUB])), E.trustMesh(tl));
  assert.deepStrictEqual(E.simulate(tl.concat([E.BUY_BATTERY_BOOST])), E.simulate(tl));

  // A later trust collapse must not re-price an old purchase.
  const early = [PFC, E.BUY_BATTERY_BOOST];
  const atPurchase = E.price(E.SERVICE_BY_ID["buy_battery_boost"], [PFC]);
  assert.strictEqual(E.spent(early), E.JUMP_DRAW + atPurchase);
  const later = early.concat(Array(10).fill(id("restrict_ai_rights")));
  assert.strictEqual(E.spent(later), E.JUMP_DRAW * 11 + atPurchase);
  assert.strictEqual(E.credBalance(later, E.simulate(later)), 0);  // never negative
});

check("snapshot joins world, operative standing and ending deterministically", () => {
  const PFC = E.CHOICE_BY_ID["protect_first_code"];
  const tl = [PFC, E.BUY_BATTERY_BOOST];
  const snap = E.snapshot(tl);
  assert.strictEqual(snap.schema, E.SCHEMA_VERSION);
  assert.deepStrictEqual(snap.choices, ["protect_first_code", "buy_battery_boost"]);
  assert.ok(Array.isArray(snap.world.flags));            // serializable, sorted
  assert.ok(snap.world.bio_social.pures > 0);
  assert.ok(snap.ending.archetype);
  for (const key of ["trust", "trust_band", "heat", "heat_tier", "spacetime",
                     "spacetime_band", "anomalies", "creds", "hunt_threshold", "hunted"])
    assert.ok(key in snap.operative, key);
  assert.strictEqual(snap.powers.ascendant, E.ascendantPower(E.simulate(tl)));
  assert.deepStrictEqual(Object.keys(snap.powers.blocs), E.POWERS);
  assert.deepStrictEqual(E.snapshot(tl), E.snapshot(tl.slice()));
  assert.deepStrictEqual(
    E.operativeState([PFC, E.CHOICE_BY_ID["full_ai_rights"]],
                     E.simulate([PFC, E.CHOICE_BY_ID["full_ai_rights"]])).anomalies,
    [{ era: 2058, severity: 1, label: "rift" }]
  );
});

check("the augment tree gates on itself and every install is paid for in body", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const LATTICE = id("install_longevity_lattice"), GOVERNOR = id("install_neural_governor");
  const WEAVE = id("install_fusion_weave"), MARROW = id("install_chrono_marrow");
  const tree = [LATTICE, GOVERNOR, WEAVE, MARROW];

  // A pristine operative is unmodified: Pure, baseline lifespan, no penalty.
  assert.deepStrictEqual(E.installed([]), []);
  assert.strictEqual(E.bioStrain([]), 0);
  assert.strictEqual(E.lifespan([]), E.BASE_LIFESPAN);
  assert.strictEqual(E.bioTrustPenalty([]), 0);

  // The lattice is the root; nothing under it is reachable on a bare body, and
  // nothing is ever installed twice.
  assert.strictEqual(E.installReason(E.AUGMENT_BY_ID["install_longevity_lattice"], []), "");
  assert.ok(E.installReason(E.AUGMENT_BY_ID["install_neural_governor"], [])
    .includes("Longevity lattice"));
  assert.ok(E.installReason(E.AUGMENT_BY_ID["install_chrono_marrow"], [LATTICE])
    .includes("Neural governor"));
  assert.strictEqual(E.installReason(E.AUGMENT_BY_ID["install_chrono_marrow"],
    [LATTICE, GOVERNOR]), "");
  assert.strictEqual(E.installReason(E.AUGMENT_BY_ID["install_longevity_lattice"],
    [LATTICE]), "already installed");

  // The whole tree is exactly what the codex calls the anomaly-damaged: Looped.
  assert.strictEqual(E.bioBand(E.bioStrain(tree)), "Looped");
  assert.strictEqual(E.trustMesh(tree), E.trustMesh([]) - E.BAND_TRUST_PENALTY.Looped);
});

check("augments buy modifiers to the systems they name, from the moment worn", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const PFC = id("protect_first_code"), FAR = id("full_ai_rights"), RAR = id("restrict_ai_rights");
  const LATTICE = id("install_longevity_lattice"), GOVERNOR = id("install_neural_governor");
  const WEAVE = id("install_fusion_weave"), MARROW = id("install_chrono_marrow");
  const POD = id("use_recovery_pod");

  // Governor: later jumps erode less standing, earlier ones are untouched.
  assert.strictEqual(E.jumpErosion([]), E.JUMP_EROSION);
  assert.strictEqual(E.jumpErosion([LATTICE, GOVERNOR]), E.GOVERNOR_EROSION);
  const governed = [PFC, LATTICE, GOVERNOR, FAR];
  assert.strictEqual(E.trustMesh(governed),
    E.trustMesh([PFC, FAR]) + (E.JUMP_EROSION - E.GOVERNOR_EROSION)
    - E.bioTrustPenalty(governed));

  // Weave: a wider ceiling is charge in hand, not a bigger number on the HUD.
  const world = E.simulate([]);
  assert.strictEqual(E.batteryCeiling(world, [LATTICE, WEAVE]),
    E.batteryCeiling(world) + E.WEAVE_CEILING);
  assert.strictEqual(E.charge([LATTICE, WEAVE], world),
    E.charge([LATTICE], world) + E.WEAVE_CEILING);

  // Marrow: a loud timeline stops compounding as steeply — but only forwards.
  const loud = [RAR, PFC, FAR], worn = loud.concat([LATTICE, GOVERNOR, MARROW]);
  assert.strictEqual(E.divergenceDivisor(worn), E.MARROW_DIVISOR);
  assert.ok(E.jumpCost(2150, worn) < E.jumpCost(2150, loud));
  assert.strictEqual(E.chargeSpent(worn), E.chargeSpent(loud));

  // Riding a torn era damages the body; the pod is the way back down.
  assert.strictEqual(E.bioStrain([PFC, FAR]), 0);
  assert.ok(E.bioStrain([PFC, FAR, RAR]) > 0);
  const hurt = [LATTICE, GOVERNOR];
  assert.strictEqual(E.bioStrain(hurt.concat([POD])), E.bioStrain(hurt) - E.POD_RELIEF);
  assert.strictEqual(E.lifespan(hurt.concat([POD])), E.lifespan(hurt) + E.POD_RELIEF);
  assert.strictEqual(E.bioStrain([LATTICE, POD, POD, POD]), 0);   // never negative

  // Installs change the operative, never Ukraine — and ride save/replay along
  // with everything else derived from the log.
  assert.deepStrictEqual(E.simulate([PFC, FAR].concat([LATTICE, WEAVE, POD])),
    E.simulate([PFC, FAR]));
  assert.deepStrictEqual(E.snapshot(governed).operative.body, {
    strain: E.bioStrain(governed), band: E.bioBand(E.bioStrain(governed)),
    lifespan: E.lifespan(governed),
    augments: ["install_longevity_lattice", "install_neural_governor"],
  });
});

check("Smart Dust: the field, the weather grid and the zone trade", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const PFC = id("protect_first_code"), FAR = id("full_ai_rights");
  const RAR = id("restrict_ai_rights"), CDR = id("charter_data_rights");
  const BOOST = id("buy_battery_boost");
  const CARP = id("relocate_carpathians"), ODESA = id("relocate_odesa");
  const KYIV = id("relocate_kyiv");

  // The whole system is pivoted so an untouched run costs nothing: Kyiv's
  // baseline sits in `dense`, which is worth zero heat and zero charge.
  assert.strictEqual(E.currentZone([]), E.HOME_ZONE);
  assert.strictEqual(E.dustBand(E.effectiveDensity("kyiv", [])), "dense");
  assert.strictEqual(E.jumpExposure([]), 0);
  assert.strictEqual(E.anchorSurcharge([]), 0);

  // Only present-day actions advance the sky — a jump returns you to the
  // moment you left, so it costs no weather.
  assert.strictEqual(E.weatherPhase([PFC, FAR, RAR]), 0);
  assert.strictEqual(E.weatherPhase([BOOST, PFC, BOOST]), 2);
  assert.strictEqual(E.weather([])[0], "clear skies");
  // Buying the ticket is itself an action, so relocating lands you under the
  // inversion; the quiet window is one action further on.
  assert.strictEqual(E.weather([CARP])[0], "thermal inversion");
  assert.strictEqual(E.weather([CARP, BOOST])[0], "ion storm");

  // Exactly one zone/phase pair reaches `swept`, and it takes two actions.
  const swept = [];
  for (let phase = 0; phase < E.WEATHER_CYCLE.length; phase++)
    for (const zone of E.ZONES)
      if (E.dustBand(E.effectiveDensity(zone, Array(phase).fill(BOOST))) === "swept")
        swept.push([zone, phase]);
  assert.deepStrictEqual(swept, [["carpathians", 2]]);

  // Stealth is paid for in charge: the anchor is under Kyiv.
  const quiet = [CARP, BOOST];
  assert.strictEqual(E.jumpExposure(quiet), -3);
  assert.ok(E.heat(quiet.concat([PFC])) < E.heat([PFC]));
  assert.ok(E.jumpCost(2058, quiet) > E.jumpCost(2058, []));
  assert.strictEqual(E.currentZone([CARP, ODESA, KYIV]), "kyiv");   // the last move wins

  // The butterfly reaches the air: who watches whom was decided in the past.
  assert.ok(E.dustDensity("kyiv", [PFC, id("abolish_precrime")]) < E.dustDensity("kyiv", []));
  assert.ok(E.dustDensity("kyiv", [CDR]) < E.dustDensity("kyiv", []));
  assert.strictEqual(E.dustBand(E.dustDensity("kyiv", [RAR, id("energy_cartel")])), "saturated");
  for (const zone of E.ZONES)
    for (const tl of [[], [RAR, id("energy_cartel")], [PFC, id("abolish_precrime"), CDR]]) {
      assert.ok(E.dustDensity(zone, tl) >= 0 && E.dustDensity(zone, tl) <= 100);
      assert.ok(E.effectiveDensity(zone, tl) >= 0 && E.effectiveDensity(zone, tl) <= 100);
    }

  // The field is read at the moment of the jump: a move made later cannot
  // retroactively quieten an earlier one.
  assert.strictEqual(E.heat([PFC].concat(quiet)), E.heat([PFC]));
  assert.ok(E.heat([PFC, CARP, BOOST, FAR]) < E.heat([PFC, FAR]));

  // The maglev prices every zone but the one you stand in, and moving Ukraine
  // is not what a maglev does.
  const world = E.simulate([]);
  const home = E.transitOffers([], world).find((o) => o.service.id === "relocate_kyiv");
  assert.strictEqual(home.reason, "you are already there");
  assert.ok(E.transitOffers([CARP], E.simulate([CARP]))
    .find((o) => o.service.id === "relocate_kyiv").available);
  assert.deepStrictEqual(E.simulate([PFC, FAR].concat([CARP, ODESA])), E.simulate([PFC, FAR]));

  const field = E.snapshot(quiet.concat([PFC])).operative;
  assert.strictEqual(field.zone, "carpathians");
  assert.strictEqual(field.dust.band, "swept");
  assert.strictEqual(field.dust.weather, "ion storm");
  assert.strictEqual(field.dust.anchor_surcharge, E.ZONE_ANCHOR.carpathians);
});

check("the Temporal Terrorist arc: pursuit, escape and the fail state", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const RAR = id("restrict_ai_rights"), PFC = id("protect_first_code");
  const FUSION = id("fusion_commons"), BOOST = id("buy_battery_boost");
  const LAY_LOW = id("lay_low"), SCRUB = id("buy_mesh_scrub");
  const CARP = id("relocate_carpathians");
  const LOUD = Array(8).fill(RAR);

  // Nobody is hunting a clean operative, and heat alone is not pursuit.
  assert.strictEqual(E.pressure([]), 0);
  assert.strictEqual(E.huntStage([]), "clear");
  assert.ok(E.heat([PFC]) > 0 && !E.huntedAt([PFC]));
  assert.strictEqual(E.pressure([PFC]), 0);

  // The ladder climbs in order — you are warned three times before the end.
  const seen = [];
  let previous = 0;
  for (let i = 0; i <= LOUD.length; i++) {
    const value = E.pressure(LOUD.slice(0, i));
    assert.ok(value >= previous);
    previous = value;
    const label = E.huntStage(LOUD.slice(0, i));
    if (!seen.length || seen[seen.length - 1] !== label) seen.push(label);
  }
  assert.deepStrictEqual(seen, ["clear", "Sweep", "Cordon", "Interception"]);

  // A jump under an active sweep is a flare; a quiet day in 2226 is not.
  const hunted = LOUD.slice(0, 5);
  assert.ok(E.huntedAt(hunted));
  const jumped = E.pressure(hunted.concat([RAR])) - E.pressure(hunted);
  const idled = E.pressure(hunted.concat([BOOST])) - E.pressure(hunted);
  assert.ok(jumped > idled && idled > 0);
  assert.strictEqual(jumped - idled, E.PRESSURE_JUMP - E.PRESSURE_PRESENT);

  // Smart Dust doing double duty: the swept uplands hide you from the cordon.
  const fled = hunted.concat([CARP, BOOST]);
  assert.strictEqual(E.dustBand(E.effectiveDensity("carpathians", fled)), "swept");
  assert.ok(E.pressure(fled.concat([RAR])) - E.pressure(fled) < jumped);

  // Relief cuts *banked* pressure, so a cordon can be escaped, not just survived.
  const cornered = LOUD.slice(0, 6);
  assert.strictEqual(E.huntStage(cornered), "Cordon");
  assert.ok(E.pressure(cornered.concat([LAY_LOW])) < E.pressure(cornered));
  assert.ok(E.pressure(cornered.concat([SCRUB])) < E.pressure(cornered));
  assert.strictEqual(E.pressure(cornered.concat(Array(6).fill(LAY_LOW))), 0);

  // The fail state, and the one case where archetype and outcome disagree.
  const caught = [BOOST, PFC, PFC, FUSION, FUSION, BOOST, RAR];
  assert.ok(E.liquidated(caught));
  assert.strictEqual(E.huntStage(caught), "Liquidation");
  assert.strictEqual(E.huntMargin(caught), 0);
  // Capped: being caught twice is not a thing.
  assert.strictEqual(E.pressure(caught.concat(Array(3).fill(RAR))), E.LIQUIDATED_AT);
  const world = E.simulate(caught);
  assert.strictEqual(E.endingBanner(world, caught)[0], E.LIQUIDATED[0]);
  assert.ok(!E.isVictory(world, caught));

  // The pursuit reads the authored Canton, so drift never decides it.
  const tl = [PFC, id("full_ai_rights"), RAR];
  assert.strictEqual(E.authoredWorld(tl).prosperity, E.authoredWorld(tl).prosperity);
  assert.strictEqual(E.pressure(tl), E.pressure(tl));

  const pursuit = E.snapshot(cornered).operative.pursuit;
  assert.strictEqual(pursuit.stage, "Cordon");
  assert.strictEqual(pursuit.caught_at, E.LIQUIDATED_AT);
  assert.strictEqual(pursuit.liquidated, false);
});

console.log(passed + " passed");
