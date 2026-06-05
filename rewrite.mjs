import fs from 'fs';
let content = fs.readFileSync('registry/nexus-elements/nexus-one/nexus-one.tsx', 'utf8');

// 1. replace state
content = content.replace(
  'const [fromToken, setFromToken] = useState<SwapTokenOption | undefined>(\n    undefined,\n  );',
  'const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);'
);
content = content.replace(
  'const [fromToken, setFromToken] = useState<SwapTokenOption | undefined>(undefined);',
  'const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);'
);

// handle edge case where spacing changes
content = content.replace(/const \[fromToken, setFromToken\] = useState<SwapTokenOption \| undefined>\(\s*undefined,?\s*\);/m, 'const [fromTokens, setFromTokens] = useState<SwapTokenOption[]>([]);');

content = content.replace(/setFromToken\(undefined\)/g, 'setFromTokens([])');
content = content.replace(/if \(!fromToken \|\| !toToken \|\| !amount\) return;/, 'if (fromTokens.length === 0 || !toToken || !amount) return;');
content = content.replace(/if \(!nexusSDK \|\| !fromToken \|\| !toToken \|\| !amount\) return;/, 'if (!nexusSDK || fromTokens.length === 0 || !toToken || !amount) return;');
content = content.replace(/fromToken\.decimals/g, 'fromTokens[0].decimals');

content = content.replace(
/from: \[\s*\{\s*chainId: fromToken\.chainId!,\s*tokenAddress: fromToken\.contractAddress as `0x\$\{string\}`,\s*amount: amountBigInt,\s*\}\,\s*\]\,/,
`from: fromTokens.map(t => ({
              chainId: t.chainId!,
              tokenAddress: t.contractAddress as \`0x\${string}\`,
              amount: amountBigInt / BigInt(fromTokens.length || 1),
            })),`
);

content = content.replace(
/\.\.\.\(fromToken\.chainId\s*\?\s*\{\s*fromSources: \[\s*\{\s*chainId: fromToken\.chainId,\s*tokenAddress: fromToken\.contractAddress as `0x\$\{string\}`,\s*\}\,\s*\]\,\s*\}\s*: \{\}\)\,/m,
`...(fromTokens.length > 0 ? {
                fromSources: fromTokens.map(t => ({
                  chainId: t.chainId!,
                  tokenAddress: t.contractAddress as \`0x\${string}\`
                }))
              } : {}),`
);

content = content.replace(/{} asset\(s\) selected/g, '{activeMode === "swap" && swapType === "exactIn" && swapStep === "choose-swap-asset" ? `${fromTokens.length} asset(s) selected` : ""}');
content = content.replace(/<span[\s\S]*?>\s*\{\} asset\(s\) selected\s*<\/span>/, 
`{activeMode === "swap" && swapStep === "choose-swap-asset" && swapType === "exactIn" && (
                <span
                  style={{
                    fontFamily: "var(--font-geist-sans), sans-serif",
                    fontSize: "13px",
                    color: "var(--foreground-muted, #848483)",
                  }}
                >
                  {fromTokens.length} asset(s) selected
                </span>
              )}`
);

content = content.replace(/fromToken=\{fromToken\}/g, 'fromToken={fromTokens[0]}');
content = content.replace(/fromToken\?\.symbol/g, 'fromTokens[0]?.symbol');
content = content.replace(/fromToken\s*\?\s*String\(fromToken\.balance\)\.replace\(\/\[\^0\-9\.\]\/g\, \"\"\)\s*:\s*maxBalance/, 
  'fromTokens.length > 0 ? String(fromTokens[0].balance).replace(/[^0-9.]/g, "") : maxBalance'
);

const exactInReplacement = `<SwapAssetSelector
                  title={
                    swapType === "exactIn"
                      ? "Choose assets to Swap"
                      : "Choose asset to Receive"
                  }
                  swapBalance={swapBalance}
                  isMulti={swapType === "exactIn"}
                  selectedTokens={fromTokens}
                  onToggle={(token) => {
                    setFromTokens((prev) => {
                      const exists = prev.find(
                        (t) =>
                          t.contractAddress === token.contractAddress &&
                          t.chainId === token.chainId
                      );
                      if (exists)
                        return prev.filter(
                          (t) =>
                            !(
                              t.contractAddress === token.contractAddress &&
                              t.chainId === token.chainId
                            )
                        );
                      return [...prev, token];
                    });
                  }}
                  onDone={() => setSwapStep("idle")}
                  onSelect={(token) => {
                    if (swapType === "exactIn") {
                      setFromTokens([token]);
                      setSwapStep("choose-receive-asset");
                    } else {
                      setToToken(token);
                      setSwapStep("idle");
                    }
                  }}
                  onBack={() => setSwapStep("idle")}
                />`;

// Replace `<SwapAssetSelector ... />` block in `swapStep === "choose-swap-asset"`
content = content.replace(/<SwapAssetSelector[\s\S]*?onBack=\{.*?\}\s*\/>/m, exactInReplacement);

// Replace Swap Chip rendering
content = content.replace(/\{fromToken \? \([\s\S]*?\) : \(\s*<div className="flex gap-4 items-center">[\s\S]*?Choose asset\s*<\/span>\s*<\/div>\s*<\/div>\s*\)\}/m,
`{fromTokens.length > 0 ? (
                        <div className="flex items-center gap-x-3">
                          <div className="relative shrink-0">
                            {fromTokens[0].logo ? (
                              <img
                                src={fromTokens[0].logo}
                                alt={fromTokens[0].symbol}
                                className="w-9 h-9 rounded-full border border-gray-100 object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                {fromTokens[0].symbol.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-start justify-center">
                            <span
                              style={{
                                fontFamily: "var(--font-geist-sans), sans-serif",
                                fontSize: "14px",
                                fontWeight: 500,
                                color: "var(--foreground-primary, #161615)",
                              }}
                            >
                              {fromTokens[0].symbol} {fromTokens.length > 1 ? \`+ \${fromTokens.length - 1}\` : ""}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-geist-sans), sans-serif",
                                fontSize: "12px",
                                color: "var(--foreground-muted, #848483)",
                              }}
                            >
                              {fromTokens.length > 1 ? \`\${fromTokens.length} Chains\` : fromTokens[0].chainName}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4 items-center">
                          <div className="h-6 w-6 rounded-full flex items-center justify-center bg-[#006BF4]">
                            <PlusIcon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              style={{
                                fontFamily: "var(--font-geist-sans), sans-serif",
                                fontSize: "14px",
                                color: "var(--foreground-primary, #161615)",
                              }}
                            >
                              {swapType === "exactIn" && "Swap"}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-geist-sans), sans-serif",
                                fontSize: "13px",
                                color: "var(--widget-card-foreground-muted, #848483)",
                              }}
                            >
                              Choose asset
                            </span>
                          </div>
                        </div>
                      )}`);


// Replace exactIn and exactOut Chips rendering
const exactOutRegex = /\{\/\* Receive asset chip — only for exactIn after source is chosen \*\/\}.*?\{\/\* Exact Out — only "Receive" chip first, then from is auto \*\/\}\s*\{swapType === "exactOut" && \(\s*<button.*?<\/button>\s*\)\}/s;

content = content.replace(/\{\/\* Receive asset chip[\s\S]*?(?=\{\/\* Exact Out — only "Receive")/, "");

content = content.replace(/\{\/\* Exact Out — only "Receive" chip first, then from is auto \*\/\}[\s\S]*?(?=<div className="pt-2">)/, 
`{/* Receive asset chip — shown in exactOut ALWAYS, or in exactIn IF fromTokens chosen */}
                  {(swapType === "exactOut" || (swapType === "exactIn" && fromTokens.length > 0)) && (
                    <button
                      onClick={() => setSwapStep(swapType === "exactOut" ? "choose-swap-asset" : "choose-receive-asset")}
                      className="w-full flex items-center justify-between p-5 bg-white gap-y-3 min-h-[72px]"
                      style={{
                        borderRadius: "12px",
                        border: "1px solid var(--border-default, #E8E8E7)",
                        boxShadow: "0px 1px 12px 0px #5B5B5B0D",
                        background: "#FFFFFF",
                      }}
                    >
                      <div className="flex items-center gap-x-3 w-full justify-between">
                        {toToken ? (
                          <div className="flex items-center gap-x-3">
                            <div className="relative shrink-0">
                              {toToken.logo ? (
                                <img
                                  src={toToken.logo}
                                  alt={toToken.symbol}
                                  className="w-9 h-9 rounded-full border border-gray-100 object-cover"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                                  {toToken.symbol.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-start justify-center">
                              <span
                                style={{
                                  fontFamily: "var(--font-geist-sans), sans-serif",
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  color: "var(--foreground-primary, #161615)",
                                }}
                              >
                                {toToken.symbol}
                              </span>
                              {toToken.chainName && (
                                <span
                                  style={{
                                    fontFamily: "var(--font-geist-sans), sans-serif",
                                    fontSize: "12px",
                                    color: "var(--foreground-muted, #848483)",
                                  }}
                                >
                                  {toToken.chainName}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-4 items-center">
                            <div className="h-6 w-6 rounded-full flex items-center justify-center bg-[#006BF4]">
                              <PlusIcon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                style={{
                                  fontFamily: "var(--font-geist-sans), sans-serif",
                                  fontSize: "14px",
                                  color: "var(--foreground-primary, #161615)",
                                }}
                              >
                                Receive
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--font-geist-sans), sans-serif",
                                  fontSize: "13px",
                                  color: "var(--widget-card-foreground-muted, #848483)",
                                }}
                              >
                                Choose asset
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-x-1">
                          {toToken && (
                            <span
                              style={{
                                fontFamily: "var(--font-geist-sans), sans-serif",
                                fontSize: "11px",
                                color: "var(--interactive-button-primary-background, #006BF4)",
                                fontWeight: 500,
                              }}
                            >
                              Edit
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )}
                  `);


fs.writeFileSync('registry/nexus-elements/nexus-one/nexus-one.tsx', content);
