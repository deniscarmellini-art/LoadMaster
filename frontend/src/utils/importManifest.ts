interface ManifestPanel {
  numeroPannello: string;
  loadStatus?: string;
  spedito?: boolean;
}

// A later operational manifest can omit shipped history. Truck reassignment
// does not change element identity; explicit shipped conflicts are checked by API.
export const findRemovedOperationalPanels = <T extends ManifestPanel>(
  existing: readonly T[],
  incoming: readonly Pick<ManifestPanel, "numeroPannello">[],
): T[] => {
  const incomingKeys = new Set(incoming.map(panel => panel.numeroPannello.trim()));
  return existing.filter(panel =>
    panel.loadStatus !== "SPEDITO" && !panel.spedito &&
    !incomingKeys.has(panel.numeroPannello.trim()),
  );
};
