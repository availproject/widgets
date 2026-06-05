"use client";
import React from "react";
import { type DepositOpportunity } from "../types";

interface OpportunityListProps {
  opportunities: DepositOpportunity[];
  selectedId?: string;
  onSelect: (opportunity: DepositOpportunity) => void;
}

export function OpportunityList({ opportunities, selectedId, onSelect }: OpportunityListProps) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBlock: "32px", gap: "8px" }}>
        <p style={{ fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", color: "#848483" }}>
          No opportunities configured
        </p>
      </div>
    );
  }

  const shouldScroll = opportunities.length > 6;

  return (
    <div
      style={{
        alignSelf: "stretch",
        backgroundColor: "#FFFFFE",
        borderColor: "#E8E8E7",
        borderRadius: "14px",
        borderStyle: "solid",
        borderWidth: "1px",
        boxShadow: "#5B5B5B0D 0px 1px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexShrink: 0,
        flexDirection: "column",
        maxHeight: shouldScroll ? "438px" : undefined,
        overflowX: "hidden",
        overflowY: shouldScroll ? "auto" : "hidden",
        scrollbarColor: shouldScroll ? "#C8C8C7 transparent" : undefined,
        scrollbarWidth: shouldScroll ? "thin" : undefined,
      }}
    >
      {opportunities.map((opp, idx) => {
        const isSelected = selectedId === opp.id;
        const isLast = idx === opportunities.length - 1;

        return (
          <button
            key={opp.id}
            onClick={() => onSelect(opp)}
            style={{
              alignItems: "center",
              backgroundColor: "#FFFFFE",
              borderBottomColor: isLast ? "transparent" : "#F0F0EF",
              borderBottomStyle: "solid",
              borderBottomWidth: isLast ? "0px" : "1px",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              boxSizing: "border-box",
              display: "flex",
              gap: "12px",
              paddingBlock: "14px",
              paddingInline: "16px",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            {/* Radio button */}
            <div
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFE",
                borderColor: isSelected ? "#006BF4" : "#D0D0CF",
                borderRadius: "999px",
                borderStyle: "solid",
                borderWidth: "2px",
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                height: "20px",
                justifyContent: "center",
                width: "20px",
              }}
            >
              {isSelected && (
                <div
                  style={{
                    backgroundColor: "#006BF4",
                    borderRadius: "999px",
                    height: "10px",
                    width: "10px",
                  }}
                />
              )}
            </div>

            {/* Logo */}
            <div
              style={{
                alignItems: "center",
                borderRadius: "999px",
                boxSizing: "border-box",
                display: "flex",
                flexShrink: 0,
                height: "36px",
                justifyContent: "center",
                overflow: "clip",
                width: "36px",
              }}
            >
              {opp.logo ? (
                <img
                  src={opp.logo}
                  alt={opp.title || opp.protocol}
                  style={{
                    flexShrink: 0,
                    height: "36px",
                    width: "36px",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "999px",
                    backgroundColor: "#F0F0EF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: '"Geist", system-ui, sans-serif',
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#848483",
                  }}
                >
                  {(opp.title || opp.protocol).slice(0, 2)}
                </div>
              )}
            </div>

            {/* Info */}
            <div
              style={{
                boxSizing: "border-box",
                display: "flex",
                flex: "1 1 0%",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div style={{ alignItems: "center", boxSizing: "border-box", display: "flex", gap: "6px" }}>
                <div style={{ boxSizing: "border-box", color: "#161615", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "16px", fontWeight: 500, lineHeight: "18px" }}>
                  {opp.title || opp.protocol}
                </div>
              </div>
              {(opp.subtitle || opp.description) && (
                <div style={{ boxSizing: "border-box", color: "#848483", fontFamily: '"Geist", system-ui, sans-serif', fontSize: "14px", lineHeight: "16px" }}>
                  {opp.subtitle || opp.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
