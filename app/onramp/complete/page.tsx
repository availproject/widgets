"use client";

import React from "react";

const ONRAMP_SUCCESS_MESSAGE = "nexus-onramp-success";
const ONRAMP_SUCCESS_ACK_MESSAGE = "nexus-onramp-success-received";

export default function OnrampCompletePage() {
  React.useEffect(() => {
    let closed = false;

    const closePage = () => {
      if (closed) return;
      closed = true;
      window.close();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data !== ONRAMP_SUCCESS_ACK_MESSAGE) return;
      closePage();
    };

    window.addEventListener("message", handleMessage);
    const closeTimeout = window.setTimeout(closePage, 3000);

    try {
      window.opener?.postMessage(ONRAMP_SUCCESS_MESSAGE, "*");
    } catch {
      // The provider can return without an opener in some browser flows.
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(closeTimeout);
    };
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
