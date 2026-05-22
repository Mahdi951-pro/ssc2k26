import logo from "@/assets/brand-logo.png";

interface Props {
  size?: number;
  className?: string;
  rounded?: string; // tailwind rounding class
  ring?: boolean;
  alt?: string;
}

/**
 * Global brand mark for SSC 2k26 Chat.
 * Use anywhere we used to put a generic MessageCircle in a gradient tile.
 */
export function BrandLogo({
  size = 40,
  className = "",
  rounded = "rounded-2xl",
  ring = true,
  alt = "SSC Batch 2026",
}: Props) {
  return (
    <img
      src={logo}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`${rounded} object-cover shadow-elegant ${
        ring ? "ring-1 ring-border/40" : ""
      } ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}
