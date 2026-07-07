// plainto_tsquery/websearch_to_tsquery both AND every word together, so a
// multi-word natural-language question almost never matches a short code
// chunk in full — verified empirically: real questions returned 0 FTS rows
// while the single word "geocode" alone returned 31. OR'ing the words via
// to_tsquery instead makes a match on ANY word count, turning ftsCount back
// into a meaningful "no keyword overlap at all" signal.
export function buildOrTsQuery(text: string): string {
  const words = text.match(/[a-zA-Z0-9]+/g) ?? [];
  return words.join(' | ');
}
