"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  type NexusOneProps,
  type SwapType,
  type DepositOpportunity,
} from "./types";
import { SwapIdleForm } from "./components/swap-idle-form";
import { SendIdleForm } from "./components/send-idle-form";
import { DepositIdleForm } from "./components/deposit-idle-form";
import { RecipientInput } from "./components/recipient-input";
import { StatusAlert } from "./components/status-alerts";
import {
  SwapAssetSelector,
  type SwapTokenOption,
} from "./components/swap-asset-selector";
import {
  SwapIntentPreview,
  type SwapIntentData,
} from "./components/swap-intent-preview";
import { ReceiveAssetSelector, preloadReceiveTokens } from "./components/receive-asset-selector";
import { OpportunityList } from "./components/opportunity-list";
import { ChevronDown, ArrowLeft, Check } from "lucide-react";
import { useNexus } from "../nexus/NexusProvider";
import { useTransactionSteps } from "../common/tx/useTransactionSteps";
import { SWAP_EXPECTED_STEPS } from "../common/tx/steps";
import TransactionProgress from "../swaps/components/transaction-progress";
import {
  NEXUS_EVENTS,
  type SwapStepType,
  TOKEN_METADATA,
} from "@avail-project/nexus-core";
import { useWalletClient, usePublicClient } from "wagmi";
import {
  erc20Abi,
  isAddress,
  createPublicClient,
  http,
  encodeFunctionData,
} from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// Types for swap step machine
// ---------------------------------------------------------------------------

type SwapStep =
  | "idle" // main screen
  | "choose-swap-asset" // pick source token (exactIn) or dest token (exactOut)
  | "choose-receive-asset" // pick receive token (exactIn only)
  | "enter-recipient" // pick recipient (send mode)
  | "preview-intent" // intent preview card
  | "progress" // transaction in flight
  | "success" // completed seamlessly
  | "history"; // transaction history

// ---------------------------------------------------------------------------
// NexusOne
// ---------------------------------------------------------------------------

export function NexusOne({
  config,
  connectedAddress,
  onComplete,
  onStart,
  onError,
}: NexusOneProps) {
  const {
    nexusSDK,
    bridgableBalance,
    swapBalance,
    getFiatValue,
    resolveTokenUsdRate,
    swapSupportedChainsAndTokens,
    supportedChainsAndTokens,
  } = useNexus();

  // Mode is a single value, not an array
  const activeMode = config.mode;

  // Preload receive tokens once SDK is available
  useEffect(() => {
    if (nexusSDK) {
      preloadReceiveTokens();
    }
  }, [nexusSDK]);

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Global form state
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(
    null,
  );
  const [txError, setTxError] = useState<string | null>(null);

  // Swap-specific
  const [swapType, setSwapType] = useState<SwapType>("exactIn");
  const [swapStep, setSwapStep] = useState<SwapStep>("idle");
  const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);
  const [toToken, setToToken] = useState<SwapTokenOption | undefined>(
    undefined,
  );

  const {
    steps,
    seed,
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<SwapStepType>();
  const [explorerUrls, setExplorerUrls] = useState<{
    sourceExplorerUrl: string | null;
    destinationExplorerUrl: string | null;
  }>({ sourceExplorerUrl: null, destinationExplorerUrl: null });
  const swapRunIdRef = useRef(0);
  const [intentToAmount, setIntentToAmount] = useState<string | undefined>(
    undefined,
  );
  const [intentFeeUsd, setIntentFeeUsd] = useState<string | undefined>(
    undefined,
  );
  const [intentLoading, setIntentLoading] = useState(false);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [intentData, setIntentData] = useState<SwapIntentData | null>(null);
  const [transferExplorerUrl, setTransferExplorerUrl] = useState<string | null>(
    null,
  );

  // Ref to store swap intent hook allow/deny callbacks
  const swapIntentRef = useRef<{
    allow: () => void;
    deny: () => void;
    refresh: () => Promise<any>;
  } | null>(null);

  // Register swap intent hook immediately before executing a swap to prevent race conditions across multiple components
  const registerIntentHook = () => {
    if (!nexusSDK) return;
    nexusSDK.setOnSwapIntentHook(async ({ intent, allow, deny, refresh }) => {
      // Store callbacks so accept/reject buttons can call them
      swapIntentRef.current = { allow, deny, refresh };
      // Populate intent data for preview
      setIntentData(intent);
      console.log("on hook intent swap intent", intent, "swap intent");
      // SDK returns amount as human-readable strings (e.g. "0.91") and value as USD fiat string
      setIntentToAmount(intent.destination?.amount || undefined);

      try {
        // [Regenerated] Computed fee natively using FIAT string parsing
        const totalInUsd = intent.sources.reduce(
          (sum: number, s: any) => sum + Number(s.value || s.amount || 0),
          0,
        );
        const totalOutUsd = Number(
          intent.destination?.value || intent.destination?.amount || 0,
        );

        const fee = totalInUsd - totalOutUsd;
        setIntentFeeUsd(fee > 0 ? fee.toFixed(2) : "0.00");
      } catch (err) {
        console.warn("Could not calculate proper feeUsd", err);
        setIntentFeeUsd("0.00");
      }

      console.log("[DEBUG] Successfully parsed intent data! Removing loader.");
      setIntentLoading(false);
    });
  };

  useEffect(() => {
    console.log("SWAP INTENT");
    console.log("intentData", intentData);
    console.log("intentFeeUsd", intentFeeUsd);
    console.log("intentLoading", intentLoading);
    console.log("intentToAmount", intentToAmount);
  }, [intentData, intentFeeUsd, intentLoading, intentToAmount]);

  // Deposit-specific
  const [selectedOpportunity, setSelectedOpportunity] = useState<
    DepositOpportunity | undefined
  >(undefined);

  const toTokenFromOpportunity = (
    opp: DepositOpportunity,
  ): SwapTokenOption => ({
    chainId: opp.chainId,
    contractAddress: opp.tokenAddress,
    symbol: opp.tokenSymbol,
    name: opp.tokenSymbol,
    balance: "0",
    balanceInFiat: "$0.00",
    decimals: 18,
    logo:
      opp.tokenLogo ||
      TOKEN_METADATA[opp.tokenSymbol as keyof typeof TOKEN_METADATA]?.icon,
  });

  useEffect(() => {
    if (config.prefill?.amount) setAmount(config.prefill.amount);
    if (config.prefill?.recipient)
      setRecipientAddress(config.prefill.recipient);
  }, [config.prefill?.amount, config.prefill?.recipient]);

  useEffect(() => {
    if (activeMode !== "deposit") return;
    if (selectedOpportunity) return;
    if (config.opportunities?.length === 1) {
      const [opp] = config.opportunities;
      setSelectedOpportunity(opp);
      setSwapType("exactOut");
      setToToken(toTokenFromOpportunity(opp));
    }
  }, [activeMode, config.opportunities, selectedOpportunity]);

  useEffect(() => {
    if (swapStep !== "idle") return;

    const hasEnoughForQuote =
      activeMode === "swap"
        ? Boolean(
            amount &&
            Number(amount) > 0 &&
            toToken &&
            (swapType === "exactOut" || fromTokens.length > 0),
          )
        : activeMode === "deposit"
          ? Boolean(amount && Number(amount) > 0 && toToken)
          : Boolean(
              amount && Number(amount) > 0 && toToken && recipientAddress,
            );

    if (!hasEnoughForQuote) {
      setQuoteRefreshing(false);
      return;
    }

    setQuoteRefreshing(true);
    const timer = window.setTimeout(() => {
      setQuoteRefreshing(false);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeMode,
    amount,
    fromTokens,
    recipientAddress,
    swapStep,
    swapType,
    toToken,
  ]);

  // Balance helpers
  const activeBalanceArray = swapBalance;
  const selectedToken = config.prefill?.token ?? "USDC";
  const currentAsset =
    activeBalanceArray?.find((a) => a.symbol === selectedToken) ||
    activeBalanceArray?.[0];
  const maxBalance = currentAsset?.balance
    ? String(currentAsset.balance)
    : undefined;
  const usdValue = getFiatValue(
    Number(amount) || 0,
    currentAsset?.symbol || "USDC",
  );
  const depositUsdValue = getFiatValue(
    Number(amount) || 0,
    selectedOpportunity?.tokenSymbol || "USDC",
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleReset = () => {
    setAmount("");
    setRecipientAddress("");
    setTxError(null);
    setSwapStep("idle");
    setFromTokens([]);
    setToToken(undefined);
    setSelectedOpportunity(undefined);
  };

  /** Start swap flow — SDK will trigger setOnSwapIntentHook for preview */
  const handleEnterPreview = async () => {
    console.log("[DEBUG] handleEnterPreview called!", {
      swapType,
      amount,
      toToken,
      fromTokens,
    });
    if (!toToken || !amount) {
      console.log("[DEBUG] Aborted: missing toToken or amount");
      return;
    }
    const isExactOutFlow = activeMode === "send" || swapType === "exactOut";

    if (!isExactOutFlow && fromTokens.length === 0) {
      console.log("[DEBUG] Aborted: exactIn but no fromTokens");
      return;
    }

    setTxError(null);

    let resolvedRecipientAddress = recipientAddress;
    if (activeMode === "send") {
      if (!recipientAddress) {
        setTxError("Recipient address is required");
        return;
      }

      if (
        connectedAddress &&
        isAddress(recipientAddress) &&
        recipientAddress.toLowerCase() === connectedAddress.toLowerCase()
      ) {
        setTxError("Recipient cannot be the connected wallet.");
        return;
      }

      setSwapStep("preview-intent");
      setIntentLoading(true);

      if (recipientAddress.endsWith(".eth")) {
        try {
          const mainnetClient =
            publicClient?.chain?.id === 1
              ? publicClient
              : createPublicClient({
                  chain: mainnet,
                  transport: http(),
                });
          const ensAddr = await mainnetClient.getEnsAddress({
            name: normalize(recipientAddress),
          });
          if (!ensAddr) {
            setTxError("Could not resolve ENS name to an address.");
            setSwapStep("idle");
            setIntentLoading(false);
            return;
          }
          resolvedRecipientAddress = ensAddr;
        } catch (e: any) {
          setTxError(e.message || "Failed to resolve ENS name.");
          setSwapStep("idle");
          setIntentLoading(false);
          return;
        }
      } else {
        if (!isAddress(recipientAddress)) {
          setTxError("Invalid recipient address.");
          setSwapStep("idle");
          setIntentLoading(false);
          return;
        }
      }

      if (
        connectedAddress &&
        isAddress(resolvedRecipientAddress) &&
        resolvedRecipientAddress.toLowerCase() ===
          connectedAddress.toLowerCase()
      ) {
        setTxError("Recipient cannot be the connected wallet.");
        setSwapStep("idle");
        setIntentLoading(false);
        return;
      }
    } else {
      console.log("[DEBUG] Proceeding to set preview-intent state...");
      setSwapStep("preview-intent");
      setIntentLoading(true);
    }
    setIntentToAmount(undefined);
    setIntentFeeUsd(undefined);
    setIntentData(null);
    swapIntentRef.current = null;

    if (!nexusSDK) {
      setTxError("SDK not initialized");
      setSwapStep("idle");
      setIntentLoading(false);
      return;
    }

    console.log("Entering preview...", {
      activeMode,
      swapType,
      toToken,
      amount,
      fromTokens,
    });

    // Claim ownership of global singleton hook before executing SDK swap
    registerIntentHook();

    const handleSwapEvent = (event: { name: string; args: SwapStepType }) => {
      if (event.name === NEXUS_EVENTS.SWAP_STEP_COMPLETE) {
        const step = event.args;
        if (step?.type === "SOURCE_SWAP_HASH" && step.explorerURL) {
          setExplorerUrls((prev) => ({
            ...prev,
            sourceExplorerUrl: step.explorerURL,
          }));
        }
        if (step?.type === "DESTINATION_SWAP_HASH" && step.explorerURL) {
          setExplorerUrls((prev) => ({
            ...prev,
            destinationExplorerUrl: step.explorerURL,
          }));
        }
        onStepComplete(step);
      }
    };

    try {
      if (!isExactOutFlow) {
        const fromPayload: {
          chainId: number;
          tokenAddress: `0x${string}`;
          amount: bigint;
        }[] = [];

        for (const token of fromTokens) {
          // Determine the amount to use for this specific token
          let rawAmountStr = token.userAmount;
          if (!rawAmountStr && fromTokens.length === 1) {
            rawAmountStr = amount; // fallback for single-token case
          }

          let cleanAmount = Number(rawAmountStr || "0");
          if (cleanAmount <= 0) continue;

          if (token.userAmountMode === "usd") {
            const tokenBalance =
              Number(String(token.balance).replace(/[^0-9.]/g, "")) || 0;
            const fiatBalance =
              Number(String(token.balanceInFiat).replace(/[^0-9.]/g, "")) || 0;
            const price = tokenBalance > 0 ? fiatBalance / tokenBalance : 0;
            if (price > 0) {
              cleanAmount = cleanAmount / price;
            } else {
              cleanAmount = 0;
            }
          }

          if (cleanAmount <= 0) continue;

          const safeTokenAmountStr = cleanAmount.toFixed(
            Math.min(token.decimals || 18, 18),
          );

          fromPayload.push({
            chainId: token.chainId!,
            tokenAddress: token.contractAddress as `0x${string}`,
            amount: nexusSDK.utils.parseUnits(
              safeTokenAmountStr,
              token.decimals || 18,
            ),
          });
        }

        console.log("SWAPPING WITH EXACTIN", {
          from: fromPayload,
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
        });
        swapRunIdRef.current += 1;
        const runId = swapRunIdRef.current;
        setExplorerUrls({
          sourceExplorerUrl: null,
          destinationExplorerUrl: null,
        });
        // Start exact-in swap — the intent hook will fire and populate preview
        await nexusSDK.swapWithExactIn(
          {
            from: fromPayload,
            toChainId: toToken.chainId!,
            toTokenAddress: toToken.contractAddress as `0x${string}`,
          },
          {
            onEvent: (event: any) => {
              if (swapRunIdRef.current !== runId) return;
              handleSwapEvent(event);
            },
          },
        );
        // If we reach here, swap completed successfully
        onComplete?.();
        setSwapStep("success");
      } else {
        console.log(
          "[DEBUG] ExactOut detected. Resolving USD rate for:",
          toToken.symbol,
        );
        const usdRate = await resolveTokenUsdRate(toToken.symbol);
        console.log("[DEBUG] USD Rate resolved:", usdRate);
        // The user inputs a USD fiat amount. Convert USD to exact Token Amount
        const exactTokenAmount =
          usdRate && usdRate > 0 ? Number(amount) / usdRate : Number(amount);
        console.log("[DEBUG] exactTokenAmount computed:", exactTokenAmount);

        console.log("[DEBUG] Parsing units using decimals:", toToken.decimals);
        const amountBigInt = nexusSDK.utils.parseUnits(
          exactTokenAmount.toFixed(Math.min(toToken.decimals || 18, 18)),
          toToken.decimals || 18,
        );
        console.log("[DEBUG] amountBigInt generated:", amountBigInt);

        console.log(`SWAPPING WITH EXACTOUT (${activeMode})`, {
          toChainId: toToken.chainId!,
          toTokenAddress: toToken.contractAddress as `0x${string}`,
          toAmount: amountBigInt,
        });

        swapRunIdRef.current += 1;
        const runId = swapRunIdRef.current;
        setExplorerUrls({
          sourceExplorerUrl: null,
          destinationExplorerUrl: null,
        });

        const fromSourcesPayload =
          fromTokens.length > 0
            ? {
                fromSources: fromTokens.map((token) => ({
                  chainId: token.chainId!,
                  tokenAddress: token.contractAddress as `0x${string}`,
                })),
              }
            : {};

        const isNative =
          !toToken.contractAddress ||
          toToken.contractAddress.toLowerCase() ===
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
          toToken.contractAddress ===
            "0x0000000000000000000000000000000000000000";

        let executeConfig: any;
        if (activeMode === "deposit" && selectedOpportunity?.execute) {
          executeConfig =
            typeof selectedOpportunity.execute === "function"
              ? selectedOpportunity.execute(
                  amountBigInt,
                  connectedAddress as `0x${string}`,
                )
              : selectedOpportunity.execute;
        } else if (activeMode === "send") {
          if (isNative) {
            executeConfig = {
              to: resolvedRecipientAddress as `0x${string}`,
              value: amountBigInt,
              gas: BigInt(100000),
            };
          } else {
            executeConfig = {
              to: toToken.contractAddress as `0x${string}`,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [resolvedRecipientAddress as `0x${string}`, amountBigInt],
              }),
              gas: BigInt(100000),
            };
          }
        }

        if (executeConfig) {
          await nexusSDK.swapAndExecute(
            {
              toChainId: toToken.chainId!,
              toTokenAddress: toToken.contractAddress as `0x${string}`,
              toAmount: amountBigInt,
              execute: executeConfig,
              ...fromSourcesPayload,
            },
            {
              onEvent: (event: any) => {
                if (swapRunIdRef.current !== runId) return;
                handleSwapEvent(event);
              },
            },
          );
        } else {
          await nexusSDK.swapWithExactOut(
            {
              toChainId: toToken.chainId!,
              toTokenAddress: toToken.contractAddress as `0x${string}`,
              toAmount: amountBigInt,
              ...fromSourcesPayload,
            },
            {
              onEvent: (event: any) => {
                if (swapRunIdRef.current !== runId) return;
                handleSwapEvent(event);
              },
            },
          );
        }

        onComplete?.();
        setSwapStep("success");
      }
    } catch (err: any) {
      console.error("Error in handleEnterPreview:", err);
      if (err?.code === "USER_DENIED_INTENT") {
        setSwapStep("idle");
        return;
      }
      setSwapStep("idle");
      const errorMessage =
        err?.message ||
        (typeof err === "string"
          ? err
          : "Transaction failed. Please try again or check console.");
      setTxError(errorMessage);
      onError?.(errorMessage);
      setIntentLoading(false);
    }
  };

  /** User accepted swap from the preview — call allow() from the intent hook */
  const handleSwapAccept = () => {
    if (swapIntentRef.current) {
      onStart?.();
      setSwapStep("progress");
      seed(SWAP_EXPECTED_STEPS);
      swapIntentRef.current.allow();
      // The swap promise in handleEnterPreview will resolve/reject
    }
  };

  // ---------------------------------------------------------------------------
  // Header title
  // ---------------------------------------------------------------------------
  const getTitle = () => {
    if (swapStep === "history") return "Transaction History";
    // Asset selection screens share the exact same titles regardless of the active mode
    if (swapStep === "choose-swap-asset")
      return swapType === "exactIn"
        ? "Choose assets to Swap"
        : "Choose Asset to Receive";
    if (swapStep === "choose-receive-asset") {
      return activeMode === "send"
        ? "Choose Asset to Send"
        : "Choose Asset to Receive";
    }

    if (swapStep === "preview-intent") {
      return activeMode === "deposit"
        ? "Confirm Deposit"
        : activeMode === "send"
          ? "Confirm Send"
          : "Confirm Swap";
    }

    if (activeMode === "swap") {
      if (swapStep === "progress") return "Swapping…";
      return "Swap";
    }
    if (activeMode === "deposit") {
      if (swapStep === "progress") return "Depositing…";
      return "Deposit";
    }
    if (activeMode === "send") return "Send";
    return "Nexus One";
  };

  // Titles that should be center-aligned (main screens / confirm screens)
  // Left-aligned: choose-swap-asset, choose-receive-asset (sub-screens with subtitles)
  const isTitleCentered = () => {
    if (
      swapStep === "choose-swap-asset" ||
      swapStep === "choose-receive-asset" ||
      swapStep === "history"
    )
      return false;
    return true; // idle, preview-intent, progress, etc.
  };

  const canGoBack = swapStep !== "idle";
  const handleBack = () => {
    if (swapStep === "history") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "choose-receive-asset") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "enter-recipient") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "preview-intent") {
      setSwapStep("idle");
      return;
    }
    if (swapStep === "progress") {
      return;
    } // can't go back during tx
    setSwapStep("idle");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isSwapCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    (swapType === "exactIn" && (fromTokens.length === 0 || !toToken)) ||
    (swapType === "exactOut" && !toToken) ||
    quoteRefreshing;
  const isDepositCtaDisabled =
    !amount || Number(amount) <= 0 || !toToken || quoteRefreshing;
  const isSendCtaDisabled =
    !amount ||
    Number(amount) <= 0 ||
    !toToken ||
    !recipientAddress ||
    quoteRefreshing;
  const quoteCtaLabel = (fallback: string) =>
    quoteRefreshing
      ? "Fetching quote..."
      : !amount || Number(amount) <= 0
        ? "Enter amount"
        : fallback;

  return (
    <div
      style={{
        backgroundColor: "#F9F9F8",
        backgroundImage:
          "url(https://app.paper.design/file-assets/01KPQEMGNQSQFDFT18A49JZ3RW/4CP45FEA7X8S1T82E2SXG5AQKV.png)",
        backgroundPosition: "center",
        backgroundPositionX: "center",
        backgroundPositionY: "center",
        backgroundSize: "cover",
        borderRadius: "16px",
        boxShadow: "#5B5B5B0D 0px 1px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontSize: "12px",
        fontSynthesis: "none",
        gap: "16px",
        height: "fit-content",
        lineHeight: "16px",
        overflow: "clip",
        position: "relative",
        width: "450px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingTop: "16px",
          width: "450px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-x-2">
          {canGoBack && (
            <button
              onClick={handleBack}
              style={{
                alignItems: "center",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                padding: "4px",
                marginRight: "4px",
              }}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: "#161615" }} />
            </button>
          )}
          <div
            style={{
              boxSizing: "border-box",
              color: "#161615",
              fontFamily: '"Delight-Medium", "Delight", system-ui, sans-serif',
              fontSize: "15px",
              fontWeight: 500,
              letterSpacing: "0.02em",
              lineHeight: "18px",
            }}
          >
            {getTitle()}
          </div>

          {/* Sub-screen asset counts */}
          {!isTitleCentered() &&
            activeMode === "swap" &&
            swapStep === "choose-swap-asset" &&
            swapType === "exactIn" && (
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), sans-serif",
                  fontSize: "13px",
                  color: "var(--foreground-muted, #848483)",
                  marginLeft: "8px",
                }}
              >
                {fromTokens.length} asset(s) selected
              </span>
            )}

          {/* Protocol chip appended next to Title when Deposit Protocol selected */}
          {isTitleCentered() &&
            activeMode === "deposit" &&
            swapStep === "idle" &&
            selectedOpportunity && (
              <div className="relative pointer-events-auto flex items-center ml-2">
                <button
                  onClick={() => setSelectedOpportunity(undefined)}
                  className="flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-[4px] hover:bg-black/5 transition-colors"
                  style={{
                    fontFamily: "var(--font-geist-mono), sans-serif",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "var(--foreground-muted, #848483)",
                    background: "var(--background-tertiary, #F0F0EF)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {selectedOpportunity.title || selectedOpportunity.protocol}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}
        </div>

        {/* Right side icons */}
        <div
          style={{
            alignItems: "center",
            boxSizing: "border-box",
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={() => setSwapStep("history")}
            style={{
              alignItems: "center",
              backgroundColor: "#FFFFFE",
              borderRadius: "8px",
              boxSizing: "border-box",
              display: "flex",
              flexShrink: 0,
              height: "32px",
              justifyContent: "center",
              outline: "1px solid #E8E8E7",
              width: "32px",
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "16px", height: "16px", flexShrink: 0 }}
            >
              <path
                d="M8 4V8L10.5 9.5"
                stroke="#161615"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C10.196 2 12.117 3.179 13.163 4.936"
                stroke="#161615"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M13.5 2V5H10.5"
                stroke="#161615"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#FFFFFE",
              borderRadius: "8px",
              boxSizing: "border-box",
              display: "flex",
              flexShrink: "0",
              height: "32px",
              justifyContent: "center",
              outline: "1px solid #E8E8E7",
              width: "32px",
              cursor: "pointer",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "16px", height: "16px", flexShrink: "0" }}
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="#161615"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          paddingInline: "16px",
          paddingBottom: "16px",
        }}
      >
        {/* =============================================================== */}
        {/* SHARED SUB-SCREENS (Swap & Send)                             */}
        {/* =============================================================== */}
        {(activeMode === "swap" ||
          activeMode === "send" ||
          activeMode === "deposit") &&
          swapStep !== "idle" && (
            <>
              {/* Panel: choose-swap-asset */}
              {swapStep === "choose-swap-asset" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 40,
                    pointerEvents: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.4)",
                      pointerEvents: "auto",
                      transition: "opacity 0.3s",
                    }}
                    onClick={() => setSwapStep("idle")}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      maxHeight: "90%",
                      backgroundColor: "#FFFFFE",
                      borderRadius: "24px 24px 0 0",
                      display: "flex",
                      flexDirection: "column",
                      pointerEvents: "auto",
                      boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                    }}
                    className="animate-in slide-in-from-bottom-full duration-300"
                  >
                    <SwapAssetSelector
                      title={
                        activeMode === "deposit"
                          ? "Choose payment sources"
                          : swapType === "exactIn"
                            ? "Choose assets to Swap"
                            : "Choose asset to Receive"
                      }
                      swapBalance={swapBalance}
                      isMulti={
                        activeMode === "deposit" || swapType === "exactIn"
                      }
                      selectedTokens={fromTokens}
                      editingAssetIndex={editingAssetIndex}
                      onToggle={(token) => {
                        setFromTokens((prev) => {
                          const exists = prev.find(
                            (t) =>
                              t.contractAddress === token.contractAddress &&
                              t.chainId === token.chainId,
                          );
                          if (exists)
                            return prev.filter(
                              (t) =>
                                !(
                                  t.contractAddress === token.contractAddress &&
                                  t.chainId === token.chainId
                                ),
                            );
                          return [
                            ...prev,
                            {
                              ...token,
                              userAmount: prev.length === 0 ? amount : "",
                            },
                          ];
                        });
                      }}
                      onDone={() => setSwapStep("idle")}
                      onSelect={(token) => {
                        if (activeMode === "swap" && swapType === "exactIn") {
                          setFromTokens((prev) => {
                            const next = [...prev];
                            const defaultAmount =
                              next.length === 0 ? amount : "";
                            const newToken = {
                              ...token,
                              userAmount: defaultAmount,
                            };
                            if (
                              editingAssetIndex !== null &&
                              editingAssetIndex < next.length
                            ) {
                              // Preserve existing userAmount if replacing
                              newToken.userAmount =
                                next[editingAssetIndex].userAmount ||
                                defaultAmount;
                              next[editingAssetIndex] = newToken;
                            } else {
                              next.push(newToken);
                            }
                            return next;
                          });
                          setSwapStep("idle");
                        } else if (
                          activeMode === "deposit" ||
                          activeMode === "send"
                        ) {
                          setFromTokens([{ ...token, userAmount: amount }]);
                          setSwapStep("idle");
                        } else {
                          setToToken(token);
                          setSwapStep("idle");
                        }
                      }}
                      onBack={() => setSwapStep("idle")}
                    />
                  </div>
                </div>
              )}
              {/* Panel: choose-receive-asset */}
              {swapStep === "choose-receive-asset" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 40,
                    pointerEvents: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.4)",
                      pointerEvents: "auto",
                      transition: "opacity 0.3s",
                    }}
                    onClick={() => setSwapStep("idle")}
                  />
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      maxHeight: "90%",
                      backgroundColor: "#FFFFFE",
                      borderRadius: "24px 24px 0 0",
                      display: "flex",
                      flexDirection: "column",
                      pointerEvents: "auto",
                      boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
                      boxSizing: "border-box",
                    }}
                    className="animate-in slide-in-from-bottom-full duration-300"
                  >
                    <div style={{ padding: "16px 16px 0 16px" }}>
                      <div
                        style={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "center",
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: "#E8E8E7",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 16,
                          marginBottom: 16,
                        }}
                      >
                        <button
                          onClick={() => setSwapStep("idle")}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: "1px solid #E8E8E7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#FFFFFE",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <ChevronDown
                            style={{
                              width: 16,
                              height: 16,
                              transform: "rotate(90deg)",
                            }}
                          />
                        </button>
                        <div
                          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                        >
                          <span
                            style={{
                              fontFamily: '"Geist", system-ui, sans-serif',
                              fontSize: 18,
                              fontWeight: 600,
                              color: "#161615",
                            }}
                          >
                            Choose asset to Receive
                          </span>
                          <span
                            style={{
                              fontFamily: '"Geist", system-ui, sans-serif',
                              fontSize: 13,
                              color: "#848483",
                            }}
                          >
                            Select token and chain
                          </span>
                        </div>
                      </div>
                    </div>
                    <ReceiveAssetSelector
                      onSelect={(token) => {
                        setToToken(token);
                        setSwapStep("idle");
                      }}
                      onBack={() => setSwapStep("idle")}
                    />
                  </div>
                </div>
              )}
              {/* Panel: enter-recipient */}
              {swapStep === "enter-recipient" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 40,
                    backgroundColor: "#FFFFFE",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  className="animate-in slide-in-from-bottom-full duration-300"
                >
                  <div
                    style={{
                      backgroundColor: "#FFFFFE",
                      border: "1px solid #E8E8E7",
                      borderRadius: "12px",
                      boxShadow: "#1616150A 0px 1px 2px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        color: "#848483",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: "12px",
                        fontWeight: 500,
                        letterSpacing: "0.08em",
                        lineHeight: "20px",
                        textTransform: "uppercase",
                      }}
                    >
                      Recipient
                    </div>
                    <RecipientInput
                      value={recipientAddress}
                      onChange={(next) => {
                        setRecipientAddress(next);
                        if (txError) setTxError(null);
                      }}
                      label="To"
                      placeholder="ENS or address"
                    />
                    <div
                      style={{
                        color: "#848483",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: "13px",
                        lineHeight: "18px",
                      }}
                    >
                      Recipient must be different from the connected wallet.
                    </div>
                  </div>

                  {txError && <StatusAlert type="error" message={txError} />}

                  <button
                    onClick={() => {
                      const next = recipientAddress.trim();
                      if (!next) {
                        setTxError("Recipient address is required");
                        return;
                      }
                      if (
                        connectedAddress &&
                        isAddress(next) &&
                        next.toLowerCase() === connectedAddress.toLowerCase()
                      ) {
                        setTxError("Recipient cannot be the connected wallet.");
                        return;
                      }
                      setRecipientAddress(next);
                      setTxError(null);
                      setSwapStep("idle");
                    }}
                    style={{
                      alignItems: "center",
                      backgroundColor: "#006BF4",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "#5555550D 0px 1px 4px",
                      color: "#FFFFFE",
                      cursor: "pointer",
                      display: "flex",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "16px",
                      fontWeight: 500,
                      gap: "8px",
                      height: "48px",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    <Check style={{ height: "16px", width: "16px" }} />
                    Done
                  </button>
                </div>
              )}
              {/* Panel: preview-intent */}
              {swapStep === "preview-intent" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full h-full">
                  <SwapIntentPreview
                    fromTokens={fromTokens}
                    fromToken={fromTokens[0]}
                    toToken={toToken}
                    fromAmount={amount}
                    fromAmountUsd={amount}
                    toAmount={intentToAmount}
                    toAmountUsd={intentToAmount}
                    toAmountTokens={
                      intentToAmount ? `${intentToAmount}` : undefined
                    }
                    totalFeeUsd={intentFeeUsd}
                    estimatedTime="10s"
                    isLoading={intentLoading}
                    intentData={intentData}
                    swapBalances={swapBalance}
                    supportedTokenAssets={supportedChainsAndTokens}
                    activeMode={activeMode}
                    mode={activeMode}
                    opportunity={selectedOpportunity}
                    onAccept={handleSwapAccept}
                    onReject={() => {
                      swapIntentRef.current?.deny();
                      swapIntentRef.current = null;
                      setSwapStep("idle");
                    }}
                  />
                </div>
              )}

              {/* Panel: progress AND SUCCESS */}
              {(swapStep === "progress" || swapStep === "success") && (
                <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid var(--border-default, #E8E8E7)",
                      boxShadow: "0px 1px 12px 0px #5B5B5B0D",
                      padding: "16px",
                    }}
                  >
                    <TransactionProgress
                      steps={steps}
                      explorerUrls={explorerUrls}
                      sourceSymbol={
                        fromTokens.length > 1
                          ? `${fromTokens.length} sources`
                          : (fromTokens[0]?.symbol ?? "Unknown")
                      }
                      destinationSymbol={toToken?.symbol ?? "Unknown"}
                      sourceLogos={{
                        token: fromTokens[0]?.logo ?? "",
                        chain: fromTokens[0]?.chainLogo ?? "",
                      }}
                      destinationLogos={{
                        token: toToken?.logo ?? "",
                        chain: toToken?.chainLogo ?? "",
                      }}
                      hasMultipleSources={fromTokens.length > 1}
                      sources={
                        fromTokens.length > 1
                          ? fromTokens.map((t) => ({
                              tokenLogo: t.logo ?? "",
                              chainLogo: t.chainLogo ?? "",
                              symbol: t.symbol,
                            }))
                          : undefined
                      }
                      isTransferMode={activeMode === "send"}
                      depositOpportunityName={
                        activeMode === "deposit"
                          ? selectedOpportunity?.title ||
                            selectedOpportunity?.protocol
                          : undefined
                      }
                    />
                  </div>
                  {swapStep === "success" && (
                    <button
                      onClick={handleReset}
                      style={{
                        alignItems: "center",
                        backgroundColor: "#006BF4",
                        borderRadius: "8px",
                        boxShadow: "#5555550D 0px 1px 4px",
                        boxSizing: "border-box",
                        display: "flex",
                        height: "48px",
                        justifyContent: "center",
                        width: "100%",
                        marginTop: "16px",
                        border: "none",
                        cursor: "pointer",
                        color: "#FFFFFE",
                        fontFamily: '"Geist", system-ui, sans-serif',
                        fontSize: "16px",
                        fontWeight: 500,
                      }}
                    >
                      Done
                    </button>
                  )}
                </div>
              )}
            </>
          )}

        {/* =============================================================== */}
        {/* HISTORY SCREEN (empty state)                                      */}
        {/* =============================================================== */}
        {swapStep === "history" && (
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#FFFFFE",
              borderColor: "#E8E8E7",
              borderRadius: "14px",
              borderStyle: "solid",
              borderWidth: "1px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              justifyContent: "center",
              paddingBlock: "48px",
              paddingInline: "24px",
              width: "100%",
            }}
          >
            {/* Clock icon */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "999px",
                backgroundColor: "#F4F4F3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 4V8L10.5 9.5"
                  stroke="#848483"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C10.196 2 12.117 3.179 13.163 4.936"
                  stroke="#848483"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M13.5 2V5H10.5"
                  stroke="#848483"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              style={{
                boxSizing: "border-box",
                color: "#161615",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "16px",
                fontWeight: 500,
                lineHeight: "24px",
                textAlign: "center",
              }}
            >
              No transactions yet
            </div>
            <div
              style={{
                boxSizing: "border-box",
                color: "#848483",
                fontFamily: '"Geist", system-ui, sans-serif',
                fontSize: "14px",
                lineHeight: "20px",
                textAlign: "center",
                maxWidth: "280px",
              }}
            >
              Your transaction history will appear here once you make your first
              swap, deposit, or send.
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* SWAP IDLE SCREEN                                                 */}
        {/* =============================================================== */}
        {activeMode === "swap" &&
          [
            "idle",
            "choose-swap-asset",
            "choose-receive-asset",
            "enter-recipient",
          ].includes(swapStep) && (
            <>
              <SwapIdleForm
                amount={amount}
                onAmountChange={(val, panel) => {
                  setAmount(val);
                  // Auto-switch swapType based on which panel the user types into
                  if (panel === "send" && swapType !== "exactIn") {
                    setSwapType("exactIn");
                  } else if (panel === "receive" && swapType !== "exactOut") {
                    setSwapType("exactOut");
                  }
                }}
                fromTokens={fromTokens}
                toToken={toToken}
                totalBalance={new Decimal(
                  swapBalance?.reduce(
                    (a, b) => a.add(b.balanceInFiat || 0),
                    new Decimal(0),
                  ) || 0,
                )
                  .toDecimalPlaces(2)
                  .toFixed()}
                receiveBalance={toToken?.balance}
                usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                swapType={swapType}
                onOpenSourcePicker={(index) => {
                  setEditingAssetIndex(index ?? null);
                  setSwapStep("choose-swap-asset");
                }}
                onOpenDestPicker={() => setSwapStep("choose-receive-asset")}
                onOpenRecipientPicker={undefined}
                recipientAddress={recipientAddress}
                onUpdateTokens={setFromTokens}
              />

              {txError && <StatusAlert type="error" message={txError} />}

              {/* CTA Button */}
              <div
                style={{
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <button
                  onClick={handleEnterPreview}
                  disabled={isSwapCtaDisabled}
                  style={{
                    alignItems: "center",
                    backgroundColor: isSwapCtaDisabled ? "#F0F0EF" : "#006BF4",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexShrink: 0,
                    height: "48px",
                    justifyContent: "center",
                    paddingInline: "16px",
                    border: "none",
                    cursor: isSwapCtaDisabled ? "default" : "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: isSwapCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "16px",
                      fontWeight: 500,
                      lineHeight: "24px",
                    }}
                  >
                    {quoteCtaLabel("Review swap")}
                  </div>
                </button>
              </div>
            </>
          )}

        {/* =============================================================== */}
        {/* DEPOSIT MODE LAYOUT                                              */}
        {/* =============================================================== */}
        {activeMode === "deposit" &&
          [
            "idle",
            "choose-swap-asset",
            "choose-receive-asset",
            "enter-recipient",
          ].includes(swapStep) && (
            <>
              {/* Opportunity list */}
              {config.opportunities &&
                config.opportunities.length > 0 &&
                !selectedOpportunity && (
                  <>
                    <OpportunityList
                      opportunities={config.opportunities}
                      selectedId={undefined}
                      onSelect={(opp) => {
                        setSelectedOpportunity(opp);
                        setSwapType("exactOut");
                        setToToken(toTokenFromOpportunity(opp));
                      }}
                    />

                    {/* Done button for opportunity selection */}
                    <div
                      style={{
                        boxSizing: "border-box",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => {
                          if (selectedOpportunity) setSwapStep("idle");
                        }}
                        style={{
                          alignItems: "center",
                          backgroundColor: "#006BF4",
                          borderRadius: "8px",
                          boxShadow: "#5555550D 0px 1px 4px",
                          boxSizing: "border-box",
                          display: "flex",
                          flex: 1,
                          height: "48px",
                          justifyContent: "center",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            boxSizing: "border-box",
                            color: "#FFFFFE",
                            fontFamily: '"Geist", system-ui, sans-serif',
                            fontSize: "15px",
                            fontWeight: 500,
                            lineHeight: "18px",
                          }}
                        >
                          Done
                        </div>
                      </button>
                    </div>
                  </>
                )}

              {/* After opportunity selected — show deposit form */}
              {(!config.opportunities ||
                config.opportunities.length === 0 ||
                selectedOpportunity) && (
                <>
                  <DepositIdleForm
                    amount={amount}
                    onAmountChange={setAmount}
                    toToken={toToken}
                    totalBalance={
                      fromTokens.length > 0
                        ? String(fromTokens[0].balance).replace(/[^0-9.]/g, "")
                        : maxBalance || "0"
                    }
                    usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                    fromTokens={fromTokens}
                    onOpenSourcePicker={() => setSwapStep("choose-swap-asset")}
                    onSetPercent={(pct) => {
                      if (!maxBalance) return;
                      const num = parseFloat(maxBalance) * (pct / 100);
                      setAmount(num.toFixed(6).replace(/\.?0+$/, ""));
                    }}
                  />

                  {txError && <StatusAlert type="error" message={txError} />}

                  <div
                    style={{
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <button
                      onClick={handleEnterPreview}
                      disabled={isDepositCtaDisabled}
                      style={{
                        alignItems: "center",
                        backgroundColor: isDepositCtaDisabled
                          ? "#F0F0EF"
                          : "#006BF4",
                        borderRadius: "8px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexShrink: 0,
                        height: "48px",
                        justifyContent: "center",
                        paddingInline: "16px",
                        border: "none",
                        cursor: isDepositCtaDisabled ? "default" : "pointer",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          boxSizing: "border-box",
                          color: isDepositCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                          fontFamily: '"Geist", system-ui, sans-serif',
                          fontSize: "16px",
                          fontWeight: 500,
                          lineHeight: "24px",
                        }}
                      >
                        {quoteCtaLabel("Review deposit")}
                      </div>
                    </button>
                  </div>
                </>
              )}
            </>
          )}

        {/* =============================================================== */}
        {/* SEND MODE — recipient first, then amount, then asset         */}
        {/* =============================================================== */}
        {activeMode === "send" &&
          [
            "idle",
            "choose-swap-asset",
            "choose-receive-asset",
            "enter-recipient",
          ].includes(swapStep) && (
            <>
              <SendIdleForm
                amount={amount}
                onAmountChange={setAmount}
                toToken={toToken}
                totalBalance={
                  fromTokens.length > 0
                    ? String(fromTokens[0].balance).replace(/[^0-9.]/g, "")
                    : maxBalance || "0"
                }
                usdValue={amount && usdValue > 0 ? usdValue.toFixed(2) : ""}
                onOpenAssetPicker={() => setSwapStep("choose-receive-asset")}
                onOpenRecipientPicker={() => setSwapStep("enter-recipient")}
                recipientAddress={recipientAddress || ""}
                onMax={() => {
                  if (!maxBalance) return;
                  setAmount(maxBalance);
                }}
              />

              {txError && <StatusAlert type="error" message={txError} />}

              <div
                style={{
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <button
                  onClick={handleEnterPreview}
                  disabled={isSendCtaDisabled}
                  style={{
                    alignItems: "center",
                    backgroundColor: isSendCtaDisabled ? "#F0F0EF" : "#006BF4",
                    borderRadius: "8px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexShrink: 0,
                    height: "48px",
                    justifyContent: "center",
                    paddingInline: "16px",
                    border: "none",
                    cursor: isSendCtaDisabled ? "default" : "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      boxSizing: "border-box",
                      color: isSendCtaDisabled ? "#9E9E9C" : "#FFFFFE",
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontSize: "16px",
                      fontWeight: 500,
                      lineHeight: "24px",
                    }}
                  >
                    {quoteCtaLabel("Review send")}
                  </div>
                </button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

export default NexusOne;
