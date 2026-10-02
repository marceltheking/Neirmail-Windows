import { useToastStore } from "../../lib/state/toastStore";

export function AppToaster() {
  const active = useToastStore((state) => state.active);
  const shown = useToastStore((state) => state.last);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="neir-toast"
      data-kind={shown?.kind}
      data-visible={active ? "true" : "false"}
      role="status"
      aria-live="polite"
    >
      {shown && (
        <>
          <span className="neir-toast-tag">{shown.label}</span>
          <span className="neir-toast-message">{shown.message}</span>
          {shown.action && (
            <button
              type="button"
              className="neir-toast-action"
              onClick={() => {
                shown.action?.onClick();
                dismiss(shown.id);
              }}
            >
              {shown.action.label}
            </button>
          )}
          <i
            key={shown.id}
            className="neir-toast-bar"
            style={{ animationDuration: `${shown.duration}ms` }}
          />
        </>
      )}
    </div>
  );
}
