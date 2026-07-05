/*
 * Priority Scorer — popup script
 * ------------------------------
 * Runs when the popup opens. It reads your saved scores from browser storage
 * and shows them as a ranked list (highest score first). Each row links to the
 * ticket and has a delete button.
 */
(function () {
  "use strict";

  const Storage = window.PriorityScorerStorage;
  const content = document.getElementById("pp-content");

  // Chrome exposes tab helpers as `chrome`; Firefox as `browser`.
  const api = typeof browser !== "undefined" ? browser : chrome;

  // Round to at most 2 decimals and drop trailing ".00".
  function formatScore(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return parseFloat(n.toFixed(2)).toString();
  }

  // Draw the whole list from scratch. Called on open and after any delete.
  async function render() {
    const scoresObj = await Storage.getAllScores();

    // Turn the { key: entry } object into an array and sort highest-first.
    const entries = Object.values(scoresObj).sort((a, b) => b.score - a.score);

    // Empty state.
    if (entries.length === 0) {
      content.innerHTML =
        '<div class="pp-empty">' +
        "<p><strong>No saved scores yet.</strong></p>" +
        "<p>Open a Jira or Linear ticket, use the floating <em>PS</em> button " +
        "to score it, and your saved scores will appear here — ranked highest " +
        "first.</p>" +
        "</div>";
      return;
    }

    // Build the list. We create elements with the DOM API (rather than pasting
    // HTML strings) so ticket titles from the web can never be treated as code.
    content.innerHTML = "";
    const list = document.createElement("ol");
    list.className = "pp-list";

    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "pp-item";

      // Score badge on the left.
      const badge = document.createElement("div");
      badge.className = "pp-score";
      badge.textContent = formatScore(entry.score);

      // Middle: clickable ticket that opens in a new tab.
      const info = document.createElement("div");
      info.className = "pp-info";

      const link = document.createElement("a");
      link.className = "pp-link";
      link.href = entry.url;
      link.textContent = entry.title || entry.id;
      link.title = entry.url;
      // Open the ticket in a new browser tab when clicked.
      link.addEventListener("click", (e) => {
        e.preventDefault();
        api.tabs.create({ url: entry.url });
      });

      const meta = document.createElement("div");
      meta.className = "pp-meta";
      const when = entry.savedAt
        ? new Date(entry.savedAt).toLocaleDateString()
        : "";
      meta.textContent =
        entry.id + " · " + entry.platform + " · " + entry.method + " · " + when;

      info.appendChild(link);
      info.appendChild(meta);

      // Delete button on the right.
      const del = document.createElement("button");
      del.className = "pp-delete";
      del.type = "button";
      del.title = "Delete this score";
      del.textContent = "×";
      del.addEventListener("click", async () => {
        await Storage.deleteScore(entry.key);
        render(); // redraw the list without this entry
      });

      li.appendChild(badge);
      li.appendChild(info);
      li.appendChild(del);
      list.appendChild(li);
    });

    content.appendChild(list);
  }

  render();
})();
