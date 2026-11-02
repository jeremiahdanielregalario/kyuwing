# Changelog

All notable changes to Kyuwing are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Game days** — draft/live/completed lifecycle, venue and date selection, game-day types (Regular, Tipid, MEGA), 35-point default target, editable court blocks per time slot.
- **Sign-ups** — add players individually, add every active player at once, CSV/JSON roster import, walk-ins with instant check-in, and per-player notes.
- **Live queue board** — Expected / Waiting / Playing / Done lanes, live wait timers, longest-wait and average-wait stats, court cards for every block, and SWR polling for multi-device use.
- **Pairing engine** — weighted foursome selection and team splitting with bracket rules, repeat-partner/opponent/foursome penalties, wait-time and games-played fairness, priority, and cross-bracket scarcity mode.
- **Requests** — partner-with, play-against, and permanent partners, with soft-rule handling and visible request badges.
- **Manual control** — swap players on a suggested match, move a match to another court, clear suggestions, start all, cancel, and finish with a score.
- **Players** — 19-level ladder (`E-` through `A+`), nickname and full name, category (active/alumni/applicant), active flag, search, level filters, and CSV/JSON export.
- **Fees** — venue × game-day-type × category rules, automatic flat + per-game calculation, per-player ledger, cash/GCash/bank/other payment recording, and mark-all-paid.
- **Reports** — session summary and per-player breakdown; Excel workbook with Summary, Players, Matches, and Fees sheets; print-ready PDF with the same data.
- **Operations** — in-app queue-master playbook with the game-day loop, pairing rules, checklists, and FAQs.
- **Auth** — single queue-master PIN with a signed, HTTP-only JWT cookie (14-hour session).
- **Docs** — README, architecture, pairing, fees, operations, and deployment guides; MIT license; CI workflow.

### Changed

- Negative peso amounts now format as `-₱250` instead of `₱-250`.
- PDF exports use `PHP 250` instead of `₱250` because standard PDF fonts lack the peso glyph.

### Fixed

- Board query now loads pairing requests, which the queue UI reads.
- Button variants and sizes are actually applied instead of being computed and discarded.
- Modal avoids a hydration mismatch by mounting its portal after hydration.
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
