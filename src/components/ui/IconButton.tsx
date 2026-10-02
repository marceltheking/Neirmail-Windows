import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  danger?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export function IconButton({
  label,
  icon,
  active,
  danger,
  tooltipSide,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} side={tooltipSide}>
      <button
        type="button"
        className={clsx("ui-icon-button", active && "is-active", danger && "is-danger", className)}
        aria-label={label}
        aria-pressed={active}
        {...props}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
