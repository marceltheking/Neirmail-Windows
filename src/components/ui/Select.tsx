import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, Check } from "@phosphor-icons/react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  className,
  disabled,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger className={clsx("ui-select-trigger", className)} aria-label={label}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <CaretDown weight="bold" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="ui-select-content" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="ui-select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                className="ui-select-item"
                value={option.value}
                key={option.value}
              >
                <SelectPrimitive.ItemIndicator className="ui-select-indicator">
                  <Check weight="bold" />
                </SelectPrimitive.ItemIndicator>
                <span className="ui-select-copy">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.description && <small>{option.description}</small>}
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
