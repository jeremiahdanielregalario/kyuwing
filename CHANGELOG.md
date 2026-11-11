# Changelog

All notable changes to Kyuwing are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Check the courts when you start** — **Start game day** (on the board and in Settings) now opens a pop-up before the game day goes live. For each court block it asks how many courts were reserved (with − / + buttons) and what the venue calls them (`1, 2, 3` or a range like `5-8`), prefilled from the plan. Typing names sets the count, and a run of numbers grows or shrinks with the count. **Start** stays disabled until each court has one name. With several blocks, **Use these courts in every block** copies the first block's courts. The confirmed courts are saved to the plan, so the board, toasts and live view use them from the first game.
- **Public player roster** — a view-only roster at `/roster`, linked from the landing page (header, hero and footer) and from a **See the player roster** button at the end of the live view (with a **Back to the live queue** link). It shows the active roster with nickname, full name, level and player type, the bracket chart, playing recency with each player's attendance history, and tournament awards. Search, filters and sorting work. There is no editing, import or export, and no contacts, notes or archived players. The page is kept out of search engines.
- **Share reminder with a ready-to-paste message and QR code** — when a game day is live, the board pops up a reminder to post the live link in the Messenger group chat. **Share live view** opens the same window any time. It has a ready-made message (game day, date, venue and the link) with **Copy message** (and **Share…** on phones, which opens the share sheet with Messenger), the plain link with copy and open buttons, and a QR code with the Kyuwing icon in the middle, the game day's name and date under it, and **Download QR** to post in the chat or print for the venue. The reminder stops once you copy, share or download on that device, or press **I already shared it**; **Remind me later** brings it back the next time the board opens.
- **Install Kyuwing as an app** — Kyuwing can now be installed from the browser and opens in its own full-screen window with the Kyuwing icon, straight to the board. On Android, and in Chrome or Edge on a computer, tap **Install app** (the download icon in the phone header, the button in the sidebar, or on the sign-in page) and confirm. On iPhone and iPad the same button shows the Safari steps (**Share → Add to Home Screen**). The button hides once the app is installed. If the connection drops, the app shows a clear "You're offline" page with **Try again** instead of the browser's error. Nothing is stored offline: the board stays live and needs the internet.
- **Split screen on phones** — on a phone or small tablet the board now keeps the courts on top and the queue in a panel docked above the bottom navigation, so you can drag a name straight up onto a court without scrolling back and forth. Hold the dragged name just above the panel to scroll down to lower courts, or near the top of the screen to scroll up; letting go over the panel cancels the drag. The panel has the queue tabs, a search button and a chevron to shrink it out of the way. **Split screen** in the Courts header turns it off or back on (remembered on that device); it is off for completed game days and on larger screens the queue stays in its side column.
- **Game time first, then court blocks** — New game day and game day Settings now ask for the game time (Starts / Ends, e.g. 1:00–4:00 PM) before the court blocks. Blocks split that time back to back and can't start before the game or run past it: the first block starts with the game, the last ends with it, and only the times between blocks are picked. **Add block** splits the longest block in half (keeping its courts), removing a block gives its time to its neighbour, and shortening the game time trims or merges blocks that no longer fit. Times are picked in 30-minute steps in 12-hour format. The block editor was redone for phones, with labelled **Starts**, **Ends** and **Courts** fields on every block. The server now also refuses overlapping blocks.
- **Team podiums in tournament awards** — a podium can now list a whole team (up to 8, comma-separated, like `Champions: EJ, Jethro, Don, Eljo`) for team-format tournaments such as the League Cup, as well as doubles pairs and singles. A player's awards show "with" their partner for doubles and "Team with" every teammate for team podiums. League Cup 2026 is loaded.
- **Edit logged attendance lists** — each list under **Players → Logged lists** (and its **View** window) has an **Edit** button. It opens the list with its date, type, label and nicknames filled in, one per line; add, remove or move names between Played and Waitlist and save. The same list is updated, so recency scores and attendance history follow. A line that is exactly a nickname in the database is always kept, even if it looks like a header.
- **Tournament awards** — players with a tournament podium get a trophy as the first of their row icons in the player database, before attendance history (gold for a title, a silver medal for runner-up only, with a count when there are several). Tap it to see each podium: place, level, tournament, date and the doubles partner. **Players → Tournament awards → Add awards** takes the results pasted as text (a level line, then `Champions:` and `Runner-up:` lines), previews them, and refuses nicknames that are not in the database. Tournaments can be viewed, edited by re-pasting, or removed. High Tide 2026 is loaded.
- **Level X (not rated yet)** — a player whose official level is not known can be saved as **X**. X players are never auto-paired and their games cannot start; when any are on a game day, the queue board pops up **Set levels** to rate them (**Later** hides it until another X player arrives, and **Set levels (n)** in the action bar brings it back). The Players page counts them separately from the brackets.

- **Player attendance history** — a history icon on each player row opens every logged game day and tournament they played in or were waitlisted for, newest first.
- **Show archive button** — beside "UP BadAss roster" on the Players page, one tap switches the player database to archived players only, and **Hide archive** switches back.
- **View logged attendance lists** — each list under **Players → Logged lists** has a **View** button that opens who played and who was waitlisted (nickname and level), so you can check the history of past game days.
- **Set initial players on a court and let Pair fill the rest** — drop one to three players onto an empty court (or waiting court), then press **Fill the rest**: they stay on the side you put them (same team = partners, different teams = opponents) and the pairing engine fills the empty places. **Pair** now always fills the court you press it on.
- **Reorder the waiting line** — each waiting game has up/down arrows to move it earlier or later, and a waiting game can be dragged onto another to take its place. Games take free courts in the new order.
- **Undo check-in** — an undo arrow on a waiting player's row (and **Undo check-in** on their Sign-ups row) puts a mistaken check-in back to Expected. It is refused, with the reason, for someone on court, already done, who has played games (use Done instead), or who is lined up for a game.
- **Create a game day from the Messenger list** — paste the sign-up chat message (title, date, time, `QM:`/`FIN:` lines and the numbered names) into **New game day** and the venue, date, type, times, queue master, finance member and every player are filled in. All names must be official nicknames: full names and `@` mentions get a one-tap fix, typos get suggestions, duplicates can be removed, and creating is blocked until the whole list is clean (checked again on the server). **Paste Messenger list** on the Sign-ups page adds players who joined the chat later, without removing or duplicating anyone.
- **Plan ahead with the waiting courts** — a waiting game no longer needs four idle players. It can include players still on court, or already in an earlier waiting game, when they are expected to be done by the time it starts (about 15 minutes a game): with 6 players and 4 on court, queue the next game with the 2 waiting plus 2 of those finishing. Add as many waiting games as you like, beyond the reserved courts. Each shows who it is waiting on and when it should start. Nobody can be on two playing courts at once: pressing Start while a player is still on another court explains who and when, and offers **Re-pair this game**. Freed courts take the first planned game whose players are all free.
- **Playing time per player** — the Reports page's **Player leaderboard** ranks players by games and shows each one's total time on court (from the start to the finish of every game they played, free games included) with the average per game. It is on screen only and is not included in the PDF or Excel downloads.
- **Leave requests from the live link** — a player on the shared link can type their official nickname under **Leaving already?** and the queue master is notified within seconds: a pop-up plus a **Leaving the game day** banner with **Confirm** and **Keep in queue**. Confirming marks them done and removes any suggested game they were lined up for. Duplicate requests are folded together and a declined player waits five minutes before asking again.
- **Download QR** on the Pay online card, so the GCash QR can be saved and scanned from a phone's gallery.
- **Regenerate pairings** — if the auto-generated pairings aren't to the queue master's liking, **Regenerate** (header) redoes every suggested court and the shuffle button on a game redoes just that one, including games in Next up. Press as often as needed: rejected lineups never come back, and nothing is replaced unless a new arrangement exists.
- **Grips and other charges per player** — Record a player's grips (₱20 each) and any other amount with a reason; both feed their total, balance, the live payment list, and the reports.
- **Change and Settled in the Fees ledger** — a **Change** column shows what to give back when a player overpays, and a **Settled** checkbox marks paid-and-change-given. The flat fee column is gone from the ledger; reports gain Extras, Change, and Settled.
- **Split-cost fees for any venue** — enter a game day's **court rate per hour** (per court) and the court cost (rate × hours × courts across the blocks) is divided among the players who check in, rounded up, as everyone's flat fee. Shuttles are per game: Active ₱20, Alumni/Inactive/Applicant ₱25, Non-affiliate ₱30. Set in the new game day form or Settings; the Fees tab shows the breakdown. Blank keeps the venue's fee rates.
- **Payment list on the live view** — when a game day is completed, the shared live link adds a **Payment list**: each player's games, total, and balance (nickname only, with your own row highlighted), above the Pay online QR. Nothing about fees is public while the game day is still running.
- **Pay online card** — game-day GCash details (account name, number, QR, one-tap Copy number) shown on the players' live view and at the top of the Fees tab, so players can pay fast. Details live in `lib/payment.ts`; the QR is `public/brand/gcash-qr.jpg`.
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

- **Tidier player database on phones** — each player row shows only the trophy (when they have awards) and a ⋯ button that opens Attendance history, Edit, Archive and Delete in a sheet. The header no longer wraps. Tablet and desktop are unchanged.
- **Tournament awards list fits phones** — each tournament shows its full name with the date, levels and teams below it, and View, Edit and Remove stay on one line.
- **Simpler login page** — the note about the PIN and deployment settings is gone from the queue master sign-in.
- **Tap to move on phones** — dragging players and courts was hard on a phone, so every drag now also works with two taps. Tap a player or a court's grip handle, then tap one of the highlighted places to put it there; a bar at the bottom shows what you're moving, with Cancel. Drag and drop still works. Court player boxes and grip handles are bigger, and the board now scrolls when you swipe over a court.
- **Start reminders on the board** — a paired game on a court shows a gold "Not started yet" note pointing at its Start button. A pop-up asks you to start it when a game ends and the next game in line moves onto the court, and when a paired game is left unstarted for 2 minutes, with Start and Not yet buttons.
- **Name required to sign in** — the queue master login now needs your name as well as the PIN, so the board always shows who is running the queue.
- **Smoother, more responsive feel across the app (makeover, part 1).** Buttons and tabs sink slightly under a finger. Windows slide up as bottom sheets on phones, with a grab handle you can swipe down to close, and scale in as centred dialogs on tablets and desktops; both animate out when closed. The phone header and bottom bar are frosted glass, and a gold pill glides to the active tab. Pages ease in on navigation and show a loading outline instead of a blank screen. Everything respects the device's "reduce motion" setting.
- **Live board feels alive (makeover, part 2).** Auto-pair, Check in and Walk-in stay pinned under the header while you scroll. On tablets in landscape the queue sits beside the courts, and courts fill two or three columns as space allows. A game popping onto a court, a new player in the queue, and changing counts animate in; LIVE dots and court timers ripple. Phones give a short buzz when a game starts, ends or is dropped somewhere, and a different one when something is refused.
- **Sign-ups, Players, Fees and Game days on phones (makeover, part 3).** The Fees ledger and the player database turn into one card per player on phones instead of a table you scroll sideways: tap a fee card to record a payment, with the Settled tick beside it, and each player card has history, edit, archive and delete within thumb reach. The Sign-ups filters and search stay pinned while you scroll the list. Buttons across these pages are bigger to tap, the game-day tabs scroll the open tab into view with an underline that draws in, and game day cards arrive one after another.
- **Contact column removed from the player table.** The contact field is still stored and editable in the player form, and search still matches it.
- Fixed dragging a court card onto a player's box: while dragging, only valid targets are offered, so a court no longer highlights or looks like it snaps into a box meant for players. Courts go onto courts or waiting games; players go onto player boxes and empty slots.
- **Sign-ups rows: settings behind a gear** — each player's row stays compact, with Check in, Undo check-in, Done for the day and Remove on it. A gear icon beside them opens that player's permanent partner (saves as soon as you pick) and pairing requests (with remove) right under the row, no dialog. A small dot on the gear and tags on the row show when a partner or request is set. The Details dialog and separate Pair button are gone.
- The Game days page no longer shows **New game day** twice when it is empty; the header button is the only one.
- Fixed the TOTAL row of the PDF and Excel fee tables, which was shifted under the wrong columns.
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

- **Board buttons on phones** — the board's action bar no longer squeezes **Auto-pair** / **Queue next game**, **Check in** and **Walk-in** into three narrow columns where the labels wrapped out of the buttons. On a phone the main action gets its own full-width row, with Check in and Walk-in side by side under it. Button labels never wrap anymore anywhere in the app, and the Courts header buttons (Start all, Regenerate, Add court) wrap to a new line instead of overflowing.
- **Dragging on the board** — the dragged player or court chip now sits right under the mouse pointer (it used to appear far away from it) and follows the finger on phones and tablets, floating just above it so the finger doesn't hide it. The drop goes to the slot under the pointer or finger. On phones the queue no longer has its own scroll box, so holding a dragged player near the top of the screen scrolls the page up to the courts. Long-pressing a player no longer opens the iOS callout menu.
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
