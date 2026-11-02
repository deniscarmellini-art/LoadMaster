/** Read the browser's native input buffer without normalizing or rebuilding QR text. */
export function readCollectorText(input: Pick<HTMLInputElement, "value"> | null | undefined): string {
  return input?.value ?? "";
}

/** Clear the native buffer after consumption or an explicit dialog close. */
export function clearCollectorText(input: Pick<HTMLInputElement, "value"> | null | undefined): void {
  if (input) input.value = "";
}
