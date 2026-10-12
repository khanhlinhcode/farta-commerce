import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--farta-radius-sm)] px-5 text-sm font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--farta-color-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--farta-color-accent)] text-[var(--farta-color-accent-contrast)] shadow-[0_0.65rem_1.8rem_rgb(95_44_59_/_0.16)] hover:-translate-y-px hover:bg-[#4f2432] hover:shadow-[0_0.9rem_2.2rem_rgb(95_44_59_/_0.22)]",
        secondary:
          "border border-[var(--farta-color-border)] bg-[var(--farta-color-surface)] text-[var(--farta-color-text)] hover:border-[var(--farta-color-text-muted)] hover:bg-[var(--farta-color-surface-strong)]",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      type={type}
      {...props}
    />
  );
}
