"use client";

import React from "react";

const ONRAMP_SUCCESS_MESSAGE = "nexus-onramp-success";

export default function OnrampCompletePage() {
  React.useEffect(() => {
    try {
      window.opener?.postMessage(ONRAMP_SUCCESS_MESSAGE, "*");
    } catch {
      // The provider can return without an opener in some browser flows.
    }
  }, []);

  return (
    <main
      style={{
        alignItems: "center",
        color: "#161615",
        display: "grid",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: "100vh",
        padding: "24px",
        textAlign: "center",
      }}
    >
      Transaction success. Redirecting back to status page...
    </main>
  );
}
