import { useEffect, useRef, useState } from "react";

export function useInViewport<T extends HTMLElement>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;
    const el = ref.current;
    const obs = new IntersectionObserver((entries) => {
      const [e] = entries;
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "200px 0px", threshold: 0.01, ...opts });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, opts]);

  return { ref, visible };
}
