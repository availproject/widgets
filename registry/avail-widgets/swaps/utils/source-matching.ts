import { type ExactOutSourceOption } from "../hooks/useSwaps";

type IntentSourceLike = {
  amount?: string;
  chain: { id: number };
  token: { contractAddress: string; symbol: string };
};

function normalizeAddress(address?: string | null) {
  return address ? address.toLowerCase() : null;
}

function buildSymbolKey(chainId: number, symbol?: string | null) {
  return `${chainId}:${(symbol ?? "").toUpperCase()}`;
}

export function buildSourceOptionKey(chainId: number, tokenAddress: string) {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

export function getIntentSourcesSignature(intentSources: IntentSourceLike[]) {
  return intentSources
    .map((source) => {
      const normalizedAddress =
        normalizeAddress(source.token.contractAddress) ?? "";
      return `${source.chain.id}:${normalizedAddress}:${source.token.symbol.toUpperCase()}:${source.amount ?? ""}`;
    })
    .join("|");
}

export function getIntentMatchedOptionKeys(
  intentSources: IntentSourceLike[],
  sourceOptions: ExactOutSourceOption[],
) {
  const optionByAddress = new Map<string, string>();
  const optionBySymbol = new Map<string, string[]>();

  for (const option of sourceOptions) {
    const normalizedOptionAddress = normalizeAddress(option.tokenAddress);
    if (normalizedOptionAddress) {
      optionByAddress.set(`${option.chainId}:${normalizedOptionAddress}`, option.key);
    }

    const symbolKey = buildSymbolKey(option.chainId, option.tokenSymbol);
    const existingForSymbol = optionBySymbol.get(symbolKey) ?? [];
    existingForSymbol.push(option.key);
    optionBySymbol.set(symbolKey, existingForSymbol);
  }

  const matched: string[] = [];
  const matchedSet = new Set<string>();

  for (const source of intentSources) {
    const chainId = source.chain.id;
    const normalizedSourceAddress = normalizeAddress(source.token.contractAddress);

    if (normalizedSourceAddress) {
      const directMatch = optionByAddress.get(
        `${chainId}:${normalizedSourceAddress}`,
      );
      if (directMatch && !matchedSet.has(directMatch)) {
        matched.push(directMatch);
        matchedSet.add(directMatch);
        continue;
      }
    }

    const symbolKey = buildSymbolKey(chainId, source.token.symbol);
    const symbolCandidates = optionBySymbol.get(symbolKey) ?? [];
    const availableCandidates = symbolCandidates.filter(
      (key) => !matchedSet.has(key),
    );
    // Avoid ambiguous symbol-only matches. If multiple sources share
    // chain+symbol, only explicit address matches should be auto-resolved.
    if (availableCandidates.length === 1) {
      const fallbackMatch = availableCandidates[0];
      matched.push(fallbackMatch);
      matchedSet.add(fallbackMatch);
    }
  }

  return matched;
}
