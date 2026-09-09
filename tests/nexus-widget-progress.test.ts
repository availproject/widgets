import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStatusRows, type NexusWidgetProgressEvent } from "../registry/avail-widgets/nexus-widget/components/nexus-widget-progress-screen";

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
  assert.equal(row(events, "approveTokens")?.label, "Tokens approved for swap (1 of 1)");
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
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for swap (1 of 2)");
  assert.equal(row(events, "approveTokens")?.description, "Approve USDC, USDT in wallet");
  events.push(progress(destination, "started"), progress(destination, "submitted"), progress(destination, "confirmed"), progress(destination, "confirmed"));
  assert.equal(row(events, "approveTokens")?.label, "Tokens approved for swap (2 of 2)");
});

test("approval completion matches step identity and chain, not repeated symbols", () => {
  const otherChain = { id: 8453, name: "Base" };
  const otherAllowance = { ...allowance, id: "allowance:destination:8453:usdc", typeID: "allowance:destination:8453:usdc", chain: otherChain };
  const otherSource = { ...source, id: "source_swap:8453", typeID: "source_swap:8453", chain: otherChain };
  const events = [plan([allowance, source, otherAllowance, otherSource]), progress(source, "confirmed"), progress(source, "confirmed")];
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for swap (2 of 2)");
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
  assert.equal(row(events, "approveTokens")?.label, "Approve tokens for swap (1 of 1)");
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
