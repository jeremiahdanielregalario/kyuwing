"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/lib/board-engine/types";
import type { FeeRow } from "@/lib/board-types";
import { TRACKER_PAYMENT } from "@/lib/finance-tracker";
import {
  SHEET_COLUMNS,
  clampRange,
  displayValue,
  edgeScroll,
  handleAnchor,
  inRange,
  parseAmount,
  parseCellKey,
  rangeOf,
  rangeToHtml,
  rangeToTsv,
  type Cell,
  type Range,
  type SheetEdit,
  type SheetRow,
} from "@/lib/fee-sheet";
import { haptic } from "@/lib/haptics";
import { PAYMENT_METHOD_KEYS } from "@/lib/validation";
import { cn } from "@/lib/utils";

const COLS = SHEET_COLUMNS.length;
/** How long a finger rests on a cell before dragging selects instead of scrolling. */
const HOLD_MS = 350;
/** How far a finger may wander during that hold before it counts as a scroll. */
const HOLD_SLOP = 10;

/** A selection being dragged out: the fixed corner, and where the pointer is now. */
type Drag = { anchor: Cell; pointerId: number; x: number; y: number };
/** A finger resting on a cell, which becomes a drag if it stays put for HOLD_MS. */
type Hold = { cell: Cell; pointerId: number; x: number; y: number; timer: number };

/**
 * The Excel report's player table as a spreadsheet grid, and the Fees page's default way to record
 * payments. VERIFIED? is a tick box and Mode of Payment a dropdown (either records the payment);
 * double-click a Voucher (tap a selected cell again on touch, or Enter) to type it, and do the same
 * on any other cell for the full payment form. Drag (or Shift+click) to select a block, tap a
 * heading for the whole column, then Ctrl/Cmd+C or Copy: the cells paste into Excel or Google
 * Sheets as cells, with amounts as plain numbers. On touch, tap a cell, then drag the round
 * handles on the selection's corners, or press and hold a cell and drag; a plain swipe still
 * scrolls the table.
 *
 * Without `feeRows` (the finance officer's shared link) the grid is read-only: cells can be
 * selected and copied, and nothing can be changed.
 */
export function FeeSheet({
  rows,
  feeRows,
  pending = false,
  onEdit,
  onOpen,
}: {
  rows: Array<SheetRow & { sessionPlayerId?: string }>;
  feeRows?: FeeRow[];
  pending?: boolean;
  onEdit?: (row: FeeRow, edit: SheetEdit) => void;
  onOpen?: (row: FeeRow) => void;
}) {
  const readOnly = !feeRows;
  const byId = React.useMemo(
    () => new Map((feeRows ?? []).map((row) => [row.sessionPlayerId, row])),
    [feeRows],
  );
  const [editing, setEditing] = React.useState<Cell | null>(null);
  const [draft, setDraft] = React.useState("");
  // The cell being typed in, for the handlers: moving focus away blurs the box, which must not
  // save twice or save a cancelled edit.
  const editRef = React.useRef<Cell | null>(null);
  const typedStart = React.useRef(false);
  const [anchor, setAnchor] = React.useState<Cell | null>(null);
  const [focus, setFocus] = React.useState<Cell | null>(null);
  const [headings, setHeadings] = React.useState(false);
  const drag = React.useRef<Drag | null>(null);
  const hold = React.useRef<Hold | null>(null);
  const skipClick = React.useRef(false);
  const scrollFrame = React.useRef(0);
  const pointer = React.useRef<string>("mouse");
  const gridRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const startHandle = React.useRef<HTMLDivElement>(null);
  const endHandle = React.useRef<HTMLDivElement>(null);

  const last = rows.length - 1;
  const range: Range | null = anchor && focus ? clampRange(rangeOf(anchor, focus), rows.length, COLS) : null;
  const all: Range | null = rows.length ? { top: 0, left: 0, bottom: last, right: COLS - 1 } : null;
  const target = range ?? all;

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  React.useEffect(() => {
    const stop = () => {
      if (hold.current) window.clearTimeout(hold.current.timer);
      hold.current = null;
      drag.current = null;
      cancelAnimationFrame(scrollFrame.current);
    };
    // While a held finger drags out a selection the table must not scroll under it. React's touch
    // listeners are passive, so this one is added by hand.
    const grid = gridRef.current;
    const noScroll = (event: TouchEvent) => {
      if (drag.current && event.cancelable) event.preventDefault();
    };
    grid?.addEventListener("touchmove", noScroll, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      grid?.removeEventListener("touchmove", noScroll);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // The round handles sit on the selection's top-left and bottom-right corners. They are placed
  // by hand (not rendered inside the corner cells) so a handle being dragged is never remounted
  // and keeps hold of the finger.
  React.useLayoutEffect(() => {
    const body = bodyRef.current;
    const place = (handle: HTMLDivElement | null, cell: Cell | null, corner: "start" | "end") => {
      if (!handle) return;
      const td = cell && body?.querySelector<HTMLElement>(`[data-cell="${cell.row}-${cell.col}"]`);
      if (!body || !td) {
        handle.style.display = "none";
        return;
      }
      const box = body.getBoundingClientRect();
      const rect = td.getBoundingClientRect();
      handle.style.display = "";
      handle.style.left = `${(corner === "end" ? rect.right : rect.left) - box.left}px`;
      handle.style.top = `${(corner === "end" ? rect.bottom : rect.top) - box.top}px`;
    };
    place(startHandle.current, range && { row: range.top, col: range.left }, "start");
    place(endHandle.current, range && { row: range.bottom, col: range.right }, "end");
  });

  const select = (from: Cell, to: Cell) => {
    setAnchor(from);
    setFocus(to);
  };
  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  /** The sheet cell under a point on screen, if any. */
  const cellAt = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el && bodyRef.current?.contains(el) ? parseCellKey(el.dataset.cell) : null;
  };
  /** Stretch the selection to the cell under the pointer. */
  const followPointer = () => {
    const now = drag.current && cellAt(drag.current.x, drag.current.y);
    if (now) setFocus((prev) => (prev && prev.row === now.row && prev.col === now.col ? prev : now));
  };
  /** Scroll the grid while the drag is held near an edge, so the selection can grow off screen. */
  const autoScroll = () => {
    const grid = gridRef.current;
    const current = drag.current;
    if (!grid || !current) return;
    const { dx, dy } = edgeScroll(current, grid.getBoundingClientRect());
    if (dx || dy) {
      grid.scrollBy(dx, dy);
      followPointer();
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  };
  const startDrag = (
    event: { pointerId: number; clientX: number; clientY: number },
    from: Cell,
    to: Cell,
  ) => {
    select(from, to);
    drag.current = { anchor: from, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(autoScroll);
  };

  const onCellPointerDown = (event: React.PointerEvent, cell: Cell) => {
    pointer.current = event.pointerType;
    if (event.pointerType === "touch") {
      // A finger that rests on a cell starts a selection drag; one that moves is scrolling.
      cancelHold();
      skipClick.current = false; // A long press may end without a click; don't eat the next tap.
      const { pointerId, clientX, clientY } = event;
      const timer = window.setTimeout(() => {
        hold.current = null;
        focusGrid();
        skipClick.current = true;
        haptic("tap");
        startDrag({ pointerId, clientX, clientY }, cell, cell);
      }, HOLD_MS);
      hold.current = { cell, pointerId, x: clientX, y: clientY, timer };
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault(); // No text selection while dragging across cells.
    focusGrid();
    if (event.shiftKey && anchor) startDrag(event, anchor, cell);
    else startDrag(event, cell, cell);
  };
  const onGridPointerMove = (event: React.PointerEvent) => {
    const resting = hold.current;
    if (resting && resting.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - resting.x, event.clientY - resting.y) > HOLD_SLOP) cancelHold();
      return;
    }
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    followPointer();
  };
  /** A corner handle: drag it to stretch the selection from the opposite corner. */
  const onHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>, handle: "start" | "end") => {
    if (!range || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    pointer.current = event.pointerType;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the drag simply ends on the next pointerup.
    }
    focusGrid();
    const from = handleAnchor(range, handle);
    const to =
      handle === "end" ? { row: range.bottom, col: range.right } : { row: range.top, col: range.left };
    startDrag(event, from, to);
  };
  const onCellClick = (cell: Cell) => {
    if (pointer.current !== "touch") return;
    if (skipClick.current) {
      skipClick.current = false; // The tap that ended a hold-and-drag.
      return;
    }
    focusGrid();
    // Touch: a tap picks the cell, and a second tap on the same cell edits it.
    const single = range && range.top === range.bottom && range.left === range.right;
    const same = anchor && anchor.row === cell.row && anchor.col === cell.col;
    if (single && same) activate(cell);
    else select(cell, cell);
  };

  /** Edit a cell: type a voucher, tick VERIFIED?, or open the payment form for the rest. */
  const activate = (cell: Cell, typed?: string) => {
    const id = rows[cell.row]?.sessionPlayerId;
    const fee = id ? byId.get(id) : undefined;
    if (!fee || pending) return;
    const column = SHEET_COLUMNS[cell.col];
    select(cell, cell);
    if (column.edit === "amount") {
      setDraft(typed ?? (fee.voucher ? String(fee.voucher) : ""));
      editRef.current = cell;
      typedStart.current = typed !== undefined;
      setEditing(cell);
    } else if (column.edit === "check") {
      onEdit?.(fee, { verified: !fee.paid });
    } else if (column.edit === "method") {
      gridRef.current
        ?.querySelector<HTMLSelectElement>(`[data-cell="${cell.row}-${cell.col}"] select`)
        ?.focus();
    } else {
      onOpen?.(fee);
    }
  };

  const commitVoucher = () => {
    const cell = editRef.current;
    if (!cell) return;
    editRef.current = null;
    const fee = byId.get(rows[cell.row]?.sessionPlayerId ?? "");
    const value = parseAmount(draft);
    setEditing(null);
    focusGrid();
    if (!fee) return;
    if (value === null) {
      toast.error("Enter the voucher in whole pesos.");
      return;
    }
    if (value !== fee.voucher) onEdit?.(fee, { voucher: value });
  };
  const cancelVoucher = () => {
    editRef.current = null;
    setEditing(null);
    focusGrid();
  };

  const pickColumn = (event: React.MouseEvent, col: number) => {
    if (!rows.length) return;
    focusGrid();
    if (event.shiftKey && anchor) select({ row: 0, col: anchor.col }, { row: last, col });
    else select({ row: 0, col }, { row: last, col });
  };
  const pickAll = () => {
    if (!rows.length) return;
    focusGrid();
    select({ row: 0, col: 0 }, { row: last, col: COLS - 1 });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return; // A cell's own control is handling it.
    const mod = event.metaKey || event.ctrlKey;
    if (focus && !mod && (event.key === "Enter" || event.key === "F2")) {
      event.preventDefault();
      activate(focus);
      return;
    }
    if (focus && event.key === " " && SHEET_COLUMNS[focus.col].edit === "check") {
      event.preventDefault();
      activate(focus);
      return;
    }
    if (focus && !mod && /^[0-9]$/.test(event.key) && SHEET_COLUMNS[focus.col].edit === "amount") {
      event.preventDefault();
      activate(focus, event.key); // Typing a number into a voucher cell starts editing it, like Excel.
      return;
    }
    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      pickAll();
      return;
    }
    if (event.key === "Escape") {
      setAnchor(null);
      setFocus(null);
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (!move || !rows.length) return;
    event.preventDefault();
    const from = focus ?? { row: 0, col: 0 };
    const next = {
      row: Math.min(Math.max(from.row + move[0], 0), last),
      col: Math.min(Math.max(from.col + move[1], 0), COLS - 1),
    };
    if (event.shiftKey && anchor) setFocus(next);
    else select(next, next);
  };

  // Ctrl/Cmd+C while the grid has focus: hand the clipboard the cells directly.
  const onCopy = (event: React.ClipboardEvent) => {
    if (!target || event.target !== event.currentTarget) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", rangeToTsv(rows, target, headings));
    event.clipboardData.setData("text/html", rangeToHtml(rows, target, headings));
    toast.success(copiedMessage(target));
  };

  const copyButton = async () => {
    if (!target) return;
    const text = rangeToTsv(rows, target, headings);
    const html = rangeToHtml(rows, target, headings);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.success(copiedMessage(target));
    } catch {
      toast.error("Couldn't reach the clipboard. Select the cells and press Ctrl+C (⌘C on a Mac).");
    }
  };

  return (
    <div>
      <div className="border-line/80 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="text-muted text-[11px]">
          {range ? (
            <span className="text-ink font-semibold">{selectionSize(range)} selected</span>
          ) : readOnly ? (
            <>
              Drag across cells (on a phone, tap a cell and drag its round handles, or press and hold and
              drag) or tap a heading to pick a block, then copy it into the finance tracker.
            </>
          ) : (
            <>
              Tick <span className="text-ink font-semibold">VERIFIED?</span> or pick a{" "}
              <span className="text-ink font-semibold">Mode of Payment</span> to record a payment.
              Double-click (or tap twice) a Voucher to change it, or any other cell for the payment form.
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <label className="text-muted inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
            <input
              type="checkbox"
              checked={headings}
              onChange={(event) => setHeadings(event.target.checked)}
              className="accent-forest h-4 w-4"
            />
            Include headings
          </label>
          <Button size="sm" variant="primary" onClick={copyButton} disabled={!target}>
            <Copy className="h-3.5 w-3.5" /> {range ? "Copy selection" : "Copy all"}
          </Button>
        </div>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        role="grid"
        aria-label={
          readOnly ? "Fee sheet: select cells to copy" : "Fee sheet: record payments and select cells to copy"
        }
        aria-multiselectable="true"
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPointerMove={onGridPointerMove}
        onContextMenu={(event) => {
          // Holding a finger on a cell starts a selection, not the phone's long-press menu.
          if (pointer.current === "touch") event.preventDefault();
        }}
        className="focus-visible:ring-lime max-h-[70vh] overflow-auto outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div ref={bodyRef} className="relative w-max min-w-full">
          <table className="w-max min-w-full border-separate border-spacing-0 font-sans text-[12px]">
            <thead className="sticky top-0 z-20">
              <tr>
                {SHEET_COLUMNS.map((column, col) => (
                  <th
                    key={column.key}
                    onClick={(event) => pickColumn(event, col)}
                    className={cn(
                      "border-line-strong h-9 cursor-pointer border-r border-b px-3 text-center text-[11px] font-bold whitespace-nowrap select-none",
                      range && col >= range.left && col <= range.right ? "bg-lime-bright" : "bg-cream",
                      col === 2 && "min-w-40",
                      col === 7 && "min-w-48",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="text-muted px-4 py-12 text-center">
                    No players yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, r) => (
                  <tr key={r}>
                    {SHEET_COLUMNS.map((column, col) => {
                      const cell = { row: r, col };
                      const selected = inRange(range, r, col);
                      const isFocus = focus?.row === r && focus.col === col && !!range;
                      const fee = row.sessionPlayerId ? byId.get(row.sessionPlayerId) : undefined;
                      const isEditing = editing?.row === r && editing.col === col;
                      // Clicks on a cell's own control shouldn't also start a selection drag.
                      const own = {
                        onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
                        onClick: (event: React.MouseEvent) => event.stopPropagation(),
                      };
                      let content: React.ReactNode = displayValue(row, column);
                      if (fee && column.edit === "check") {
                        content = (
                          <input
                            type="checkbox"
                            {...own}
                            checked={fee.paid}
                            disabled={pending}
                            onChange={(event) => {
                              onEdit?.(fee, { verified: event.target.checked });
                              focusGrid();
                            }}
                            aria-label={`${row.name} verified (paid in full)`}
                            className="accent-forest h-5 w-5 cursor-pointer align-middle disabled:opacity-40"
                          />
                        );
                      } else if (fee && column.edit === "method") {
                        content = (
                          <select
                            {...own}
                            value={fee.paymentMethod ?? ""}
                            disabled={pending}
                            onChange={(event) => {
                              onEdit?.(fee, { method: (event.target.value || null) as PaymentMethod | null });
                              focusGrid();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") focusGrid();
                            }}
                            aria-label={`${row.name} mode of payment`}
                            className="h-9 w-full min-w-24 cursor-pointer appearance-none bg-transparent text-center outline-none"
                          >
                            <option value="">—</option>
                            {PAYMENT_METHOD_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {TRACKER_PAYMENT[key] ?? key}
                              </option>
                            ))}
                          </select>
                        );
                      } else if (isEditing) {
                        content = (
                          <input
                            {...own}
                            autoFocus
                            inputMode="numeric"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={commitVoucher}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter" || event.key === "Tab") {
                                event.preventDefault();
                                commitVoucher();
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                cancelVoucher();
                              }
                            }}
                            onFocus={(event) => {
                              // Started by typing a digit: keep it and carry on typing after it.
                              const end = event.target.value.length;
                              if (typedStart.current) event.target.setSelectionRange(end, end);
                              else event.target.select();
                            }}
                            aria-label={`${row.name} voucher`}
                            className="h-8 w-24 bg-white text-right font-mono outline-none"
                          />
                        );
                      }
                      return (
                        <td
                          key={column.key}
                          role="gridcell"
                          data-cell={`${r}-${col}`}
                          aria-selected={selected}
                          onPointerDown={(event) => onCellPointerDown(event, cell)}
                          onClick={() => onCellClick(cell)}
                          onDoubleClick={() => {
                            if (pointer.current !== "touch" && !column.edit?.match(/check|method/))
                              activate(cell);
                          }}
                          className={cn(
                            "border-line h-9 cursor-cell border-r border-b whitespace-nowrap select-none",
                            column.edit === "method" && !readOnly ? "px-1" : "px-3",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right font-mono",
                            selected ? "bg-lime/25" : "bg-paper",
                            (isFocus || isEditing) && "ring-forest ring-2 ring-inset",
                          )}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {(["start", "end"] as const).map((handle) => (
            <div
              key={handle}
              ref={handle === "start" ? startHandle : endHandle}
              onPointerDown={(event) => onHandlePointerDown(event, handle)}
              aria-hidden
              style={{ display: "none" }}
              className="absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none place-items-center"
            >
              <span className="bg-forest h-3.5 w-3.5 rounded-full shadow-sm ring-2 ring-white" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function selectionSize(range: Range) {
  const rows = range.bottom - range.top + 1;
  const cols = range.right - range.left + 1;
  if (rows === 1 && cols === 1) return "1 cell";
  return `${rows} ${rows === 1 ? "row" : "rows"} × ${cols} ${cols === 1 ? "column" : "columns"}`;
}

function copiedMessage(range: Range) {
  const cells = (range.bottom - range.top + 1) * (range.right - range.left + 1);
  return `Copied ${cells} ${cells === 1 ? "cell" : "cells"}. Paste into Excel or Google Sheets.`;
}
