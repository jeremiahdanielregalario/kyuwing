# Operations

For the person holding the tablet. This is the day-of runbook; the in-app **Playbook** (`/app/guide`) is the same material with fewer words.

## Before the session

- [ ] Charge the tablet or phone. A power bank is not optional for a four-hour session.
- [ ] Starting from the Messenger sign-up list? Open **New game day**, expand **Start from the Messenger list**, and paste the chat message as it is. The app reads the title (type and venue), date, time, the **QM:** and **FIN:** lines, and every numbered name, and fills in the form. Every name has to be the player's **official nickname** from the Players database. Anything else is flagged with a fix: full names and `@` mentions (e.g. `@Shawn Elizarde`) get a **Use "Shawn"** button (or **Use nicknames for all**), a nickname you mistyped gets close suggestions, a name listed twice gets **Remove line**, and a name that is not in the database has to be added in **Players** first. **Create game day** stays disabled until every name is an official nickname. Names under a **Waitlist** heading are skipped. Players are added as **expected**; check them in as they arrive. The list keeps changing before the day, so on the game day's **Sign-ups** page press **Paste Messenger list** to add whoever is new (nobody is removed or added twice).
- [ ] Know who is queue master and who is the finance member for the day; enter both when you create the game day (they appear on the session report and can be changed in **Settings**).
- [ ] Confirm the venue booking and the exact court numbers, and enter them in each block's **Court numbers** when you create the game day (`5, 6, 7, 8` or `5-8`). The board, toasts, and the players' live view then use those numbers.
- [ ] Open Kyuwing and log in with the queue-master PIN.
- [ ] Create the game day: venue, date, **Regular / Tipid / MEGA**, court blocks.
- [ ] Set the court blocks to match the booking. Example: 3 courts 09:00–10:00, 4 courts 10:00–12:00, 3 courts 12:00–14:00.
- [ ] Double-check the fee matrix in **Venues → Fees** if anything changed.
- [ ] Playing at a venue with no saved fees? Enter its **Court rate per hour** when you create the game day and the court cost is split among the players (see `docs/FEES.md`).
- [ ] Build the sign-up list, or tap **Add all active players** and remove no-shows later.

## Starting the day

1. Open the game day and press **Start** to move it from Draft to Live.
2. Check in only the players who are physically present. Start with the first four to eight.
4. When a court is free, press **Auto-pair**. Don't like what it suggests? Press **Regenerate** for different pairings on every suggested court, or the shuffle button on one game to redo just that one. Press again as often as you like: each press avoids everything you already rejected for that game, so you never see the same lineup twice. Nothing changes until a new arrangement exists. When there is no other fair option, the board says so; edit the game by hand then.
5. Press **Share live view** and paste the link in the group chat. Players can watch the courts, the Next up line, and the waiting order from their phones, and type their nickname to see if they are next. The link is view-only and shows nicknames and levels, never full names or contacts, and no fees until the game day is completed. It also shows the **Pay online** card with the GCash QR and number, so players can pay without asking. The same card sits at the top of the **Fees** tab. Players who want to go home early type their official nickname under **Leaving already?** on the link; the board shows a gold **Leaving the game day** banner (and a pop-up) within a few seconds. Press **Confirm** to mark them done (a suggested game they were in is removed and the other three go back to waiting) or **Keep in queue** to decline. Someone in a live game can be confirmed after the game finishes, and a declined player can't ask again for five minutes. The Pay online card also has a **Download QR** button so players can save the QR and scan it from their gallery. Once you **complete** the game day, the same link also shows a **Payment list** (nickname, games, total, balance) so players can settle up. Record payments on the Fees tab (add grips or other charges there too) and their line changes to Paid. To change the account, edit `lib/payment.ts` and replace `public/brand/gcash-qr.jpg`, then redeploy.

Do not check in the whole sign-up list on faith. The queue is supposed to reflect the court, not the group chat.

## During the session

### The loop

```
Player arrives → Check in → Auto-pair → Start → End game → Requeue
```

- Check in players as they arrive, one at a time. The wait timer starts at check-in.
- **Planning ahead.** A waiting game can include players who are still on court or already in an earlier waiting game, as long as they should be done by the time it would start (about 15 minutes a game). Example: 6 players, 4 on court: queue the next game now with the 2 who are waiting plus 2 of the 4 finishing. Press **Queue next game** or **Pair** and the board fills the idle players first, then the ones finishing in time. You can add as many waiting games as you like, even beyond the courts you reserved, and a player can be in several of them. Each planned game shows who it is waiting on and when it should start. The one rule: nobody can be on two **playing** courts at once. When a court frees up, the first planned game whose four players are all free moves onto it; if you press **Start** while someone is still on another court, the board says who and when they should finish, and offers **Re-pair this game**. Drag players who are playing from the **Playing** list into a waiting game; the board refuses to put them on a court to start now.
- **Waiting courts** under the courts hold games set ahead of time. Drop four waiting players on the empty waiting court, or press its **Pair**, to set the next game, even while courts are open. When every court is busy, the Auto-pair button becomes **Queue next game** and does the same.
- Waiting games line up in order (**Up next**, Waiting 2, …). When a game ends, the first one moves onto that court automatically; press **Start** once the four are on court. If a court is already open, **Start** on a waiting game sends it there.
- Queued games can be edited, removed with ✕, or dragged onto an open court.
- Start a match only when all four are walking on court.
- End a match with one tap. Both teams requeue automatically and each player's game count increments.
- If a suggested match is wrong, press **Edit** on the court card and swap players before starting.

### Reading the board

| Lane | Meaning |
| --- | --- |
| **Expected** | Signed up, not checked in. Not pairable. |
| **Waiting** | Checked in, in the queue, timer running. Pairable. If you checked in the wrong person, press the undo arrow on their row (or **Undo check-in** on their Sign-ups row) to put them back to **Expected**; the toast offers **Check in again**. It only works for someone who has not played and is not lined up for a game; after that, use **Done**. |
| **Playing** | On court in a live match. Not pairable. |
| **Done** | Finished for the day. Not pairable; games and fees are kept. |

Stats at the top show total players, waiting, playing, games completed, busy/open courts, average wait, and longest wait. If the longest wait is climbing while courts sit open, pair.

### Moving things by hand

The court cards accept drag and drop:

- **Move a match** — grab the grip handle in a court header and drop the card on another court. If that court already has a match, the two swap. Drag a waiting court's game onto a free court to send it there.
- **Swap players** — drag a player from the queue (grab the outlined name box; on a tablet, press and hold it for a moment) or from another court onto a slot. Dropping a waiting player onto an occupied slot replaces that player; the replaced player stays checked in and waiting.
- **Build a court by hand** — drop four waiting players onto the empty slots of an open court. The first two become Team A, the last two Team B, and the match appears as a suggestion for you to start.

Every drop is saved immediately and every other device sees it on the next poll.

### Common situations

**The venue frees up another court.**
Press **Add court** above the court cards. It adds a court to the block you are viewing (courts named 5, 6, 7 suggest 8). If a game is waiting in Next up, it moves onto the new court. Remove courts in **Settings**.

**A court becomes unavailable** (a failed reservation, a broken net).
Press the **−** button in that court's header and confirm. The court leaves the block you are viewing; the other courts keep their names (removing Court 6 from 5–8 leaves 5, 7, 8). A suggested game on it moves to the waiting courts. A game in progress must be finished or cancelled first, so the button is disabled on live courts. A block always keeps at least one court.

**The venue switches court numbers.**
Tap a court's name on its card (it is underlined) to rename it. Type the number (`9` shows as Court 9) or a name like `Main court`. Leave **Use this name in every block** ticked to rename that court in every time block, or untick it to change just the block you are viewing. Two courts in the same block can't share a name.

**A game was ended by mistake.**
Press **Undo** on the "Court … finished" message (it stays up for about ten seconds), or **Restore** next to the game under **Recently finished**. The game goes back on its court as live with its original timer, the four players go back on court, and their game counts drop back so fees stay right. If the next waiting game had already moved onto that court, it goes back to the front of the waiting line. Restoring is refused, with the reason, when that court now has another game in progress or one of the four has been put in another game or marked done.

**It is near closing time.**
A game takes about 15 minutes. When you start a game within 15 minutes of the reservation's end, the board asks whether it is a **free game**. Free games are played with a used shuttle, show a violet **Free** tag, and do not count as a game played, so they are not added to anyone's fees.

**Someone has waited a long time.**
Pair normally. The engine already weights wait time. If they are about to leave, toggle **Priority** so they jump the next wave.

**Someone leaves early.**
Press **Done**. Their games and fees stay. Do not remove them from the game day — removal deletes their session record.

**A player comes back after leaving.**
Press **Requeue**. They re-enter Waiting with a fresh timer.

**Two players always want to partner.**
On the **Sign-ups** page, press the gear on one of their rows and pick a **permanent partner** from the Partner menu (it saves as soon as you choose; the pair is set both ways). Pairing requests (partner with, play against) are in the same panel. The engine will never split them across the net and will bench them together rather than break the pair.

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

1. Open **Players → Log attendance**.
2. Pick the date and whether it was a **Game day** or a **Tournament**.
3. Paste the whole chat message into **Played**. Numbering, blank slots, and headers (title, date, time) are ignored, and anything under a `Waitlist:` line is counted as waitlisted. You can also paste a waitlist separately into the second box.
4. Save. Any nickname that is not in the player database is listed in a warning; add those players, delete the list, and log it again.

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

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Board is stale | Poll failed or device asleep | Pull to refresh / reload the page |
| “At least four players need to be checked in” | Fewer than four Waiting | Check in more arrivals |
| “All N courts are assigned” | Every court has a suggestion or live match | Start, finish, or cancel a match |
| “Add at least one court block in Settings first” | Empty court plan | Add a block in Settings |
| Auto-pair produces a cross-bracket match | Queue is thin | Expected; check in more players for tighter matches |
| Login rejected | Wrong PIN or `QUEUE_MASTER_PIN` changed | Use the current PIN; ask the operator |
| Fees show 0 | No rule for venue/type/category | Fill the matrix in Venues → Fees |
| Export fails | Server/database hiccup | Retry; if it persists, screenshot the error reference |

## Escalation

If something looks broken:

1. Note the time, the game-day name, and what you pressed.
2. Take a screenshot of the board and any error toast.
3. Do not reset the database during a session.
4. After the session, report with the details so the data can be inspected safely.

## Device tips

- Add Kyuwing to the home screen for a full-screen board.
- Keep the device plugged in or on a power bank.
- Use one device as the source of truth. Multiple queue masters is fine for viewing, but avoid two people pressing pair at the same time.
- Screen brightness up; the board is designed to be readable across a court.
