import * as SwitchPrimitive from "@radix-ui/react-switch";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  return (
    <label className="ui-setting-row">
      <span className="ui-setting-copy">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </span>
      <SwitchPrimitive.Root
        className="ui-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      >
        <SwitchPrimitive.Thumb className="ui-switch-thumb" />
      </SwitchPrimitive.Root>
    </label>
  );
}
