# Changelog

All notable changes to Kyuwing are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **End of reservation** — when the reserved time runs out, the board asks whether to **extend** (until when, with how many courts) or **end the game day**, counting games still on court and going straight to Fees. It can be snoozed for 10 minutes.
- **Restore an ended game** — ending a game shows an **Undo** for about ten seconds, and **Recently finished** has a **Restore** button. The game goes back on court as live with its timer, game counts drop back, and a waiting game moved onto that court returns to the front of the line. Refused with a reason if the court or any of the players has moved on.
- **Court numbers up front** — when creating a game day, enter the venue's court numbers per block (`5, 6, 7, 8` or `5-8`); the court count follows. Leave blank to number courts 1, 2, 3…
- **Rename courts from the board** — tap a court's name to rename it, in one block or every block. "Court 6", "C6", and "6" all mean Court 6, and duplicate names in a block are refused.
- **Remove court** — remove an unavailable court (e.g. a failed reservation) from the board with the **−** button on its card. Its suggested game moves to the waiting courts, the other courts keep their names, and courts with a game in progress can't be removed until it ends.
- **Waiting courts** — set games ahead of time on court-style cards below the courts: drop four players in or press Pair, even while courts are open. Waiting games run in order and take the next court that frees up; edit, remove, or drag them onto a free court. Waiting courts are yellow, like Queue Maestro's, so they stand apart from the green courts.
- **Shareable live view** — **Share live view** on the board gives a view-only link for the group chat. Players see the courts, the Next up line, and the waiting order, updating every few seconds, and can type their nickname to see if they're next. No login; nicknames and levels only.
- **Non-affiliate player type** — for plus-ones from outside the association, with its own fee rules (a higher ₱30 per-game rate in production). Available in the roster, sign-ups, walk-ins, imports (`non-affiliate`, `plus one`, or `guest`), and the fee matrix.
- **Add court** — add a court to the current block from the live board, mid-session. A game waiting in Next up moves straight onto it.
- **Free games** — starting a game within 15 minutes of the reservation's end asks whether it is a free game (used shuttle). Free games are tagged on the board, reports, and exports, and do not count toward games played or fees.
- **Next up queue** — auto-pair works even when every court is busy. Each tap of **Queue next game** adds a balanced game to a Next up line; when a court frees up, the first game in line moves onto it, ready to start. Queued games can be edited, removed, or dragged onto an open court.
- **Playing recency** — log game-day and tournament lists pasted from the group chat (played and waitlist) on the Players page. Each player gets a recency score and a band (Playing often, Playing, Tournament only, Cooling off, Dormant, No history), shown as a sortable column in the player database.
- **Developer UI customization** — a separate `ADMIN_PIN` unlocks a developer sign-in at `/login?mode=admin`. "Customize UI" turns on trim mode: click any highlighted optional text or panel to hide it for everyone, on every device. Hidden pieces are stored globally and can be restored individually or all at once.
- **UP BadAss identity** — the app now uses the association's black, gold, and paper-white palette, the official wordmark, the 2015/Diliman story, the mission and vision, and the three core values (Competency, Commitment, Camaraderie) on the landing page and login screen.
- **Drag and drop courts** — drag a match card onto another court to swap them, drag a player chip onto another slot to swap players, and drop four waiting players onto an open court to build a match by hand.
- **Court-surface cards** — every court card is drawn on a top-down badminton court with singles/doubles lines and a gold net, matching the Queue Maestro card layout.
- **Game days** — draft/live/completed lifecycle, venue and date selection, game-day types (Regular, Tipid, MEGA), editable court blocks per time slot.
- **Sign-ups** — add players individually, add every active player at once, CSV/JSON roster import, walk-ins with instant check-in, and per-player notes.
- **Live queue board** — Expected / Waiting / Playing / Done lanes, live wait timers, longest-wait and average-wait stats, court cards for every block, and SWR polling for multi-device use.
- **Pairing engine** — weighted foursome selection and team splitting with bracket rules, repeat-partner/opponent/foursome penalties, wait-time and games-played fairness, priority, and cross-bracket scarcity mode.
- **Requests** — partner-with, play-against, and permanent partners, with soft-rule handling and visible request badges.
- **Manual control** — swap players on a suggested match, move a match to another court, clear suggestions, start all, cancel, and finish with a game.
- **Players** — 19-level ladder (`E-` through `A+`), nickname and full name, category (active/alumni/applicant), active flag, search, level filters, and CSV/JSON export.
- **Fees** — venue × game-day-type × category rules, automatic flat + per-game calculation, per-player ledger, cash/GCash/bank/other payment recording, and mark-all-paid.
- **Reports** — session summary and per-player breakdown; Excel workbook with Summary, Players, Matches, and Fees sheets; print-ready PDF with the same data.
- **Operations** — in-app queue-master playbook with the game-day loop, pairing rules, checklists, and FAQs.
- **Auth** — queue-master PIN with a signed, HTTP-only JWT cookie (14-hour session), plus an optional developer PIN for UI customization.
- **Docs** — README, architecture, pairing, fees, operations, and deployment guides; MIT license; CI workflow.

### Changed

- The login screen's side quote now reads the UP BadAss 3C's: Competency. Commitment. Camaraderie.
- The queue master sign-in name field starts empty with "EJ Mallilin" as placeholder text instead of a pre-filled "Queue Master". Leaving it blank still signs in as Queue Master.
- Tagline is now the UP BadAss motto, **Bold. Agile. Daring.**, on the landing page, the login screen, and in the site description.
- **Session reports** (PDF and Excel) use the UP BadAss black and gold, carry the UP BadAss wordmark, and name the game day's **queue master** and **finance member**, which are asked for when a game day is set up and editable in Settings. Reports no longer include the app credit line. PDF tables span the full page width.
- **Draggable queue names** — in The queue, each waiting player's name box is the drag handle, outlined so it looks draggable. On tablets, press and hold to pick a player up, so a quick swipe still scrolls the list.
- **Player database sorting** — sort the roster by name, level, type, contact, or status by clicking a column header or using the sort control; click again to flip the direction.
- **Player search** — search now also matches notes, and a Clear button resets all filters at once.
- **Player categories** — "Inactive" and "Alumni" are now separate player types (Active, Inactive, Alumni, Applicant) in the roster, sign-ups, board, and fee rules.
- **Level pickers** — level dropdowns show only the level (`C+`) instead of appending the bracket name (`C+ · Intermediate`).
- **Bracket spread** — the players page chart is now a bar chart with the count above each bracket and a baseline, colour-coded per bracket (E grey, D blue, C green, B amber, A rose) to match the level badges.
- Negative peso amounts now format as `-₱250` instead of `₱-250`.
- PDF exports use `PHP 250` instead of `₱250` because standard PDF fonts lack the peso glyph.

### Removed

- **Score tracking** — matches no longer record scores and there is no target score setting. Finishing a game is one tap; reports and exports list match history by court and time instead of final scores.

### Fixed

- Excel and PDF reports show levels as `C+`, `A-`, … instead of internal codes like `C_PLUS`.
- Confirmation dialogs without extra details no longer show an empty strip between the message and the buttons.
- Board messages name courts by their labels ("Court 5 is live") instead of their position ("Court 1").
- Adding a Non-affiliate player from sign-ups or walk-ins no longer fails with "Pick a valid player type."
- Sidebar and mobile navigation highlight "Live board" on every game-day page and "Game days" only on the list page.
- "Live board" is disabled when no game day exists, instead of bouncing through a redirect to the game-days list.
- Player category dropdowns (players, sign-ups, and walk-ins) no longer list duplicate Active and Applicant options.
- Board query now loads pairing requests, which the queue UI reads.
- Button variants and sizes are actually applied instead of being computed and discarded.
- Modal avoids a hydration mismatch by mounting its portal after hydration.
- Live board avoids a hydration mismatch: the tick clock starts at zero on the server and dnd-kit's drag aria attributes attach after hydration.
- Venue fee editor switches records without an effect-driven state reset.
- Sign-up details derive wait time from a captured timestamp rather than `Date.now()` during render.

### Security

- Queue-master PIN comparison is constant-time.
- The session cookie is HTTP-only, `SameSite=Lax`, and `Secure` in production.
- All board, mutation, and export routes require a queue-master session.

### Known limitations

- Fee values shipped in the seed are placeholders and must be replaced with approved rates.
- One shared queue-master login; there are no individual accounts or audit trail per operator.
- No offline mode; the board needs a network connection.
- Reports are generated synchronously per request.

## [0.1.0] — 2026-11-02

Initial build: schema, pairing engine, live board, sign-ups, fees, players, venues, reports, and the queue-master playbook.

[Unreleased]: https://github.com/jeremiahdanielregalario/kyuwing/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jeremiahdanielregalario/kyuwing/releases/tag/v0.1.0
