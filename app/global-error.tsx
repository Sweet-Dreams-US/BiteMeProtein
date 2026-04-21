"use client";

/**
 * Root-level fatal error boundary.
 *
 * Triggered ONLY when the root layout itself throws (which would normally
 * take down error.tsx too). Must render its own <html> + <body> since
 * nothing above it is intact.
 */

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#FFF5EE", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
          <p style={{ fontSize: "4rem", marginBottom: "1rem" }}>🙈</p>
          <h1 style={{ fontFamily: "Georgia, serif", color: "#843430", fontSize: "2rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#7a6a62", marginBottom: "1rem" }}>
            We hit a critical error. Please try refreshing — if it continues, reach out to Haley at haley@bitemeprotein.com.
          </p>
          {error.digest && (
            <p style={{ color: "#b0a098", fontSize: "0.75rem", marginBottom: "1.5rem" }}>Ref: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#843430",
              color: "white",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "100px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
