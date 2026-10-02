import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <CircleNotch className="ui-spinner" weight="bold" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}
