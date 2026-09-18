import { useCallback, useEffect, useRef, useState } from "react";
import type { EthereumProvider } from "@avail-project/nexus-core";
import { isAddress, zeroAddress, type Address, type WalletClient } from "viem";
import { logOnramp } from "./onramp-session";

type ConnectionProvider = EthereumProvider & {
  connected?: boolean;
  isConnected?: () => boolean;
  session?: { expiry?: number } | null;
  on?: (event: string, listener: (...args: any[]) => void) => unknown;
  removeListener?: (event: string, listener: (...args: any[]) => void) => unknown;
};

export type GetOnrampWalletProvider = () => Promise<EthereumProvider | undefined>;

/** Bound read-only probes even when a wallet transport never resolves its request. */
export function withOnrampWalletTimeout<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new Error("Wallet check cancelled."));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("Wallet did not respond. Reconnect your wallet."));
    }, timeoutMs);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return abort();
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return operation();
      })
      .then(
        value => { finish(); resolve(value); },
        error => { finish(); reject(error); },
      );
  });
}

export async function readOnrampWalletAddress(
  provider: EthereumProvider,
): Promise<Address | undefined> {
  const connection = provider as ConnectionProvider;
  const sessionIsInactive = () =>
    connection.connected === false ||
    connection.isConnected?.() === false ||
    ("session" in connection && !connection.session) ||
    (typeof connection.session?.expiry === "number" &&
      connection.session.expiry * 1000 <= Date.now());
  if (sessionIsInactive()) return undefined;
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  return !sessionIsInactive() && Number(chainId) > 0 &&
    typeof address === "string" && isAddress(address) && address !== zeroAddress
    ? (address as Address)
    : undefined;
}

/** Only the active connector is inspected; a persisted address is never proof of connection. */
export function useOnrampWallet({
  getProvider,
  walletClient,
  walletConnected,
}: {
  getProvider: GetOnrampWalletProvider;
  walletClient?: WalletClient | null;
  walletConnected: boolean;
}) {
  const [verified, setVerified] = useState<{
    address?: Address;
    client?: WalletClient | null;
    getter?: GetOnrampWalletProvider;
    revision: number;
  }>({ revision: 0 });
  const [checking, setChecking] = useState(false);
  const checkRef = useRef<() => Promise<Address | undefined>>(async () => undefined);
  const check = useCallback(() => checkRef.current(), []);

  useEffect(() => {
    const lifetime = new AbortController();
    let provider: ConnectionProvider | undefined;
    let inFlight: Promise<Address | undefined> | undefined;
    let epoch = 0;
    let providerDisconnected = false;
    let backgroundChecksPaused = false;
    const update = (address?: Address) => {
      if (lifetime.signal.aborted) return;
      setVerified(previous => {
        if (previous.address === address && previous.client === walletClient &&
          previous.getter === getProvider) return previous;
        logOnramp("wallet.connection", { address, connected: Boolean(address) });
        return {
          address, client: walletClient, getter: getProvider,
          revision: previous.revision + 1,
        };
      });
    };
    const changed = () => {
      epoch++;
      providerDisconnected = false;
      update();
      void checkConnection();
    };
    const disconnected = () => {
      epoch++;
      providerDisconnected = true;
      update();
      logOnramp("wallet.disconnected");
    };
    // Switching to the deposit chain must not look like an account disconnect.
    const chainChanged = () => { void checkConnection(); };
    const events: Array<[string, (...args: any[]) => void]> = [
      ["accountsChanged", changed],
      ["chainChanged", chainChanged],
      ["connect", changed],
      ["disconnect", disconnected],
      ["session_delete", disconnected],
      ["session_expire", disconnected],
    ];
    const detach = () => events.forEach(([event, handler]) =>
      provider?.removeListener?.(event, handler));
    const checkConnection = (): Promise<Address | undefined> => {
      if (lifetime.signal.aborted) return Promise.resolve(undefined);
      if (inFlight) return inFlight;
      if (!walletConnected || !walletClient) {
        setChecking(false);
        update();
        return Promise.resolve(undefined);
      }
      const runEpoch = epoch;
      setChecking(true);
      inFlight = withOnrampWalletTimeout(async () => {
        const activeProvider = (await getProvider()) as ConnectionProvider | undefined;
        if (lifetime.signal.aborted || runEpoch !== epoch) return undefined;
        if (activeProvider !== provider) {
          detach();
          provider = activeProvider;
          providerDisconnected = false;
          if (typeof provider?.on === "function" && typeof provider.removeListener === "function") {
            events.forEach(([event, handler]) => provider?.on?.(event, handler));
          }
        }
        if (!activeProvider || providerDisconnected) return undefined;
        const address = await readOnrampWalletAddress(activeProvider);
        backgroundChecksPaused = false;
        // The signing client must belong to this live provider account too.
        return address && walletClient.account?.address.toLowerCase() === address.toLowerCase()
          ? address : undefined;
      }, lifetime.signal).catch(error => {
        // EIP-1193 cannot cancel a stuck transport request. Avoid stacking automatic
        // probes after failure; a user action, focus or provider event can retry.
        backgroundChecksPaused = true;
        if (!lifetime.signal.aborted) logOnramp("wallet.check_failed", { error });
        return undefined;
      }).then(address => {
        if (lifetime.signal.aborted || runEpoch !== epoch) return undefined;
        update(address);
        return address;
      }).finally(() => {
        inFlight = undefined;
        if (!lifetime.signal.aborted) setChecking(false);
      });
      return inFlight;
    };
    checkRef.current = checkConnection;
    const wake = () => { void checkConnection(); };
    const visible = () => { if (document.visibilityState === "visible") wake(); };
    wake();
    const timer = setInterval(() => {
      if (!backgroundChecksPaused) wake();
    }, 5000);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", visible);
    return () => {
      lifetime.abort();
      clearInterval(timer);
      detach();
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [getProvider, walletClient, walletConnected]);

  const address = walletConnected && verified.getter === getProvider &&
    verified.address?.toLowerCase() === walletClient?.account?.address.toLowerCase()
    ? verified.address : undefined;
  return { address, revision: verified.revision, checking, check };
}
