# Codebook — Camp Wild Heart selective exposure study

There is **one row per participant**. The row is sent once, when the participant clicks **Finish** at the end of Part 2.
There are 94 columns: 13 participant/session columns + 2 parts × 4 conditions × 10 episode columns + `detail_json`.
The same list, one row per column, is in `codebook.csv`.

**Conventions**
- All time variables end in `_sec` and are in **seconds**, with 2 decimals (e.g. `12.34`).
- **Active time**: timers run only while the browser tab is visible. They pause if the participant switches tabs, minimizes the window, or locks the phone.
  `total_sec` is the only exception: it is wall-clock time.
- Timestamps are ISO 8601 in **UTC**, e.g. `2026-09-24T16:05:49.841Z`.
- `set1` = Part 1 (first four episodes). `set2` = Part 2 (second four episodes).

---

## 1. Participant and session

| Variable | Type | Values | Description |
|---|---|---|---|
| `pid` | text | e.g. `5f3a…` | Participant ID as **confirmed on the ID page**. This is the ID to use for matching and paying participants. In test mode it looks like `test-xxxxx`. |
| `url_id` | text | ID or blank | ID passed in the study link (checked in order: `PROLIFIC_PID`, `participantId`, `workerId`, `pid`). Blank if the link carried none. If it isn't blank and differs from `pid`, the participant edited the pre-filled ID. |
| `started_at` | timestamp (UTC) | | When the study page was first opened in that browser tab. |
| `finished_at` | timestamp (UTC) | | When the participant clicked **Finish**. |
| `total_sec` | decimal, sec | ≥ 0 | `finished_at` − `started_at`. Wall-clock time: it **includes** time spent in other tabs. |
| `user_agent` | text | | Browser and operating system string, useful for spotting device types or bots. |
| `viewport_w` | integer, px | | Width of the browser window at finish, in CSS pixels. |
| `viewport_h` | integer, px | | Height of the browser window at finish, in CSS pixels. |
| `touch_device` | binary | 1 = touch (phone/tablet), 0 = mouse | Whether the main input device can't hover. |
| `set1_sec` | decimal, sec | ≥ 0 | Active time in Part 1: all episode cards plus all Read More pages. Instructions are not included. |
| `set2_sec` | decimal, sec | ≥ 0 | Same as `set1_sec`, for Part 2. |
| `set1_instructions_sec` | decimal, sec | ≥ 0 | Active time on the Part 1 instructions page.\* |
| `set2_instructions_sec` | decimal, sec | ≥ 0 | Active time on the Part 2 instructions page.\* |

\* These two columns were added after your pasted header was generated, so older test downloads won't have them.

## 2. Episode variables (repeated 8 times)

Pattern: **`set{1|2}_{condition}_{measure}`**, where
- `set` = `set1` or `set2`
- `condition` = `growth`, `neutral`, `rejection`, `unwavering`

Each part shows exactly one episode per condition, so each set × condition pair maps to exactly one episode. Columns are always in the order growth, neutral, rejection, unwavering, whatever order the participant saw them in.

| Measure | Type | Values | Description |
|---|---|---|---|
| `_episode` | text | see §3 | Which of the condition's two episodes was shown in this part (e.g. `growth_2`). The other one appears in the other part. |
| `_position` | integer | 1–4 | Where this episode appeared in the part's random order (1 = shown first). |
| `_title_view_sec` | decimal, sec | ≥ 0 | **Title reading time.** Total active time this episode's card (title + one-sentence summary + Read More link) was on screen, summed over every visit to the card. Time on the Read More page and time the Share pop-up was open are **not** included. |
| `_title_views` | integer | ≥ 1 | Number of times the card was displayed. This goes up on the first view, when returning via **Previous**, and when coming back from Read More. 1 means one continuous viewing. |
| `_readmore_clicked` | binary | 1 = yes, 0 = no | Whether the participant opened Read More for this episode at least once. |
| `_readmore_clicks` | integer | ≥ 0 | Number of times Read More was opened for this episode. |
| `_readmore_sec` | decimal, sec | ≥ 0 | **Read More reading time.** Total active time on this episode's full-description page, summed over all visits. Time the Share pop-up was open is not included. 0 if never opened. |
| `_readmore_max_scroll_pct` | integer, % | 0–100 | The furthest point of the full description that was on screen, as a percent, taking the highest value across visits. 100 = the end of the text was reached. 0 = never opened. On large screens the whole text may fit without scrolling, which gives 100 straight away, so interpret this alongside `viewport_h`. |
| `_share_clicked` | binary | 1 = yes, 0 = no | Whether the participant clicked the **Share** button for this episode at least once, on the episode card or the Read More page. The button is a mock: it only opens a thank-you pop-up and nothing is actually shared. |
| `_share_clicks` | integer | ≥ 0 | Number of times Share was clicked for this episode (card + Read More page combined). Where each click happened is in `detail_json` (`share_open` events, `from`). |

## 3. Episode IDs

| `episode` value | Condition | Title |
|---|---|---|
| `growth_1` | Growth | Season 1, Ep 8: Growing into Allyship: How to Become an Ally to Your Trans Child |
| `growth_2` | Growth | Season 05 Ep 09: Be Open, Be Curious: A Trans Family's Growth Story |
| `neutral_1` | Neutral | Season 4, Ep 01: What Do We Do When Our Kids Won't Talk to Us? |
| `neutral_2` | Neutral | Season 02, Ep 06: The Power of Showing Up for Our Kids |
| `rejection_1` | Rejection | Season 05 Ep 06: Religious Trauma and Growing Up, Coming Out, and Moving Forward |
| `rejection_2` | Rejection | Season 04 Ep 11: Heartache of an Inauthentic Life: Not Living Your True Self because of Fear of Rejection |
| `unwavering_1` | Unwavering | Season 5, Ep 4: We've Got Your Back No Matter What: How Conservative Parents Became Fierce Allies |
| `unwavering_2` | Unwavering | Season 04 Ep 12: I'm With You Every Step of the Way: One Dad's Call to Action |

**How episodes are assigned**:
1. For each condition, one of its two episodes is randomly assigned to Part 1 and the other to Part 2. Each has a 50/50 chance.
2. Within each part, the four episodes are shown in random order, which is recorded in `_position`.

## 4. `detail_json` (raw log)

This is a JSON text column for audits and finer-grained analyses. Most analyses won't need it.

```
{
  "order":   { "set1": [episode ids in display order], "set2": [...] },
  "metrics": { "set1": { "<episode id>": {
                 "title_view_sec", "title_views", "readmore_clicks", "readmore_sec",
                 "readmore_visits": [ { "opened_at", "sec", "max_scroll_pct" }, ... ], "share_clicks" } }, "set2": {...} },
  "events":  [ { "t_sec", "type", "set", ...extra }, ... ]
}
```

- `metrics` values here are the same as the columns above (seconds).
- `readmore_visits` has one entry per time Read More was opened: when it opened (UTC), active time for that visit, and max scroll % for that visit.
- `events` is a timeline of what the participant did. `t_sec` = seconds since `started_at` (wall-clock). `set` = the stage when the event happened: `id`, `set1`, `set2`, or `done`.

| Event `type` | Extra fields | Logged when |
|---|---|---|
| `id_confirmed` | `id_matches_url` (true / false / null if no URL ID) | Participant clicks Start on the ID page |
| `view_instructions` | | Instructions page shown |
| `begin_set` | | Participant clicks Begin on the instructions page |
| `view_title` | `episode`, `condition`, `position` | An episode card is shown |
| `readmore_open` | `episode`, `condition` | Read More clicked |
| `readmore_close` | `episode`, `visit_sec` | Participant leaves the Read More page |
| `share_open` | `episode`, `condition`, `from` (`card` or `readmore`) | Share button clicked |
| `share_close` | `episode`, `from`, `popup_sec` (how long the pop-up was open) | Share pop-up closed |
| `continue` | | Leaves the last card of a part (Continue to Part 2 / Finish) |
| `finish` | | Study completed |
| `tab_hidden` / `tab_visible` | | Participant left / returned to the study tab |

## 5. Notes for analysis

- **Reshaping to long format.** For models with repeated measures, reshape to 8 rows per participant (2 parts × 4 conditions). Use `pid`, `set`, and `condition` as keys, with `episode`, `position`, `title_view_sec`, `readmore_clicked`, and `readmore_sec` as columns.
- **Selective exposure DVs.** The main ones are `_title_view_sec` (attention to the title), `_readmore_clicked` (choosing to read more), `_readmore_sec` (time reading the full description), and `_share_clicked` (intention to share).
  `_readmore_sec` is 0 whenever `_readmore_clicked` = 0, so consider a two-part (hurdle) model or analyze it among clickers only.
- **Controls.** Consider `position` (order effects), `episode` (stimulus item effects), and `touch_device`.
- **Data-quality checks.**
  - Very short `title_view_sec` on all cards may mean the participant clicked through quickly.
  - Many `tab_hidden` events, or a large gap between `total_sec` and the sum of active times, suggests the participant was multitasking.
  - A `url_id` that doesn't match `pid` needs checking.
  - Duplicate `pid`s mean the participant retook the study in a new tab.
