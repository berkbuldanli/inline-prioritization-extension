/*
 * Priority Scorer — content script
 * ---------------------------------
 * A "content script" is JavaScript that the browser injects into web pages.
 * This one runs on Jira and Linear pages (see manifest.json -> content_scripts).
 *
 * What it does:
 *   1. Detects whether the page is a TICKET page (not a board, settings, etc.).
 *   2. If it is, injects a floating "PS" button that opens a scoring panel.
 *   3. The panel lets you score the ticket with RICE or ICE and save the result
 *      to your browser (via lib/storage.js, loaded before this file).
 *
 * Jira and Linear are "single-page apps": clicking around updates the page
 * WITHOUT a full reload. So near the bottom we watch for URL changes and
 * re-check the page, keeping the widget correct as you move between tickets.
 *
 * Everything is wrapped in one big function we call immediately, just to keep
 * our variable names from leaking into the page.
 */
(function () {
  "use strict";

  const WIDGET_ID = "priority-scorer-root";

  // Short-hand to the storage helpers loaded from lib/storage.js.
  const Storage = window.PriorityScorerStorage;

  // ==========================================================================
  // SCORING MATH
  // ==========================================================================
  // Kept as tiny, separate functions so the formulas are easy to read/verify.

  // RICE = (Reach × Impact × Confidence) ÷ Effort
  //   confidence is a decimal here (100% -> 1, 80% -> 0.8, 50% -> 0.5)
  function computeRice(reach, impact, confidence, effort) {
    return (reach * impact * confidence) / effort;
  }

  // ICE = average of Impact, Confidence, Ease (each on a 1–10 scale)
  function computeIce(impact, confidence, ease) {
    return (impact + confidence + ease) / 3;
  }

  // Round to at most 2 decimals, and drop trailing ".00" so scores read cleanly.
  function formatScore(n) {
    if (!isFinite(n)) return "—";
    return parseFloat(n.toFixed(2)).toString();
  }

  // ==========================================================================
  // STEP 1: Detect whether the current page is a Jira or Linear ticket.
  // ==========================================================================
  // Returns { platform, id, title, url, key } or null if not a ticket page.
  // `key` is a unique, stable id we store the score under. We include the
  // workspace so the same ticket number in two different workspaces (e.g. two
  // companies both having "PROJ-1") never collide.
  function detectTicket() {
    const url = window.location.href;
    const host = window.location.hostname;
    const path = window.location.pathname;

    // --- Linear: https://linear.app/<workspace>/issue/ENG-123/slug ---------
    if (host.endsWith("linear.app")) {
      const match = path.match(/\/([^/]+)\/issue\/([A-Za-z0-9]+-\d+)/);
      if (match) {
        const workspace = match[1];
        const id = match[2].toUpperCase();
        return {
          platform: "Linear",
          id: id,
          title: getTicketTitle(id),
          url: url,
          key: "linear:" + workspace + ":" + id,
        };
      }
    }

    // --- Jira: https://<workspace>.atlassian.net/browse/PROJ-456 ----------
    if (host.endsWith("atlassian.net")) {
      const workspace = host.split(".")[0]; // the subdomain
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

      // Board view with the ticket in a query param (?selectedIssue=PROJ-456).
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

    return null; // not a ticket page
  }

  // Best-effort human-friendly title from the browser tab title, with the
  // ticket id and trailing site name stripped off.
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
  // STEP 2: Build the floating widget (button + panel with the calculators).
  // ==========================================================================
  function buildWidget(ticket) {
    const root = document.createElement("div");
    root.id = WIDGET_ID;
    root.className = "ps-root";

    // The floating round button.
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "ps-toggle";
    toggleBtn.type = "button";
    toggleBtn.title = "Priority Scorer";
    toggleBtn.textContent = "PS";

    // The panel (hidden until the button is clicked).
    const panel = document.createElement("div");
    panel.className = "ps-panel ps-hidden";

    // We build the panel's inner HTML as one template string, then wire up the
    // interactive bits below. Using safe placeholders (spans we fill with
    // textContent) for anything that comes from the page.
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

        <!-- Method switcher: RICE vs ICE -->
        <div class="ps-tabs">
          <button class="ps-tab ps-tab-active" data-method="RICE" type="button">RICE</button>
          <button class="ps-tab" data-method="ICE" type="button">ICE</button>
        </div>

        <!-- RICE form -->
        <form class="ps-form ps-form-rice">
          <label class="ps-field">
            <span class="ps-field-label">Reach <small>(people / period)</small></span>
            <input class="ps-input" name="reach" type="number" min="0" step="any" placeholder="e.g. 500" />
          </label>
          <label class="ps-field">
            <span class="ps-field-label">Impact</span>
            <select class="ps-input" name="impact">
              <option value="3">Massive (3)</option>
              <option value="2">High (2)</option>
              <option value="1" selected>Medium (1)</option>
              <option value="0.5">Low (0.5)</option>
              <option value="0.25">Minimal (0.25)</option>
            </select>
          </label>
          <label class="ps-field">
            <span class="ps-field-label">Confidence</span>
            <select class="ps-input" name="confidence">
              <option value="1" selected>High (100%)</option>
              <option value="0.8">Medium (80%)</option>
              <option value="0.5">Low (50%)</option>
            </select>
          </label>
          <label class="ps-field">
            <span class="ps-field-label">Effort <small>(person-months)</small></span>
            <input class="ps-input" name="effort" type="number" min="0" step="any" placeholder="e.g. 2" />
          </label>
        </form>

        <!-- ICE form (hidden until the ICE tab is chosen) -->
        <form class="ps-form ps-form-ice ps-hidden">
          <label class="ps-field">
            <span class="ps-field-label">Impact <small>(1–10)</small></span>
            <input class="ps-input" name="impact" type="number" min="1" max="10" step="1" placeholder="1–10" />
          </label>
          <label class="ps-field">
            <span class="ps-field-label">Confidence <small>(1–10)</small></span>
            <input class="ps-input" name="confidence" type="number" min="1" max="10" step="1" placeholder="1–10" />
          </label>
          <label class="ps-field">
            <span class="ps-field-label">Ease <small>(1–10)</small></span>
            <input class="ps-input" name="ease" type="number" min="1" max="10" step="1" placeholder="1–10" />
          </label>
        </form>

        <!-- Live result -->
        <div class="ps-result">
          <span class="ps-result-label">Score</span>
          <span class="ps-result-value">—</span>
        </div>

        <button class="ps-save" type="button" disabled>Save score</button>
        <div class="ps-saved-note"></div>
      </div>
    `;

    // Fill in the detected ticket safely (textContent = no HTML injection).
    panel.querySelector(".ps-detected-id").textContent = ticket.id;
    panel.querySelector(".ps-detected-title").textContent = ticket.title;

    root.appendChild(panel);
    root.appendChild(toggleBtn);

    // Wire up all the interactivity.
    wireUpPanel(panel, ticket);

    // Open/close the panel.
    toggleBtn.addEventListener("click", () =>
      panel.classList.toggle("ps-hidden")
    );
    panel
      .querySelector(".ps-close")
      .addEventListener("click", () => panel.classList.add("ps-hidden"));

    return root;
  }

  // --------------------------------------------------------------------------
  // Wire up tab switching, live recalculation, and saving.
  // --------------------------------------------------------------------------
  function wireUpPanel(panel, ticket) {
    const tabs = panel.querySelectorAll(".ps-tab");
    const riceForm = panel.querySelector(".ps-form-rice");
    const iceForm = panel.querySelector(".ps-form-ice");
    const resultValue = panel.querySelector(".ps-result-value");
    const saveBtn = panel.querySelector(".ps-save");
    const savedNote = panel.querySelector(".ps-saved-note");

    // Which method is currently selected.
    let method = "RICE";

    // Read the current inputs and return { score, valid, inputs } for the
    // active method. "valid" is false if a required number is missing/bad.
    function currentCalculation() {
      if (method === "RICE") {
        const reach = parseFloat(riceForm.reach.value);
        const impact = parseFloat(riceForm.impact.value);
        const confidence = parseFloat(riceForm.confidence.value);
        const effort = parseFloat(riceForm.effort.value);
        // Reach and effort must be real numbers, and effort can't be 0
        // (dividing by zero has no meaning).
        const valid =
          isFinite(reach) && reach >= 0 && isFinite(effort) && effort > 0;
        return {
          valid,
          score: valid ? computeRice(reach, impact, confidence, effort) : NaN,
          inputs: { reach, impact, confidence, effort },
        };
      } else {
        const impact = parseFloat(iceForm.impact.value);
        const confidence = parseFloat(iceForm.confidence.value);
        const ease = parseFloat(iceForm.ease.value);
        const inRange = (n) => isFinite(n) && n >= 1 && n <= 10;
        const valid = inRange(impact) && inRange(confidence) && inRange(ease);
        return {
          valid,
          score: valid ? computeIce(impact, confidence, ease) : NaN,
          inputs: { impact, confidence, ease },
        };
      }
    }

    // Recompute and update the on-screen result + the Save button state.
    function refresh() {
      const calc = currentCalculation();
      resultValue.textContent = calc.valid ? formatScore(calc.score) : "—";
      saveBtn.disabled = !calc.valid;
    }

    // Switch between the RICE and ICE tabs.
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        method = tab.dataset.method;
        tabs.forEach((t) =>
          t.classList.toggle("ps-tab-active", t === tab)
        );
        riceForm.classList.toggle("ps-hidden", method !== "RICE");
        iceForm.classList.toggle("ps-hidden", method !== "ICE");
        refresh();
      });
    });

    // Recompute whenever any input changes.
    panel.querySelectorAll(".ps-input").forEach((input) => {
      input.addEventListener("input", refresh);
      input.addEventListener("change", refresh);
    });

    // Save the current score for this ticket.
    saveBtn.addEventListener("click", async () => {
      const calc = currentCalculation();
      if (!calc.valid) return;

      await Storage.saveScore({
        key: ticket.key,
        id: ticket.id,
        platform: ticket.platform,
        title: ticket.title,
        url: ticket.url,
        method: method,
        score: calc.score,
        inputs: calc.inputs,
        savedAt: new Date().toISOString(),
      });

      // Brief confirmation + refresh the "last saved" note.
      saveBtn.textContent = "Saved ✓";
      setTimeout(() => (saveBtn.textContent = "Save score"), 1500);
      showSavedNote();
    });

    // Show (and, if we have a saved score, pre-fill from) the last saved entry.
    async function showSavedNote() {
      const saved = await Storage.getScore(ticket.key);
      if (!saved) {
        savedNote.textContent = "";
        return;
      }
      const when = new Date(saved.savedAt).toLocaleDateString();
      savedNote.textContent =
        "Last saved: " +
        saved.method +
        " " +
        formatScore(saved.score) +
        " on " +
        when;
    }

    // If this ticket was scored before, restore those inputs so you can tweak
    // and re-save rather than starting from scratch.
    async function prefillFromSaved() {
      const saved = await Storage.getScore(ticket.key);
      if (!saved) {
        refresh();
        return;
      }
      if (saved.method === "RICE" && saved.inputs) {
        if (isFinite(saved.inputs.reach)) riceForm.reach.value = saved.inputs.reach;
        if (isFinite(saved.inputs.impact)) riceForm.impact.value = saved.inputs.impact;
        if (isFinite(saved.inputs.confidence))
          riceForm.confidence.value = saved.inputs.confidence;
        if (isFinite(saved.inputs.effort)) riceForm.effort.value = saved.inputs.effort;
      } else if (saved.method === "ICE" && saved.inputs) {
        // Switch to the ICE tab.
        tabs.forEach((t) =>
          t.classList.toggle("ps-tab-active", t.dataset.method === "ICE")
        );
        riceForm.classList.add("ps-hidden");
        iceForm.classList.remove("ps-hidden");
        method = "ICE";
        if (isFinite(saved.inputs.impact)) iceForm.impact.value = saved.inputs.impact;
        if (isFinite(saved.inputs.confidence))
          iceForm.confidence.value = saved.inputs.confidence;
        if (isFinite(saved.inputs.ease)) iceForm.ease.value = saved.inputs.ease;
      }
      refresh();
      showSavedNote();
    }

    prefillFromSaved();
  }

  // ==========================================================================
  // STEP 3: Keep the widget in sync with the page.
  // ==========================================================================
  function syncWidget() {
    const ticket = detectTicket();
    const existing = document.getElementById(WIDGET_ID);

    if (!ticket) {
      if (existing) existing.remove();
      return;
    }

    // Already showing the right ticket? Leave it (so we don't wipe out
    // whatever the user is typing).
    if (existing && existing.dataset.ticketKey === ticket.key) return;
    if (existing) existing.remove();

    const widget = buildWidget(ticket);
    widget.dataset.ticketKey = ticket.key;
    document.body.appendChild(widget);
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

    // Safety net: re-check when the tab title changes (SPAs often update it a
    // moment after navigating).
    const titleEl = document.querySelector("title");
    if (titleEl) {
      new MutationObserver(onUrlMaybeChanged).observe(titleEl, {
        childList: true,
      });
    }
  }

  // Debounce so several rapid navigation events only trigger one re-sync.
  let syncTimer = null;
  function onUrlMaybeChanged() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncWidget, 300);
  }

  // GO! Run once now, then keep watching.
  syncWidget();
  watchForNavigation();
})();
