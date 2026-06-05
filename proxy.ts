import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // const csp = [
  //   "default-src 'self'",
  //   "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.walletconnect.com https://*.walletconnect.org https://*.eth.merkle.io https://*.reown.com",
  //   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  //   "font-src 'self' https://fonts.gstatic.com data:",
  //   "img-src 'self' data: blob: https://monadfastbridge.com https://availproject.org https://*.walletconnect.com https://*.walletconnect.org https:",
  //   "connect-src 'self' https://api.coinbase.com https://rpcs.avail.so https://*.avail.so wss://*.avail.so ws://*.avail.so https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://*.infura.io https://*.alchemy.com https://mainnet.infura.io https://polygon-rpc.com https://api.avax.network https://rpc.ankr.com https://*.ankr.com https://*.1inch.io https://*.1inch.exchange https://*.uniswap.org https://*.uniswap.io https://monadvision.com https://*.merkle.io https://*.arcana.network http://*.arcana.network https://cosmos01-testnet.arcana.network:26650 http://cosmos01-testnet.arcana.network:26650 https://cosmos04-dev.arcana.network http://cosmos04-dev.arcana.network https://cosmos04-dev.arcana.network:26650 http://cosmos04-dev.arcana.network:26650 wss://*.arcana.network wss://cosmos01-testnet.arcana.network:26650 ws://cosmos01-testnet.arcana.network:26650 wss://cosmos04-dev.arcana.network:26650 ws://cosmos04-dev.arcana.network:26650 https://li.quest https://*.li.quest https://api.bebop.xyz https://*.bebop.xyz https://mainnet.base.org https://*.base.org https://*.optimism.io https://mainnet.optimism.io https://*.arbitrum.io https://arb1.arbitrum.io https://*.scroll.io https://rpc.scroll.io https://*.polygon.technology https://*.avax.network https://*.sophon.xyz https://rpc.sophon.xyz https://*.kaia.io https://public-en.node.kaia.io https://*.bsc.com https://bsc-dataseed.binance.org https://*.binance.org https://*.tron.network https://*.trongrid.io https://*.sepolia.io https://sepolia.infura.io https://rpc.sepolia.org https://sepolia.optimism.io https://*.optimism-sepolia.io https://sepolia-rollup.arbitrum.io https://*.arbitrum-sepolia.io https://*.amoy.polygon.technology https://rpc-amoy.polygon.technology https://sepolia.base.org https://*.base-sepolia.org https://*.monad.xyz https://*.reown.com https://api.reown.com https://*.web3modal.org https://api.web3modal.org",
  //   "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com https://*.family.co",
  //   "frame-ancestors 'none'",
  //   "manifest-src 'self'",
  //   "form-action 'self'",
  //   "base-uri 'self'",
  // ].join("; ");

  // Security headers
  // response.headers.set("Content-Security-Policy", csp);

  // Prevent page from being displayed in a frame (clickjacking protection)
  // This is redundant with CSP frame-ancestors but provides compatibility with older browsers
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy - restrict access to browser features
  // Removed deprecated features: ambient-light-sensor, battery, document-domain,
  // execution-while-not-rendered, execution-while-out-of-viewport, navigation-override
  const permissionsPolicy = [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "cross-origin-isolated=()",
    "display-capture=()",
    "encrypted-media=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "keyboard-map=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "sync-xhr=()",
    "usb=()",
    "web-share=()",
    "xr-spatial-tracking=()",
  ].join(", ");
  response.headers.set("Permissions-Policy", permissionsPolicy);

  // Strict Transport Security (HSTS) - only set in production with HTTPS
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
