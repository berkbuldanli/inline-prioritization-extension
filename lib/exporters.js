/*
 * Priority Scorer — exporters
 * ---------------------------
 * Pure functions that turn your saved scores into different text formats.
 * "Pure" means they take data in and return a string out — they don't touch
 * the page or trigger downloads (the popup does that). Keeping them separate
 * makes them easy to reuse and to test.
 *
 * Each takes an array of "rows" already worked out by the popup, where a row is:
 *   { rankLabel, method, scoreStr, tier, id, title, platform, saved, url }
 */
(function (global) {
  "use strict";

  // Escape a value so it can't break a CSV cell (wrap in quotes, double quotes).
  function csvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  // Escape a value for a Markdown table cell (pipes and newlines would break it).
  function mdCell(value) {
    return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  }

  const COLUMNS = ["Rank", "Method", "Score", "Tier", "Ticket ID", "Title", "Platform", "Saved", "URL"];

  function rowToArray(r) {
    return [r.rankLabel, r.method, r.scoreStr, r.tier, r.id, r.title, r.platform, r.saved, r.url];
  }

  // --- CSV (opens in Excel / Google Sheets) -------------------------------
  function toCsv(rows) {
    const lines = [COLUMNS].concat(rows.map(rowToArray));
    return lines
      .map(function (row) {
        return row.map(csvCell).join(",");
      })
      .join("\r\n");
  }

  // --- Markdown table (paste into Notion / Docs / GitHub) -----------------
  function toMarkdown(rows, meta) {
    meta = meta || {};
    const out = [];
    out.push("# Priority Scores");
    out.push("");
    out.push(
      "_Exported " +
        (meta.dateStr || new Date().toLocaleString()) +
        " · " +
        rows.length +
        (rows.length === 1 ? " ticket_" : " tickets_")
    );
    out.push("");
    out.push("| Rank | Score | Tier | Ticket | Method | Platform | Saved |");
    out.push("| --- | ---: | --- | --- | --- | --- | --- |");
    rows.forEach(function (r) {
      const ticket = "[" + mdCell(r.id + " " + r.title) + "](" + r.url + ")";
      const cells = [
        mdCell(r.rankLabel),
        mdCell(r.scoreStr),
        mdCell(r.tier),
        ticket,
        mdCell(r.method),
        mdCell(r.platform),
        mdCell(r.saved),
      ];
      out.push("| " + cells.join(" | ") + " |");
    });
    return out.join("\n");
  }

  // --- JSON backup (for Restore / moving between browsers) ----------------
  // Exports the raw saved-scores object wrapped with a little metadata so we can
  // recognise it on import.
  function toJsonBackup(scoresObject) {
    return JSON.stringify(
      {
        app: "Priority Scorer",
        version: 1,
        exportedAt: new Date().toISOString(),
        scores: scoresObject || {},
      },
      null,
      2
    );
  }

  // Parse a backup file's text and return the { key: entry } scores map, or
  // throw if it doesn't look like one of our backups. Accepts either our
  // wrapped format ({ app, scores }) or a bare scores map.
  function parseBackup(text) {
    const data = JSON.parse(text); // throws on invalid JSON
    const scores = data && data.scores ? data.scores : data;
    if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
      throw new Error("This file doesn't look like a Priority Scorer backup.");
    }
    // Light sanity check: every entry should have a key and a numeric score.
    Object.keys(scores).forEach(function (k) {
      const e = scores[k];
      if (!e || typeof e !== "object" || typeof e.score !== "number") {
        throw new Error("This backup file is missing score data.");
      }
    });
    return scores;
  }

  global.PriorityScorerExporters = {
    toCsv: toCsv,
    toMarkdown: toMarkdown,
    toJsonBackup: toJsonBackup,
    parseBackup: parseBackup,
  };
})(typeof window !== "undefined" ? window : globalThis);
