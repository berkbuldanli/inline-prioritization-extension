# Priority Scorer

A browser extension that helps product managers score and prioritize **Jira**
and **Linear** tickets using the **RICE** and **ICE** frameworks. Everything is
stored locally in your browser — no accounts, no servers, no external APIs.

Works on **Chrome** and **Firefox** (built with the WebExtensions API,
Manifest V3).

> _Works with Jira and Linear. Not affiliated with, or endorsed by, Atlassian or
> Linear._

## Publishing

Ready to go to the stores. Run `bash scripts/package.sh` to build the upload zip,
and follow [`STORE_SUBMISSION.md`](STORE_SUBMISSION.md) for the full Chrome Web
Store + Firefox AMO checklist (listing copy, screenshots in `store-assets/`, and
permission justifications are all prepared). See [`PRIVACY.md`](PRIVACY.md) for
the privacy policy.

## What it does

- On a **Jira** or **Linear** ticket page, a floating **PS** button appears
  bottom-right. Click it to open the scoring panel.
- Score the ticket two ways, switchable with tabs:
  - **RICE** — Reach × Impact × Confidence ÷ Effort.
  - **ICE** — the average of Impact, Confidence, and Ease (each 1–10).
- The score updates live as you type, with a **priority tier** badge
  (High / Medium / Low) and short plain-English hints under every field. Click
  **Save score** to store it against that ticket (kept in your browser, keyed by
  ticket + workspace, with the date and method).
- Click the toolbar icon to open the **popup**: all your saved scores as a
  ranked list (highest first), each with its tier and rank. You can:
  - **Search** by title or ticket ID,
  - **Sort** by score or date,
  - **Filter** by method (RICE / ICE),
  - **Edit** a saved score in place, or **delete** it (with a confirm step),
  - click a ticket to open it in a new tab,
  - **Export ▾** the list in several formats (see below).

### Exporting & backups

The **Export ▾** menu in the popup gives you:

- **Copy as Markdown** — a ranked Markdown table on your clipboard, ready to
  paste into Notion, Confluence, Google Docs, or a GitHub comment.
- **Markdown (.md)** / **CSV (.csv)** — download the current view as a file.
  (CSV opens directly in Excel and Google Sheets.)
- **Print / Save as PDF** — opens a clean, formatted report in a new tab and
  brings up the print dialog; choose "Save as PDF" to share it.
- **Backup all (JSON)** — download every saved score as a `.json` file.
- **Restore from backup…** — load a `.json` backup back in. This is how you move
  your scores to another browser or computer (your data is otherwise stored only
  in the browser you saved it in). Restoring **merges** — it adds/updates from
  the file without deleting what you already have.

> Markdown, CSV, and the PDF report reflect your current search/filter view;
> the JSON backup always includes everything.

### About priority tiers

RICE and ICE scores live on different scales, so tiers are worked out per
method:

- **ICE** (a 1–10 average): High ≥ 7, Medium ≥ 4, Low below 4.
- **RICE** (no natural ceiling): ranked relative to your own highest RICE score —
  the top third is High, the middle Medium, the bottom Low.

---

## What's in this folder

| File / folder         | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `manifest.json`       | The extension's "ID card" — its name, permissions, and which files to run. |
| `content/content.js`  | Runs on Jira/Linear pages; detects tickets and injects the widget.  |
| `content/widget.css`  | Styles specific to the floating button and panel.                   |
| `lib/scoring.js`      | The single "source of truth": each method's fields, math, tiers, ranks. |
| `lib/scoreForm.js`    | The reusable RICE/ICE form (used by both the widget and the popup's edit mode). |
| `lib/scoreForm.css`   | Shared styles for that form and the tier badges.                    |
| `lib/exporters.js`    | Pure functions that turn scores into CSV / Markdown / JSON text.    |
| `lib/storage.js`      | Shared helper for reading/writing saved scores.                     |
| `popup/`              | The toolbar window: ranked list, search/sort/filter, edit, export.  |
| `report/`             | The printable "Save as PDF" report page.                            |
| `README.md`           | This file.                                                          |

---

## How to try it out

You don't need to build or install anything — you just point the browser at
this folder. This is called "loading an unpacked extension."

### In Chrome (or Edge / Brave)

1. Open a new tab and go to: `chrome://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select this project folder (the one containing `manifest.json`).
5. You should see **Priority Scorer** appear in your list of extensions.

### In Firefox

1. Open a new tab and go to: `about:debugging`
2. Click **This Firefox** in the left sidebar.
3. Click **Load Temporary Add-on…**
4. Select the **`manifest.json`** file inside this project folder.
5. You should see **Priority Scorer** appear under "Temporary Extensions."

> In Firefox, temporary add-ons are removed when you close the browser — just
> load it again next time. This is normal for extensions you're still building.

### See it working

1. Open a ticket in Jira or Linear, for example:
   - Linear: a URL like `https://linear.app/your-team/issue/ENG-123/...`
   - Jira: a URL like `https://your-team.atlassian.net/browse/PROJ-456`
2. Look at the **bottom-right corner** — you should see a round purple **PS**
   button.
3. Click it. A panel opens. Pick **RICE** or **ICE**, fill in the numbers, and
   watch the **Score** update live.
4. Click **Save score**. Then click the extension's **toolbar icon** to see it
   in your ranked list. Click the ticket title to open it, or **×** to delete.
5. Click around to a different ticket without reloading — the panel follows you.

If you change any of the code, go back to the extensions page and click the
**reload/refresh** icon on the Priority Scorer card, then refresh the ticket
tab.

---

## Security & privacy

- **Nothing leaves your browser.** No servers, no accounts, no analytics, no
  network requests at all. Saved scores live only in your browser's local
  extension storage.
- **Least privilege.** The extension only asks for `storage` and `clipboardWrite`
  (for "Copy as Markdown"), and its content script runs only on
  `*.atlassian.net` and `linear.app` — nowhere else.
- **Manifest V3** with an explicit Content Security Policy: no remote code, no
  inline scripts, no `eval`.
- **Safe rendering.** Ticket titles and other text are always inserted as plain
  text (never as HTML), so a weird page title can't run code.
- **Backups are sanitized on import.** Because a backup file is data you could
  receive from someone else, restoring rebuilds each entry from known fields,
  validates them, and drops anything unexpected (for example, a non-`http(s)`
  link is stripped so it can never be clicked). Exported CSVs are also protected
  against spreadsheet "formula injection."
