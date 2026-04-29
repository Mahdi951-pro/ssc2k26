import { useEffect, useState } from "react";

/**
 * SSC'26 animated writing splash.
 * Shows once per browser session (sessionStorage gate) so it doesn't annoy
 * the user on every route change but greets them beautifully on app open.
 */
export function SplashScreen() {
  // Always start hidden to match SSR; reveal on client only if not yet shown.
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("ssc26_splash_shown")) return;
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 2400);
    const doneTimer = setTimeout(() => {
      sessionStorage.setItem("ssc26_splash_shown", "1");
      setVisible(false);
    }, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!visible) return null;

  const text = "SSC'26 chat";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Soft animated blobs for depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-primary/25 blur-3xl animate-pulse" />
        <div
          className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-pulse"
          style={{ animationDelay: "0.6s" }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {/* Animated writing text */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="inline-flex">
            {text.split("").map((ch, i) => (
              <span
                key={i}
                className="ssc-letter inline-block bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </span>
          <span className="ssc-caret ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.05em] bg-primary align-middle" />
        </h1>

        <p
          className="ssc-sub text-sm text-muted-foreground sm:text-base"
          style={{ animationDelay: "1.4s" }}
        >
          Your batch, in one chat.
        </p>

        {/* Loading dots */}
        <div className="mt-2 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ssc-dot h-2 w-2 rounded-full bg-primary"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes sscWrite {
          0% { opacity: 0; transform: translateY(8px) scale(0.9); filter: blur(4px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes sscCaret {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes sscSub {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sscDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .ssc-letter {
          opacity: 0;
          animation: sscWrite 0.5s ease-out forwards;
        }
        .ssc-caret {
          animation: sscCaret 0.9s ease-in-out infinite;
        }
        .ssc-sub {
          opacity: 0;
          animation: sscSub 0.6s ease-out forwards;
        }
        .ssc-dot {
          animation: sscDot 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
