import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { gsap } from "gsap";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  images: string[];
  startIndex: number;
}

export function ImageLightbox({ open, onOpenChange, images, startIndex }: Props) {
  const [i, setI] = useState(startIndex);
  const imgRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef({ scale: 1, x: 0, y: 0 });

  useEffect(() => setI(startIndex), [startIndex, open]);

  // Reset transform on image change
  useEffect(() => {
    stateRef.current = { scale: 1, x: 0, y: 0 };
    if (imgRef.current) gsap.set(imgRef.current, { scale: 1, x: 0, y: 0 });
  }, [i, open]);

  // Pinch zoom + drag
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !open) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let dragStart: { x: number; y: number } | null = null;

    const distance = () => {
      const pts = Array.from(pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    };

    const apply = () => {
      gsap.set(el, {
        scale: stateRef.current.scale,
        x: stateRef.current.x,
        y: stateRef.current.y,
      });
    };

    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        pinchStartDist = distance();
        pinchStartScale = stateRef.current.scale;
        dragStart = null;
      } else if (pointers.size === 1 && stateRef.current.scale > 1) {
        dragStart = { x: e.clientX - stateRef.current.x, y: e.clientY - stateRef.current.y };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist > 0) {
        const factor = distance() / pinchStartDist;
        stateRef.current.scale = Math.max(1, Math.min(4, pinchStartScale * factor));
        if (stateRef.current.scale === 1) {
          stateRef.current.x = 0;
          stateRef.current.y = 0;
        }
        apply();
      } else if (pointers.size === 1 && dragStart) {
        stateRef.current.x = e.clientX - dragStart.x;
        stateRef.current.y = e.clientY - dragStart.y;
        apply();
      }
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const onDouble = () => {
      if (stateRef.current.scale > 1) {
        stateRef.current = { scale: 1, x: 0, y: 0 };
      } else {
        stateRef.current = { scale: 2, x: 0, y: 0 };
      }
      gsap.to(el, {
        scale: stateRef.current.scale,
        x: 0,
        y: 0,
        duration: 0.25,
        ease: "power2.out",
      });
    };
    el.addEventListener("dblclick", onDouble);

    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", onDouble);
    };
  }, [open, i]);

  const next = () => setI((p) => Math.min(images.length - 1, p + 1));
  const prev = () => setI((p) => Math.max(0, p - 1));

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-black/95 p-0 sm:rounded-none">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <a
          href={images[i]}
          target="_blank"
          rel="noreferrer"
          download
          className="absolute right-3 top-16 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          aria-label="Download"
        >
          <Download className="h-5 w-5" />
        </a>

        {i > 0 && (
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {i < images.length - 1 && (
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center overflow-hidden">
          <img
            ref={imgRef}
            src={images[i]}
            alt=""
            draggable={false}
            className="max-h-full max-w-full select-none object-contain touch-none"
            style={{ touchAction: "none" }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur">
          {i + 1} / {images.length} · double-tap or pinch to zoom
        </div>
      </DialogContent>
    </Dialog>
  );
}
