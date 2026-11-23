export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A count with its noun in the matching number: `1 trajectory`, `2 trajectories`. */
export function countOf(count: number, noun: string) {
  if (count === 1) return `${count} ${noun}`;
  return `${count} ${noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`}`;
}
