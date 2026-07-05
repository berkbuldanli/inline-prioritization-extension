# Priority Scorer

A browser extension that helps product managers score and prioritize **Jira**
and **Linear** tickets using the **RICE** and **ICE** frameworks. Everything is
stored locally in your browser — no accounts, no servers, no external APIs.

Works on **Chrome** and **Firefox** (built with the WebExtensions API,
Manifest V3).

> **Status:** Early version. Right now the extension detects when you're on a
> Jira/Linear ticket page and shows a floating **PS** button that opens a small
> panel. The RICE/ICE scoring math and the saved-scores list are being added
> next.

---

## What's in this folder

| File / folder         | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `manifest.json`       | The extension's "ID card" — its name, permissions, and which files to run. |
| `content/content.js`  | Runs on Jira/Linear pages; detects tickets and injects the widget.  |
| `content/widget.css`  | Styles for the floating button and panel.                           |
| `popup/`              | The little window that opens when you click the toolbar icon.       |
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
3. Click it. A panel opens showing the ticket ID it detected.
4. Click around to a different ticket without reloading — the panel should
   update to the new ticket.

If you change any of the code, go back to the extensions page and click the
**reload/refresh** icon on the Priority Scorer card, then refresh the ticket
tab.

---

## Privacy

This extension does not send any data anywhere. Scores you save are kept in
your browser's local extension storage only.
