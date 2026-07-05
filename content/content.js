/*
 * Priority Scorer — content script
 * ---------------------------------
 * A "content script" is JavaScript that the browser injects into web pages.
 * This one runs on Jira and Linear pages (see manifest.json -> content_scripts).
 *
 * Its job in this first version:
 *   1. Figure out whether the page we're on is a TICKET page (not a board,
 *      settings screen, etc.).
 *   2. If it is, inject a small floating button in the corner.
 *   3. Clicking the button opens/closes a panel (the scoring widget lives here).
 *
 * Jira and Linear are "single-page apps" (SPAs): when you click around, the
 * page updates WITHOUT a full reload. A normal script would only run once and
 * then go stale. So near the bottom we watch for URL changes and re-check the
 * page, keeping the widget correct as you move between tickets.
 *
 * Everything is wrapped in one big function that we call immediately. This is
 * just a tidy way to keep our variable names from leaking into the page.
 */
(function () {
  "use strict";

  // A unique id for our floating container so we never inject it twice.
  const WIDGET_ID = "priority-scorer-root";

  // -------------------------------------------------------------------------
  // STEP 1: Detect whether the current page is a Jira or Linear ticket.
  // -------------------------------------------------------------------------
  //
  // We return an object describing the ticket ({ platform, id, title, url })
  // or `null` if this isn't a ticket page. Keeping detection in one function
  // makes it easy to tweak later if Jira/Linear change their URLs.
  function detectTicket() {
    const url = window.location.href;
    const host = window.location.hostname;
    const path = window.location.pathname;

    // --- Linear ---------------------------------------------------------
    // Linear ticket URLs look like:
    //   https://linear.app/acme/issue/ENG-123/some-title-slug
    // So we look for "/issue/" followed by something like "ENG-123".
    if (host.endsWith("linear.app")) {
      const match = path.match(/\/issue\/([A-Za-z0-9]+-\d+)/);
      if (match) {
        return {
          platform: "Linear",
          id: match[1].toUpperCase(), // e.g. "ENG-123"
          title: getTicketTitle(match[1]),
          url: url,
        };
      }
    }

    // --- Jira -----------------------------------------------------------
    // Jira Cloud shows a ticket in two common ways:
    //   1. https://acme.atlassian.net/browse/PROJ-456
    //   2. A board URL with the ticket in a query param, e.g.
    //      ...?selectedIssue=PROJ-456
    if (host.endsWith("atlassian.net")) {
      const browseMatch = path.match(/\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)/);
      if (browseMatch) {
        return {
          platform: "Jira",
          id: browseMatch[1].toUpperCase(),
          title: getTicketTitle(browseMatch[1]),
          url: url,
        };
      }

      const params = new URLSearchParams(window.location.search);
      const selected = params.get("selectedIssue");
      if (selected && /^[A-Za-z][A-Za-z0-9]+-\d+$/.test(selected)) {
        return {
          platform: "Jira",
          id: selected.toUpperCase(),
          title: getTicketTitle(selected),
          url: url,
        };
      }
    }

    // Not a ticket page.
    return null;
  }

  // Best-effort attempt to read a human-friendly title for the ticket.
  // The page's <title> usually contains it (e.g. "ENG-123 Fix login bug").
  // We strip the ticket id and any trailing site name to keep it clean.
  function getTicketTitle(ticketId) {
    let title = document.title || "";
    // Remove the ticket id if the tab title starts with it.
    title = title.replace(new RegExp("^\\s*" + ticketId + "\\s*[-:·]?\\s*", "i"), "");
    // Chop off trailing " - Jira" / " - Linear" style suffixes.
    title = title.replace(/\s*[-–|·]\s*(Jira|Linear).*$/i, "");
    title = title.trim();
    return title || ticketId; // fall back to the id if we found nothing useful
  }

  // -------------------------------------------------------------------------
  // STEP 2: Build the floating widget (button + panel).
  // -------------------------------------------------------------------------
  function buildWidget(ticket) {
    // The outer container holds both the button and the panel.
    const root = document.createElement("div");
    root.id = WIDGET_ID;
    root.className = "ps-root";

    // The floating round button.
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "ps-toggle";
    toggleBtn.type = "button";
    toggleBtn.title = "Priority Scorer";
    toggleBtn.textContent = "PS"; // simple text logo for now

    // The panel that expands when you click the button. Hidden by default.
    const panel = document.createElement("div");
    panel.className = "ps-panel ps-hidden";

    // Panel header: shows what ticket we detected + a close button.
    const header = document.createElement("div");
    header.className = "ps-header";
    header.innerHTML =
      '<span class="ps-title">Priority Scorer</span>' +
      '<button class="ps-close" type="button" title="Close">&times;</button>';

    // Panel body: placeholder for now. The RICE/ICE calculator goes here next.
    const body = document.createElement("div");
    body.className = "ps-body";
    body.innerHTML =
      '<div class="ps-detected">' +
      '<div class="ps-detected-label">Detected ticket</div>' +
      '<div class="ps-detected-id"></div>' +
      '<div class="ps-detected-platform"></div>' +
      "</div>" +
      '<p class="ps-placeholder">The RICE &amp; ICE scoring widget will appear here. ' +
      "If you can read this on a ticket page, the extension is installed and working. 🎉</p>";

    // Fill in the detected ticket details safely (textContent avoids any risk
    // of the page's text being treated as HTML).
    body.querySelector(".ps-detected-id").textContent = ticket.id;
    body.querySelector(".ps-detected-platform").textContent = ticket.platform;

    // Assemble the panel.
    panel.appendChild(header);
    panel.appendChild(body);

    // Assemble the whole widget.
    root.appendChild(panel);
    root.appendChild(toggleBtn);

    // --- Wire up the clicks ---------------------------------------------
    toggleBtn.addEventListener("click", function () {
      panel.classList.toggle("ps-hidden");
    });
    header.querySelector(".ps-close").addEventListener("click", function () {
      panel.classList.add("ps-hidden");
    });

    return root;
  }

  // -------------------------------------------------------------------------
  // STEP 3: Keep the widget in sync with the page.
  // -------------------------------------------------------------------------
  //
  // `syncWidget` is the traffic cop: it checks the current page and either
  // adds, removes, or leaves the widget alone.
  function syncWidget() {
    const ticket = detectTicket();
    const existing = document.getElementById(WIDGET_ID);

    if (!ticket) {
      // Not on a ticket page — remove the widget if it's lingering.
      if (existing) existing.remove();
      return;
    }

    // On a ticket page. If the widget already exists but points at a different
    // ticket, rebuild it so the detected id stays accurate.
    if (existing) {
      if (existing.dataset.ticketId === ticket.id) return; // already correct
      existing.remove();
    }

    const widget = buildWidget(ticket);
    widget.dataset.ticketId = ticket.id;
    document.body.appendChild(widget);
  }

  // -------------------------------------------------------------------------
  // STEP 4: Detect SPA navigation (URL changes without a page reload).
  // -------------------------------------------------------------------------
  //
  // SPAs change the URL using the browser's History API (pushState /
  // replaceState) or the back/forward buttons (popstate). None of these fire
  // a normal "page load", so we hook into them to know when to re-check.
  function watchForNavigation() {
    // Wrap pushState/replaceState so we get notified when the app navigates.
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

    // Back/forward buttons.
    window.addEventListener("popstate", onUrlMaybeChanged);

    // Safety net: some apps swap content without touching the URL right away,
    // and the page <title> may update a beat later. A lightweight observer on
    // the document title lets us re-check when that happens.
    const titleEl = document.querySelector("title");
    if (titleEl) {
      new MutationObserver(onUrlMaybeChanged).observe(titleEl, {
        childList: true,
      });
    }
  }

  // Debounce: SPAs can fire several navigation events in quick succession.
  // We wait a short moment so we only re-sync once things settle.
  let syncTimer = null;
  function onUrlMaybeChanged() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncWidget, 300);
  }

  // -------------------------------------------------------------------------
  // GO! Run once now, then keep watching.
  // -------------------------------------------------------------------------
  syncWidget();
  watchForNavigation();
})();
