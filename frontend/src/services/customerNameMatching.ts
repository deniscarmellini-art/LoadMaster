/** Suggestions only: this does not change registry data or DDT validation. */
export function customerNameKey(name: string): string {
  let words = name.toLocaleLowerCase("it-IT").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const suffix = /(?:^|\s)(?:s\s*r\s*l\s*s?|s\s*p\s*a|s\s*a\s*s|s\s*n\s*c|s\s*c\s*a\s*r\s*l|societa\s+cooperativa|soc\s+coop)$/u;
  while (suffix.test(words)) words = words.replace(suffix, "").trim();
  return words.replace(/\s+/gu, "");
}

type NamedCustomer = { id: string; denominazione: string; partitaIva?: string; codiceFiscale?: string };
export function searchCustomers<T extends NamedCustomer>(items: readonly T[], query: string): T[] {
  const key = customerNameKey(query);
  if (!key) return [...items];
  const rank = (item: T) => {
    const name = customerNameKey(item.denominazione);
    if (name === key) return 0;
    if (name.startsWith(key)) return 1;
    if (name.includes(key)) return 2;
    return [item.partitaIva, item.codiceFiscale].some(value => value && customerNameKey(value).includes(key)) ? 3 : 4;
  };
  return items.filter(item => rank(item) < 4).sort((a, b) => rank(a) - rank(b) || a.denominazione.localeCompare(b.denominazione, "it"));
}

export function proposeCustomer<T extends NamedCustomer>(items: readonly T[], name: string): T | null {
  const key = customerNameKey(name);
  if (!key) return null;
  const matches = searchCustomers(items, name);
  return matches.length === 1 && customerNameKey(matches[0]!.denominazione) === key ? matches[0]! : null;
}
