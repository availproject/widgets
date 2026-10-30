import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Keep the previous quote through debounce; avoid flashing a short-lived skeleton. */
export function useDepositQuoteMotion<T>({ enabled, pending, inputKey, destinationKey, value }: {
  enabled: boolean; pending: boolean; inputKey: string; destinationKey: string; value: T;
}) {
  const previous = useRef<{ key: string; value: T } | null>(null);
  const started = useRef<number | null>(null);
  const [shimmer, setShimmer] = useState(false);
  useEffect(() => {
    if (!enabled) previous.current = null;
    else if (!pending) previous.current = { key: destinationKey, value };
  }, [enabled, pending, destinationKey, value]);
  useEffect(() => {
    if (!enabled) {
      started.current = null;
      setShimmer(false);
      return;
    }
    if (pending) {
      if (started.current != null) return;
      // 250 ms input debounce, then 200 ms before showing a loading skeleton.
      const timer = setTimeout(() => {
        started.current = Date.now();
        setShimmer(true);
      }, 450);
      return () => clearTimeout(timer);
    }
    const remaining = started.current == null ? 0 : Math.max(0, 400 - (Date.now() - started.current));
    const finish = () => { started.current = null; setShimmer(false); };
    if (!remaining) { finish(); return; }
    const timer = setTimeout(finish, remaining);
    return () => clearTimeout(timer);
  }, [enabled, pending, inputKey, destinationKey]);
  return {
    shimmer: enabled && shimmer,
    stale: enabled && pending && !shimmer,
    value: enabled && pending
      ? previous.current?.key === destinationKey ? previous.current.value : null
      : value,
  };
}

export function DepositAnimatedLabel({ children }: { children: string }) {
  const [frame, setFrame] = useState({ label: children, old: "", revision: 0 });
  if (frame.label !== children) setFrame({ label: children, old: frame.label, revision: frame.revision + 1 });
  return <span className="nx-label-stack" aria-label={children}>
    {frame.old && <span key={`old-${frame.revision}`} aria-hidden className="nx-label-out">{frame.old}</span>}
    <span key={frame.revision} aria-hidden className={frame.revision ? "nx-label-in" : undefined}>{frame.label}</span>
  </span>;
}

export const groupDepositInput = (value: string) => {
  const [whole, ...fraction] = value.replaceAll(",", "").split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction.length ? `.${fraction.join("")}` : "");
};

export interface DepositAmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: React.ReactNode;
}

/** Preserve selection by digit position when grouping inserts or removes commas. Auto-sizes to content to prevent gaps. */
export const DepositAmountInput = React.forwardRef<HTMLInputElement, DepositAmountInputProps>(
  function DepositAmountInput({ prefix, value = "", onChange, style, ...props }, forwardedRef) {
    const internalRef = useRef<HTMLInputElement>(null);
    const selection = useRef<number | null>(null);
    const [selectionRevision, setSelectionRevision] = useState(0);
    const shown = groupDepositInput(String(value));

    useLayoutEffect(() => {
      const el = internalRef.current;
      if (selection.current == null || !el) return;
      let offset = 0, digits = 0;
      while (offset < shown.length && digits < selection.current) {
        if (shown[offset] !== ",") digits++;
        offset++;
      }
      el.setSelectionRange(offset, offset);
      selection.current = null;
    }, [shown, selectionRevision]);

    const { width: _w, textAlign: _ta, fieldSizing: _fs, ...cleanStyle } = (style || {}) as React.CSSProperties & { fieldSizing?: string };

    return (
      <span
        className="nx-amount-field"
        onClick={() => internalRef.current?.focus()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-end",
          cursor: "text",
        }}
      >
        {prefix}
        <span
          style={{
            display: "inline-grid",
            alignItems: "center",
            justifyItems: "end",
            position: "relative",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              gridArea: "1 / 1",
              visibility: "hidden",
              whiteSpace: "pre",
              font: style?.font,
              fontSize: style?.fontSize,
              fontWeight: style?.fontWeight,
              fontFamily: style?.fontFamily,
              letterSpacing: style?.letterSpacing,
              lineHeight: style?.lineHeight,
              padding: 0,
              margin: 0,
              border: 0,
              pointerEvents: "none",
            }}
          >
            {shown || props.placeholder || "0"}
          </span>
          <input
            {...props}
            ref={(node) => {
              internalRef.current = node;
              if (typeof forwardedRef === "function") {
                forwardedRef(node);
              } else if (forwardedRef) {
                (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              }
            }}
            value={shown}
            style={{
              ...cleanStyle,
              gridArea: "1 / 1",
              width: "100%",
              minWidth: 0,
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              outline: "none",
              textAlign: "right",
            }}
            onChange={(event) => {
              let sel = event.target.value.slice(0, event.target.selectionStart ?? 0).replaceAll(",", "").length;
              if (event.target.value.trimStart().startsWith(".") && (event.target.selectionStart ?? 0) >= 1) {
                sel += 1;
              }
              selection.current = sel;
              setSelectionRevision((v) => v + 1);
              onChange?.(event);
            }}
          />
        </span>
      </span>
    );
  }
);

/** Outgoing screens are inert DOM snapshots, so effects and payment hooks never run twice. */
export function DepositScreenMotion({ screenKey, back, enabled = true, children }: { screenKey: string; back?: boolean; enabled?: boolean; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLDivElement>(null);
  const previous = useRef<{ key: string; snapshot: HTMLElement } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !current.current || !stage.current) return;
    if (previous.current && previous.current.key !== screenKey) {
      stage.current.querySelector(".nx-screen-leaving")?.remove();
      if (timer.current) clearTimeout(timer.current);
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        const snapshot = previous.current.snapshot;
        snapshot.className = "nx-screen-leaving";
        snapshot.inert = true;
        snapshot.setAttribute("aria-hidden", "true");
        snapshot.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
        stage.current.appendChild(snapshot);
        timer.current = setTimeout(() => snapshot.remove(), 150);
      }
    }
    previous.current = { key: screenKey, snapshot: current.current.cloneNode(true) as HTMLElement };
  }, [screenKey, children, enabled]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!enabled) return <>{children}</>;
  return <div ref={stage} className={`nx-screen-stage${back ? " back" : ""}`}>
    <div ref={current} className="nx-screen-entering" key={screenKey}>{children}</div>
  </div>;
}

/** Grip-only dragging avoids stealing scrolling from the asset list. */
export function DepositSheetGrip({ onDismiss }: { onDismiss: () => void }) {
  const start = useRef<number | null>(null);
  const distance = useRef(0);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return <div className="nx-sheet-grip" onClick={() => { if (distance.current < 4) onDismiss(); }} role="button" tabIndex={0} aria-label="Close token selector"
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onDismiss(); } }}
    onPointerDown={event => {
      start.current = event.clientY; distance.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (start.current == null) return;
      distance.current = Math.max(0, event.clientY - start.current);
      const sheet = event.currentTarget.parentElement;
      const scrim = sheet?.previousElementSibling as HTMLElement | null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        if (sheet) { sheet.style.transition = "none"; sheet.style.transform = `translateY(${distance.current}px)`; }
        if (scrim) scrim.style.opacity = String(Math.max(0, 1 - distance.current / 400));
      });
    }}
    onPointerUp={event => {
      if (start.current == null) return;
      start.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const sheet = event.currentTarget.parentElement;
      if (sheet) { sheet.style.transition = "transform 250ms cubic-bezier(.32,.72,0,1), opacity 250ms"; sheet.style.transform = "translateY(0)"; }
      const scrim = sheet?.previousElementSibling as HTMLElement | null;
      if (scrim) scrim.style.opacity = "1";
      if (distance.current >= 90) onDismiss();
    }}
    onPointerCancel={event => {
      start.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const sheet = event.currentTarget.parentElement;
      if (sheet) { sheet.style.transition = "transform 250ms cubic-bezier(.32,.72,0,1)"; sheet.style.transform = "translateY(0)"; }
      const scrim = sheet?.previousElementSibling as HTMLElement | null;
      if (scrim) scrim.style.opacity = "1";
    }}><span /></div>;
}
