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

check("energy costs 20/25/30/35 and blocks the 5th jump", () => {
  assert.deepStrictEqual([0, 1, 2, 3].map(E.jumpCost), [20, 25, 30, 35]);
  assert.strictEqual(E.energy(0), 120);
  assert.strictEqual(E.canJump(4), false);
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
  assert.strictEqual(E.offers([], E.simulate([])).length, E.SERVICES.length);
});

check("purchases move charge and heat but never the world or the ledger's past", () => {
  const id = (i) => E.CHOICE_BY_ID[i];
  const PFC = id("protect_first_code"), FAR = id("full_ai_rights");
  const tl = [PFC, FAR];

  // Boost tops up charge, capped at a full battery; scrub sheds heat for free.
  assert.strictEqual(E.charge(tl.concat([E.BUY_BATTERY_BOOST])),
                     E.charge(tl) + E.BOOST_CHARGE);
  assert.strictEqual(E.charge([E.BUY_BATTERY_BOOST, E.BUY_BATTERY_BOOST,
                               E.BUY_BATTERY_BOOST]), E.MAX_ENERGY);
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
                     "spacetime_band", "anomalies", "creds"])
    assert.ok(key in snap.operative, key);
  assert.deepStrictEqual(E.snapshot(tl), E.snapshot(tl.slice()));
  assert.deepStrictEqual(
    E.operativeState([PFC, E.CHOICE_BY_ID["full_ai_rights"]],
                     E.simulate([PFC, E.CHOICE_BY_ID["full_ai_rights"]])).anomalies,
    [{ era: 2058, severity: 1, label: "rift" }]
  );
});

console.log(passed + " passed");
