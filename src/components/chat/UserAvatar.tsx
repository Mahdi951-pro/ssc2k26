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
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${colors[colorIdx]} font-semibold text-white`}
          style={{ fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-card ${
            online ? "bg-success animate-pulse-dot" : "bg-muted-foreground/40"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
