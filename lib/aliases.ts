import { nameKey } from "./attendance";

/**
 * Other names a player signs up with in the Messenger chat ("LA" for "Ian LA", "Chris" for
 * "XB"). They are matched like the nickname wherever chat lists are read, so a list using
 * them needs no fixing. Pure, so it is unit-tested.
 */

export const ALIAS_MAX_LENGTH = 60;
export const ALIASES_MAX = 10;

/** "LA, Ian L.A." → ["LA", "Ian L.A."]: split on commas or new lines, trimmed. */
export function parseAliases(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/** Aliases without repeats (ignoring case) and without the nickname itself. */
export function cleanAliases(nickname: string, aliases: string[]): string[] {
  const seen = new Set([nameKey(nickname)]);
  const result: string[] = [];
  for (const alias of aliases) {
    const value = alias.trim().replace(/\s+/g, " ");
    const key = nameKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

/**
 * The first alias that would make a name ambiguous: it is another player's nickname or one of
 * their aliases. Null when every alias is free.
 */
export function aliasConflict(
  aliases: string[],
  others: Array<{ nickname: string; aliases: string[] }>,
): { alias: string; owner: string; asNickname: boolean } | null {
  const owners = new Map<string, { owner: string; asNickname: boolean }>();
  for (const other of others) {
    for (const alias of other.aliases)
      owners.set(nameKey(alias), { owner: other.nickname, asNickname: false });
  }
  for (const other of others)
    owners.set(nameKey(other.nickname), { owner: other.nickname, asNickname: true });
  for (const alias of aliases) {
    const found = owners.get(nameKey(alias));
    if (found) return { alias, ...found };
  }
  return null;
}

/**
 * The other names to save when the queue master picks a nickname for a name written in a
 * Messenger list, so the same name is recognised next time. A name that is already that
 * player's nickname or other name is left out, and so is one that belongs to someone else
 * (it would make the name ambiguous), one that is too long, or one past the limit.
 * Returns, per nickname, the full new list of other names.
 */
export function learnedAliases(
  picks: Array<{ name: string; nickname: string }>,
  players: Array<{ nickname: string; aliases: string[] }>,
): {
  updates: Map<string, string[]>;
  saved: Array<{ name: string; nickname: string }>;
  skipped: Array<{ name: string; nickname: string; reason: string }>;
} {
  const updates = new Map<string, string[]>();
  const saved: Array<{ name: string; nickname: string }> = [];
  const skipped: Array<{ name: string; nickname: string; reason: string }> = [];
  const current = (nickname: string) =>
    updates.get(nickname) ?? players.find((player) => player.nickname === nickname)?.aliases ?? [];
  for (const pick of picks) {
    const name = pick.name
      .trim()
      .replace(/^@+\s*/, "")
      .replace(/\s+/g, " ");
    const owner = players.find((player) => player.nickname === pick.nickname);
    if (!owner || !name) continue;
    const mine = current(owner.nickname);
    if (nameKey(name) === nameKey(owner.nickname) || mine.some((alias) => nameKey(alias) === nameKey(name)))
      continue;
    if (name.length > ALIAS_MAX_LENGTH) {
      skipped.push({ ...pick, reason: "too long" });
      continue;
    }
    if (mine.length >= ALIASES_MAX) {
      skipped.push({ ...pick, reason: `already has ${ALIASES_MAX} other names` });
      continue;
    }
    const others = players
      .filter((player) => player.nickname !== owner.nickname)
      .map((player) => ({ nickname: player.nickname, aliases: current(player.nickname) }));
    const conflict = aliasConflict([name], others);
    if (conflict) {
      skipped.push({ ...pick, reason: `already used by ${conflict.owner}` });
      continue;
    }
    updates.set(owner.nickname, [...mine, name]);
    saved.push({ name, nickname: owner.nickname });
  }
  return { updates, saved, skipped };
}

/**
 * Looks a chat name up by alias. An official nickname always wins over an alias, so callers
 * check nicknames first; an alias two players share matches nobody.
 */
export function aliasIndex<T>(players: Array<{ aliases?: string[] | null; value: T }>): Map<string, T> {
  const index = new Map<string, T>();
  const shared = new Set<string>();
  for (const player of players) {
    for (const alias of player.aliases ?? []) {
      const key = nameKey(alias);
      if (index.has(key) && index.get(key) !== player.value) shared.add(key);
      else index.set(key, player.value);
    }
  }
  for (const key of shared) index.delete(key);
  return index;
}
