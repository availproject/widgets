import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildStatusRows, NexusWidgetProgressScreen, type NexusWidgetProgressEvent } from "../registry/avail-widgets/nexus-widget/components/nexus-widget-progress-screen";
import { NexusWidgetThemeContext } from "../registry/avail-widgets/nexus-widget/theme-context";

const chain = { id: 42161, name: "Arbitrum" };
const token = { contractAddress: "0xusdc", symbol: "USDC" };
const allowance = { id: "allowance:destination:42161:usdc", typeID: "allowance:destination:42161:usdc", type: "ALLOWANCE", method: "permit", token, chain };
const destination = { id: "destination_swap:42161", typeID: "destination_swap:42161", type: "DESTINATION_SWAP", chain, swaps: [{ input: token }] };
const execute = { id: "execute_transaction", typeID: "execute_transaction", type: "TRANSACTION_SENT", chain };
const source = { ...destination, id: "source_swap:42161", typeID: "source_swap:42161", type: "SOURCE_SWAP" };
const plan = (steps: any[]): NexusWidgetProgressEvent => ({ id: "plan", name: "swap_plan_list", steps, completed: false });
const progress = (step: any, state: string): NexusWidgetProgressEvent => ({ id: `${step.id}:${state}`, name: "swap_plan_progress", step, event: { type: "plan_progress", state }, completed: state === "confirmed" || state === "completed" });
const rows = (events: NexusWidgetProgressEvent[], failedStep?: any, steps: any[] = []) => buildStatusRows({ events, mode: "deposit", steps, failedStep, context: { destinationChain: "Arbitrum", destinationSymbol: "USDT", opportunityName: "Aave" } });
const row = (events: NexusWidgetProgressEvent[], id: string) => rows(events).find((item) => item.id === id);

const depositOnlyRows = (events: NexusWidgetProgressEvent[] = [], failedStep?: any, isRejected = false) =>
  buildStatusRows({
    events, failedStep, isRejected, mode: "deposit", steps: [],
    context: { swapRequired: false, destinationSymbol: "USDC", opportunityName: "Aave" },
  });

test("no-swap deposit has one status from review through approval and submission", () => {
  const approval = { id: "execute_approval", type: "APPROVAL", chain };
  for (const events of [
    [],
    [plan([approval, execute])],
    [plan([approval, execute]), progress(approval, "wallet_prompted")],
    [plan([approval, execute]), progress(execute, "submitted")],
  ]) {
    const result = depositOnlyRows(events);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "action");
    assert.equal(result[0].label, "Deposit in progress");
  }
});

test("no-swap deposit keeps completion and failure truthful in the single row", () => {
  const confirmed = { ...execute, type: "TRANSACTION_CONFIRMED" };
  assert.equal(depositOnlyRows([progress(confirmed, "confirmed")])[0].state, "completed");
  assert.equal(depositOnlyRows([progress(confirmed, "confirmed")])[0].label, "USDC deposited to Aave");
  assert.equal(depositOnlyRows([], execute)[0].state, "error");
  assert.equal(depositOnlyRows([], execute)[0].label, "Deposit failed. Funds are in your wallet.");
  assert.equal(depositOnlyRows([], execute, true)[0].label, "Deposit cancelled by user");
});

test("a skipped-swap event also collapses deposit progress without intent metadata", () => {
  const result = rows([progress({ id: "skipped", type: "SWAP_SKIPPED" }, "completed")]);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, "Deposit in progress");
});

test("missing swapRequired metadata does not hide a required swap", () => {
  const result = rows([plan([source, destination, execute])]);
  assert.ok(result.some((item) => item.id === "swapTokens"));
  assert.ok(result.some((item) => item.id === "receiveToken"));
});

test("progress screen passes the reviewed no-swap flag to its rendered statuses", () => {
  const html = renderToStaticMarkup(createElement(NexusWidgetProgressScreen, {
    mode: "deposit",
    intentData: {
      swapRequired: false,
      sources: [],
      destination: {
        chain: { id: 42161, name: "Arbitrum" },
        token: { symbol: "USDC", decimals: 6 },
        amount: "5",
      },
    } as any,
  }));
  assert.equal(html.match(/Deposit in progress/g)?.length, 1);
  assert.doesNotMatch(html, /Swaps in progress|Swap tokens|Receiving USDC|Receive USDC/);
});

test("same-chain USDC to USDT deposit shows its destination permit before SDK progress", () => {
  const events = [plan([allowance, destination, execute])];
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  assert.equal(row(events, "approveTokens")?.description, "Sign permit for USDC in wallet");
  assert.equal(row(events, "receiveToken")?.state, "default");
  assert.equal(row(events, "action")?.state, "default");
});

test("destination wallet prompt remains an approval until authorization finishes", () => {
  const events = [plan([allowance, destination, execute]), progress(destination, "wallet_prompted")];
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  assert.equal(row(events, "receiveToken")?.state, "default");
  events.push(progress(destination, "started"));
  assert.equal(row(events, "approveTokens")?.state, "completed");
  assert.equal(row(events, "receiveToken")?.state, "inProgress");
  events.push(progress(destination, "submitted"), progress(destination, "confirmed"));
  assert.equal(row(events, "approveTokens")?.label, "Tokens approved for deposit (1 of 1)");
  assert.equal(row(events, "receiveToken")?.state, "completed");
  assert.equal(row(events, "action")?.state, "preapproval");
});

test("confirmed plan removes provisional approvals and does not invent one from swap inputs", () => {
  const events = [plan([allowance, destination]), plan([destination, execute])];
  assert.equal(row(events, "approveTokens"), undefined);
  assert.equal(rows(events, undefined, [{ id: 0, step: allowance, completed: false }]).find((item) => item.id === "approveTokens"), undefined);
});

test("confirmed plan can add approvals without freezing the preview count", () => {
  const second = { ...allowance, id: "allowance:destination:42161:usdt", typeID: "allowance:destination:42161:usdt", token: { contractAddress: "0xusdt", symbol: "USDT" }, method: "approval" };
  const events = [plan([allowance, destination]), plan([allowance, second, destination])];
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for deposit (1 of 2)");
  assert.equal(row(events, "approveTokens")?.description, "Sign permit for USDC in wallet");
  events.push(progress(destination, "started"), progress(destination, "submitted"), progress(destination, "confirmed"), progress(destination, "confirmed"));
  assert.equal(row(events, "approveTokens")?.label, "Tokens approved for deposit (2 of 2)");
});

test("approval completion matches step identity and chain, not repeated symbols", () => {
  const otherChain = { id: 8453, name: "Base" };
  const otherAllowance = { ...allowance, id: "allowance:destination:8453:usdc", typeID: "allowance:destination:8453:usdc", chain: otherChain };
  const otherSource = { ...source, id: "source_swap:8453", typeID: "source_swap:8453", chain: otherChain };
  const events = [plan([allowance, source, otherAllowance, otherSource]), progress(source, "confirmed"), progress(source, "confirmed")];
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for deposit (2 of 2)");
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  events.push(progress(otherSource, "started"));
  assert.equal(row(events, "approveTokens")?.state, "completed");
});

test("permit failure belongs to approvals; execution failure after approval belongs to receive", () => {
  const events = [plan([allowance, destination, execute]), progress(destination, "wallet_prompted"), progress(destination, "failed")];
  const failed = rows(events, destination);
  assert.equal(failed.find((item) => item.id === "approveTokens")?.state, "error");
  assert.equal(failed.some((item) => item.id === "receiveToken"), false);
  const afterAuthorization = rows([plan([allowance, destination]), progress(destination, "started"), progress(destination, "failed")], destination);
  assert.equal(afterAuthorization.find((item) => item.id === "approveTokens")?.state, "completed");
  assert.equal(afterAuthorization.find((item) => item.id === "receiveToken")?.state, "error");
});

test("EOA authorization completes when its bridge transfer is submitted", () => {
  const transfer = { ...source, id: "eoa_to_ephemeral_transfer:42161", typeID: "eoa_to_ephemeral_transfer:42161", type: "EOA_TO_EPHEMERAL_TRANSFER", asset: token };
  const bridge = { ...transfer, id: "bridge_deposit:42161", typeID: "bridge_deposit:42161", type: "BRIDGE_DEPOSIT" };
  const events = [plan([allowance, transfer, bridge]), progress(transfer, "wallet_prompted")];
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  events.push(progress(bridge, "submitted"));
  assert.equal(row(events, "approveTokens")?.state, "completed");
});

test("bridge approval remains pending until its own receipt and is separate from execute approval", () => {
  const bridgeAllowance = { ...allowance, type: "ALLOWANCE_APPROVAL", method: undefined };
  const executeApproval = { ...allowance, id: "execute_approval", typeID: "execute_approval", type: "APPROVAL" };
  const events = [plan([bridgeAllowance, source, executeApproval]), progress(bridgeAllowance, "submitted")];
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for deposit (1 of 1)");
  events.push(progress(bridgeAllowance, "confirmed"));
  assert.equal(row(events, "approveTokens")?.state, "completed");
});

test("source-only swap completes before the execute step and submission shows depositing", () => {
  const events = [plan([source, execute]), progress(source, "confirmed")];
  assert.equal(row(events, "swapTokens")?.state, "completed");
  assert.equal(row(events, "action")?.state, "preapproval");
  events.push(progress(execute, "wallet_prompted"));
  assert.equal(row(events, "action")?.state, "preapproval");
  events.push(progress(execute, "submitted"));
  assert.equal(row(events, "action")?.state, "inProgress");
  events.push(progress({ ...execute, type: "TRANSACTION_CONFIRMED" }, "confirmed"));
  assert.equal(row(events, "action")?.state, "completed");
});

test("destination approval waits for cross-chain funds without blocking bridge progress", () => {
  const fill = { id: "bridge_fill:42161", typeID: "bridge_fill:42161", type: "BRIDGE_FILL", chain };
  const events = [plan([fill, allowance, destination, execute]), progress(fill, "waiting")];
  assert.equal(row(events, "approveTokens")?.state, "default");
  assert.equal(row(events, "swapTokens")?.state, "inProgress");
  events.push(progress(fill, "completed"));
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
});

test("initial execution with empty events shows milestone rows and omits intent verification when absent", () => {
  const emptyEventsRows = rows([]);
  assert.equal(emptyEventsRows.length, 3);

  assert.equal(emptyEventsRows[0]?.id, "swapTokens");
  assert.equal(emptyEventsRows[0]?.state, "inProgress");
  assert.equal(emptyEventsRows[0]?.label, "Swaps in progress");

  assert.equal(emptyEventsRows[1]?.id, "receiveToken");
  assert.equal(emptyEventsRows[1]?.state, "default");
  assert.equal(emptyEventsRows[1]?.label, "Receive USDT on Arbitrum");

  assert.equal(emptyEventsRows[2]?.id, "action");
  assert.equal(emptyEventsRows[2]?.state, "default");
  assert.equal(emptyEventsRows[2]?.label, "Deposit USDT to Aave");
});

test("intent signature step prompts Approve intent -> Intent approved", () => {
  const intentSignature = { id: "intent_signature", typeID: "intent_signature", type: "INTENT_SIGNATURE", chain };
  const events = [plan([intentSignature])];
  const pendingRow = row(events, "intentVerified");
  assert.equal(pendingRow?.state, "preapproval");
  assert.equal(pendingRow?.label, "Approve intent");
  assert.equal(pendingRow?.description, "Approve in wallet");

  events.push(progress(intentSignature, "confirmed"));
  const confirmedRow = row(events, "intentVerified");
  assert.equal(confirmedRow?.state, "completed");
  assert.equal(confirmedRow?.label, "Intent approved");
  assert.equal(confirmedRow?.description, undefined);
});

test("SDK v2 Better Intent events progress through milestones", () => {
  const intentSignature = { id: "intent_signature", typeID: "intent_signature", type: "INTENT_SIGNATURE", chain };
  const intentSubmission = { id: "intent_submission", typeID: "intent_submission", type: "INTENT_SUBMISSION", chain };
  const intentFulfillment = { id: "intent_fulfillment", typeID: "intent_fulfillment", type: "INTENT_FULFILLMENT", chain };

  const events: NexusWidgetProgressEvent[] = [progress(intentSignature, "confirmed")];
  assert.equal(row(events, "intentVerified")?.state, "completed");
  assert.equal(row(events, "intentVerified")?.label, "Intent approved");
  assert.equal(row(events, "swapTokens")?.state, "inProgress");
  assert.equal(row(events, "swapTokens")?.label, "Swaps in progress");

  events.push(progress(intentSubmission, "confirmed"));
  assert.equal(row(events, "swapTokens")?.state, "inProgress");

  events.push(progress(intentFulfillment, "confirmed"));
  assert.equal(row(events, "swapTokens")?.state, "completed");
  assert.equal(row(events, "swapTokens")?.label, "Swaps completed");
  assert.equal(row(events, "receiveToken")?.state, "completed");
  assert.equal(row(events, "receiveToken")?.label, "Received USDT on Arbitrum");
  assert.equal(row(events, "action")?.state, "preapproval");
});

test("multi-token approval progresses from token 1 to token 2 then marks completed", () => {
  const approval1 = { id: "app1", typeID: "app1", type: "erc20_approval", chainId: 42161, tokenAddress: "0xusdc", token: { symbol: "USDC" } };
  const approval2 = { id: "app2", typeID: "app2", type: "erc20_approval", chainId: 42161, tokenAddress: "0xdai", token: { symbol: "DAI" } };
  const events: NexusWidgetProgressEvent[] = [plan([approval1, approval2])];

  // Token 1 in progress
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for deposit (1 of 2)");
  assert.equal(row(events, "approveTokens")?.description, "Approve USDC in wallet");

  // Token 1 completed
  events.push(progress(approval1, "confirmed"));
  assert.equal(row(events, "approveTokens")?.state, "preapproval");
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for deposit (2 of 2)");
  assert.equal(row(events, "approveTokens")?.description, "Approve DAI in wallet");

  // Token 2 completed -> success state
  events.push(progress(approval2, "confirmed"));
  assert.equal(row(events, "approveTokens")?.state, "completed");
  assert.equal(row(events, "approveTokens")?.label, "Tokens approved for deposit (2 of 2)");
  assert.equal(row(events, "approveTokens")?.description, undefined);
});

test("resolves token symbol from context when step.token is absent", () => {
  const bareApproval = { id: "bare_app", typeID: "bare_app", type: "erc20_approval", chainId: 42161, tokenAddress: "0xcontext_usdc" };
  const events: NexusWidgetProgressEvent[] = [plan([bareApproval])];
  const resultRows = buildStatusRows({
    events,
    mode: "deposit",
    steps: [],
    context: {
      destinationChain: "Arbitrum",
      destinationSymbol: "USDT",
      fromTokens: [{ chainId: 42161, contractAddress: "0xcontext_usdc", symbol: "USDC" }],
    },
  });
  const approveRow = resultRows.find((r) => r.id === "approveTokens");
  assert.equal(approveRow?.description, "Approve USDC in wallet");
});

test("cancelling deposit approval marks action step as error and shows wallet refund message", () => {
  const intentFulfillment = { id: "intent_fulfillment", typeID: "intent_fulfillment", type: "INTENT_FULFILLMENT", chain };
  const depositAction = { id: "deposit_action", typeID: "action_failed", type: "APPROVAL", chain };
  const events: NexusWidgetProgressEvent[] = [progress(intentFulfillment, "confirmed")];

  const resultRows = rows(events, depositAction);
  const actionRow = resultRows.find((r) => r.id === "action");
  assert.equal(actionRow?.state, "error");
  assert.equal(actionRow?.label, "Deposit failed. Funds are in your wallet.");
  assert.equal(actionRow?.description, undefined);

  const receiveRow = resultRows.find((r) => r.id === "receiveToken");
  assert.equal(receiveRow?.state, "completed");
});

test("replicates exact V1 deposit progress screen from screenshot", () => {
  const approval = { id: "app1", typeID: "app1", type: "erc20_approval", chainId: 10, token: { symbol: "USDC" } };
  const sourceSwap = { id: "source1", typeID: "source1", type: "SOURCE_SWAP", chain: { id: 10, name: "Optimism" } };
  const destinationSwap = { id: "dest1", typeID: "dest1", type: "DESTINATION_SWAP", chain: { id: 10, name: "Optimism" } };
  const depositAction = { id: "deposit1", typeID: "deposit1", type: "TRANSACTION_SENT", chain: { id: 10, name: "Optimism" } };
  const events = [plan([approval, sourceSwap, destinationSwap, depositAction])];
  const result = buildStatusRows({
    events,
    mode: "deposit",
    steps: [],
    context: {
      destinationChain: "Optimism",
      destinationSymbol: "USDC",
      opportunityName: "Aave",
    },
  });

  assert.equal(result.length, 4);

  // Step 1: Active approval in wallet
  assert.equal(result[0].id, "approveTokens");
  assert.equal(result[0].label, "Approve tokens for deposit (1 of 1)");
  assert.equal(result[0].description, "Approve USDC in wallet");
  assert.equal(result[0].state, "preapproval");

  // Step 2: Swap tokens (pending)
  assert.equal(result[1].id, "swapTokens");
  assert.equal(result[1].label, "Swap tokens");
  assert.equal(result[1].state, "default");

  // Step 3: Receive USDC on Optimism (pending)
  assert.equal(result[2].id, "receiveToken");
  assert.equal(result[2].label, "Receive USDC on Optimism");
  assert.equal(result[2].state, "default");

  // Step 4: Deposit USDC to Aave (pending)
  assert.equal(result[3].id, "action");
  assert.equal(result[3].label, "Deposit USDC to Aave");
  assert.equal(result[3].state, "default");

  // Lifecycle progression:
  // 1. Approval confirmed -> Swaps begin
  events.push(progress(approval, "confirmed"));
  const step2 = buildStatusRows({ events, mode: "deposit", steps: [], context: { destinationChain: "Optimism", destinationSymbol: "USDC", opportunityName: "Aave" } });
  assert.equal(step2[0].state, "completed");
  assert.equal(step2[0].label, "Tokens approved for deposit (1 of 1)");
  assert.equal(step2[1].state, "inProgress");
  assert.equal(step2[1].label, "Swaps in progress");
  assert.equal(step2[2].state, "default");
  assert.equal(step2[2].label, "Receive USDC on Optimism");

  // 2. Source swaps complete -> Receiving on Optimism in progress
  events.push(progress(sourceSwap, "confirmed"));
  const step3 = buildStatusRows({ events, mode: "deposit", steps: [], context: { destinationChain: "Optimism", destinationSymbol: "USDC", opportunityName: "Aave" } });
  assert.equal(step3[1].state, "completed");
  assert.equal(step3[1].label, "Swaps completed");
  assert.equal(step3[2].state, "inProgress");
  assert.equal(step3[2].label, "Receiving USDC on Optimism");

  // 3. Destination fill complete -> Deposit preapproval in wallet
  events.push(progress(destinationSwap, "confirmed"));
  const step4 = buildStatusRows({ events, mode: "deposit", steps: [], context: { destinationChain: "Optimism", destinationSymbol: "USDC", opportunityName: "Aave" } });
  assert.equal(step4[2].state, "completed");
  assert.equal(step4[2].label, "Received USDC on Optimism");
  assert.equal(step4[3].state, "preapproval");
  assert.equal(step4[3].label, "Approve Deposit of USDC to Aave");
  assert.equal(step4[3].description, "Approve in wallet");

  // 4. Deposit submitted -> Depositing in progress
  events.push(progress(depositAction, "submitted"));
  const step5 = buildStatusRows({ events, mode: "deposit", steps: [], context: { destinationChain: "Optimism", destinationSymbol: "USDC", opportunityName: "Aave" } });
  assert.equal(step5[3].state, "inProgress");
  assert.equal(step5[3].label, "Depositing USDC to Aave");

  // 5. Deposit confirmed -> Success
  events.push(progress({ ...depositAction, type: "TRANSACTION_CONFIRMED" }, "confirmed"));
  const step6 = buildStatusRows({ events, mode: "deposit", steps: [], context: { destinationChain: "Optimism", destinationSymbol: "USDC", opportunityName: "Aave" } });
  assert.equal(step6[3].state, "completed");
  assert.equal(step6[3].label, "USDC deposited to Aave");
});

test("user rejection at token approval marks approveTokens as rejected and failed", () => {
  const approval = { id: "app1", typeID: "app1", type: "erc20_approval", chainId: 10, token: { symbol: "USDC" } };
  const sourceSwap = { id: "source1", typeID: "source1", type: "SOURCE_SWAP", chain: { id: 10, name: "Optimism" } };
  const events = [plan([approval, sourceSwap])];

  const failedStep = { type: "ALLOWANCE_APPROVAL", typeID: "approve_tokens_failed", isRejected: true };
  const result = buildStatusRows({
    events,
    mode: "swap",
    steps: [],
    failedStep: failedStep as any,
    isRejected: true,
    context: {
      destinationChain: "Optimism",
      destinationSymbol: "USDC",
    },
  });

  const approveRow = result.find((r) => r.id === "approveTokens");
  assert.ok(approveRow);
  assert.equal(approveRow.state, "error");
  assert.equal(approveRow.label, "Token approval rejected");
  assert.equal(approveRow.description, "Rejected in wallet");
});

test("user rejection at intent signature marks intentVerified as rejected and failed", () => {
  const intentSignature = { id: "intent_signature", typeID: "intent_signature", type: "INTENT_SIGNATURE", chain };
  const events = [plan([intentSignature])];

  const failedStep = { type: "INTENT_SIGNATURE", typeID: "intent_signature_failed", isRejected: true };
  const result = buildStatusRows({
    events,
    mode: "swap",
    steps: [],
    failedStep: failedStep as any,
    isRejected: true,
    context: {
      destinationChain: "Arbitrum",
      destinationSymbol: "USDT",
    },
  });

  const intentRow = result.find((r) => r.id === "intentVerified");
  assert.ok(intentRow);
  assert.equal(intentRow.state, "error");
  assert.equal(intentRow.label, "Intent approval rejected");
  assert.equal(intentRow.description, "Rejected in wallet");
});

test("user rejection at deposit action marks action as cancelled by user", () => {
  const intentFulfillment = { id: "intent_fulfillment", typeID: "intent_fulfillment", type: "INTENT_FULFILLMENT", chain };
  const events: NexusWidgetProgressEvent[] = [progress(intentFulfillment, "confirmed")];

  const failedStep = { type: "APPROVAL", typeID: "action_failed", isRejected: true };
  const result = buildStatusRows({
    events,
    mode: "deposit",
    steps: [],
    failedStep: failedStep as any,
    isRejected: true,
    context: {
      destinationChain: "Arbitrum",
      destinationSymbol: "USDT",
      opportunityName: "Aave",
    },
  });

  const actionRow = result.find((r) => r.id === "action");
  assert.ok(actionRow);
  assert.equal(actionRow.state, "error");
  assert.equal(actionRow.label, "Deposit cancelled by user");
  assert.equal(actionRow.description, "Rejected in wallet");
});

test("two tokens with generic ID (erc20_approval) both tracked and does not show swaps in progress prematurely", () => {
  // Both steps have identical generic ID: "erc20_approval"
  const approval1 = { id: "erc20_approval", typeID: "erc20_approval", type: "erc20_approval", chainId: 42161, tokenAddress: "0xusdc", token: { symbol: "USDC" } };
  const approval2 = { id: "erc20_approval", typeID: "erc20_approval", type: "erc20_approval", chainId: 10, tokenAddress: "0xusdt", token: { symbol: "USDT" } };
  const source1 = { id: "source_swap:42161", typeID: "source_swap:42161", type: "SOURCE_SWAP", chain: { id: 42161, name: "Arbitrum" }, swaps: [{ input: { contractAddress: "0xusdc" } }] };
  const source2 = { id: "source_swap:10", typeID: "source_swap:10", type: "SOURCE_SWAP", chain: { id: 10, name: "Optimism" }, swaps: [{ input: { contractAddress: "0xusdt" } }] };
  const executeStep = { id: "execute_approval", typeID: "execute_approval", type: "APPROVAL", chain: { id: 42161, name: "Arbitrum" } };

  const events: NexusWidgetProgressEvent[] = [plan([approval1, approval2, source1, source2, executeStep])];

  // Both tokens detected: "(1 of 2)"
  let res = rows(events);
  let approveRow = res.find((r) => r.id === "approveTokens");
  let swapRow = res.find((r) => r.id === "swapTokens");
  assert.equal(approveRow?.state, "preapproval");
  assert.equal(approveRow?.label, "Approve tokens for deposit (1 of 2)");
  assert.equal(swapRow?.state, "default"); // NOT in progress!

  // Token 1 completed: moves to "(2 of 2)", swap tokens still default!
  events.push(progress(approval1, "confirmed"));
  res = rows(events);
  approveRow = res.find((r) => r.id === "approveTokens");
  swapRow = res.find((r) => r.id === "swapTokens");
  assert.equal(approveRow?.state, "preapproval");
  assert.equal(approveRow?.label, "Approve tokens for deposit (2 of 2)");
  assert.equal(swapRow?.state, "default"); // MUST NOT show swaps in progress!

  // Token 2 wallet prompt: still on approveTokens
  events.push(progress(approval2, "wallet_prompted"));
  res = rows(events);
  approveRow = res.find((r) => r.id === "approveTokens");
  swapRow = res.find((r) => r.id === "swapTokens");
  assert.equal(approveRow?.state, "preapproval");
  assert.equal(swapRow?.state, "default");

  // Token 2 completed: now approvals complete
  events.push(progress(approval2, "confirmed"));
  res = rows(events);
  approveRow = res.find((r) => r.id === "approveTokens");
  swapRow = res.find((r) => r.id === "swapTokens");
  assert.equal(approveRow?.state, "completed");
  assert.equal(approveRow?.label, "Tokens approved for deposit (2 of 2)");

  // Once swap step starts, swaps become in progress
  events.push(progress(source1, "started"));
  res = rows(events);
  swapRow = res.find((r) => r.id === "swapTokens");
  assert.equal(swapRow?.state, "inProgress");
});

test("progress screen uses light progress grid by default and dark grid in dark mode", () => {
  const defaultHtml = renderToStaticMarkup(
    createElement(NexusWidgetProgressScreen, {
      mode: "swap",
    })
  );
  assert.match(defaultHtml, /nexus-one\/progress-grid\.gif/);
  assert.doesNotMatch(defaultHtml, /nexus-one\/progress-grid-dark\.gif/);

  const darkHtml = renderToStaticMarkup(
    createElement(
      NexusWidgetThemeContext.Provider,
      { value: { colorScheme: "dark" } as any },
      createElement(NexusWidgetProgressScreen, {
        mode: "swap",
      })
    )
  );
  assert.match(darkHtml, /nexus-one\/progress-grid-dark\.gif/);
  assert.doesNotMatch(darkHtml, /nexus-one\/progress-grid\.gif"/);
});



