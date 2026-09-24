import assert from "node:assert/strict";
import test from "node:test";
import { aiWorkflows, createAiPrompt, createChatGptUrl } from "../app/lib/ai-prompt.js";

test("AI launcher exposes only the canonical investment workflows", () => {
  assert.deepEqual(aiWorkflows.map(({ command }) => command), [
    "/business", "/valorisation", "/short", "/earnings", "/pf-fit", "/memo", "/full-value", "/full-analyse",
  ]);
});

test("AI prompt includes the company, ticker, profile, and French output instruction", () => {
  assert.equal(
    createAiPrompt("/business", "Example Corporation", "EXM"),
    "@Investment OS Analysis Utilise /business pour analyser Example Corporation (EXM). Profil : Notion Investment OS. Rédige le rapport en français.",
  );
});

test("plugin mention is the first text in every generated prompt", () => {
  for (const { command } of aiWorkflows) {
    assert.ok(createAiPrompt(command, "Example Corporation", "EXM").startsWith("@Investment OS Analysis "));
  }
});

test("ChatGPT URL encodes the prompt and does not send it", () => {
  const prompt = createAiPrompt("/pf-fit", "A & B", "AB");
  const url = new URL(createChatGptUrl(prompt));
  assert.equal(url.origin, "https://chatgpt.com");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("q"), prompt);
  assert.equal([...url.searchParams.keys()].length, 1);
});
