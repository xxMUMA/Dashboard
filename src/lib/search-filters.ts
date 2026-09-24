export type SearchFilters = { include: string[]; exclude: string[] };

export function parseSearchFilters(includeInput: string, excludeInput: string): SearchFilters | null {
  if (includeInput.length > 300 || excludeInput.length > 300) return null;
  const parse = (value: string) => [...new Set(value.split(",").map(term => term.trim().replace(/\s+/g, " ")).filter(Boolean))];
  const include = parse(includeInput);
  const exclude = parse(excludeInput);
  if ([...include, ...exclude].some(term => term.length > 60) || include.length > 8 || exclude.length > 8) return null;
  return { include, exclude };
}

export function matchesSearchFilters(text: string, filters: SearchFilters) {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  return filters.include.every(term => normalized.includes(term.normalize("NFKC").toLocaleLowerCase())) &&
    filters.exclude.every(term => !normalized.includes(term.normalize("NFKC").toLocaleLowerCase()));
}
