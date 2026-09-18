"use client";

import React from "react";
import { logOnramp } from "@/registry/avail-widgets/nexus-widget/utils/onramp-session";

const ONRAMP_SUCCESS_MESSAGE = "nexus-onramp-success";
const ONRAMP_SUCCESS_ACK_MESSAGE = "nexus-onramp-success-received";

export default function OnrampCompletePage() {
  React.useEffect(() => {
    let closed = false;
    logOnramp("provider.return_page", { hasOpener: Boolean(window.opener) });

    const closePage = () => {
      if (closed) return;
      closed = true;
      logOnramp("provider.return_page.close");
      window.close();
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== window.opener ||
        event.data !== ONRAMP_SUCCESS_ACK_MESSAGE
      )
        return;
      logOnramp("provider.return_page.acknowledged");
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
      Returning to payment status. Keep the original page open to finish your
      deposit.
    </main>
  );
}
