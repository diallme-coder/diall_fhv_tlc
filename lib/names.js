// TLC lists names as "LAST,FIRST,MIDDLE". Drivers type them in any order,
// so compare as sets of tokens: every token typed must appear in the listed name.

export function nameTokens(s) {
  return String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function nameMatches(typed, listed) {
  const a = nameTokens(typed);
  if (a.length < 2) return false; // require at least first + last
  const b = new Set(nameTokens(listed));
  return a.every((t) => b.has(t));
}
