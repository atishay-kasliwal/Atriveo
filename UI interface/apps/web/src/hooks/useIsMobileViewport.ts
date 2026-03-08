import { useEffect, useState } from "react";

export default function useIsMobileViewport(maxWidth = 767) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setIsMobile(query.matches);
    onChange();

    if ("addEventListener" in query) {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }

    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, [maxWidth]);

  return isMobile;
}
