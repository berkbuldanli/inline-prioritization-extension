/*
 * Priority Scorer — shared scoring "source of truth"
 * --------------------------------------------------
 * Everything about HOW we score lives here, in one place, so the widget (on the
 * page) and the popup (toolbar) always agree. Loaded before both content.js and
 * popup.js.
 *
 * The big idea: we DESCRIBE each method (RICE, ICE) as data — its fields, the
 * help text, how to compute the score, how to check the inputs are valid. Then
 * the forms, tooltips, validation, and math all come from this one description.
 * Add or tweak a field here and it updates everywhere.
 */
(function (global) {
  "use strict";

  // --- The two scoring methods, described as data -------------------------
  //
  // Each field has:
  //   name        - the input's name (also the key in the saved `inputs`)
  //   label       - shown above the input
  //   hint        - short plain-English explanation (tooltip + helper line)
  //   type        - "number" or "select"
  //   min / max   - for number inputs (used for validation + the input element)
  //   placeholder - greyed example text for number inputs
  //   options     - for selects: [{ value, label }], with `default` marking one
  const METHODS = {
    RICE: {
      label: "RICE",
      summary: "Reach × Impact × Confidence ÷ Effort",
      fields: [
        {
          name: "reach",
          label: "Reach",
          unit: "people / time period",
          hint: "How many people will this affect in a given period? e.g. 500 users per quarter.",
          type: "number",
          min: 0,
          placeholder: "e.g. 500",
        },
        {
          name: "impact",
          label: "Impact",
          hint: "How much it moves the needle for each person, from Minimal to Massive.",
          type: "select",
          options: [
            { value: 3, label: "Massive (3)" },
            { value: 2, label: "High (2)" },
            { value: 1, label: "Medium (1)", default: true },
            { value: 0.5, label: "Low (0.5)" },
            { value: 0.25, label: "Minimal (0.25)" },
          ],
        },
        {
          name: "confidence",
          label: "Confidence",
          hint: "How sure are you about your Reach and Impact estimates?",
          type: "select",
          options: [
            { value: 1, label: "High (100%)", default: true },
            { value: 0.8, label: "Medium (80%)" },
            { value: 0.5, label: "Low (50%)" },
          ],
        },
        {
          name: "effort",
          label: "Effort",
          unit: "person-months",
          hint: "Total work for everyone involved, in person-months. e.g. 2 people for 1 month = 2.",
          type: "number",
          min: 0,
          placeholder: "e.g. 2",
        },
      ],
      // (Reach × Impact × Confidence) ÷ Effort
      compute: function (v) {
        return (v.reach * v.impact * v.confidence) / v.effort;
      },
      // Reach must be a number ≥ 0; Effort must be a number > 0 (no ÷ by zero).
      validate: function (v) {
        return {
          reach: isFinite(v.reach) && v.reach >= 0,
          impact: isFinite(v.impact),
          confidence: isFinite(v.confidence),
          effort: isFinite(v.effort) && v.effort > 0,
        };
      },
    },

    ICE: {
      label: "ICE",
      summary: "Average of Impact, Confidence, Ease (each 1–10)",
      fields: [
        {
          name: "impact",
          label: "Impact",
          unit: "1–10",
          hint: "How big is the positive effect if this works? 1 = tiny, 10 = huge.",
          type: "number",
          min: 1,
          max: 10,
          placeholder: "1–10",
        },
        {
          name: "confidence",
          label: "Confidence",
          unit: "1–10",
          hint: "How sure are you it will work? 1 = wild guess, 10 = certain.",
          type: "number",
          min: 1,
          max: 10,
          placeholder: "1–10",
        },
        {
          name: "ease",
          label: "Ease",
          unit: "1–10",
          hint: "How easy is it to do? 1 = very hard, 10 = trivial.",
          type: "number",
          min: 1,
          max: 10,
          placeholder: "1–10",
        },
      ],
      // Average of the three.
      compute: function (v) {
        return (v.impact + v.confidence + v.ease) / 3;
      },
      // Each value must be a number between 1 and 10.
      validate: function (v) {
        const ok = function (n) {
          return isFinite(n) && n >= 1 && n <= 10;
        };
        return { impact: ok(v.impact), confidence: ok(v.confidence), ease: ok(v.ease) };
      },
    },
  };

  // Are ALL the fields for this method valid? (validate() returns per-field.)
  function isValid(method, values) {
    const perField = METHODS[method].validate(values);
    return Object.keys(perField).every(function (k) {
      return perField[k];
    });
  }

  // Round to at most 2 decimals and drop a trailing ".00" so scores read clean.
  function formatScore(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return parseFloat(n.toFixed(2)).toString();
  }

  // --- Priority tier (High / Medium / Low) --------------------------------
  //
  // RICE and ICE live on different scales, so we band each method differently:
  //   ICE: absolute bands on the 1–10 average.
  //   RICE: relative to your own highest RICE score (since RICE has no natural
  //         ceiling — it's only meaningful compared to your other RICE items).
  //
  // `sameMethodScores` is an array of the numeric scores already saved with the
  // SAME method (used only for RICE's relative banding).
  function tierForScore(method, score, sameMethodScores) {
    if (!isFinite(score)) return { label: "—", className: "ps-tier-none" };

    if (method === "ICE") {
      if (score >= 7) return { label: "High", className: "ps-tier-high" };
      if (score >= 4) return { label: "Medium", className: "ps-tier-medium" };
      return { label: "Low", className: "ps-tier-low" };
    }

    // RICE: compare against the biggest RICE score we know about.
    const max = Math.max.apply(
      null,
      (sameMethodScores && sameMethodScores.length ? sameMethodScores : [score]).concat(score)
    );
    const ratio = max > 0 ? score / max : 0;
    if (ratio >= 0.66) return { label: "High", className: "ps-tier-high" };
    if (ratio >= 0.33) return { label: "Medium", className: "ps-tier-medium" };
    return { label: "Low", className: "ps-tier-low" };
  }

  // 1-based rank of `score` among `sameMethodScores` (higher score = better
  // rank). Returns { rank, total }, e.g. { rank: 2, total: 8 } -> "#2 of 8".
  function rankWithin(score, sameMethodScores) {
    const scores = (sameMethodScores || []).slice();
    const total = scores.length;
    // How many scores are strictly higher than this one? rank = that + 1.
    let higher = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > score) higher++;
    }
    return { rank: higher + 1, total: total };
  }

  global.PriorityScorerScoring = {
    METHODS: METHODS,
    isValid: isValid,
    formatScore: formatScore,
    tierForScore: tierForScore,
    rankWithin: rankWithin,
  };
})(typeof window !== "undefined" ? window : globalThis);
