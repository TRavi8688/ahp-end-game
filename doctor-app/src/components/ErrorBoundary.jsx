/**
 * ErrorBoundary.jsx
 * Phase 5 Fix — Prevents full app crash on any unhandled JS error
 *
 * COPY THIS EXACT FILE TO:
 *   doctor-app/src/components/ErrorBoundary.jsx         ← already has this, verify it matches
 *   staff-portal/src/components/ErrorBoundary.jsx
 *   reception-portal/src/components/ErrorBoundary.jsx
 *   partner-app/src/components/ErrorBoundary.jsx
 *   hospyn-v2-web/src/components/ErrorBoundary.jsx
 *   hr-portal/src/components/ErrorBoundary.jsx          ← provided in hr-portal/ folder
 *
 * Then in each app's index.jsx / main.jsx, wrap <App />:
 *   import ErrorBoundary from "./components/ErrorBoundary";
 *   root.render(<ErrorBoundary><App /></ErrorBoundary>);
 *
 * No changes needed after this deploy. Sentry is wired automatically when
 * window.Sentry is initialised by the app-level sentry_sdk.init().
 */
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Auto-reports to Sentry if it has been initialised by main.jsx
    if (window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "32px",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px", color: "#1f2937" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "24px", maxWidth: "400px" }}>
            An unexpected error occurred. Please refresh the page. If the problem
            persists, contact Hospain support.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 20px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Refresh Page
            </button>
          </div>

          {/* Dev-only error details — hidden in production */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details
              style={{
                marginTop: "24px",
                padding: "16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                maxWidth: "600px",
                textAlign: "left",
                fontSize: "12px",
                color: "#dc2626",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: "600", marginBottom: "8px" }}>
                Error Details (dev only)
              </summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {this.state.error.toString()}
                {"\n\n"}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
