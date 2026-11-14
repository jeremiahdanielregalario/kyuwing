import { nameKey } from "./attendance";

/**
 * Other names a player signs up with in the Messenger chat ("LA" for "Ian LA", "Chris" for
 * "XB"). They are matched like the nickname wherever chat lists are read, so a list using
 * them needs no fixing. Pure, so it is unit-tested.
 */

export const ALIAS_MAX_LENGTH = 30;
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
