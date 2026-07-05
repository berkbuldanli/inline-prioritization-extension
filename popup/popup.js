/*
 * Priority Scorer — popup script
 * ------------------------------
 * Reads your saved scores and shows them as a ranked list with:
 *   - search (by title / ticket id)
 *   - sort (by score or date)
 *   - method filter (All / RICE / ICE)
 *   - a colored priority tier + rank on each row
 *   - edit (reuses the shared scoring form) and delete (with a confirm)
 *   - Export to CSV
 *
 * It reuses the shared helpers: PriorityScorerStorage, PriorityScorerScoring,
 * and PriorityScorerForm (loaded before this file in popup.html).
 */
(function () {
  "use strict";

  const Storage = window.PriorityScorerStorage;
  const Scoring = window.PriorityScorerScoring;
  const Form = window.PriorityScorerForm;
  const api = typeof browser !== "undefined" ? browser : chrome;

  // Page elements.
  const content = document.getElementById("pp-content");
  const controls = document.getElementById("pp-controls");
  const searchInput = document.getElementById("pp-search");
  const sortSelect = document.getElementById("pp-sort");
  const filterSelect = document.getElementById("pp-filter");
  const exportBtn = document.getElementById("pp-export");

  // Which row (if any) is currently being edited.
  let editingKey = null;

  // Group all scores by method -> [numbers], for tiers and ranks.
  function scoresByMethod(all) {
    const byMethod = { RICE: [], ICE: [] };
    Object.values(all).forEach(function (e) {
      if (byMethod[e.method]) byMethod[e.method].push(e.score);
    });
    return byMethod;
  }

  // Apply the current search + filter + sort to the saved entries.
  function visibleEntries(all) {
    const term = searchInput.value.trim().toLowerCase();
    const methodFilter = filterSelect.value;
    const sortBy = sortSelect.value;

    let entries = Object.values(all);

    if (methodFilter !== "ALL") {
      entries = entries.filter(function (e) { return e.method === methodFilter; });
    }
    if (term) {
      entries = entries.filter(function (e) {
        return (
          (e.title || "").toLowerCase().indexOf(term) !== -1 ||
          (e.id || "").toLowerCase().indexOf(term) !== -1
        );
      });
    }
    entries.sort(function (a, b) {
      if (sortBy === "date") {
        return new Date(b.savedAt) - new Date(a.savedAt);
      }
      return b.score - a.score; // score, high -> low
    });
    return entries;
  }

  // Draw the whole list. Called on open and after any change.
  async function render() {
    const all = await Storage.getAllScores();
    const total = Object.keys(all).length;

    // Show/hide the controls + export depending on whether anything is saved.
    controls.style.display = total ? "block" : "none";
    exportBtn.style.display = total ? "inline-block" : "none";

    if (total === 0) {
      content.innerHTML =
        '<div class="pp-empty">' +
        "<p><strong>No saved scores yet.</strong></p>" +
        "<p>Open a Jira or Linear ticket, use the floating <em>PS</em> button " +
        "to score it, and your saved scores will appear here — ranked highest " +
        "first.</p>" +
        "</div>";
      return;
    }

    const byMethod = scoresByMethod(all);
    const entries = visibleEntries(all);

    content.innerHTML = "";

    if (entries.length === 0) {
      const none = document.createElement("div");
      none.className = "pp-empty";
      none.textContent = "No scores match your search / filter.";
      content.appendChild(none);
      return;
    }

    const list = document.createElement("ol");
    list.className = "pp-list";
    entries.forEach(function (entry) {
      list.appendChild(buildRow(entry, byMethod));
    });
    content.appendChild(list);
  }

  // Build one row (or its edit form, if this row is being edited).
  function buildRow(entry, byMethod) {
    const li = document.createElement("li");
    li.className = "pp-item";

    if (editingKey === entry.key) {
      li.className = "pp-item pp-item-editing";
      li.appendChild(buildEditor(entry, byMethod));
      return li;
    }

    const sameMethod = byMethod[entry.method] || [];
    const tier = Scoring.tierForScore(entry.method, entry.score, sameMethod);
    const rank = Scoring.rankWithin(entry.score, sameMethod);

    // Score badge.
    const badge = document.createElement("div");
    badge.className = "pp-score";
    badge.textContent = Scoring.formatScore(entry.score);

    // Middle: title link + meta + tier/rank.
    const info = document.createElement("div");
    info.className = "pp-info";

    const link = document.createElement("a");
    link.className = "pp-link";
    link.href = entry.url;
    link.textContent = entry.title || entry.id;
    link.title = entry.url;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      api.tabs.create({ url: entry.url });
    });

    const tierRow = document.createElement("div");
    tierRow.className = "pp-tier-row";
    const tierBadge = document.createElement("span");
    tierBadge.className = "ps-tier " + tier.className;
    tierBadge.textContent = tier.label;
    const rankText = document.createElement("span");
    rankText.className = "pp-rank";
    rankText.textContent = "#" + rank.rank + " of " + rank.total + " " + entry.method;
    tierRow.appendChild(tierBadge);
    tierRow.appendChild(rankText);

    const meta = document.createElement("div");
    meta.className = "pp-meta";
    meta.textContent =
      entry.id +
      " · " +
      entry.platform +
      " · " +
      (entry.savedAt ? new Date(entry.savedAt).toLocaleDateString() : "");

    info.appendChild(link);
    info.appendChild(tierRow);
    info.appendChild(meta);

    // Action buttons: edit + delete.
    const actions = document.createElement("div");
    actions.className = "pp-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "pp-edit";
    editBtn.type = "button";
    editBtn.title = "Edit this score";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", function () {
      editingKey = entry.key;
      render();
    });

    const del = document.createElement("button");
    del.className = "pp-delete";
    del.type = "button";
    del.title = "Delete this score";
    del.textContent = "×";
    // Two-step delete: first click asks to confirm.
    del.addEventListener("click", function () {
      if (del.dataset.confirm === "1") {
        Storage.deleteScore(entry.key).then(render);
      } else {
        del.dataset.confirm = "1";
        del.textContent = "Sure?";
        del.classList.add("pp-delete-confirm");
        setTimeout(function () {
          del.dataset.confirm = "";
          del.textContent = "×";
          del.classList.remove("pp-delete-confirm");
        }, 2500);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(del);

    li.appendChild(badge);
    li.appendChild(info);
    li.appendChild(actions);
    return li;
  }

  // Build the inline edit form for a row (reuses the shared scoring form).
  function buildEditor(entry, byMethod) {
    const wrap = document.createElement("div");
    wrap.className = "pp-editor";

    const heading = document.createElement("div");
    heading.className = "pp-editor-title";
    heading.textContent = "Editing " + entry.id;
    wrap.appendChild(heading);

    const form = Form.create({
      method: entry.method,
      values: entry.inputs,
      showTabs: true,
      getSameMethodScores: function (method) {
        return byMethod[method] || [];
      },
    });
    wrap.appendChild(form.element);

    const actions = document.createElement("div");
    actions.className = "pp-editor-actions";

    const save = document.createElement("button");
    save.className = "pp-btn pp-btn-primary";
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", async function () {
      const state = form.getState();
      if (!state.valid) {
        form.showAllErrors();
        return;
      }
      await Storage.saveScore(
        Object.assign({}, entry, {
          method: state.method,
          score: state.score,
          inputs: state.values,
          savedAt: new Date().toISOString(),
        })
      );
      editingKey = null;
      render();
    });

    const cancel = document.createElement("button");
    cancel.className = "pp-btn";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", function () {
      editingKey = null;
      render();
    });

    actions.appendChild(cancel);
    actions.appendChild(save);
    wrap.appendChild(actions);
    return wrap;
  }

  // --- Export to CSV -------------------------------------------------------
  // Builds a CSV of whatever's currently shown (respects search/filter/sort)
  // and triggers a download.
  async function exportCsv() {
    const all = await Storage.getAllScores();
    const byMethod = scoresByMethod(all);
    const entries = visibleEntries(all);
    if (entries.length === 0) return;

    const header = [
      "Rank",
      "Method",
      "Score",
      "Tier",
      "Ticket ID",
      "Title",
      "Platform",
      "Saved",
      "URL",
    ];

    const rows = entries.map(function (e) {
      const sameMethod = byMethod[e.method] || [];
      const tier = Scoring.tierForScore(e.method, e.score, sameMethod);
      const rank = Scoring.rankWithin(e.score, sameMethod);
      return [
        "#" + rank.rank + " of " + rank.total,
        e.method,
        Scoring.formatScore(e.score),
        tier.label,
        e.id,
        e.title || "",
        e.platform,
        e.savedAt ? new Date(e.savedAt).toLocaleDateString() : "",
        e.url,
      ];
    });

    // Wrap each cell in quotes and escape any quotes inside — safe for commas.
    const csv = [header]
      .concat(rows)
      .map(function (row) {
        return row
          .map(function (cell) {
            return '"' + String(cell).replace(/"/g, '""') + '"';
          })
          .join(",");
      })
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "priority-scores.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // --- Wire up the controls ------------------------------------------------
  // Re-render as the user searches / sorts / filters. (Leaving edit mode first
  // so a stale editor doesn't linger.)
  function onControlChange() {
    editingKey = null;
    render();
  }
  searchInput.addEventListener("input", onControlChange);
  sortSelect.addEventListener("change", onControlChange);
  filterSelect.addEventListener("change", onControlChange);
  exportBtn.addEventListener("click", exportCsv);

  render();
})();
