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

  // Return the URL only if it's a normal web link (http/https). Anything else —
  // "javascript:", "data:", junk — becomes "" so it can never be used as a live
  // link. Used both when importing backups and when rendering rows in the popup.
  function safeUrl(u) {
    if (typeof u !== "string") return "";
    try {
      const parsed = new URL(u);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return u;
    } catch (e) {
      // not a valid URL
    }
    return "";
  }

  // Escape a value so it can't break a CSV cell (wrap in quotes, double quotes).
  // We also neutralize "formula injection": a cell starting with = + - @ (or a
  // tab/carriage-return) can be run as a formula by Excel/Sheets, so we prefix
  // those with a single quote to force them to stay plain text.
  function csvCell(value) {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
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

  // Coerce anything to a trimmed string, capped to a sane length.
  function str(value, max) {
    return String(value == null ? "" : value).slice(0, max || 300);
  }

  // Parse a backup file's text and return a CLEAN { key: entry } scores map, or
  // throw if it doesn't look like one of our backups. Accepts either our wrapped
  // format ({ app, scores }) or a bare scores map.
  //
  // Because a backup file is untrusted input (someone could hand you a crafted
  // one), we don't store it as-is: we rebuild each entry from scratch, keeping
  // only known fields, validating types, capping lengths, sanitizing the URL,
  // and skipping dangerous keys — so nothing unexpected ends up in storage.
  function parseBackup(text) {
    const data = JSON.parse(text); // throws on invalid JSON
    const scores = data && data.scores ? data.scores : data;
    if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
      throw new Error("This file doesn't look like a Priority Scorer backup.");
    }

    const clean = {};
    Object.keys(scores).forEach(function (key) {
      // Never let these become object keys (prototype-pollution guard).
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return;
      }
      const e = scores[key];
      if (!e || typeof e !== "object") {
        throw new Error("This backup file has a malformed entry.");
      }
      if (typeof e.score !== "number" || !isFinite(e.score)) {
        throw new Error("This backup file is missing score data.");
      }
      if (e.method !== "RICE" && e.method !== "ICE") {
        throw new Error("This backup file has an unknown scoring method.");
      }
      clean[key] = {
        key: str(e.key || key, 200),
        id: str(e.id, 120),
        platform: str(e.platform, 40),
        title: str(e.title, 300),
        url: safeUrl(e.url),
        method: e.method,
        score: e.score,
        inputs: e.inputs && typeof e.inputs === "object" ? e.inputs : {},
        savedAt: typeof e.savedAt === "string" ? e.savedAt : new Date().toISOString(),
      };
    });
    return clean;
  }

  global.PriorityScorerExporters = {
    toCsv: toCsv,
    toMarkdown: toMarkdown,
    toJsonBackup: toJsonBackup,
    parseBackup: parseBackup,
    safeUrl: safeUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
