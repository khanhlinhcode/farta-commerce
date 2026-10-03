import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--farta-radius-lg)] bg-[var(--farta-color-surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function GlassSurface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--farta-radius-lg)] border border-[var(--farta-glass-border)] bg-[var(--farta-glass-background)] shadow-[var(--farta-shadow-soft)] supports-[backdrop-filter]:backdrop-blur-[var(--farta-glass-blur)]",
        className,
      )}
      {...props}
    />
  );
}
