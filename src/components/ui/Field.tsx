import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  trailing?: ReactNode;
}

export function Field({ label, hint, error, trailing, className, id, ...props }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const descriptionId = hint || error ? `${fieldId}-description` : undefined;
  return (
    <label className="ui-field" htmlFor={fieldId}>
      <span className="ui-field-label">{label}</span>
      <span className={clsx("ui-input-shell", error && "has-error")}>
        <input
          id={fieldId}
          className={clsx("ui-input", className)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={descriptionId}
          {...props}
        />
        {trailing}
      </span>
      {hint && !error && (
        <span id={descriptionId} className="ui-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={descriptionId} className="ui-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
