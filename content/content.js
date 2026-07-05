/*
 * Priority Scorer — content script
 * ---------------------------------
 * Runs on Jira and Linear pages (see manifest.json). It:
 *   1. Detects whether the page is a TICKET page.
 *   2. If so, injects a floating "PS" button that opens a scoring panel.
 *   3. The panel uses the shared scoring form (lib/scoreForm.js) for RICE/ICE,
 *      shows a live score + priority tier, and saves results to your browser.
 *
 * Jira and Linear are single-page apps, so near the bottom we watch for URL
 * changes and keep the widget in sync as you move between tickets.
 */
(function () {
  "use strict";

  const WIDGET_ID = "priority-scorer-root";
  const Storage = window.PriorityScorerStorage;
  const Scoring = window.PriorityScorerScoring;
  const Form = window.PriorityScorerForm;

  // ==========================================================================
  // STEP 1: Detect whether the current page is a Jira or Linear ticket.
  // ==========================================================================
  // Returns { platform, id, title, url, key } or null. `key` includes the
  // workspace so the same ticket number in two workspaces never collides.
  function detectTicket() {
    const url = window.location.href;
    const host = window.location.hostname;
    const path = window.location.pathname;

    // --- Linear: https://linear.app/<workspace>/issue/ENG-123/slug ---------
    if (host.endsWith("linear.app")) {
      const match = path.match(/\/([^/]+)\/issue\/([A-Za-z0-9]+-\d+)/);
      if (match) {
        const id = match[2].toUpperCase();
        return {
          platform: "Linear",
          id: id,
          title: getTicketTitle(id),
          url: url,
          key: "linear:" + match[1] + ":" + id,
        };
      }
    }

    // --- Jira: https://<workspace>.atlassian.net/browse/PROJ-456 ----------
    if (host.endsWith("atlassian.net")) {
      const workspace = host.split(".")[0];
      const browseMatch = path.match(/\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)/);
      if (browseMatch) {
        const id = browseMatch[1].toUpperCase();
        return {
          platform: "Jira",
          id: id,
          title: getTicketTitle(id),
          url: url,
          key: "jira:" + workspace + ":" + id,
        };
      }
      const selected = new URLSearchParams(window.location.search).get(
        "selectedIssue"
      );
      if (selected && /^[A-Za-z][A-Za-z0-9]+-\d+$/.test(selected)) {
        const id = selected.toUpperCase();
        return {
          platform: "Jira",
          id: id,
          title: getTicketTitle(id),
          url: url,
          key: "jira:" + workspace + ":" + id,
        };
      }
    }

    return null;
  }

  // Best-effort human-friendly title from the browser tab title.
  function getTicketTitle(ticketId) {
    let title = document.title || "";
    title = title.replace(
      new RegExp("^\\s*" + ticketId + "\\s*[-:·]?\\s*", "i"),
      ""
    );
    title = title.replace(/\s*[-–|·]\s*(Jira|Linear).*$/i, "");
    title = title.trim();
    return title || ticketId;
  }

  // ==========================================================================
  // Helper: group all saved scores by method -> array of numeric scores.
  // Used to work out priority tiers/ranks for the current ticket.
  // ==========================================================================
  function scoresByMethod(allScores) {
    const byMethod = { RICE: [], ICE: [] };
    Object.values(allScores).forEach(function (entry) {
      if (byMethod[entry.method]) byMethod[entry.method].push(entry.score);
    });
    return byMethod;
  }

  // ==========================================================================
  // STEP 2: Build the floating widget (button + panel with the scoring form).
  // Async because we load this ticket's saved score first (to pre-fill it).
  // ==========================================================================
  async function buildWidget(ticket) {
    const allScores = await Storage.getAllScores();
    const saved = allScores[ticket.key] || null;
    let snapshot = scoresByMethod(allScores);

    const root = document.createElement("div");
    root.id = WIDGET_ID;
    root.className = "ps-root";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "ps-toggle";
    toggleBtn.type = "button";
    toggleBtn.title = "Priority Scorer";
    toggleBtn.textContent = "PS";

    const panel = document.createElement("div");
    panel.className = "ps-panel ps-hidden";
    panel.innerHTML = `
      <div class="ps-header">
        <span class="ps-title">Priority Scorer</span>
        <button class="ps-close" type="button" title="Close">&times;</button>
      </div>
      <div class="ps-body">
        <div class="ps-detected">
          <div class="ps-detected-label">Scoring ticket</div>
          <div class="ps-detected-id"></div>
          <div class="ps-detected-title"></div>
        </div>
        <div class="ps-form-mount"></div>
        <button class="ps-save" type="button">Save score</button>
        <div class="ps-saved-note"></div>
      </div>
    `;

    panel.querySelector(".ps-detected-id").textContent = ticket.id;
    panel.querySelector(".ps-detected-title").textContent = ticket.title;

    // Build the shared scoring form, pre-filled from any saved score.
    const form = Form.create({
      method: saved ? saved.method : "RICE",
      values: saved ? saved.inputs : null,
      showTabs: true,
      // For RICE's relative tier, compare against your saved RICE scores.
      getSameMethodScores: function (method) {
        return snapshot[method];
      },
    });
    panel.querySelector(".ps-form-mount").appendChild(form.element);

    const saveBtn = panel.querySelector(".ps-save");
    const savedNote = panel.querySelector(".ps-saved-note");

    function renderSavedNote() {
      if (!saved) {
        savedNote.textContent = "";
        return;
      }
      savedNote.textContent =
        "Last saved: " +
        saved.method +
        " " +
        Scoring.formatScore(saved.score) +
        " on " +
        new Date(saved.savedAt).toLocaleDateString();
    }
    renderSavedNote();

    saveBtn.addEventListener("click", async function () {
      const state = form.getState();
      if (!state.valid) {
        form.showAllErrors(); // point out what's missing
        return;
      }
      await Storage.saveScore({
        key: ticket.key,
        id: ticket.id,
        platform: ticket.platform,
        title: ticket.title,
        url: ticket.url,
        method: state.method,
        score: state.score,
        inputs: state.values,
        savedAt: new Date().toISOString(),
      });

      saveBtn.textContent = "Saved ✓";
      setTimeout(function () { saveBtn.textContent = "Save score"; }, 1500);

      // Refresh our local view so the tier badge and note stay accurate.
      const fresh = await Storage.getAllScores();
      snapshot = scoresByMethod(fresh);
      savedNote.textContent =
        "Last saved: " +
        state.method +
        " " +
        Scoring.formatScore(state.score) +
        " on " +
        new Date().toLocaleDateString();
      form.refresh();
    });

    root.appendChild(panel);
    root.appendChild(toggleBtn);

    toggleBtn.addEventListener("click", function () {
      panel.classList.toggle("ps-hidden");
    });
    panel.querySelector(".ps-close").addEventListener("click", function () {
      panel.classList.add("ps-hidden");
    });

    return root;
  }

  // ==========================================================================
  // STEP 3: Keep the widget in sync with the page.
  // ==========================================================================
  let building = false;
  async function syncWidget() {
    const ticket = detectTicket();
    const existing = document.getElementById(WIDGET_ID);

    if (!ticket) {
      if (existing) existing.remove();
      return;
    }
    // Already showing the right ticket? Leave it (don't wipe what's being typed).
    if (existing && existing.dataset.ticketKey === ticket.key) return;
    if (building) return; // avoid overlapping async builds
    building = true;
    try {
      if (existing) existing.remove();
      const widget = await buildWidget(ticket);
      // Guard: make sure we're still on the same ticket after the await.
      if (detectTicket() && detectTicket().key === ticket.key) {
        widget.dataset.ticketKey = ticket.key;
        document.body.appendChild(widget);
      }
    } finally {
      building = false;
    }
  }

  // ==========================================================================
  // STEP 4: Detect SPA navigation (URL changes without a page reload).
  // ==========================================================================
  function watchForNavigation() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      onUrlMaybeChanged();
    };
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onUrlMaybeChanged();
    };
    window.addEventListener("popstate", onUrlMaybeChanged);

    const titleEl = document.querySelector("title");
    if (titleEl) {
      new MutationObserver(onUrlMaybeChanged).observe(titleEl, {
        childList: true,
      });
    }
  }

  let syncTimer = null;
  function onUrlMaybeChanged() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncWidget, 300);
  }

  syncWidget();
  watchForNavigation();
})();
