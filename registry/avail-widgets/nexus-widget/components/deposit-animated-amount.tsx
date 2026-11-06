import React from "react";
import Decimal from "decimal.js";

const numericValue = (value: string) => {
  const match = value.match(/(-?\d[\d,]*(?:\.\d+)?)\s*([MB])?(?=\b|$)/);
  try {
    return new Decimal(match?.[1].replaceAll(",", "") || "0")
      .mul(match?.[2] === "B" ? 1e9 : match?.[2] === "M" ? 1e6 : 1);
  }
  catch { return new Decimal(0); }
};

/** Animate calculated digits only; input fields retain their exact typed value. */
export function DepositAnimatedAmount({ value, entranceDelay }: { value: string; entranceDelay?: number }) {
  const [frame, setFrame] = React.useState({ value, previous: entranceDelay == null ? value : "0" });
  if (frame.value !== value) setFrame({ value, previous: frame.value });
  const rising = numericValue(frame.value).gte(numericValue(frame.previous));
  const number = frame.value.match(/\d[\d,]*(?:\.\d+)?/)?.[0] ?? "";
  const previous = frame.previous.match(/\d[\d,]*(?:\.\d+)?/)?.[0]?.replaceAll(",", "") ?? "";
  const numberStart = frame.value.indexOf(number);
  const [whole, fraction = ""] = number.split(".");
  const [oldWhole, oldFraction = ""] = previous.split(".");
  return <span className="nx-animated-amount" aria-label={value}>
    <span aria-hidden="true">
      {frame.value.slice(0, numberStart)}
      <span className="nx-digit-group">
        {[...number].map((char, index) => {
          if (!/\d/.test(char)) return <span key={`punct-${index}`}>{char}</span>;
          const afterDecimal = index > whole.length;
          const place = afterDecimal ? index - whole.length - 1 : whole.slice(index).replaceAll(",", "").length - 1;
          const old = afterDecimal ? oldFraction[place] : oldWhole[oldWhole.length - place - 1];
          const changed = char !== old;
          const stagger = afterDecimal ? fraction.length - place - 1 : fraction.length + place;
          return <span className="nx-digit-window" key={`${afterDecimal ? "fraction" : "whole"}-${place}`}>
            <span key={`${char}-${frame.value === frame.previous ? "still" : rising ? "up" : "down"}`}
              className={changed ? `nx-digit-current ${rising ? "up" : "down"}` : "nx-digit-current"}
              style={{ animationDelay: `${(entranceDelay ?? 0) + Math.min(stagger, 12) * 18}ms` }}>{char}</span>
          </span>;
        })}
      </span>
      {frame.value.slice(numberStart + number.length)}
    </span>
  </span>;
}
