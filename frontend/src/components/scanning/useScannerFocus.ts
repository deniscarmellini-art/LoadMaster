import { useCallback, useEffect, useRef, type RefObject } from "react";

// A request expires or is cancelled by a new user interaction; it never traps focus.
export default function useScannerFocus(inputRef: RefObject<HTMLInputElement | null>) {
  const interaction = useRef(0);
  const frame = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => {
    const interrupt = () => { interaction.current++; cancel(); };
    document.addEventListener("pointerdown", interrupt, true);
    document.addEventListener("keydown", interrupt, true);
    return () => {
      document.removeEventListener("pointerdown", interrupt, true);
      document.removeEventListener("keydown", interrupt, true);
      cancel();
    };
  }, [cancel]);
  const focusToken = useCallback(() => interaction.current, []);
  const focusScanner = useCallback((token = interaction.current) => {
    cancel();
    const deadline = performance.now() + 1000;
    const attempt = () => {
      frame.current = null;
      if (token !== interaction.current) return;
      const input = inputRef.current;
      if (!input) return;
      // Wait for React to enable the input and MUI to finish closing its overlay.
      if (input.disabled || document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) {
        if (performance.now() < deadline) frame.current = requestAnimationFrame(attempt);
        return;
      }
      input.focus({ preventScroll: true });
    };
    frame.current = requestAnimationFrame(attempt);
  }, [cancel, inputRef]);
  return { focusScanner, focusToken };
}
