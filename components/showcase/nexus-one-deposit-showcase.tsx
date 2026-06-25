"use client";
import React, { useState } from "react";
import ShowcaseWrapper from "./showcase-wrapper";
import { NexusWidget } from "@/registry/nexus-elements/nexus-one/nexus-one";
import { encodeFunctionData, parseAbi, isAddress, maxUint256 } from "viem";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";

const AAVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "address", name: "onBehalfOf", type: "address" },
      { internalType: "uint16", name: "referralCode", type: "uint16" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const COMPOUND_ABI = [
  {
    inputs: [
      { internalType: "address", name: "asset", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const FLUID_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "assets_", type: "uint256" },
      { internalType: "address", name: "receiver_", type: "address" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "shares_", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const MYSTIC_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
    ],
    name: "deposit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ZENTRA_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "asset",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "onBehalfOf",
        type: "address",
      },
      {
        internalType: "uint16",
        name: "referralCode",
        type: "uint16",
      },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const OPPORTUNITIES = {
  // 1. Aave on Arbitrum (USDT)
  "aave-arb-usdt": {
    protocol: "Aave",
    depositTargetLogo:
      "https://files.availproject.org/uploads/2026-04-16/aave.svg",
    chainId: 42161,
    tokenSymbol: "USDT",
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const,
    tokenDecimals: 6,
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdt/logo.png",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" as const,
      data: encodeFunctionData({
        abi: AAVE_ABI,
        functionName: "supply",
        args: [tokenAddress, amount, user, 0],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" as const,
      },
    }),
  },

  // 2. Aave on Ethereum (GHO)
  "aave-eth-gho": {
    title: "Custom Title Example",
    protocol: "Aave",
    depositTargetLogo:
      "https://files.availproject.org/uploads/2026-04-16/aave.svg",
    chainId: 1,
    tokenSymbol: "GHO",
    tokenAddress: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f" as const,
    tokenDecimals: 18,
    tokenLogo: "https://s2.coinmarketcap.com/static/img/coins/64x64/23508.png",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as const,
      data: encodeFunctionData({
        abi: AAVE_ABI,
        functionName: "supply",
        args: [tokenAddress, amount, user, 0],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as const,
      },
    }),
  },

  // 3. Compound on Polygon (USDT)
  "compound-pol-usdt": {
    protocol: "Compound",
    depositTargetLogo:
      "https://files.availproject.org/uploads/2026-04-16/compound.svg",
    chainId: 137,
    tokenSymbol: "USDT",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as const,
    tokenDecimals: 6,
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdt/logo.png",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0xaeB318360f27748Acb200CE616E389A6C9409a07" as const,
      data: encodeFunctionData({
        abi: COMPOUND_ABI,
        functionName: "supply",
        args: [tokenAddress, amount],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0xaeB318360f27748Acb200CE616E389A6C9409a07" as const,
      },
    }),
  },

  // 4. Fluid on Base (USDC)
  "fluid-base-usdc": {
    protocol: "Fluid",
    depositTargetLogo: "https://fluid.instad.app/images/logo.png",
    chainId: 8453,
    tokenSymbol: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
    tokenDecimals: 6,
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdc/logo.png",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169" as const,
      data: encodeFunctionData({
        abi: FLUID_ABI,
        functionName: "deposit",
        args: [amount, user],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169" as const,
      },
    }),
  },

  // 5. Mystic on Citrea (ctUSD)
  "mystic-citrea-ctusd": {
    protocol: "Mystic",
    depositTargetLogo:
      "https://files.availproject.org/nexus-elements/mystic.png",
    chainId: 4114,
    tokenSymbol: "ctUSD",
    tokenAddress: "0x8D82c4E3c936C7B5724A382a9c5a4E6Eb7aB6d5D" as const,
    tokenDecimals: 18,
    tokenLogo: "https://files.availproject.org/nexus-elements/ctUSD.svg",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0x72f8C254548839Fa1Db4156aE01d8C6ae5885EE4" as const,
      data: encodeFunctionData({
        abi: MYSTIC_ABI,
        functionName: "deposit",
        args: [amount, user],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0x72f8C254548839Fa1Db4156aE01d8C6ae5885EE4" as const,
      },
    }),
  },

  // 6. Zentra on Citrea (wcBTC)
  "zentra-citrea-wcbtc": {
    protocol: "Zentra",
    depositTargetLogo:
      "https://zentrafinance.gitbook.io/zentra/~gitbook/image?url=https%3A%2F%2F2899070418-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Forganizations%252F1jzW9aBSq190MuRJKgIj%252Fsites%252Fsite_2l6Ro%252Ficon%252Fb8adwB6RA7Y6VJH3vGjh%252FZentra%2520%284%29.png%3Falt%3Dmedia%26token%3D8aa44578-e817-4c2f-b20e-abd25827d4fe&width=32&dpr=3&quality=100&sign=d18163fe&sv=2",
    chainId: 4114,
    tokenSymbol: "wcBTC",
    tokenAddress: "0x3100000000000000000000000000000000000006" as const,
    tokenDecimals: 18,
    tokenLogo:
      "https://assets.coingecko.com/coins/images/102172843/standard/cBTC.png",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => ({
      to: "0xfb7908150b738e7dB9862007c66C9eb7850706F5" as const,
      data: encodeFunctionData({
        abi: ZENTRA_ABI,
        functionName: "supply",
        args: [tokenAddress, amount, user, 0],
      }),
      tokenApproval: {
        token: tokenAddress,
        amount,
        spender: "0xfb7908150b738e7dB9862007c66C9eb7850706F5" as const,
      },
    }),
  },
} as const;

const NexusWidgetDepositShowcase = () => {
  const { address } = useAccount();
  const { setOpen } = useModal();
  const [selectedOpt, setSelectedOpt] = useState<
    keyof typeof OPPORTUNITIES | "sandbox"
  >("aave-arb-usdt");
  const [isOpen, setIsOpen] = useState(false);
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);

  // Default sandbox configuration state
  const [sandboxConfig, setSandboxConfig] = useState<{
    title: string;
    protocol: string;
    depositTargetLogo?: string;
    chainId: number;
    tokenSymbol: string;
    tokenAddress: `0x${string}`;
    tokenDecimals: number;
    tokenLogo?: string;
    executeDeposit: any;
    targetContract: string;
    abiText: string;
    functionName: string;
    argsText: string;
    enableApproval: boolean;
    approvalAmountType: "required" | "infinite";
    gasLimit: string;
  }>({
    title: "Sandbox",
    protocol: "Sandbox",
    depositTargetLogo:
      "https://files.availproject.org/uploads/2026-04-16/aave.svg",
    chainId: 42161,
    tokenSymbol: "USDC",
    tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    tokenDecimals: 6,
    tokenLogo:
      "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdc/logo.png",
    targetContract: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    abiText: `// Paste JSON ABI or human-readable signatures (one per line)\ndeposit(uint256 assets, address receiver)`,
    functionName: "deposit",
    argsText: `["{{amount}}", "{{user}}"]`,
    enableApproval: true,
    approvalAmountType: "required",
    gasLimit: "",
    executeDeposit: (
      symbol: string,
      tokenAddress: `0x${string}`,
      amount: bigint,
      chainId: number,
      user: `0x${string}`,
    ) => {
      return {
        to: "0xE592427A0AEce92De3Edee1F18E0157C05861564" as const,
        data: encodeFunctionData({
          abi: [
            {
              inputs: [
                { internalType: "uint256", name: "assets", type: "uint256" },
                { internalType: "address", name: "receiver", type: "address" },
              ],
              name: "deposit",
              outputs: [],
              stateMutability: "nonpayable",
              type: "function",
            },
          ],
          functionName: "deposit",
          args: [amount, user],
        }),
        tokenApproval: {
          token: tokenAddress,
          amount,
          spender: "0xE592427A0AEce92De3Edee1F18E0157C05861564" as const,
        },
      };
    },
  });

  // Sandbox form states (initialized with sandboxConfig defaults)
  const [formProtocol, setFormProtocol] = useState("Sandbox");
  const [formChainId, setFormChainId] = useState<number>(42161);
  const [formTokenSymbol, setFormTokenSymbol] = useState("USDC");
  const [formTokenAddress, setFormTokenAddress] = useState(
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  );
  const [formTokenDecimals, setFormTokenDecimals] = useState<number>(6);
  const [formTargetContract, setFormTargetContract] = useState(
    "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  );
  const [formAbiText, setFormAbiText] = useState(
    `// Paste JSON ABI or human-readable signatures (one per line)\ndeposit(uint256 assets, address receiver)`,
  );
  const [formFunctionName, setFormFunctionName] = useState("deposit");
  const [formArgsText, setFormArgsText] = useState(
    `["{{amount}}", "{{user}}"]`,
  );
  const [formProtocolLogo, setFormProtocolLogo] = useState(
    "https://files.availproject.org/uploads/2026-04-16/aave.svg",
  );
  const [formTokenLogo, setFormTokenLogo] = useState(
    "https://raw.githubusercontent.com/availproject/nexus-assets/refs/heads/main/tokens/usdc/logo.png",
  );
  const [formEnableApproval, setFormEnableApproval] = useState(true);
  const [formApprovalAmountType, setFormApprovalAmountType] = useState<"required" | "infinite">("required");
  const [formGasLimit, setFormGasLimit] = useState("");
  const [formError, setFormError] = useState("");

  const openSandboxModal = () => {
    setFormProtocol(sandboxConfig.protocol);
    setFormChainId(sandboxConfig.chainId);
    setFormTokenSymbol(sandboxConfig.tokenSymbol);
    setFormTokenAddress(sandboxConfig.tokenAddress);
    setFormTokenDecimals(sandboxConfig.tokenDecimals);
    setFormTargetContract(sandboxConfig.targetContract);
    setFormAbiText(sandboxConfig.abiText);
    setFormFunctionName(sandboxConfig.functionName);
    setFormArgsText(sandboxConfig.argsText);
    setFormProtocolLogo(sandboxConfig.depositTargetLogo || "");
    setFormTokenLogo(sandboxConfig.tokenLogo || "");
    setFormEnableApproval(sandboxConfig.enableApproval);
    setFormApprovalAmountType(sandboxConfig.approvalAmountType);
    setFormGasLimit(sandboxConfig.gasLimit);
    setFormError("");
    setIsSandboxModalOpen(true);
  };

  const handleApplySandbox = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formProtocol.trim()) {
      setFormError("Protocol name is required");
      return;
    }
    if (!isAddress(formTokenAddress)) {
      setFormError("Invalid token address format");
      return;
    }
    if (!isAddress(formTargetContract)) {
      setFormError("Invalid target contract address format");
      return;
    }
    if (!formFunctionName.trim()) {
      setFormError("Function name is required");
      return;
    }

    let parsedArgs: any[] = [];
    try {
      parsedArgs = JSON.parse(formArgsText);
      if (!Array.isArray(parsedArgs)) {
        setFormError("Arguments must be a valid JSON array");
        return;
      }
    } catch (err) {
      setFormError("Invalid JSON in arguments mapping");
      return;
    }

    let parsedAbi: any;
    try {
      // Try JSON first
      parsedAbi = JSON.parse(formAbiText);
    } catch (err) {
      // Try human readable format
      try {
        const cleanLines = formAbiText
          .split("\n")
          .map((line) => line.trim())
          .filter(
            (line) => line && !line.startsWith("//") && !line.startsWith("/*"),
          );

        if (cleanLines.length === 0) {
          setFormError("ABI input is empty");
          return;
        }

        const normalizedLines = cleanLines.map((line) => {
          if (
            line.startsWith("function ") ||
            line.startsWith("constructor") ||
            line.startsWith("event") ||
            line.startsWith("error")
          ) {
            return line;
          }
          return `function ${line}`;
        });

        parsedAbi = parseAbi(normalizedLines);
      } catch (abiErr: any) {
        setFormError(`Failed to parse ABI: ${abiErr?.message || abiErr}`);
        return;
      }
    }

    const config = {
      title: formProtocol,
      protocol: formProtocol,
      depositTargetLogo: formProtocolLogo.trim() || undefined,
      chainId: formChainId,
      tokenSymbol: formTokenSymbol,
      tokenAddress: formTokenAddress as `0x${string}`,
      tokenDecimals: formTokenDecimals,
      tokenLogo: formTokenLogo.trim() || undefined,
      targetContract: formTargetContract,
      abiText: formAbiText,
      functionName: formFunctionName,
      argsText: formArgsText,
      enableApproval: formEnableApproval,
      approvalAmountType: formApprovalAmountType,
      gasLimit: formGasLimit,
      executeDeposit: (
        symbol: string,
        tokenAddress: `0x${string}`,
        amount: bigint,
        chainId: number,
        user: `0x${string}`,
      ) => {
        const resolvedArgs = parsedArgs.map((arg: any) => {
          if (arg === "{{token}}" || arg === "{{asset}}") return tokenAddress;
          if (arg === "{{amount}}" || arg === "{{assets}}") return amount;
          if (
            arg === "{{user}}" ||
            arg === "{{receiver}}" ||
            arg === "{{onBehalfOf}}"
          )
            return user;
          return arg;
        });

        const executeResult: any = {
          to: formTargetContract as `0x${string}`,
          data: encodeFunctionData({
            abi: parsedAbi,
            functionName: formFunctionName,
            args: resolvedArgs,
          }),
        };

        if (formEnableApproval) {
          executeResult.tokenApproval = {
            token: tokenAddress,
            amount: formApprovalAmountType === "infinite" ? maxUint256 : amount,
            spender: formTargetContract as `0x${string}`,
          };
        }

        if (formGasLimit.trim()) {
          const parsedGas = parseInt(formGasLimit.trim(), 10);
          if (!isNaN(parsedGas) && parsedGas > 0) {
            executeResult.gas = BigInt(parsedGas);
          }
        }

        return executeResult;
      },
    };

    setSandboxConfig(config);
    setSelectedOpt("sandbox");
    setIsSandboxModalOpen(false);
  };

  const currentOpportunity =
    selectedOpt === "sandbox"
      ? sandboxConfig
      : OPPORTUNITIES[selectedOpt as keyof typeof OPPORTUNITIES];

  return (
    <ShowcaseWrapper
      type="nexus-one"
      connectLabel="Connect wallet to use Deposit"
    >
      <div className="flex flex-col gap-6 w-full items-center">
        {/* Custom Dropdown Selector */}
        <div className="w-full max-w-sm flex flex-col gap-1.5 relative">
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Select Deposit Protocol
          </label>

          <div className="flex gap-2 w-full">
            {/* Trigger Button */}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-between flex-1 h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-2">
                {currentOpportunity.depositTargetLogo && (
                  <img
                    src={currentOpportunity.depositTargetLogo}
                    alt="Deposit target logo"
                    className="w-5 h-5 rounded-full object-contain"
                  />
                )}
                <span className="font-semibold text-sm">
                  {currentOpportunity.protocol} -{" "}
                  {currentOpportunity.tokenSymbol} (
                  {currentOpportunity.chainId === 42161
                    ? "Arbitrum"
                    : currentOpportunity.chainId === 1
                      ? "Ethereum"
                      : currentOpportunity.chainId === 137
                        ? "Polygon"
                        : currentOpportunity.chainId === 8453
                          ? "Base"
                          : currentOpportunity.chainId === 4114
                            ? "Citrea"
                            : `Chain ID: ${currentOpportunity.chainId}`}
                  )
                </span>
              </div>

              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Configure Sandbox Button */}
            {selectedOpt === "sandbox" && (
              <button
                type="button"
                onClick={() => openSandboxModal()}
                className="flex items-center justify-center h-11 w-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold cursor-pointer transition-all shadow-sm"
                title="Configure Sandbox"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown Menu */}
          {isOpen && (
            <>
              {/* Click outside overlay */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />

              <div className="absolute top-[68px] left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1.5 z-20 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-100">
                {Object.entries(OPPORTUNITIES).map(([key, opt]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedOpt(key as any);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3.5 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all ${
                      selectedOpt === key
                        ? "bg-zinc-50 dark:bg-zinc-800/80 font-medium text-blue-600 dark:text-blue-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {opt.depositTargetLogo && (
                        <img
                          src={opt.depositTargetLogo}
                          alt="deposit target logo"
                          className="w-5 h-5 rounded-full object-contain"
                        />
                      )}
                      <span>
                        {opt.protocol} - {opt.tokenSymbol} (
                        {opt.chainId === 42161
                          ? "Arbitrum"
                          : opt.chainId === 1
                            ? "Ethereum"
                            : opt.chainId === 137
                              ? "Polygon"
                              : opt.chainId === 8453
                                ? "Base"
                                : "Citrea"}
                        )
                      </span>
                    </div>

                    {selectedOpt === key && (
                      <svg
                        className="w-4 h-4 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}

                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1.5" />

                <button
                  type="button"
                  onClick={() => {
                    openSandboxModal();
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all ${
                    selectedOpt === "sandbox"
                      ? "bg-zinc-50 dark:bg-zinc-800/80 font-medium text-blue-600 dark:text-blue-400"
                      : "text-blue-600 dark:text-blue-400 font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>Test your own (Sandbox)</span>
                  </div>
                  {selectedOpt === "sandbox" && (
                    <svg
                      className="w-4 h-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <div
          className="flex w-full justify-center"
          style={{
            alignItems: "flex-start",
          }}
        >
          <NexusWidget
            key={selectedOpt}
            config={{
              mode: "deposit",
              deposit: currentOpportunity as any,
            }}
            connectedAddress={address}
            onConnectClick={() => setOpen(true)}
          />
        </div>
      </div>

      {/* Sandbox Config Modal Dialog */}
      {isSandboxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSandboxModalOpen(false)}
          />
          {/* Modal Content */}
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                  Configure Sandbox Deposit
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Configure a custom vault or deposit function to test with
                  NexusWidget.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSandboxModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleApplySandbox} className="flex flex-col gap-4">
              {formError && (
                <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50">
                  {formError}
                </div>
              )}

              {/* Protocol & Chain */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    Protocol Name
                  </label>
                  <input
                    type="text"
                    value={formProtocol}
                    onChange={(e) => setFormProtocol(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. My Vault"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    Chain ID
                  </label>
                  <select
                    value={formChainId}
                    onChange={(e) => setFormChainId(Number(e.target.value))}
                    className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Ethereum (1)</option>
                    <option value={42161}>Arbitrum (42161)</option>
                    <option value={137}>Polygon (137)</option>
                    <option value={8453}>Base (8453)</option>
                    <option value={4114}>Citrea (4114)</option>
                  </select>
                </div>
              </div>

              {/* Protocol Logo URL */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Protocol Logo URL
                </label>
                <input
                  type="text"
                  value={formProtocolLogo}
                  onChange={(e) => setFormProtocolLogo(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              {/* Token Configuration */}
              <div className="border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3 flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Token Settings
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-xs text-zinc-600 dark:text-zinc-400">
                      Symbol
                    </label>
                    <input
                      type="text"
                      value={formTokenSymbol}
                      onChange={(e) => setFormTokenSymbol(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="USDC"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs text-zinc-600 dark:text-zinc-400">
                      Decimals
                    </label>
                    <input
                      type="number"
                      value={formTokenDecimals}
                      onChange={(e) =>
                        setFormTokenDecimals(Number(e.target.value))
                      }
                      className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      max={36}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    Token Contract Address
                  </label>
                  <input
                    type="text"
                    value={formTokenAddress}
                    onChange={(e) => setFormTokenAddress(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0x..."
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    Token Logo URL
                  </label>
                  <input
                    type="text"
                    value={formTokenLogo}
                    onChange={(e) => setFormTokenLogo(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Target Spender */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Target Vault / Deposit Contract Address
                </label>
                <input
                  type="text"
                  value={formTargetContract}
                  onChange={(e) => setFormTargetContract(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0x..."
                  required
                />
                <span className="text-[10px] text-zinc-400">
                  Tokens will be approved for and deposited to this contract.
                </span>
              </div>

              {/* Function & ABI Call */}
              <div className="border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3 flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  ABI & Call Settings
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    Function Name
                  </label>
                  <input
                    type="text"
                    value={formFunctionName}
                    onChange={(e) => setFormFunctionName(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="deposit"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    ABI (JSON array or one-line human readable signature)
                  </label>
                  <textarea
                    value={formAbiText}
                    onChange={(e) => setFormAbiText(e.target.value)}
                    className="h-24 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g. deposit(uint256 assets, address receiver)"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    Arguments Mapping (JSON Array)
                  </label>
                  <input
                    type="text"
                    value={formArgsText}
                    onChange={(e) => setFormArgsText(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder='["{{amount}}", "{{user}}"]'
                    required
                  />
                  <div className="text-[10px] text-zinc-400 leading-tight">
                    Placeholders:{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      {"{{amount}}"}
                    </code>
                    ,{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      {"{{user}}"}
                    </code>
                    ,{" "}
                    <code className="text-zinc-600 dark:text-zinc-300">
                      {"{{token}}"}
                    </code>
                  </div>
                </div>
              </div>

              {/* Token Approval Settings */}
              <div className="border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Enable Token Approval
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Whether the token should be approved before deposit execution
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormEnableApproval(!formEnableApproval)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formEnableApproval ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formEnableApproval ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {formEnableApproval && (
                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
                    <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      Approval Amount
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormApprovalAmountType("required")}
                        className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          formApprovalAmountType === "required"
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Required Amount
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormApprovalAmountType("infinite")}
                        className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          formApprovalAmountType === "infinite"
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Infinite (MAXUint256)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Gas Limit Setting */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Gas Limit (Optional)
                </label>
                <input
                  type="text"
                  value={formGasLimit}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d+$/.test(val)) {
                      setFormGasLimit(val);
                    }
                  }}
                  className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 300000"
                />
                <span className="text-[10px] text-zinc-400 leading-tight">
                  Manually set gas limit. Saves from simulation/estimation failures on complex contracts.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSandboxModalOpen(false)}
                  className="h-10 px-4 rounded-lg text-sm font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-all"
                >
                  Apply Sandbox Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ShowcaseWrapper>
  );
};

export default NexusWidgetDepositShowcase;
