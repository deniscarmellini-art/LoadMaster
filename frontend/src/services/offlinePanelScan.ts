export interface OfflinePanelInput { line: number; raw: string; }
export interface OfflinePanelPreview extends OfflinePanelInput {
  code: string;
  status: "VALID" | "DUPLICATE" | "ERROR" | "REGISTERED";
  message: string;
}

export function parseOfflinePanelLines(text: string): OfflinePanelInput[] {
  return text.split(/\r\n|\r|\n/).map(raw => raw.trim()).filter(Boolean).map((raw, index) => ({ line: index + 1, raw }));
}

export function buildOfflinePanelPreview(
  text: string,
  validate: (raw: string) => { code?: string; duplicateKey?: string; error?: string },
): OfflinePanelPreview[] {
  const seen = new Set<string>();
  return parseOfflinePanelLines(text).map(input => {
    const result = validate(input.raw);
    if (result.error) return { ...input, code: result.code ?? "—", status: "ERROR", message: result.error };
    if (result.duplicateKey && seen.has(result.duplicateKey)) {
      return { ...input, code: result.code ?? "—", status: "DUPLICATE", message: "QR duplicato nel testo importato" };
    }
    if (result.duplicateKey) seen.add(result.duplicateKey);
    return { ...input, code: result.code ?? "—", status: "VALID", message: "Pronto per la registrazione" };
  });
}
