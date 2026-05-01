import { useEffect, useState } from "react";

/**
 * SSC'26 premium animated splash screen.
 * Fully responsive (mobile → desktop), with a creator branding signature.
 * Shows once per browser session.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("ssc26_splash_shown")) return;
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 2700);
    const doneTimer = setTimeout(() => {
      sessionStorage.setItem("ssc26_splash_shown", "1");
      setVisible(false);
    }, 3300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!visible) return null;

  const text = "SSC'26 chat";

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {/* Aurora gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-hero opacity-80" />
        <div className="ssc-blob absolute -left-[20%] top-[10%] h-[55vw] max-h-[520px] w-[55vw] max-w-[520px] rounded-full bg-primary/30 blur-[80px]" />
        <div
          className="ssc-blob absolute -right-[15%] bottom-[5%] h-[60vw] max-h-[560px] w-[60vw] max-w-[560px] rounded-full bg-accent/25 blur-[90px]"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="ssc-blob absolute left-1/2 top-1/2 h-[40vw] max-h-[380px] w-[40vw] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-glow/20 blur-[70px]"
          style={{ animationDelay: "0.6s" }}
        />
      </div>

      {/* Subtle grain / noise overlay via radial dots */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] [background-size:18px_18px]" />

      {/* Top spacer for balanced vertical layout */}
      <div className="h-8 sm:h-12" />

      {/* Center content */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 px-5 text-center sm:gap-7">
        {/* Logo mark */}
        <div className="ssc-mark relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-brand opacity-60 blur-2xl" />
          <div className="glass-strong flex h-16 w-16 items-center justify-center rounded-3xl shadow-elegant sm:h-20 sm:w-20">
            <span className="bg-gradient-brand bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
              S
            </span>
          </div>
        </div>

        {/* Animated writing wordmark */}
        <h1 className="px-2 text-[clamp(2rem,9vw,4.5rem)] font-bold leading-[1.05] tracking-tight">
          <span className="inline-flex flex-wrap justify-center">
            {text.split("").map((ch, i) => (
              <span
                key={i}
                className="ssc-letter inline-block bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </span>
          <span className="ssc-caret ml-1 inline-block h-[0.85em] w-[3px] translate-y-[0.05em] rounded-full bg-primary align-middle" />
        </h1>

        <p
          className="ssc-sub max-w-[28ch] text-balance text-sm text-muted-foreground sm:text-base"
          style={{ animationDelay: "1.3s" }}
        >
          Your batch, in one chat.
        </p>

        {/* Loading dots */}
        <div className="mt-1 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ssc-dot h-1.5 w-1.5 rounded-full bg-primary sm:h-2 sm:w-2"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Creator signature */}
      <div className="ssc-credit relative z-10 mb-[max(env(safe-area-inset-bottom),1.25rem)] flex flex-col items-center gap-1.5 px-6 text-center">
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-border sm:w-10" />
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">
            Built by
          </span>
          <span className="h-px w-6 bg-border sm:w-10" />
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-gradient-brand bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-lg">
            Abid
          </span>
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_currentColor]" />
        </div>
        <p className="text-[10px] text-muted-foreground/70 sm:text-[11px]">
          Crafted with care for SSC&nbsp;2k26
        </p>
      </div>

      <style>{`
        @keyframes sscWrite {
          0% { opacity: 0; transform: translateY(10px) scale(0.92); filter: blur(6px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes sscCaret {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes sscSub {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sscDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes sscMark {
          0% { opacity: 0; transform: translateY(-12px) scale(0.7) rotate(-8deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }
        @keyframes sscBlob {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(2%, -3%, 0) scale(1.08); }
        }
        @keyframes sscCredit {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ssc-letter { opacity: 0; animation: sscWrite 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .ssc-caret { animation: sscCaret 0.9s ease-in-out infinite; }
        .ssc-sub { opacity: 0; animation: sscSub 0.6s ease-out forwards; }
        .ssc-dot { animation: sscDot 1.2s ease-in-out infinite; }
        .ssc-mark { opacity: 0; animation: sscMark 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .ssc-blob { animation: sscBlob 7s ease-in-out infinite; }
        .ssc-credit { opacity: 0; animation: sscCredit 0.6s ease-out 1.6s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .ssc-letter, .ssc-sub, .ssc-mark, .ssc-credit { opacity: 1 !important; animation: none !important; transform: none !important; filter: none !important; }
          .ssc-blob, .ssc-dot, .ssc-caret { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
