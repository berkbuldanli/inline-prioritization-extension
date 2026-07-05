/*
 * Priority Scorer — popup script
 * ------------------------------
 * Runs when the popup opens. In a later step this will read your saved scores
 * from browser storage and show them as a ranked list. For now it just renders
 * a friendly "no scores yet" message so we can confirm the popup works.
 */
(function () {
  "use strict";

  const content = document.getElementById("pp-content");

  content.innerHTML =
    '<div class="pp-empty">' +
    "<p><strong>No saved scores yet.</strong></p>" +
    "<p>Open a Jira or Linear ticket, use the floating <em>PS</em> button to " +
    "score it, and your saved scores will appear here — ranked highest first.</p>" +
    "</div>";
})();
