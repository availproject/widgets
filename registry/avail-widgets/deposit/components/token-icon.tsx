import { useState } from "react";
import { cn } from "../utils";

type TokenIconSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<TokenIconSize, { token: number; protocol: number }> = {
  sm: { token: 24, protocol: 16 },
  md: { token: 32, protocol: 16 },
  lg: { token: 40, protocol: 20 },
};

interface TokenIconProps {
  tokenSrc: string;
  protocolSrc?: string;
  tokenAlt?: string;
  protocolAlt?: string;
  size?: TokenIconSize;
  className?: string;
}

export function TokenIcon({
  tokenSrc,
  protocolSrc,
  tokenAlt = "Token",
  protocolAlt = "Protocol",
  size = "sm",
  className,
}: TokenIconProps) {
  const dimensions = SIZE_MAP[size];
  const [tokenError, setTokenError] = useState(false);

  return (
    <div className={cn("relative inline-flex", className)}>
      {!tokenError ? (
        <img
          src={tokenSrc}
          alt={tokenAlt}
          width={dimensions.token}
          height={dimensions.token}
          className="rounded-full object-cover"
          onError={() => setTokenError(true)}
        />
      ) : (
        <div
          className="rounded-full bg-muted flex items-center justify-center border font-sans font-medium text-muted-foreground uppercase"
          style={{ width: dimensions.token, height: dimensions.token, fontSize: dimensions.token / 2.5 }}
        >
          {tokenAlt.slice(0, 2)}
        </div>
      )}
      {protocolSrc && (
        <img
          src={protocolSrc}
          alt={protocolAlt}
          width={dimensions.protocol}
          height={dimensions.protocol}
          className="absolute -bottom-0.5 -right-0.5 translate-x-1/5 translate-y-1/5 rounded-full border-2 border-base object-cover"
        />
      )}
    </div>
  );
}
