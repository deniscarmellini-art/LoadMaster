/** Definitive DDT is enabled in the explicitly configured TEST app and production builds. */
export const definitiveDdtEnabled = (): boolean =>
  import.meta.env.VITE_SISLOG_TEST === true || import.meta.env.PROD === true;
