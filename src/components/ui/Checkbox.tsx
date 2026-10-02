import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "@phosphor-icons/react";

interface CheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onCheckedChange, label, disabled }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className="ui-checkbox"
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
      disabled={disabled}
    >
      <CheckboxPrimitive.Indicator className="ui-checkbox-indicator">
        {checked === "indeterminate" ? <Minus weight="bold" /> : <Check weight="bold" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
