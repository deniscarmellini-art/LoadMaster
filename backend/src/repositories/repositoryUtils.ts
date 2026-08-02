export const booleanFromDatabase = (value: unknown): boolean => value === 1;

export const requiredString = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Campo database non valido: ${key}`);
  return value;
};

export const requiredNumber = (row: Record<string, unknown>, key: string): number => {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Campo database non valido: ${key}`);
  return value;
};
