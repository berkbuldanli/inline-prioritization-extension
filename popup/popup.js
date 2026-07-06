/*
 * Priority Scorer — popup script
 * ------------------------------
 * Reads your saved scores and shows them as a ranked list with:
 *   - search (by title / ticket id)
 *   - sort (by score or date)
 *   - method filter (All / RICE / ICE)
 *   - a colored priority tier + rank on each row
 *   - edit (reuses the shared scoring form) and delete (with a confirm)
 *   - an Export menu: Copy Markdown, Markdown, CSV, PDF, JSON backup & restore
 *
 * It reuses the shared helpers: PriorityScorerStorage, PriorityScorerScoring,
 * PriorityScorerForm, and PriorityScorerExporters (all loaded before this file).
 */
(function () {
  "use strict";

  const Storage = window.PriorityScorerStorage;
  const Scoring = window.PriorityScorerScoring;
  const Form = window.PriorityScorerForm;
  const Exporters = window.PriorityScorerExporters;
  const api = typeof browser !== "undefined" ? browser : chrome;

  // Page elements.
  const content = document.getElementById("pp-content");
  const controls = document.getElementById("pp-controls");
  const searchInput = document.getElementById("pp-search");
  const sortSelect = document.getElementById("pp-sort");
  const filterSelect = document.getElementById("pp-filter");
  const exportBtn = document.getElementById("pp-export-btn");
  const exportMenu = document.getElementById("pp-export-menu");
  const importFile = document.getElementById("pp-import-file");

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

  // --- Export helpers ------------------------------------------------------

  // Turn the currently-shown entries into the flat "rows" the exporters want,
  // each enriched with its per-method rank and tier.
  function enrichVisibleRows(all) {
    const byMethod = scoresByMethod(all);
    return visibleEntries(all).map(function (e) {
      const sameMethod = byMethod[e.method] || [];
      const tier = Scoring.tierForScore(e.method, e.score, sameMethod);
      const rank = Scoring.rankWithin(e.score, sameMethod);
      return {
        rankLabel: "#" + rank.rank + " of " + rank.total,
        method: e.method,
        scoreStr: Scoring.formatScore(e.score),
        tier: tier.label,
        id: e.id,
        title: e.title || "",
        platform: e.platform,
        saved: e.savedAt ? new Date(e.savedAt).toLocaleDateString() : "",
        url: e.url,
      };
    });
  }

  // Trigger a file download from an in-memory string.
  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // A date stamp like "2026-07-06" for filenames.
  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  // Copy text to the clipboard, with a fallback for older browsers.
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback: a hidden textarea + execCommand.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  // A small transient message at the bottom of the popup.
  function toast(message) {
    let t = document.getElementById("pp-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "pp-toast";
      t.className = "pp-toast";
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add("pp-toast-show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.classList.remove("pp-toast-show");
    }, 2200);
  }

  // --- The Export menu actions --------------------------------------------
  async function runExportAction(action) {
    const all = await Storage.getAllScores();

    if (action === "json") {
      // Backup EVERYTHING (not just the filtered view).
      download(
        "priority-scorer-backup-" + stamp() + ".json",
        "application/json",
        Exporters.toJsonBackup(all)
      );
      toast("Backup downloaded.");
      return;
    }

    if (action === "import") {
      importFile.click(); // opens the file picker; handled below
      return;
    }

    if (action === "pdf") {
      // Open the printable report in its own tab (it auto-opens the print box).
      api.tabs.create({ url: api.runtime.getURL("report/report.html") });
      return;
    }

    // The remaining actions work on the currently-shown rows.
    const rows = enrichVisibleRows(all);
    if (rows.length === 0) {
      toast("Nothing to export in this view.");
      return;
    }

    if (action === "csv") {
      download("priority-scores-" + stamp() + ".csv", "text/csv;charset=utf-8;", Exporters.toCsv(rows));
      toast("CSV downloaded.");
    } else if (action === "md") {
      download("priority-scores-" + stamp() + ".md", "text/markdown;charset=utf-8;", Exporters.toMarkdown(rows, { dateStr: new Date().toLocaleString() }));
      toast("Markdown downloaded.");
    } else if (action === "copy-md") {
      const ok = await copyToClipboard(Exporters.toMarkdown(rows, { dateStr: new Date().toLocaleString() }));
      toast(ok ? "Markdown copied to clipboard." : "Couldn't copy — try the download instead.");
    }
  }

  // Read a chosen backup file and merge it into storage.
  async function handleImportFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = Exporters.parseBackup(text); // throws if malformed
      const current = await Storage.getAllScores();
      const merged = Object.assign({}, current, incoming); // imported wins on clashes
      await Storage.setAllScores(merged);
      toast(Object.keys(incoming).length + " score(s) restored.");
      render();
    } catch (e) {
      toast("Import failed: " + e.message);
    } finally {
      importFile.value = ""; // let the same file be chosen again later
    }
  }

  // --- Export menu open/close ---------------------------------------------
  function toggleMenu(open) {
    const willOpen = open != null ? open : exportMenu.classList.contains("pp-menu-hidden");
    exportMenu.classList.toggle("pp-menu-hidden", !willOpen);
  }
  exportBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMenu();
  });
  exportMenu.addEventListener("click", function (e) {
    const item = e.target.closest(".pp-menu-item");
    if (!item) return;
    toggleMenu(false);
    runExportAction(item.dataset.action);
  });
  // Close the menu when clicking anywhere else.
  document.addEventListener("click", function () { toggleMenu(false); });
  importFile.addEventListener("change", function () {
    handleImportFile(importFile.files && importFile.files[0]);
  });

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

  render();
})();
