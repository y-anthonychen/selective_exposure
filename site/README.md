# Camp Wild Heart — selective exposure stimulus site

A static website (plain HTML/CSS/JS with no build step) that simulates the Camp Wild Heart podcast site.

## Flow
1. **ID page**: the participant confirms their Prolific or CloudResearch ID. It is pre-filled from the URL when available.
2. **Part 1**: 4 episodes, one from each condition (growth, neutral, rejection, unwavering), in random order and **shown one at a time**.
   Each episode has a **Read More** link that opens the full description, a mock **Share** button that shows a thank-you pop-up, and Previous / Next buttons.
3. **Part 2**: the other episode from each condition, in a new random order.
4. **Finish**: the data is sent, and the participant sees a thank-you page or is redirected back to Prolific or CloudResearch.

For each condition, which of its two episodes appears in Part 1 is also random. Episode text lives in `episodes.js`.

## What is recorded (one row per participant)
For each `set1`/`set2` × `growth`/`neutral`/`rejection`/`unwavering`:

| column | meaning |
|---|---|
| `setN_<cond>_episode` / `_position` | which episode was shown and at what position (1–4) |
| `_title_view_sec` | total time that episode's title card was on screen (**title reading time**) |
| `_title_views` | how many times they landed on that card (returning via Previous or from Read More counts again) |
| `_readmore_clicked` | 1 if they opened Read More at least once |
| `_readmore_clicks` | number of times Read More was opened |
| `_readmore_sec` | total time on the Read More page |
| `_readmore_max_scroll_pct` | how far down the full description they scrolled |
| `_share_clicked` / `_share_clicks` | whether / how often they clicked the mock **Share** button (card or Read More page) |

The record also includes `pid` (the confirmed ID), `url_id` (the ID from the URL, to catch typos), `set1_sec`/`set2_sec`, device info, and `detail_json`, a full timestamped event log.
All times are in seconds (2 decimals). Timers pause while the browser tab is hidden.

## Running it
- Local test: `cd site && python3 -m http.server 8000`, then open <http://localhost:8000/>.
  Add `?debug=1` for a live timer panel.
  While `TEST_MODE` is on, the end page has **Download data (CSV)** and **Start over** buttons.
- Hosting (GitHub Pages): `.github/workflows/pages.yml` publishes `site/` on every push to `main`.
  One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
  The site is then at `https://y-anthonychen.github.io/selective_exposure/`.
  Note: Pages on a **private** repo needs GitHub Pro (free for students and teachers via GitHub Education). The published site is public to anyone with the link.
  Any other static host works too (e.g. Netlify): upload the `site/` folder.
- Sharing with collaborators for testing: send `https://<site>/?debug=1`. Each tester gets a test ID and live timers, and can download their own CSV at the end.
  Keep `TEST_MODE: true` and `DATA_ENDPOINT: ""` while testing.

## Settings (`CONFIG` at the top of `app.js`)
| setting | now | before launch |
|---|---|---|
| `TEST_MODE` | `true` (test ID pre-filled, test buttons shown) | `false` |
| `DATA_ENDPOINT` | `""` (nothing sent) | your Google Apps Script URL |
| `REDIRECT_URL` | `""` (thank-you page) | Prolific completion URL, e.g. `https://app.prolific.com/submissions/complete?cc=XXXX` |
| `MIN_SECONDS_PER_EPISODE` | `0` | e.g. `5` so Next is disabled for the first 5 seconds on each episode |
| `SHARE_MESSAGE` | thank-you pop-up text | your wording |
| `INSTRUCTIONS` | placeholder text | your wording |

**Study URL to give Prolific:** `https://<your-site>/?PROLIFIC_PID={{%PROLIFIC_PID%}}`
**CloudResearch Connect:** `https://<your-site>/?participantId={{%participantId%}}`, or the equivalent placeholder shown in its study setup.

## Saving data to Google Sheets (downloadable as Excel)
1. Create a Google Sheet, then go to **Extensions → Apps Script** and paste:

```js
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const rec = JSON.parse(e.postData.contents);
    let headers = sheet.getLastRow() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    const missing = Object.keys(rec).filter(k => !headers.includes(k));
    if (missing.length) {
      headers = headers.concat(missing);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.appendRow(headers.map(h => rec[h] ?? ""));
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}
```
2. Choose **Deploy → New deployment → Web app**. Set Execute as "Me" and access to "Anyone".
3. Paste the web app URL into `CONFIG.DATA_ENDPOINT`.
4. To get Excel: **File → Download → Microsoft Excel (.xlsx)**.

Why not GitHub for data: a public web page can't write to a repo without exposing a secret access token in its code, and participant data would end up on GitHub.
