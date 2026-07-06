/*
 * Priority Scorer — shared storage helper
 * ---------------------------------------
 * Both the widget (content script) and the popup need to read and write your
 * saved scores. Rather than writing that code twice, we put it here once and
 * load this file in both places (see manifest.json and popup.html).
 *
 * We use the browser's built-in extension storage ("storage.local"). It's like
 * a private notebook for the extension that stays on your machine — nothing is
 * ever sent anywhere.
 *
 * All scores are kept together under a single key ("scores") as an object that
 * maps a ticket's unique key -> its saved entry, e.g.:
 *   {
 *     "linear:berksproject:BER-4": {
 *        key, id, platform, title, url, method, score, inputs, savedAt
 *     },
 *     ...
 *   }
 */
(function (global) {
  "use strict";

  // Chrome exposes the API as `chrome`; Firefox as `browser`. This line picks
  // whichever exists so the same code runs in both browsers.
  const api = typeof browser !== "undefined" ? browser : chrome;

  const STORAGE_KEY = "scores";

  // Read every saved score. Returns an object (empty {} if nothing saved yet).
  async function getAllScores() {
    const data = await api.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || {};
  }

  // Add or update one score. `entry.key` decides which ticket it belongs to,
  // so saving again for the same ticket replaces the previous entry.
  async function saveScore(entry) {
    const scores = await getAllScores();
    scores[entry.key] = entry;
    await api.storage.local.set({ [STORAGE_KEY]: scores });
  }

  // Replace the ENTIRE saved-scores object at once. Used by Restore/import.
  async function setAllScores(scoresObject) {
    await api.storage.local.set({ [STORAGE_KEY]: scoresObject || {} });
  }

  // Read a single ticket's saved score, or null if it hasn't been scored.
  async function getScore(key) {
    const scores = await getAllScores();
    return scores[key] || null;
  }

  // Remove one score by its key.
  async function deleteScore(key) {
    const scores = await getAllScores();
    delete scores[key];
    await api.storage.local.set({ [STORAGE_KEY]: scores });
  }

  // Expose these functions to the rest of our code under one global name.
  global.PriorityScorerStorage = {
    getAllScores,
    setAllScores,
    getScore,
    saveScore,
    deleteScore,
  };
})(typeof window !== "undefined" ? window : globalThis);
