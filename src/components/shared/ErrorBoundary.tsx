import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppTitleBar } from "../layout/AppTitleBar";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/States";
import { NeirLogo } from "./NeirLogo";

interface ErrorBoundaryProps {
  children: ReactNode;
  scope?: "app" | "section";
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Interface error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    if (this.props.scope === "section") {
      return (
        <ErrorState
          title="This page could not be displayed"
          description="Something unexpected happened. Try again, or open another section."
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }

    return (
      <div className="app-frame">
        <AppTitleBar />
        <div className="app-bootstrap-state" role="alert">
          <NeirLogo />
          <span>Something went wrong while drawing this window.</span>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload Neir Mail
          </Button>
        </div>
      </div>
    );
  }
}
