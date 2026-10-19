/** Read archived values only: reprints must keep the identity of the issued DDT. */
export function ddtDownloadName(snapshotJson: string): string {
  let data: {model?:{order?:unknown;truck?:unknown;customer?:unknown};load?:{commessa?:unknown;camion?:unknown;cliente?:unknown};customer?:{denominazione?:unknown}} = {};
  try { data = JSON.parse(snapshotJson)?.data ?? {}; } catch { /* Legacy snapshot: use explicit fallbacks. */ }
  const part = (value: unknown, fallback: string): string => {
    const clean = (typeof value === "string" || typeof value === "number" ? String(value) : "")
      .normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "-").trim().replace(/[. ]+$/g, "");
    const bounded = Array.from(clean).slice(0, 40).join("").replace(/[. ]+$/g, "");
    if (!bounded || /^\.+$/.test(bounded)) return fallback;
    return /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(bounded) ? `_${bounded}` : bounded;
  };
  return [part(data.model?.order ?? data.load?.commessa, "Commessa"),
    part(data.model?.truck ?? data.load?.camion, "Camion"),
    part(data.model?.customer ?? data.load?.cliente ?? data.customer?.denominazione, "Cliente")].join("_") + ".pdf";
}

export function ddtContentDisposition(snapshotJson: string, attachment = false): string {
  const name = ddtDownloadName(snapshotJson);
  const ascii = name.replace(/[^\x20-\x7e]/g, "-");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${attachment ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
