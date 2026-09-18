import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAlert } from "../registry/avail-widgets/nexus-widget/components/status-alerts";

test("status alert keeps its icon and message aligned without host Tailwind styles", () => {
  const html = renderToStaticMarkup(
    <StatusAlert message="Minimum amount is 5." type="error" />,
  );

  assert.match(html, /display:flex/);
  assert.match(html, /align-items:flex-start/);
  assert.match(html, /gap:8px/);
  assert.match(html, /flex:0 0 14px/);
  assert.match(html, /flex:1 1 0%/);
  assert.match(html, /min-width:0/);
  assert.match(html, /Minimum amount is 5\./);
});
