import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SwapAssetSelector } from "../registry/avail-widgets/nexus-widget/components/swap-asset-selector";

for (const tab of ["all", "custom", "native", "stables"] as const) {
  test(`${tab} shortfall keeps progress and only Native/Stables offer selection shortcuts`, () => {
    const html = renderToStaticMarkup(
      <SwapAssetSelector
        autoSelectFilterTabs
        filterTabBehavior="source-pool"
        initialFilterTab={tab}
        isMulti
        lockedTokens={[]}
        onBack={() => {}}
        onSelect={() => {}}
        requiredUsd="100"
        selectedTokens={[]}
        staticOptions={[]}
        swapBalance={[]}
        title="Choose Assets to Pay with"
      />,
    );
    assert.match(html, /Required/);
    assert.match(html, /\$100/);
    assert.doesNotMatch(html, />Done</);
    const hasShortcuts = tab === "native" || tab === "stables";
    assert.equal(html.includes("Auto-select tokens"), hasShortcuts);
    assert.equal(html.includes("Select manually"), hasShortcuts);
  });
}
