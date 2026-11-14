# Operations

For the person holding the tablet. This is the day-of runbook; the in-app **Playbook** (`/app/guide`) is the same material with fewer words.

## Before the session

- [ ] Charge the tablet or phone. A power bank is not optional for a four-hour session.
- [ ] Starting from the Messenger sign-up list? Open **New game day**, expand **Start from the Messenger list**, and paste the chat message as it is. The app reads the title (type and venue), date, time, the **QM:** and **FIN:** lines, and every numbered name, and fills in the form. If the list has two **QM:** lines (or two **FIN:** lines), both are kept, e.g. "Roniel & Jgops", and the reports say **Queue masters**. Every name has to be the player's **official nickname** from the Players database, or one of the other names saved under **Also goes by** on their player (e.g. "LA" for Ian LA, "Chris" for XB); those are read as the nickname without any fixing, and the box lists them as "Read as nicknames: LA → Ian LA". Anything else is flagged with a fix: full names and `@` mentions (e.g. `@Shawn Elizarde`) get a **Use "Shawn"** button (or **Use nicknames for all**), a nickname you mistyped gets close suggestions, a name listed twice gets **Remove line**, and a name that is not in the database has to be added in **Players** first. **Create game day** stays disabled until every name is an official nickname. Names under a **Waitlist** heading are skipped. Players are added as **expected**; check them in as they arrive. The list keeps changing before the day, so on the game day's **Sign-ups** page press **Paste Messenger list** to add whoever is new (nobody is removed or added twice).
- [ ] Know who is queue master and who is the finance member for the day; enter both when you create the game day (they appear on the session report and can be changed in **Settings**).
- [ ] Confirm the venue booking and the exact court numbers, and enter them in each block's **Court numbers** when you create the game day (`5, 6, 7, 8` or `5-8`). The board, toasts, and the players' live view then use those numbers.
- [ ] Open Kyuwing and log in with the queue-master PIN.
- [ ] Create the game day: venue, date, **Regular / Tipid / MEGA**, court blocks. Choosing MEGA adds one court hour by default (the last block grows); adjust the times if needed.
- [ ] Set the **Game time** first (when the booking starts and ends, e.g. 1:00–4:00 PM), then split it into court blocks to match the booking. Example: 3 courts 9:00–10:00 AM, 4 courts 10:00 AM–12:00 PM, 3 courts 12:00–2:00 PM. Blocks run back to back inside the game time: the first starts when the game starts, the last ends when it ends, and you only pick the times between blocks. **Add block** splits the longest block in half; removing a block gives its time to its neighbour. Shortening the game time trims or merges blocks that no longer fit.
- [ ] Check the court rate on each game day (DASC ₱300, KBC ₱250 per court per hour by default) if the venue changed its price.
- [ ] Playing at a venue with no saved fees? Enter its **Court rate per hour** when you create the game day and the court cost is split among the players (see `docs/FEES.md`).
- [ ] Build the sign-up list, or tap **Add all active players** and remove no-shows later.

## Starting the day

1. Open the game day and press **Start game day** to move it from Draft to Live. If the board is open when the clock reaches the first court time and the day is still a draft, the same pop-up opens by itself (once per device). It shows every detail to review: name, date, game time, venue, type, court rent, queue master and finance member, and the players (checked in and not here yet, with a warning for anyone without a level). If something is wrong, press **Edit details** (opens Settings) or **Edit sign-ups** (opens Sign-ups); back on the board, the review opens again. Then check the courts: for each block, the number of courts the venue actually gave you (− / +) and their names (`1, 2, 3` or `5-8`, the numbers painted on the courts). Fix anything that changed since you made the game day, then press **Everything's right, start**. With several blocks, **Use these courts in every block** copies the first one. The board, the toasts and the players' live view use these court names.
2. Check in only the players who are physically present. Start with the first four to eight.
4. When a court is free, press **Auto-pair**. Don't like what it suggests? Press **Regenerate** for different pairings on every suggested court, or **Re-pair** on one game to redo just that one. Press again as often as you like: each press avoids everything you already rejected for that game, so you never see the same lineup twice. Nothing changes until a new arrangement exists. When there is no other fair option, the board says so; edit the game by hand then.
5. Share the live view in the group chat. Once the game day is live the board reminds you with a pop-up (or press **Share live view**): tap **Copy message** and paste it in the Messenger group chat (on a phone, **Share…** opens the share sheet straight to Messenger), or **Download QR** to post the QR image or print it for the venue. The reminder stops once you copy, share or download, or press **I already shared it**; **Remind me later** brings it back the next time you open the board. Players can watch the courts, the Next up line, and the waiting order from their phones, and type their nickname to see if they are next. The link is view-only and shows nicknames and levels, never full names or contacts, and no fees until the game day is completed. It also shows the **Pay online** card with the GCash QR and number, so players can pay without asking. The same card sits at the top of the **Fees** tab. Players who want to go home early type their official nickname under **Leaving already?** on the link; the board shows a gold **Leaving the game day** banner (and a pop-up) within a few seconds. Press **Confirm** to mark them done (a suggested game they were in is removed and the other three go back to waiting) or **Keep in queue** to decline. Someone in a live game can be confirmed after the game finishes, and a declined player can't ask again for five minutes. The Pay online card also has a **Download QR** button so players can save the QR and scan it from their gallery. Once you **complete** the game day, the same link also shows a **Payment list** (nickname, games, total, balance) so players can settle up. Record payments on the Fees tab (add grips or other charges there too) and their line changes to Paid. To change the account, edit `lib/payment.ts` and replace `public/brand/gcash-qr.jpg`, then redeploy.

Do not check in the whole sign-up list on faith. The queue is supposed to reflect the court, not the group chat.

## During the session

### The loop

```
Player arrives → Check in → Auto-pair → Start → End game → Requeue
```

- Check in players as they arrive, one at a time. The wait timer starts at check-in.
- **Start a court by hand, let Pair fill the rest.** Drop the players you already know onto an empty court's slots (one to three of them). The slot you drop them on is the side they play on: two players on the same team stay partners, one on each team stay opponents. Then press **Fill the rest** and the board fills the empty places with the fairest players from the queue, just like Auto-pair. The same works on a waiting court. **Pair** on a court with nobody placed fills all four places of that court. Placed players have to be checked in and waiting (or, for a waiting court, free by then).
- **Reordering the waiting line.** Each waiting game has up and down arrows in its header to move it earlier or later in line; you can also drag a waiting game onto another waiting game to take its place. The order is the order they take free courts, and the plan notes update to match.
- **Planning ahead.** A waiting game can include players who are still on court or already in an earlier waiting game, as long as they should be done by the time it would start (about 15 minutes a game). Example: 6 players, 4 on court: queue the next game now with the 2 who are waiting plus 2 of the 4 finishing. Press **Queue next game** or **Pair** and the board fills the idle players first, then the ones finishing in time. You can add as many waiting games as you like, even beyond the courts you reserved, and a player can be in several of them. Each planned game shows who it is waiting on and when it should start. The one rule: nobody can be on two **playing** courts at once. When a court frees up, the first planned game whose four players are all free moves onto it; if you press **Start** while someone is still on another court, the board says who and when they should finish, and offers **Re-pair this game**. Drag players who are playing from the **Playing** list into a waiting game; the board refuses to put them on a court to start now.
- **Waiting courts** under the courts hold games set ahead of time. Drop four waiting players on the empty waiting court, or press its **Pair**, to set the next game, even while courts are open. When every court is busy, the Auto-pair button becomes **Queue next game** and does the same.
- Waiting games line up in order (**Up next**, Waiting 2, …). When a game ends, the first one moves onto that court automatically; press **Start** once the four are on court. If a court is already open, **Start** on a waiting game sends it there.
- Queued games can be edited, removed with ✕, or dragged onto an open court.
- Start a match only when all four are walking on court.
- **Start reminders.** A paired game on a court shows a small floating "Start game" tag (with how long ago it was paired) over its **Start** button until it starts. A pop-up also asks you to start it right after a game ends and the next game in line moves onto the court, and again if a paired game sits unstarted for 2 minutes. **Start** in the pop-up starts that game; **Not yet** stops the pop-up for those games on this device (reloading the board brings it back), but the note on the court stays.
- End a match with one tap. Both teams requeue automatically and each player's game count increments.
- If a suggested match is wrong, press **Edit** on the court card and swap players before starting.

### Reading the board

| Lane | Meaning |
| --- | --- |
| **Expected** | Signed up, not checked in. Not pairable. |
| **Waiting** | Checked in, in the queue, timer running. Pairable. If you checked in the wrong person, press **⋮** on their block and choose **Undo check-in** (or **Undo check-in** on their Sign-ups row) to put them back to **Expected**; the toast offers **Check in again**. It only works for someone who has not played and is not lined up for a game; after that, use **Done**. |
| **Playing** | On court in a live match. Not pairable. |
| **Done** | Finished for the day. Not pairable; games and fees are kept. |

Stats at the top show total players, waiting, playing, games completed, busy/open courts, average wait, and longest wait. If the longest wait is climbing while courts sit open, pair.

### Moving things by hand

Everything below works two ways: **tap to move** (easiest on a phone) or drag and drop.

- **Tap to move.** Tap a player (their block in the queue, on a court, or in a court place you are filling by hand) or a court's grip handle (⠿ in the header). A black bar at the bottom says what you're moving, and every place it can go lights up. Tap one of them to put it there. Tap the same thing again, press **Cancel**, or press Esc to put it back down. On a court, a lit-up player box means "put them here instead"; an empty slot says **Tap to put here**; a whole court shows **Move to**, **Swap with** or **Take this place in line**.
- **Drag and drop.** Grab the same things and drop them on a target; it lands on the slot under your pointer or finger. On a phone or tablet, press and hold for a moment before dragging, so a quick swipe still scrolls; the dragged name floats just above your finger. To reach the courts from the queue on a phone, hold the dragged name near the top of the screen and the page scrolls up.
- **Split screen (phones and small tablets).** The board keeps the courts on top and the queue in a panel above the bottom navigation, so names drag straight up onto a court. Hold a dragged name just above the panel to scroll down to lower courts (the closer to the panel, the faster), or near the top of the screen to scroll up. Letting go over the panel cancels the drag. Use the search icon to find a player and the chevron to shrink the panel. **Split screen** in the Courts header switches it off or on for that device.

What each move does:

- **Move a match** — grab the grip handle in a court header and drop the card on another court. If that court already has a match, the two swap. Drag a waiting court's game onto a free court to send it there.
- **Swap players** — drag a player's block from the queue (on a phone or tablet, press and hold it for a moment) or from another court onto a slot. Dropping a waiting player onto an occupied slot replaces that player; the replaced player stays checked in and waiting.
- **Build a court by hand** — drop four waiting players onto the empty slots of an open court, or press **+** on their blocks to put each in the next free place (the first open court, else the waiting court). The first two become Team A, the last two Team B, and the match appears as a suggestion for you to start. A player you have placed is still a block: drag or tap them to another place or court (dropping on another placed player trades places), or press ⊗ on the block, or ↩ on their gold queue block, to send them back.
- **Return a player to the queue** — drag a player's block from a court back onto the queue (it lights up gold with "Drop here to return to the queue"), or tap the block and press **To queue** in the black bar. This works for a player you placed by hand and for a paired game that hasn't started: that game is taken apart, the player goes back to the queue, and the other three stay on the court in their places, ready for **Fill the rest** or another player. If a waiting game is in line (it would take the freed court), or the game was itself a waiting game and the waiting court already has players placed, all four go back to the queue instead. A game that has started can't be taken apart this way: finish or cancel it.
- **Late players** — auto-pair treats a player who checks in late (more than 10 minutes after the first court time) as if they had played the games they missed, so they are not pushed ahead of on-time players for having fewer games. The later they arrive, the more games they lose: with 4 courts and 32 players, an hour late counts as about 2 games. The board still shows their real games played. To let a late player in anyway, use **Mark priority** or place them by hand.
- **Mismatch warning** — when a game looks one-sided, its court shows a coral **Mismatch** tag instead of the level gap. Tap it (or hover) to see why. It appears when one team's levels add up to 5 or more steps above the other's (e.g. B, C vs D, E), or when the four players span three brackets or more (e.g. B with E) even if the teams are even. Building a court by hand into a mismatch also shows a warning message. It is only a warning: you can still start the game, or swap players to even it out.
- **Player blocks** — every player is a compact pill: level tag, nickname, and in the queue the games played and waiting time. **+** places them, **⋮** opens **Mark priority**, **Undo check-in** and **Done for the day**. The blocks stay outlined and draggable while a move is saving.

Every move is saved immediately and every other device sees it on the next poll.

### Common situations

**The venue frees up another court.**
Press **Add court** above the court cards. The pop-up asks for the court's name (courts named 5, 6, 7 suggest 8) and how long it is used: **Used from** (it starts at the half hour in progress; change it if the court was taken earlier or starts later) and **For how long** (**Until the end** of the reserved time, or 30 min, 1 hour, 1 hour 30 min, 2 hours or 3 hours only). It shows the time and how much that adds to the court rent.

The court is charged only for that time. Example: 4 courts are reserved 5:30–7:30 PM and after an hour you add one court for 1 hour. The rent becomes 4 courts × 2 hours + 1 court × 1 hour = 9 court-hours, not 10, and every player's share follows. To do this the app splits the court plan around that time (here into 5:30–6:30 with 4 courts and 6:30–7:30 with 5), which you will see in the court plan row and in **Settings**, where you can still adjust it. A plan holds at most 8 blocks.

If the court is in use now and a game is waiting in Next up, that game moves onto it. When the court's time is over, press the next block in the court plan row as usual; a game still on the extra court keeps its card until it is finished. Remove courts in **Settings**.

**A court becomes unavailable** (a failed reservation, a broken net).
Press the red **−** button in that court's header and confirm. The court leaves the block you are viewing; the other courts keep their names (removing Court 6 from 5–8 leaves 5, 7, 8). A suggested game on it moves to the waiting courts. A game in progress must be finished or cancelled first, so the button is disabled on live courts. A block always keeps at least one court.

**The venue switches court numbers.**
Tap a court's name on its card (it is underlined) to rename it. Type the number (`9` shows as Court 9) or a name like `Main court`. Leave **Use this name in every block** ticked to rename that court in every time block, or untick it to change just the block you are viewing. Two courts in the same block can't share a name.

**A game was ended by mistake.**
Press **Undo** on the "Court … finished" message (it stays up for about ten seconds), or **Restore** next to the game under **Recently finished**. The game goes back on its court as live with its original timer, the four players go back on court, and their game counts drop back so fees stay right. If the next waiting game had already moved onto that court, it goes back to the front of the waiting line. Restoring is refused, with the reason, when that court now has another game in progress or one of the four has been put in another game or marked done.

**It is near closing time.**
A game takes about 15 minutes. When you start a game within 15 minutes of the reservation's end, the board asks whether it is a **free game**. Free games are played with a used shuttle, show a violet **Free** tag, and do not count as a game played, so they are not added to anyone's fees.

**Someone has waited a long time.**
Pair normally. The engine already weights wait time. If they are about to leave, choose **Mark priority** in their block's **⋮** menu so they jump the next wave.

**Someone leaves early.**
Press **Done**. Their games and fees stay. Do not remove them from the game day — removal deletes their session record.

**A player comes back after leaving.**
Press **Requeue**. They re-enter Waiting with a fresh timer.

**Two players always want to partner.**
On the **Sign-ups** page, press **⋯** on one of their rows and pick a **permanent partner** from the Partner menu (it saves as soon as you choose; the pair is set both ways). Pairing requests (partner with, play against) are in the same panel. The engine will never split them across the net and will bench them together rather than break the pair.

**Two players want to play each other once.**
Add a **Play against** request. It is honored when the match stays fair.

**The queue is too thin for a fair four.**
The board will say so. Wait for arrivals or check in someone from Expected. Do not force a three-player game.

**A court is double-booked.**
Edit the court block in **Settings**, or move the affected match to another court. Do not delete the game day.

**A game was finished by mistake.**
Cancel the match if it is still live. If it is completed, the game count already moved to fees; requeue the players and adjust the fee entry on the Fees page. Avoid editing the database during a session.

### Requests

Requests are soft. The board shows a badge when one was honored. If a request is not honored, it is because honoring it would have produced a lopsided game. Explain that rather than overriding the pairing; players generally accept “the engine kept it fair.”

## Closing the day

When the reservation runs out (the end of the last block, on the game day itself), the board asks **Reservation time is up**:

- **Extend the game day** — pick until when and how many courts you still have (it suggests an hour more with the same courts). A new *Extension* block keeps the court numbers. If you keep fewer courts, suggested games on the dropped courts move to the waiting courts.
- **End the game day & go to fees** — closes the board and opens **Fees**. Games still on court count as played unless you untick the box; suggested and waiting games are cancelled.
- **Remind me in 10 min** — or close the box; it comes back after ten minutes.

- [ ] Finish or cancel every live and suggested match.
- [ ] Mark anyone who left early as **Done**.
- [ ] Open **Fees**, record payments, and reconcile cash vs GCash.
- [ ] Download the **Excel** and **PDF** reports.
- [ ] Check the **Player leaderboard** on the **Reports** page, which ranks players by games and shows each one's total time on court, from the start to the finish of every game they played (free games included). It is for your eyes only and is not in the Excel or PDF. If one player's time looks far too long, a game was probably left running; check Match history.
- [ ] Add a short note to the game day if anything unusual happened (late courts, guests, corrections).
- [ ] Press **Complete**. This cancels leftovers and freezes the session.
- [ ] Log out if the device is shared.

## Logging attendance for recency

The **Players** page has a **Playing recency** section. Its counters show Playing often, Playing, and Tournament only; every status below appears in the Recency column of the player database. It separates people who still play from people who have drifted away, using the lists posted in the group chat.

Game days run in Kyuwing log themselves: when you press **End game day** (or close the game day in Settings), everyone who checked in is saved as **Played** on a list for that date, named after the game day. Sign-ups who never checked in are left out. If a list for that date was already pasted from the chat, the app adds to that list instead of making a second one, so its waitlist stays. If you reopen the game day and end it again, the same list is updated. You only need to paste lists for days not run in the app, or to add a waitlist.

To log a list by hand:

1. Open **Players → Log attendance**.
2. Pick the date and whether it was a **Game day** or a **Tournament**.
3. Paste the whole chat message into **Played**. Numbering, blank slots, and headers (title, date, time) are ignored, and anything under a `Waitlist:` line is counted as waitlisted. You can also paste a waitlist separately into the second box.
4. Save. Other names saved under **Also goes by** count as the nickname. Any nickname that is not in the player database is listed in a warning; add those players, delete the list, and log it again.

To check who was on a past game day, press **View** on any list under **Logged lists**. It shows the players who played and the waitlist, each with their nickname and current level.

To fix a list, press the pencil (or **Edit** in the View window). The form opens with the date, type, label and nicknames filled in, one per line. Add or remove names, or move them between Played and Waitlist, and press **Save changes**. The same list is updated, so recency and each player's attendance history follow. Names not in the player database are reported and left out, as when logging.

On the player table, the history icon in a player's row lists every logged game day and tournament they attended or were waitlisted for.

How players are banded:

| Band          | Meaning                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Playing often | Active in the last 30 days and plays regularly (score 55+)                     |
| Playing       | Played or waitlisted in the last 30 days                                       |
| Tournament only | Seen only on tournament lists in the last 90 days, never on a game-day list |
| Cooling off   | Last seen 31–90 days ago                                                       |
| Dormant       | Not seen in over 90 days                                                       |
| No history    | Not on any logged list                                                         |

The score (0–100) sorts the **Recency** column. Each list counts less as it ages (half weight after 60 days, none after a year), and a waitlist place counts 40% of a game, because joining the waitlist still shows the player wants to play.

## Tournament awards

Players with a tournament podium get a trophy (gold for a title, a medal for runner-up only) as the first icon on their row in the player database (on phones, beside the ⋯ button that holds the other player actions). Tapping it lists each podium with the level, tournament, date, and their doubles partner or, for team-format tournaments, their teammates.

To add a tournament, go to **Players → Tournament awards → Add awards** and paste the results:

```
League Cup 2026

Level AB
Champions: EJ, Jethro, Don, Eljo
Runners-up: Bens, Jacob, Kyle, Edge

Level B
Champions: Serafin & JP
Runner-up: Baby & JCB
```

- A line that is not a result starts a new level. The first line becomes the tournament name if the name box is left blank.
- Separate a doubles pair with `&` and a team with commas (up to 8 players).
- Every name must be an official nickname. Unknown names show struck through in the preview and the save is refused; add the player first.
- To fix a tournament, press the pencil and re-paste. Saving replaces its awards.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Board is stale | Poll failed or device asleep | Pull to refresh / reload the page |
| “At least four players need to be checked in” | Fewer than four Waiting | Check in more arrivals |
| “All N courts are assigned” | Every court has a suggestion or live match | Start, finish, or cancel a match |
| “Add at least one court block in Settings first” | Empty court plan | Add a block in Settings |
| Auto-pair produces a cross-bracket match | Queue is thin | Expected; check in more players for tighter matches |
| Login rejected | Wrong PIN or `QUEUE_MASTER_PIN` changed | Use the current PIN; ask the operator |
| Fees show 0 | No rule for venue/type/category | Fill the matrix in Venues |
| Export fails | Server/database hiccup | Retry; if it persists, screenshot the error reference |

## Escalation

If something looks broken:

1. Note the time, the game-day name, and what you pressed.
2. Take a screenshot of the board and any error toast.
3. Do not reset the database during a session.
4. After the session, report with the details so the data can be inspected safely.

## Device tips

- **Install Kyuwing as an app** for a full-screen board with its own icon:
  - **Android (Chrome, Samsung Internet), or Chrome / Edge on a computer:** tap **Install app** (the download icon in the phone header, the button in the sidebar, or on the sign-in page) and confirm. The browser's own menu (**Install app** / **Add to Home screen**) works too.
  - **iPhone / iPad:** open Kyuwing in Safari, tap **Share**, then **Add to Home Screen**. The Install app button shows these steps.
  - Right after you sign in in the browser, a **Get the Kyuwing app** pop-up offers the same install. **Not now** hides it until your next sign-in; it doesn't show once the app is installed.
  - The installed app opens straight to the board and updates itself whenever a new version is deployed. It still needs the internet; without it you get a "You're offline" page with **Try again**.
- Keep the device plugged in or on a power bank.
- Use one device as the source of truth. Multiple queue masters is fine for viewing, but avoid two people pressing pair at the same time.
- Screen brightness up; the board is designed to be readable across a court.
