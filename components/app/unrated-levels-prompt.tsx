"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setPlayerLevels } from "@/lib/actions/gamedays";
import type { BoardPlayer } from "@/lib/board-types";
import { CATEGORY_SHORT } from "@/lib/fees";
import { haptic } from "@/lib/haptics";
import { LEVELS } from "@/lib/levels";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/**
 * Asks the queue master for real levels of players still marked X (not rated yet).
 * X players are never auto-paired and their games cannot start, so this opens by
 * itself when one is on the game day. Levels left blank stay X.
 */
export function UnratedLevelsPrompt({
  open,
  onClose,
  gameDayId,
  players,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  gameDayId: string;
  players: BoardPlayer[];
  onSaved: () => void;
}) {
  const [levels, setLevels] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const chosen = players.filter((player) => levels[player.playerId]);

  const save = () => {
    startTransition(async () => {
      const result = await setPlayerLevels(
        gameDayId,
        chosen.map((player) => ({ playerId: player.playerId, level: levels[player.playerId] })),
      );
      if (!result.ok) {
        haptic("warning");
        toast.error(result.error);
        return;
      }
      haptic("success");
      toast.success(result.message ?? "Levels saved.");
      setLevels({});
      onSaved();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={players.length === 1 ? "Set this player's level" : `Set levels for ${players.length} players`}
      description="X means their official level is not known yet. They are not auto-paired, and their games can't start until they have a level. Watch a rally, then pick the closest one."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button onClick={save} loading={pending} disabled={chosen.length === 0}>
            <Check className="h-4 w-4" />
            {chosen.length > 1 ? `Save ${chosen.length} levels` : "Save level"}
          </Button>
        </>
      }
    >
      <ul className="divide-line/60 divide-y">
        {players.map((player) => (
          <li key={player.playerId} className="flex items-center gap-3 py-2.5">
            <Avatar name={player.nickname} level={player.levelLabel} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{player.nickname}</p>
              <p className="text-muted text-[10px]">
                {CATEGORY_SHORT[player.category]} · {player.status === "EXPECTED" ? "expected" : "checked in"}
              </p>
            </div>
            <Select
              value={levels[player.playerId] ?? ""}
              onChange={(event) => setLevels((prev) => ({ ...prev, [player.playerId]: event.target.value }))}
              aria-label={`Level for ${player.nickname}`}
              className="h-10 w-28 text-[13px]"
            >
              <option value="">X (not yet)</option>
              {LEVELS.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.label}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
