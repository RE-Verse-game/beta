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
  return a(["charter_data_rights", "orbital_solar", "open_mind_upload", "starlight_diaspora"]) === "Starlight Diaspora"
    && a(["charter_data_rights", "orbital_solar", "open_mind_upload", "singular_merge"]) === "Singularity Fusion"
    && a(["protect_first_code", "open_biohacking", "grant_looped_rights", "reground_the_flesh"]) === "Grounded Renaissance";
});

check("2180 era is gated and opens via the upload chain", () => {
  const ids = (y, tl) => E.availableChoices(y, tl).map((c) => c.id);
  if (!E.ERAS.includes(2180)) return false;
  if (ids(2180, []).length !== 0) return false;
  const tl = ["charter_data_rights", "orbital_solar", "open_mind_upload"].map((id) => E.CHOICE_BY_ID[id]);
  const a = ids(2180, tl);
  return a.includes("starlight_diaspora") && a.includes("singular_merge") && !a.includes("reground_the_flesh");
});

check("upload chain yields the Uploaded Ascendancy ending", () => {
  const tl = ["charter_data_rights", "orbital_solar", "open_mind_upload"].map((id) => E.CHOICE_BY_ID[id]);
  const ws = E.simulate(tl);
  return E.archetype(ws)[0] === "Uploaded Ascendancy" && "Uploaded Ascendancy" in E.ENDINGS;
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

console.log(passed + " passed");
