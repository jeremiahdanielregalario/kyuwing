"use client";

import { formatTimeRange, time12 } from "@/lib/datetime";
import * as React from "react";
import { AlertCircle, Check, ClipboardPaste, Loader2, Trash2 } from "lucide-react";
import { checkSignupText } from "@/lib/actions/signup-text";
import type { SignupCheck, SignupTexts } from "@/lib/signup-check";
import { removeLine, rewriteLine, type ResolvedLine, type SignupList } from "@/lib/signup-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MEMBERS_EXAMPLE = `Official Game Day (DASC)
Nov 16, 2026; Monday
11AM - 4PM

1. QM: Roniel
2. FIN: Ivana
3. Jess
4. Harry
5-20. APPS`;

const APPLICANTS_EXAMPLE = `Official Game Day (DASC)
Nov 16, 2026; Monday
11AM - 3PM

1. Clyde Abella
2. Matt Dela Cruz
3-20. MEMALUMNS`;

export const EMPTY_SIGNUP_TEXTS: SignupTexts = { members: "", applicants: "" };

/**
 * Paste boxes for the Messenger sign-up lists: one for members and alumni (official
 * nicknames), one for applicants ("Nickname Surname"). They are checked as they are typed or
 * pasted, and the panel shows what has to change. Fixes rewrite the pasted text itself, so
 * the text stays the single source.
 */
export function SignupTextPanel({
  texts,
  onTextsChange,
  gameDayId,
  onChecked,
}: {
  texts: SignupTexts;
  onTextsChange: (texts: SignupTexts) => void;
  /** Check against a game day, to show who is already signed up. */
  gameDayId?: string;
  onChecked?: (check: SignupCheck | null) => void;
}) {
  // Both lists as one string, to tell whether a finished check is still current.
  const text = texts.applicants.trim() ? `${texts.members}\u0000${texts.applicants}` : texts.members;
  const { members, applicants } = texts;
  const setList = (list: SignupList, value: string) => onTextsChange({ ...texts, [list]: value });
  // The latest finished check, with the text it was for.
  const [result, setResult] = React.useState<{
    text: string;
    check: SignupCheck | null;
    error: string | null;
  } | null>(null);
  const latest = React.useRef(0);
  const onCheckedRef = React.useRef(onChecked);
  React.useEffect(() => {
    onCheckedRef.current = onChecked;
  });

  // Check shortly after the text stops changing.
  React.useEffect(() => {
    const ticket = ++latest.current;
    if (!text.trim()) {
      onCheckedRef.current?.(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await checkSignupText({ members, applicants }, gameDayId);
      if (ticket !== latest.current) return;
      const check = response.ok && response.data ? response.data : null;
      setResult({ text, check, error: response.ok ? null : response.error });
      onCheckedRef.current?.(check);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [text, members, applicants, gameDayId]);

  const shown = text.trim() ? result : null;
  const check = shown?.check ?? null;
  const error = shown?.error ?? null;
  const checking = Boolean(text.trim()) && result?.text !== text;

  const problems = check ? check.lines.filter((line) => !line.waitlist && line.status !== "ok") : [];
  const fullNameFixes = problems.filter((line) => line.status === "suggest");
  const confirmed = check ? check.lines.filter((line) => !line.waitlist) : [];
  const waitlisted = check ? check.lines.filter((line) => line.waitlist) : [];
  const viaAlias = confirmed.filter((line) => line.status === "ok" && line.viaAlias);
  const memberCount = confirmed.filter((line) => line.list === "members").length;
  const applicantCount = confirmed.length - memberCount;

  const fixAll = () => {
    // Rewriting keeps line numbers, so the fixes can be applied one after another.
    const fix = (list: SignupList) =>
      fullNameFixes
        .filter((line) => line.list === list)
        .reduce((current, line) => rewriteLine(current, line, line.nickname!), texts[list]);
    onTextsChange({ members: fix("members"), applicants: fix("applicants") });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold">Members &amp; alumni list</span>
          <Textarea
            value={members}
            onChange={(event) => setList("members", event.target.value)}
            placeholder={MEMBERS_EXAMPLE}
            rows={9}
            className="font-mono text-[12px]"
            spellCheck={false}
          />
          <span className="text-muted mt-1 block text-[11px]">
            By official nickname, e.g. &ldquo;Jess&rdquo;.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold">Applicants list</span>
          <Textarea
            value={applicants}
            onChange={(event) => setList("applicants", event.target.value)}
            placeholder={APPLICANTS_EXAMPLE}
            rows={9}
            className="font-mono text-[12px]"
            spellCheck={false}
          />
          <span className="text-muted mt-1 block text-[11px]">
            By nickname and surname, e.g. &ldquo;Matt Dela Cruz&rdquo;.
          </span>
        </label>
      </div>
      <p className="text-muted text-[11px] leading-relaxed">
        Paste each list from Messenger as is; either box can stay empty. Every name has to be the
        player&apos;s <span className="text-ink font-semibold">official nickname</span> from the player
        database, one of the other names saved for them (like &ldquo;LA&rdquo; for Ian LA), or on the
        applicants list their nickname and surname. Lines like &ldquo;18-43. MEMALUMNS&rdquo; are skipped.
        Full names, @ mentions and typos are flagged below.
      </p>

      {text.trim() && (
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-3 text-[12px]",
            error
              ? "border-coral/30 bg-coral-soft text-[#a8331a]"
              : check?.ready
                ? "border-emerald-300/60 bg-emerald-50 text-emerald-900"
                : "border-gold/60 bg-gold/15",
          )}
          aria-live="polite"
        >
          {error ? (
            error
          ) : !check ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the list…
            </span>
          ) : (
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 font-semibold">
                {check.ready ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {confirmed.length} {confirmed.length === 1 ? "name" : "names"}
                {applicantCount > 0 &&
                  ` (${memberCount} members & alumni, ${applicantCount} applicants)`} ·{" "}
                {check.ready
                  ? "all official nicknames. Ready."
                  : `${problems.length} ${problems.length === 1 ? "needs" : "need"} fixing before you can continue`}
                {checking && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>
              {check.header.title && (
                <p className="text-muted">
                  {check.header.title}
                  {check.header.date && ` · ${check.header.date}`}
                  {check.header.start &&
                    ` · ${check.header.end ? formatTimeRange(check.header.start, check.header.end) : time12(check.header.start)}`}
                  {check.header.venueShort && !check.header.venueId && (
                    <span className="text-coral font-semibold">
                      {" "}
                      · venue &ldquo;{check.header.venueShort}&rdquo; not found, pick one yourself
                    </span>
                  )}
                </p>
              )}
              {check.headerMismatch && <p className="text-coral font-semibold">{check.headerMismatch}</p>}
              {viaAlias.length > 0 && (
                <p className="text-muted">
                  Read as nicknames: {viaAlias.map((line) => `${line.name} → ${line.nickname}`).join(", ")}.
                </p>
              )}
              {waitlisted.length > 0 && (
                <p className="text-muted">
                  {waitlisted.length} on the waitlist {waitlisted.length === 1 ? "is" : "are"} skipped.
                </p>
              )}
              {check.alreadyOnList.length > 0 && (
                <p className="text-muted">
                  {check.alreadyOnList.length} already signed up for this game day.
                </p>
              )}
              {check.inactive.length > 0 && (
                <p className="text-muted">
                  Archived in the player database, still added: {check.inactive.join(", ")}.
                </p>
              )}
              {check.ignored.length > 0 && (
                <p className="text-muted">Skipped text: {check.ignored.slice(0, 3).join(" · ")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {check && problems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold tracking-[0.14em] uppercase">To fix</h3>
            {fullNameFixes.length > 1 && (
              <Button size="sm" variant="paper" onClick={fixAll}>
                Use nicknames for all {fullNameFixes.length} full names
              </Button>
            )}
          </div>
          <ul className="border-line divide-line/60 divide-y overflow-hidden rounded-2xl border bg-white">
            {problems.map((line) => (
              <ProblemRow
                key={`${line.list}-${line.lineIndex}-${line.name}`}
                line={line}
                onUse={(nickname) => setList(line.list, rewriteLine(texts[line.list], line, nickname))}
                onRemove={() => setList(line.list, removeLine(texts[line.list], line))}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProblemRow({
  line,
  onUse,
  onRemove,
}: {
  line: ResolvedLine;
  onUse: (nickname: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="text-muted w-6 font-mono text-[10px] font-bold">{line.number}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {line.list === "applicants" && (
            <span className="text-muted mr-1.5 text-[10px] font-bold uppercase">Applicants</span>
          )}
          {line.role && (
            <span className="text-muted mr-1.5 text-[10px] font-bold uppercase">{line.role}</span>
          )}
          {line.name}
        </p>
        <p className="text-muted text-[11px]">
          {line.status === "suggest"
            ? "That's a full name, not the official nickname."
            : line.status === "duplicate"
              ? "Already listed above."
              : line.list === "applicants"
                ? "No player with that nickname and surname."
                : "Not an official nickname."}
          {line.status === "unknown" &&
            line.suggestions.length === 0 &&
            (line.list === "applicants"
              ? " Add them in Players first (category Applicant, full name with their surname), or fix the spelling."
              : " Add them in Players first, or fix the spelling.")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {line.suggestions.map((nickname) => (
          <Button key={nickname} size="sm" variant="primary" onClick={() => onUse(nickname)}>
            Use &ldquo;{nickname}&rdquo;
          </Button>
        ))}
        {line.status === "duplicate" && (
          <Button size="sm" variant="paper" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" /> Remove line
          </Button>
        )}
      </div>
    </li>
  );
}

/** Small label for the form: where the paste box sits. */
export function PasteListHeading() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ClipboardPaste className="h-3.5 w-3.5" /> Paste the Messenger list
    </span>
  );
}
