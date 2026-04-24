import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * useGsapEnter - animates a container's children with a soft, springy stagger.
 * Pass a CSS selector relative to the container.
 */
export function useGsapEnter<T extends HTMLElement>(
  selector: string = "[data-anim]",
  deps: any[] = []
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(selector, {
        opacity: 0,
        y: 18,
        scale: 0.98,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.06,
        clearProps: "transform",
      });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Press animation: subtle scale pulse on click. */
export function pressAnim(el: HTMLElement | null) {
  if (!el) return;
  gsap.fromTo(
    el,
    { scale: 0.92 },
    { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" }
  );
}

export { gsap };
