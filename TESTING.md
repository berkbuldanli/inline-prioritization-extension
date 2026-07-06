# Priority Scorer — Manual QA Checklist

A plain-English checklist to confirm the extension works. No coding needed — just
follow each **Do**, check the **Expect**, and tick the box. If something doesn't
match, note the case number and what you saw (a screenshot helps).

> **Firefox note:** a temporary add-on is removed when you close the browser —
> just load it again next time. This is normal for extensions you're building.

---

## 0. Setup — load the extension

### Chrome (or Edge / Brave)

- [ ] **Do:** Go to `chrome://extensions` → turn on **Developer mode** →
      **Load unpacked** → pick the project folder (the one with `manifest.json`).
      **Expect:** "Priority Scorer" appears with no red errors.
- [ ] **Do:** Glance at the permissions. **Expect:** storage + clipboard (the
      clipboard one powers "Copy as Markdown"); access is limited to Jira/Linear.

### Firefox

- [ ] **Do:** Go to `about:debugging` → **This Firefox** → **Load Temporary
      Add-on…** → pick the **`manifest.json`** file. **Expect:** "Priority
      Scorer" appears under Temporary Extensions.

> After ANY code change: click **reload** on the extension card, then refresh the
> Jira/Linear tab.

### Suggested test numbers (so you can check the math by eye)

| Method | Inputs | Correct score | Tier |
| --- | --- | --- | --- |
| RICE | Reach **500**, Impact **Medium (1)**, Confidence **High (100%)**, Effort **2** | **250** | — |
| RICE | Reach **1200**, Impact **High (2)**, Confidence **100%**, Effort **3** | **800** | High* |
| ICE | Impact **9**, Confidence **7**, Ease **8** | **8** | High |
| ICE | Impact **3**, Confidence **3**, Ease **3** | **3** | Low |

\* RICE tiers are relative to your own highest RICE score, so "High" assumes this
is your top (or only) RICE item. ICE tiers are fixed: High ≥ 7, Medium ≥ 4,
Low < 4.

---

## 1. Ticket detection

- [ ] **1.1 Linear ticket** — Open a Linear issue (`linear.app/<team>/issue/ENG-123/…`).
      **Expect:** a round purple **PS** button at the bottom-right.
- [ ] **1.2 Jira ticket** — Open a Jira issue (`<company>.atlassian.net/browse/PROJ-123`).
      **Expect:** the **PS** button appears.
- [ ] **1.3 Jira board** — Open a board and click a card so the URL contains
      `selectedIssue=PROJ-123`. **Expect:** the **PS** button appears.
- [ ] **1.4 Non-ticket page** — Go to a Linear **Inbox**/**My Issues** list or a
      Jira **dashboard** (no single ticket open). **Expect:** **no** PS button.

## 2. Widget basics

- [ ] **2.1 Open** — Click **PS**. **Expect:** a panel opens with a purple
      "Priority Scorer" header.
- [ ] **2.2 Detected ticket** — **Expect:** under "SCORING TICKET" it shows the
      **correct ticket ID** and its title.
- [ ] **2.3 Close** — Click the **×** in the panel header, then PS again.
      **Expect:** it closes and reopens.

## 3. Single-page-app navigation (important)

Jira/Linear change tickets without a full page reload — the widget must keep up.

- [ ] **3.1 Switch tickets** — With the panel open on ticket A, click through to a
      **different** ticket B (no manual reload). **Expect:** the panel now shows
      **B's** ID/title.
- [ ] **3.2 Leave tickets** — Navigate to a list/board (no ticket open).
      **Expect:** the PS button disappears.
- [ ] **3.3 Return** — Open a ticket again. **Expect:** the PS button comes back.

## 4. RICE scoring

- [ ] **4.1 Correct math** — On the **RICE** tab: Reach **500**, Impact
      **Medium (1)**, Confidence **High (100%)**, Effort **2**. **Expect:**
      **Score = 250**, updating live as you type.
- [ ] **4.2 Tier badge** — **Expect:** a colored tier badge next to the score.
- [ ] **4.3 Missing fields** — Clear **Reach** (or **Effort**). **Expect:** Score
      shows **—**, a "Enter … to see the score" message, and the empty field turns
      **red** after you click out of it.
- [ ] **4.4 Divide-by-zero guard** — Set Effort to **0**. **Expect:** Score stays
      **—** (you can't save a broken score).

## 5. ICE scoring

- [ ] **5.1 Correct math** — On the **ICE** tab: Impact **9**, Confidence **7**,
      Ease **8**. **Expect:** **Score = 8**, tier **High**.
- [ ] **5.2 Low tier** — Enter **3 / 3 / 3**. **Expect:** **Score = 3**, tier
      **Low**.
- [ ] **5.3 Out of range** — Enter **11** in any box. **Expect:** Score **—** and
      the field is flagged.

## 6. Switching methods

- [ ] **6.1 Tabs swap forms** — Click **RICE** then **ICE**. **Expect:** the
      inputs change between the two methods.
- [ ] **6.2 Values remembered** — Type RICE numbers, switch to ICE, switch back.
      **Expect:** your RICE numbers are still there.

## 7. Saving & re-opening

- [ ] **7.1 Save** — Enter valid numbers → **Save score**. **Expect:** the button
      briefly says **Saved ✓** and a "Last saved: … on <date>" note appears.
- [ ] **7.2 Pre-fill on return** — Close the panel, go to another ticket, come
      back to this one, open the panel. **Expect:** it opens on the saved method
      with your saved numbers pre-filled.

## 8. Popup — the ranked list

Open the popup with the extension's **toolbar icon** (top-right of the browser).
Save a few tickets first (mix RICE and ICE) so there's data.

- [ ] **8.1 Ranked** — **Expect:** scores listed **highest first**.
- [ ] **8.2 Badges** — **Expect:** each row shows a score badge, a colored tier,
      and a rank like **"#2 of 5 RICE"**.
- [ ] **8.3 Per-method fairness** — With a high RICE score (e.g. 250) and an ICE
      score (e.g. 8) saved, **Expect:** the ICE item can still read **High** in
      its own method — tiers are judged within each method, not by raw number.
- [ ] **8.4 Open ticket** — Click a ticket title. **Expect:** it opens in a new
      browser tab.

## 9. Search / sort / filter

- [ ] **9.1 Search** — Type part of a title or an ID. **Expect:** the list narrows
      to matches as you type.
- [ ] **9.2 Sort by date** — Change **Sort** to "Date (newest first)".
      **Expect:** order changes to most-recently-saved first.
- [ ] **9.3 Filter method** — Change **Method** to **RICE** (then **ICE**).
      **Expect:** only that method's rows show.

## 10. Edit & delete in the popup

- [ ] **10.1 Edit opens** — Click the **✎** (pencil) on a row. **Expect:** an
      inline form appears with that ticket's saved numbers.
- [ ] **10.2 Live recalc** — Change a number. **Expect:** the editor's score
      updates live.
- [ ] **10.3 Save edit** — Click **Save**. **Expect:** the row updates to the new
      score and re-ranks if needed.
- [ ] **10.4 Cancel** — Edit again, click **Cancel**. **Expect:** no change.
- [ ] **10.5 Delete confirm** — Click **×** on a row. **Expect:** it changes to
      **"Sure?"**. Click again → the row is removed. (Wait a couple seconds
      without clicking → it reverts to × without deleting.)

## 11. Exports

Open the **Export ▾** menu (top-right of the popup).

- [ ] **11.1 Copy as Markdown** — Click it, then paste (Ctrl/Cmd-V) into a doc or
      Notion. **Expect:** a tidy ranked **table** in Markdown.
- [ ] **11.2 Markdown (.md)** — **Expect:** a `.md` file downloads.
- [ ] **11.3 CSV (.csv)** — **Expect:** a `.csv` downloads and opens as a table in
      Excel/Google Sheets.
- [ ] **11.4 Respects filter** — Filter to **ICE**, then export CSV/Markdown.
      **Expect:** only ICE rows are in the file.
- [ ] **11.5 Print / Save as PDF** — Click it. **Expect:** a new tab opens with a
      clean "Priority Scores" report (RICE and ICE sections) and the print dialog
      appears; choosing "Save as PDF" produces a PDF.

## 12. Backup & restore

- [ ] **12.1 Backup** — Export ▾ → **Backup all (JSON)**. **Expect:** a
      `priority-scorer-backup-<date>.json` downloads.
- [ ] **12.2 Restore merges** — Delete one score, then Export ▾ → **Restore from
      backup…** → pick the JSON you saved. **Expect:** the deleted score reappears
      and your other scores are untouched (a brief "…score(s) restored" message).
- [ ] **12.3 Move to another browser (optional)** — Load the extension in the
      other browser, use **Restore from backup…** with the same file.
      **Expect:** your scores appear there too.
- [ ] **12.4 Bad file rejected** — Try restoring a random non-backup file.
      **Expect:** a friendly "Import failed…" message, and nothing is lost.

## 13. Persistence & edge cases

- [ ] **13.1 Survives reload** — Save a score, close the popup and the ticket tab,
      reopen. **Expect:** the score is still in the popup. (On **Chrome** it also
      survives a browser restart; on **Firefox** temporary add-ons reset — that's
      expected.)
- [ ] **13.2 Empty state** — With nothing saved (or after deleting everything),
      open the popup. **Expect:** a friendly "No saved scores yet" message and the
      controls/Export are hidden.
- [ ] **13.3 Long title** — Score a ticket with a very long title. **Expect:** the
      title is trimmed with "…" and the layout doesn't break.

---

## Cross-browser matrix

Tick each once you've confirmed it in that browser.

| Flow | Chrome | Firefox |
| --- | :---: | :---: |
| Widget appears on a ticket (§1–2) | [ ] | [ ] |
| SPA navigation follows tickets (§3) | [ ] | [ ] |
| RICE & ICE math correct (§4–5) | [ ] | [ ] |
| Save & pre-fill (§7) | [ ] | [ ] |
| Popup list + search/sort/filter (§8–9) | [ ] | [ ] |
| Edit & delete (§10) | [ ] | [ ] |
| Copy as Markdown (§11.1) | [ ] | [ ] |
| CSV / Markdown / PDF (§11) | [ ] | [ ] |
| Backup & restore (§12) | [ ] | [ ] |

---

### Found a problem?

Note the **case number**, what you **did**, what you **expected**, and what you
**saw** (a screenshot helps a lot). Send that over and it'll be quick to fix.
