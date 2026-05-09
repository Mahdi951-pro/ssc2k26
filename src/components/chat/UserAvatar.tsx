interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  online?: boolean;
  showStatus?: boolean;
  className?: string;
}

const colors = [
  "from-emerald-400 to-teal-500",
  "from-fuchsia-400 to-pink-500",
  "from-violet-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
  "from-rose-400 to-red-500",
  "from-lime-400 to-green-500",
];

export function UserAvatar({ name, url, size = 40, online, showStatus, className = "" }: AvatarProps) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colorIdx =
    Math.abs((name || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt={name || "avatar"}
          className="h-full w-full rounded-full object-cover ring-1 ring-border/40"
          loading="lazy"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${colors[colorIdx]} font-semibold text-white shadow-sm ring-1 ring-white/10`}
          style={{ fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
      {showStatus && online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full bg-success ring-2 ring-background"
          style={{
            width: Math.max(8, size * 0.22),
            height: Math.max(8, size * 0.22),
            boxShadow:
              "0 0 0 1px color-mix(in oklab, var(--success) 50%, transparent), 0 0 8px color-mix(in oklab, var(--success) 60%, transparent)",
          }}
        />
      )}
    </div>
  );
}
