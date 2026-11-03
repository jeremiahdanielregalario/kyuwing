# Operations

For the person holding the tablet. This is the day-of runbook; the in-app **Playbook** (`/app/guide`) is the same material with fewer words.

## Before the session

- [ ] Charge the tablet or phone. A power bank is not optional for a four-hour session.
- [ ] Confirm the venue booking and the exact court numbers, and enter them in each block's **Court numbers** when you create the game day (`5, 6, 7, 8` or `5-8`). The board, toasts, and the players' live view then use those numbers.
- [ ] Open Kyuwing and log in with the queue-master PIN.
- [ ] Create the game day: venue, date, **Regular / Tipid / MEGA**, court blocks.
- [ ] Set the court blocks to match the booking. Example: 3 courts 09:00–10:00, 4 courts 10:00–12:00, 3 courts 12:00–14:00.
- [ ] Double-check the fee matrix in **Venues → Fees** if anything changed.
- [ ] Build the sign-up list, or tap **Add all active players** and remove no-shows later.

## Starting the day

1. Open the game day and press **Start** to move it from Draft to Live.
2. Check in only the players who are physically present. Start with the first four to eight.
4. When a court is free, press **Auto-pair**.
5. Press **Share live view** and paste the link in the group chat. Players can watch the courts, the Next up line, and the waiting order from their phones, and type their nickname to see if they are next. The link is view-only and shows nicknames and levels, never full names, contacts, or fees.

Do not check in the whole sign-up list on faith. The queue is supposed to reflect the court, not the group chat.

## During the session

### The loop

```
Player arrives → Check in → Auto-pair → Start → End game → Requeue
```

- Check in players as they arrive, one at a time. The wait timer starts at check-in.
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
| **Waiting** | Checked in, in the queue, timer running. Pairable. |
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

**It is near closing time.**
A game takes about 15 minutes. When you start a game within 15 minutes of the reservation's end, the board asks whether it is a **free game**. Free games are played with a used shuttle, show a violet **Free** tag, and do not count as a game played, so they are not added to anyone's fees.

**Someone has waited a long time.**
Pair normally. The engine already weights wait time. If they are about to leave, toggle **Priority** so they jump the next wave.

**Someone leaves early.**
Press **Done**. Their games and fees stay. Do not remove them from the game day — removal deletes their session record.

**A player comes back after leaving.**
Press **Requeue**. They re-enter Waiting with a fresh timer.

**Two players always want to partner.**
Set a **permanent partner** on one of them. The engine will never split them across the net and will bench them together rather than break the pair.

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

- [ ] Finish or cancel every live and suggested match.
- [ ] Mark anyone who left early as **Done**.
- [ ] Open **Fees**, record payments, and reconcile cash vs GCash.
- [ ] Download the **Excel** and **PDF** reports.
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
