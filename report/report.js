/*
 * Priority Scorer — printable report logic
 * Reads all saved scores and renders them as ranked, per-method tables.
 */
(function () {
  "use strict";

  const Storage = window.PriorityScorerStorage;
  const Scoring = window.PriorityScorerScoring;
  const content = document.getElementById("rp-content");

  // Group all scores by method -> [numbers], for tiers and ranks.
  function scoresByMethod(all) {
    const byMethod = { RICE: [], ICE: [] };
    Object.values(all).forEach(function (e) {
      if (byMethod[e.method]) byMethod[e.method].push(e.score);
    });
    return byMethod;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  async function render() {
    const all = await Storage.getAllScores();
    const entries = Object.values(all);

    // Page title + date.
    const header = el("div", "rp-header");
    header.appendChild(el("h1", null, "Priority Scores"));
    header.appendChild(
      el("p", "rp-sub", "Generated " + new Date().toLocaleString() + " · " + entries.length + (entries.length === 1 ? " ticket" : " tickets"))
    );
    content.appendChild(header);

    if (entries.length === 0) {
      content.appendChild(el("p", "rp-empty", "No saved scores yet."));
      return;
    }

    const byMethod = scoresByMethod(all);

    // One section per method that actually has scores, each ranked high -> low.
    ["RICE", "ICE"].forEach(function (method) {
      const rows = entries
        .filter(function (e) { return e.method === method; })
        .sort(function (a, b) { return b.score - a.score; });
      if (rows.length === 0) return;

      const section = el("section", "rp-section");
      section.appendChild(el("h2", null, method + " (" + rows.length + ")"));

      const table = el("table", "rp-table");
      const thead = el("thead");
      const headRow = el("tr");
      ["#", "Score", "Tier", "Ticket", "Platform", "Saved"].forEach(function (h) {
        headRow.appendChild(el("th", null, h));
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = el("tbody");
      rows.forEach(function (e, i) {
        const tier = Scoring.tierForScore(method, e.score, byMethod[method]);
        const tr = el("tr");
        tr.appendChild(el("td", "rp-rank", "#" + (i + 1)));
        tr.appendChild(el("td", "rp-score", Scoring.formatScore(e.score)));

        const tierTd = el("td");
        tierTd.appendChild(el("span", "rp-tier rp-tier-" + tier.label.toLowerCase(), tier.label));
        tr.appendChild(tierTd);

        const ticketTd = el("td");
        ticketTd.appendChild(el("strong", null, e.id + " "));
        ticketTd.appendChild(document.createTextNode(e.title || ""));
        tr.appendChild(ticketTd);

        tr.appendChild(el("td", null, e.platform));
        tr.appendChild(el("td", null, e.savedAt ? new Date(e.savedAt).toLocaleDateString() : ""));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      section.appendChild(table);
      content.appendChild(section);
    });
  }

  document.getElementById("rp-print").addEventListener("click", function () {
    window.print();
  });

  // Render, then open the print dialog automatically (a short delay lets the
  // page finish drawing first).
  render().then(function () {
    setTimeout(function () { window.print(); }, 400);
  });
})();
