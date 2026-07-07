# Store Submission Checklist — Priority Scorer

Everything you need to publish Priority Scorer to the **Chrome Web Store** and
**Firefox Add-ons (AMO)**. The repo side is done; this walks you through the
account/upload side, with all the listing text pre-written so you can copy-paste.

---

## ✅ Already done in the repo (you don't need to touch these)

- Manifest V3, valid for both stores; version **1.0.0**.
- Icons at 16/32/48/128 px (`icons/`).
- Passes Firefox's official validator (`web-ext lint`) with **0 errors, 0
  warnings**.
- Privacy policy (`PRIVACY.md`) and MIT `LICENSE`.
- Security-hardened; 97 automated tests passing.
- Store images generated in **`store-assets/`**:
  - `store-icon-128.png` — the listing icon.
  - `shot-1-widget.png … shot-4-report.png` — 1280×800 screenshots.
  - `promo-tile-440x280.png` — Chrome "small promo tile" (optional).

---

## 1. Build the upload file

From the project folder, run:

```bash
bash scripts/package.sh
```

This creates **`priority-scorer-1.0.0.zip`** containing only the files the
extension needs. You upload this **same zip** to both stores.

> Ship an update later? Bump `"version"` in `manifest.json` (e.g. `1.0.1`),
> re-run the script, and upload the new zip. Stores reject a re-upload of the
> same version number.

---

## 2. Accounts & fees (one-time)

- **Chrome Web Store:** register a developer account at
  <https://chrome.google.com/webstore/devconsole> — there's a **one-time US $5**
  registration fee. Turn on 2-factor auth.
- **Firefox AMO:** create a free account at
  <https://addons.mozilla.org/developers/> — no fee. Turn on 2-factor auth.

---

## 3. Host the privacy policy (needed for the listing)

Chrome asks for a **Privacy Policy URL**. The simplest option: once your repo is
public, link directly to the file, e.g.
`https://github.com/berkbuldanli/inline-prioritization-extension/blob/main/PRIVACY.md`
(swap `main` for your default branch). For a cleaner URL you can enable **GitHub
Pages** on the repo and link the published `PRIVACY` page instead.

---

## 4. Listing copy (copy-paste ready)

**Name:** `Priority Scorer`

**Short description / summary** (≤132 chars):
```
Score and rank your Jira and Linear tickets with the RICE and ICE frameworks — fast, private, and entirely in your browser.
```

**Category:** Productivity (Chrome: "Workflow & Planning"). **Language:** English.

**Detailed description:**
```
Priority Scorer helps product managers decide what to build next. Open any Jira
or Linear ticket and a lightweight panel lets you score it two proven ways:

• RICE — Reach × Impact × Confidence ÷ Effort
• ICE — the average of Impact, Confidence, and Ease

The score updates live as you type, with a colour-coded priority tier (High /
Medium / Low). Save it and every scored ticket shows up in a ranked list in the
toolbar popup — highest priority first — where you can search, sort, filter,
edit, and delete.

Share your priorities in whatever format you need:
• Copy a ranked table as Markdown (paste into Notion, Confluence, Docs, GitHub)
• Download CSV (opens in Excel / Google Sheets)
• Print or Save as PDF for stakeholders
• Back up and restore everything as a JSON file

Private by design: there are no accounts, no servers, and no tracking. Every
score is stored locally in your browser and never leaves your device.

Works with Jira and Linear. Not affiliated with, or endorsed by, Atlassian or
Linear.
```

**Trademark note:** the listing may say the extension *works with* Jira and
Linear, but do **not** use their logos or imply endorsement. The disclaimer above
covers this — keep it in the description.

---

## 5. Chrome Web Store — step by step

1. Developer Dashboard → **Add new item** → upload `priority-scorer-1.0.0.zip`.
2. **Store listing:** paste the name, short + detailed description; set category
   and language; upload `store-assets/store-icon-128.png` and the
   `shot-1…4` screenshots (optionally `promo-tile-440x280.png`).
3. **Privacy practices tab:**
   - **Single purpose:** *"Score and prioritize Jira and Linear tickets using the
     RICE and ICE frameworks, storing the results locally in the browser."*
   - **Permission justifications:**
     - `storage` — *"Save the user's scores locally so they persist between
       sessions. No data leaves the device."*
     - `clipboardWrite` — *"Only used when the user clicks 'Copy as Markdown', to
       place the exported table on their clipboard."*
     - Host access to `*.atlassian.net` and `linear.app` — *"The content script
       shows the scoring widget on Jira and Linear ticket pages and reads only
       the ticket's ID and title to label saved scores. It does not modify the
       page or read other content, and runs on no other sites."*
   - **Data usage:** certify that the extension does **not** collect or use user
     data, is **not** sold, and is **not** used for unrelated purposes (all true).
   - Add the **Privacy Policy URL** from step 3.
4. **Submit for review.** Review typically takes a few hours to a few days.

---

## 6. Firefox AMO — step by step

1. <https://addons.mozilla.org/developers/> → **Submit a New Add-on** → **On this
   site** (listed) → upload the **same** `priority-scorer-1.0.0.zip`.
2. The validator runs automatically (we already pass it cleanly). Choose to list
   it publicly.
3. Fill the listing: name, summary, detailed description (reuse the copy above),
   categories, screenshots from `store-assets/`, and select the **MIT** license.
   Add the privacy policy text or URL.
4. **Submit.** AMO runs automated checks plus occasional human review, then signs
   the add-on. Because all our code is plain, unminified JavaScript, no separate
   source upload is required.

---

## 7. Why this should pass review (pre-empted rejection reasons)

- **Minimal, justified permissions** — only `storage` + `clipboardWrite`, and
  host access limited to Jira/Linear.
- **Clear single purpose** — one focused job.
- **Privacy** — no data collection, no network requests, policy provided.
- **No remote code** — everything is bundled; explicit CSP; MV3.
- **No trademark misuse** — nominative "works with" wording, no third-party logos.

---

## 8. After it's live

- Add the store links to `README.md`.
- To update: bump `version`, `bash scripts/package.sh`, re-upload to both stores.
- Watch for reviewer emails and reply promptly if they ask for clarification.
