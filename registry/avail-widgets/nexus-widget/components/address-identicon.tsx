// biome-ignore-all lint: NexusWidget registry component from shadcn registry.

import React from "react";

const identiconPalette = [
  "var(--foreground-brand)",
  "#16A34A",
  "#B7791F",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#EA580C",
  "#475569",
];

const hashAddress = (address: string) => {
  let hash = 0;
  for (const char of address.toLowerCase()) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
};

export function AddressIdenticon({
  address,
  size = 18,
}: {
  address: string;
  size?: number;
}) {
  const hash = hashAddress(address);
  const primary = identiconPalette[hash % identiconPalette.length];
  const secondary =
    identiconPalette[Math.floor(hash / 7) % identiconPalette.length];
  const accent =
    identiconPalette[Math.floor(hash / 13) % identiconPalette.length];
  const rotation = hash % 360;

  return (
    <span
      aria-hidden="true"
      style={{
        background: `conic-gradient(from ${rotation}deg, ${primary}, ${secondary}, ${accent}, ${primary})`,
        border: "1px solid #FFFFFE",
        borderRadius: "999px",
        boxShadow: "0 0 0 1px #E8E8E7",
        boxSizing: "border-box",
        display: "inline-block",
        flexShrink: 0,
        height: size,
        width: size,
      }}
    />
  );
}
