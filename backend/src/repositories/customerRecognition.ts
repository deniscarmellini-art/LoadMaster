import type { DatabaseSync } from "node:sqlite";

// Only case and redundant whitespace are ignored. Punctuation, accents and words remain significant.
export const customerNameKey = (name: string) => name.trim().replace(/\s+/gu, " ").toLocaleLowerCase("it-IT");
export function recognizeCustomer(db: DatabaseSync, name: string): { customerId: string | null; status: "UNIQUE" | "NONE" | "AMBIGUOUS" } {
  const key = customerNameKey(name);
  const matches = key ? (db.prepare("SELECT id,denominazione FROM Customers").all() as {id:string;denominazione:string}[])
    .filter(customer => customerNameKey(customer.denominazione) === key) : [];
  return { customerId: matches.length === 1 ? matches[0]!.id : null,
    status: matches.length === 1 ? "UNIQUE" : matches.length ? "AMBIGUOUS" : "NONE" };
}
