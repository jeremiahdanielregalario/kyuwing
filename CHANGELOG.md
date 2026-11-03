# Changelog

All notable changes to Kyuwing are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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

- Sidebar and mobile navigation highlight "Live board" on every game-day page and "Game days" only on the list page.
- "Live board" is disabled when no game day exists, instead of bouncing through a redirect to the game-days list.
- Player category dropdown no longer lists duplicate Active and Applicant options.
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
