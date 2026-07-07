# Privacy Policy — Priority Scorer

_Last updated: 2026-07-07_

Priority Scorer is a browser extension that helps you score and prioritize Jira
and Linear tickets using the RICE and ICE frameworks.

## The short version

**Priority Scorer does not collect, transmit, sell, or share any of your data.**
Everything you enter stays on your own device.

## What data the extension handles

The only data involved is what you choose to create:

- The scores you save (the RICE/ICE numbers, the resulting score, the method,
  and the date).
- The ticket identifier, title, and URL of the page you scored, so your saved
  scores can be listed and linked.

## Where that data is stored

All of it is stored **locally in your browser**, using the browser's built-in
extension storage (`storage.local`). It never leaves your machine.

## What the extension does NOT do

- It does **not** send data to any server — the extension makes no network
  requests at all.
- It does **not** use analytics, tracking, advertising, or cookies.
- It does **not** require an account or a login.
- It does **not** read or modify your Jira/Linear tickets; it only reads the
  ticket's ID and title from the page to label your saved scores.

## Permissions and why they are used

- **Storage** — to save your scores locally.
- **Clipboard (write)** — only when you click "Copy as Markdown", to place that
  text on your clipboard.
- **Access to `*.atlassian.net` and `linear.app`** — so the scoring widget can
  appear on Jira and Linear ticket pages. The extension runs on no other sites.

## Exports and backups

When you export (CSV, Markdown, JSON) or print a PDF, the resulting file is
created by your browser and saved wherever you choose. Those files are yours; the
extension does not upload them anywhere.

## Data deletion

You are always in control: delete individual scores from the popup, or remove all
data by uninstalling the extension or clearing the browser's extension storage.

## Changes to this policy

If this policy changes, the updated version will be published in the project
repository with a new "Last updated" date.

## Contact

Questions? Open an issue at
<https://github.com/berkbuldanli/inline-prioritization-extension>.
