export interface PackageIdReference { current: string | undefined; }

/** Reuses the open package or creates it atomically with its first panel. */
export async function registerPanelInActivePackage<T extends { id: string }>(input: {
  packageId: PackageIdReference;
  loadId: string | undefined;
  operatorId: string;
  panelId: string;
  create: (loadId: string, operatorId: string, panelId: string) => Promise<T>;
  add: (packageId: string, panelId: string, operatorId: string) => Promise<T>;
}): Promise<{ response: T; created: boolean }> {
  const currentId = input.packageId.current;
  if (currentId) {
    return { response: await input.add(currentId, input.panelId, input.operatorId), created: false };
  }
  if (!input.loadId) throw new Error("Carico non disponibile");
  const response = await input.create(input.loadId, input.operatorId, input.panelId);
  // Set synchronously so the next row in an offline batch is added to this package.
  input.packageId.current = response.id;
  return { response, created: true };
}
