import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/** Verified/admin tick — shown next to display names. */
export function VerifiedBadge({ size = 14, className, title = "Verified" }: Props) {
  return (
    <BadgeCheck
      aria-label={title}
      className={cn("inline-block shrink-0 fill-primary text-primary-foreground", className)}
      style={{ width: size, height: size }}
    />
  );
}
