import type { ReactNode } from "react";
import { ArrowClockwise, Tray, WarningCircle } from "@phosphor-icons/react";
import { Button } from "./Button";

export function Skeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="ui-skeleton-list" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <div className="ui-skeleton-row" key={index}>
            <span />
            <div>
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-icon">{icon ?? <Tray weight="duotone" />}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ui-empty-state ui-error-state" role="alert">
      <div className="ui-empty-icon">
        <WarningCircle weight="duotone" />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<ArrowClockwise />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
