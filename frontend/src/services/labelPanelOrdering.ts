export interface LabelPanelOrderFields {
  numeroMasterPanel: string | number;
  numeroPannello: string | number;
}

const numericCollator = new Intl.Collator("it-IT", { numeric: true, sensitivity: "base" });

/** Natural numeric order, with element number as a stable secondary key. */
export function compareLabelPanels<T extends LabelPanelOrderFields>(left: T, right: T): number {
  return numericCollator.compare(String(left.numeroMasterPanel), String(right.numeroMasterPanel))
    || numericCollator.compare(String(left.numeroPannello), String(right.numeroPannello));
}

export function sortLabelPanels<T extends LabelPanelOrderFields>(panels: readonly T[]): T[] {
  return panels
    .map((panel, index) => ({ panel, index }))
    .sort((left, right) => compareLabelPanels(left.panel, right.panel) || left.index - right.index)
    .map(({ panel }) => panel);
}

export function numericMasterPanel(value: string | number): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function masterPanelBounds<T extends LabelPanelOrderFields>(panels: readonly T[]): { min: number; max: number } | null {
  const values = panels
    .map(panel => numericMasterPanel(panel.numeroMasterPanel))
    .filter((value): value is number => value !== null);
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

export function labelPanelIndexesInRange<T extends LabelPanelOrderFields>(
  panels: readonly T[],
  from: number,
  to: number,
): number[] {
  return panels.flatMap((panel, index) => {
    const masterPanel = numericMasterPanel(panel.numeroMasterPanel);
    return masterPanel !== null && masterPanel >= from && masterPanel <= to ? [index] : [];
  });
}
