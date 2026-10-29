import React, { useState } from "react";
import type { SwapTokenOption } from "./swap-asset-selector";

const uiFont = '"Geist", system-ui, sans-serif';

export function TokenLogo({
  src,
  label,
  size = 40,
}: {
  src?: string;
  label?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(!src);
  React.useEffect(() => setFailed(!src), [src]);
  if (!failed && src) {
    return (
      <img
        alt={label || ""}
        onError={() => setFailed(true)}
        src={src}
        style={{
          borderRadius: "999px",
          display: "block",
          height: size,
          objectFit: "cover",
          width: size,
        }}
      />
    );
  }
  return (
    <span
      style={{
        alignItems: "center",
        background: "var(--nx-blue-soft, #E5F0FE)",
        borderRadius: "999px",
        color: "var(--nx-blue, #006BF4)",
        display: "flex",
        fontFamily: uiFont,
        fontSize: size > 24 ? 14 : 10,
        fontWeight: 700,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {(label || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function LogoPair({ token, size = 40 }: { token: SwapTokenOption; size?: number }) {
  const badge = Math.round(size * 0.42);
  return (
    <span style={{ height: size, position: "relative", width: size, flexShrink: 0 }}>
      <TokenLogo label={token.symbol} size={size} src={token.logo} />
      {token.chainLogo ? (
        <img
          alt=""
          src={token.chainLogo}
          style={{
            borderRadius: "999px",
            height: badge,
            left: size - badge + 2,
            outline: "2px solid var(--nx-card, #FFFFFF)",
            position: "absolute",
            top: size - badge + 2,
            width: badge,
          }}
        />
      ) : null}
    </span>
  );
}

