"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Download,
  FileJson,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPlayer,
  deletePlayer,
  importPlayers,
  togglePlayerActive,
  updatePlayer,
} from "@/lib/actions/players";
import { CATEGORY_SHORT } from "@/lib/fees";
import { LEVELS, levelLabel, levelValue } from "@/lib/levels";
import type { RecencySnapshot } from "@/lib/recency";
import { RecencyBadge, recencyCaption } from "@/components/app/recency-panel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type PlayerRecord = {
  id: string;
  nickname: string;
  fullName: string | null;
  level: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | "NON_AFFILIATE";
  contact: string | null;
  notes: string | null;
  active: boolean;
};

type FormState = {
  id?: string;
  nickname: string;
  fullName: string;
  level: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | "NON_AFFILIATE";
  contact: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  nickname: "",
  fullName: "",
  level: "C",
  category: "ACTIVE",
  contact: "",
  notes: "",
};

type ImportSummary = { created: number; updated: number; total: number; errors: string[] };
type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

type SortKey = "nickname" | "level" | "category" | "contact" | "status" | "recency";
type SortDir = "asc" | "desc";

const CATEGORY_ORDER: Record<string, number> = {
  ACTIVE: 0,
  INACTIVE: 1,
  ALUMNI: 2,
  APPLICANT: 3,
  NON_AFFILIATE: 4,
};

export function PlayerManager({
  players,
  recency,
}: {
  players: PlayerRecord[];
  recency: Record<string, RecencySnapshot>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [query, setQuery] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [sortKey, setSortKey] = React.useState<SortKey>("nickname");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [importOpen, setImportOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [importResult, setImportResult] = React.useState<ImportSummary | null>(null);

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const filtered = players
    .filter((player) => {
      if (statusFilter === "active") return player.active;
      if (statusFilter === "archived") return !player.active;
      return true;
    })
    .filter((player) => levelFilter === "ALL" || player.level === levelFilter)
    .filter((player) => categoryFilter === "ALL" || player.category === categoryFilter)
    .filter((player) => {
      const haystack =
        `${player.nickname} ${player.fullName ?? ""} ${player.contact ?? ""} ${player.notes ?? ""} ${levelLabel(player.level)}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "level":
          diff = levelValue(a.level) - levelValue(b.level);
          break;
        case "category":
          diff = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
          break;
        case "contact":
          diff = (a.contact ?? "").localeCompare(b.contact ?? "", undefined, { sensitivity: "base" });
          break;
        case "status":
          // Active players first when ascending.
          diff = Number(b.active) - Number(a.active);
          break;
        case "recency":
          diff = (recency[a.id]?.score ?? -1) - (recency[b.id]?.score ?? -1);
          break;
        default:
          diff = a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
      }
      if (diff === 0) diff = a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? diff : -diff;
    });

  const filtersActive =
    query.trim() !== "" || levelFilter !== "ALL" || categoryFilter !== "ALL" || statusFilter !== "active";

  const clearFilters = () => {
    setQuery("");
    setLevelFilter("ALL");
    setCategoryFilter("ALL");
    setStatusFilter("active");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Recency is most useful hottest-first; the rest read naturally A→Z.
      setSortDir(key === "recency" ? "desc" : "asc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (player: PlayerRecord) => {
    setForm({
      id: player.id,
      nickname: player.nickname,
      fullName: player.fullName ?? "",
      level: player.level,
      category: player.category,
      contact: player.contact ?? "",
      notes: player.notes ?? "",
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!form.nickname.trim()) {
      toast.error("Nickname is required.");
      return;
    }
    const payload = {
      nickname: form.nickname.trim(),
      fullName: form.fullName.trim() || null,
      level: form.level as (typeof LEVELS)[number]["key"],
      category: form.category,
      contact: form.contact.trim() || null,
      notes: form.notes.trim() || null,
    };
    startTransition(async () => {
      const result = form.id ? await updatePlayer(form.id, payload) : await createPlayer(payload);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        setFormOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const submitImport = () => {
    if (!file) {
      toast.error("Choose a CSV or JSON file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await importPlayers(formData);
      if (result.ok) {
        setImportResult(result.data ?? null);
        toast.success(result.message ?? "Import finished.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="border-line bg-paper flex flex-wrap items-center gap-2 rounded-2xl border p-3">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nickname, name, contact…"
            className="h-9 pl-8 text-[12px]"
          />
        </div>
        <Select
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
          className="h-9 w-auto min-w-[7rem] text-[12px]"
        >
          <option value="ALL">All levels</option>
          {LEVELS.map((level) => (
            <option key={level.key} value={level.key}>
              {level.label}
            </option>
          ))}
        </Select>
        <Select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-9 w-auto min-w-[8rem] text-[12px]"
        >
          <option value="ALL">All player types</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALUMNI">Alumni</option>
          <option value="APPLICANT">Applicant</option>
          <option value="NON_AFFILIATE">Non-affiliate</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 w-auto min-w-[7rem] text-[12px]"
        >
          <option value="active">Active only</option>
          <option value="archived">Archived</option>
          <option value="all">Everyone</option>
        </Select>
        <div className="flex items-center gap-1">
          <Select
            value={sortKey}
            onChange={(event) => {
              const next = event.target.value as SortKey;
              setSortKey(next);
              setSortDir(next === "recency" ? "desc" : "asc");
            }}
            className="h-9 w-auto min-w-[8.5rem] text-[12px]"
            aria-label="Sort players by"
          >
            <option value="nickname">Sort: Name</option>
            <option value="level">Sort: Level</option>
            <option value="category">Sort: Type</option>
            <option value="contact">Sort: Contact</option>
            <option value="status">Sort: Status</option>
            <option value="recency">Sort: Recency</option>
          </Select>
          <button
            type="button"
            onClick={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
            className="border-line text-muted hover:bg-cream-deep hover:text-ink grid h-9 w-9 place-items-center rounded-lg border transition"
            title={
              sortDir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"
            }
            aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
          >
            {sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
        </div>
        {filtersActive && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <a href="/api/players/export?template=1" className="inline-flex">
            <Button size="sm" variant="ghost">
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
          </a>
          <a href="/api/players/export" className="inline-flex">
            <Button size="sm" variant="paper">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </a>
          <Button
            size="sm"
            variant="paper"
            onClick={() => {
              setImportOpen(true);
              setImportResult(null);
            }}
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button size="sm" onClick={openCreate}>
            <UserRoundPlus className="h-3.5 w-3.5" /> Add player
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-line/80 flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-display text-base font-bold">Player database</h2>
            <p className="text-muted text-[11px]">
              {filtered.length} of {players.length} players · 19 levels, E- to A+
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={statusFilter === "archived" ? "primary" : "outline"}
              onClick={() => setStatusFilter(statusFilter === "archived" ? "active" : "archived")}
            >
              <Archive className="h-3.5 w-3.5" /> {statusFilter === "archived" ? "Hide archive" : "Show archive"}
            </Button>
            <span className="text-muted inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
              <Users className="h-3.5 w-3.5" /> UP BadAss roster
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No players match this view"
              description="Adjust the filters, or add a new player to the database."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" /> Add player
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead>
                <tr className="border-line bg-cream/50 text-muted border-b text-[9px] tracking-[0.12em] uppercase">
                  <th className="px-4 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("nickname")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Player {sortIcon("nickname")}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("level")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Level {sortIcon("level")}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("category")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Type {sortIcon("category")}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("contact")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Contact {sortIcon("contact")}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Status {sortIcon("status")}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSort("recency")}
                      className="hover:text-ink inline-flex items-center gap-1 font-bold uppercase transition"
                    >
                      Recency {sortIcon("recency")}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr key={player.id} className="border-line/50 hover:bg-cream/30 border-b transition">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={player.nickname} level={levelLabel(player.level)} />
                        <div className="min-w-0">
                          <p className="font-semibold">{player.nickname}</p>
                          <p className="text-muted truncate text-[10px]">
                            {player.fullName ?? "No full name"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <LevelBadge level={player.level} />
                    </td>
                    <td className="text-muted px-2 py-2.5 text-[11px]">{CATEGORY_SHORT[player.category]}</td>
                    <td className="text-muted px-2 py-2.5 text-[11px]">{player.contact ?? "—"}</td>
                    <td className="px-2 py-2.5">
                      {player.active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Archived</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col items-start gap-0.5">
                        <RecencyBadge snapshot={recency[player.id]} />
                        {recencyCaption(recency[player.id]) && (
                          <span className="text-muted font-mono text-[9px]">
                            {recencyCaption(recency[player.id])}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(player)}
                          className="text-muted hover:bg-cream-deep hover:text-ink grid h-7 w-7 place-items-center rounded-full transition"
                          aria-label={`Edit ${player.nickname}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => act(() => togglePlayerActive(player.id, !player.active))}
                          disabled={pending}
                          className="text-muted hover:bg-cream-deep hover:text-ink grid h-7 w-7 place-items-center rounded-full transition"
                          aria-label={
                            player.active ? `Archive ${player.nickname}` : `Reactivate ${player.nickname}`
                          }
                        >
                          {player.active ? (
                            <Archive className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmSpec({
                              title: `Delete ${player.nickname}?`,
                              description:
                                "Players with games on record are archived instead so fees stay correct.",
                              confirmLabel: "Delete player",
                              cancelLabel: "Keep player",
                              tone: "danger",
                              onConfirm: () => act(() => deletePlayer(player.id)),
                            });
                          }}
                          disabled={pending}
                          className="text-muted hover:bg-coral-soft hover:text-coral grid h-7 w-7 place-items-center rounded-full transition"
                          aria-label={`Delete ${player.nickname}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit player" : "Add player"}
        description="Levels run from E- (beginner) to A+ (open). Player type controls the fee rate."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} loading={pending}>
              <Check className="h-4 w-4" /> {form.id ? "Save player" : "Add player"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nickname">
              <Input
                value={form.nickname}
                onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                placeholder="e.g. Jose"
                maxLength={30}
                autoFocus
              />
            </Field>
            <Field label="Full name (optional)">
              <Input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Jose Maria Santos"
                maxLength={80}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <Select
                value={form.level}
                onChange={(event) => setForm({ ...form, level: event.target.value })}
              >
                {LEVELS.map((level) => (
                  <option key={level.key} value={level.key}>
                    {level.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Player type">
              <Select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value as FormState["category"] })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ALUMNI">Alumni</option>
                <option value="APPLICANT">Applicant</option>
                <option value="NON_AFFILIATE">Non-affiliate</option>
              </Select>
            </Field>
          </div>
          <Field label="Contact (optional)" hint="Phone number, Messenger handle, or anything the org uses.">
            <Input
              value={form.contact}
              onChange={(event) => setForm({ ...form, contact: event.target.value })}
              maxLength={60}
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={2}
              maxLength={300}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import players"
        description="Upload CSV or JSON. Matching nicknames are updated; new ones are added."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            <Button onClick={submitImport} loading={pending} disabled={!file}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label
            className={cn(
              "border-line-strong bg-cream/40 hover:border-forest/40 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
              file && "border-forest/40 bg-lime/10",
            )}
          >
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setImportResult(null);
              }}
            />
            {file ? <FileJson className="text-forest h-7 w-7" /> : <Upload className="text-muted h-7 w-7" />}
            <p className="mt-2 text-[13px] font-semibold">{file ? file.name : "Choose a CSV or JSON file"}</p>
            <p className="text-muted text-[11px]">Up to 500 players · 2 MB max</p>
          </label>

          <div className="border-line bg-paper text-muted rounded-xl border p-3 text-[11px]">
            <p className="text-ink font-semibold">CSV columns</p>
            <p className="mt-1 font-mono text-[10px]">nickname, fullName, level, category, contact, notes</p>
            <p className="mt-1">
              Level accepts E-, E, E+, DE, D-, … A+. Category accepts Active, Inactive, Alumni, Applicant, or
              Non-affiliate. Header names are flexible.
            </p>
          </div>

          {importResult && (
            <div className="border-line bg-cream/50 rounded-xl border p-3 text-[11px]">
              <p className="font-semibold">
                {importResult.created} added · {importResult.updated} updated · {importResult.total} rows
              </p>
              {importResult.errors.length > 0 && (
                <ul className="text-coral mt-2 list-disc space-y-0.5 pl-4">
                  {importResult.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <a
            href="/api/players/export?template=1"
            className="text-forest inline-flex items-center gap-1.5 text-[11px] font-semibold hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download the CSV template
          </a>
        </div>
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}
