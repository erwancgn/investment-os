import assert from "node:assert/strict";
import test from "node:test";
import { aiWorkflows, createAiPrompt, createChatGptUrl, demoAiCompanies } from "../app/lib/ai-prompt.js";

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

test("demo AI prompt names a fictitious profile and excludes the personal Notion profile", () => {
  const prompt = createAiPrompt("/pf-fit", "Example Corporation", "EXM", "demo");
  assert.match(prompt, /portefeuille fictifs de démonstration/);
  assert.match(prompt, /sans position détenue réelle/);
  assert.match(prompt, /N’utilise aucune donnée personnelle ni aucun espace Notion privé/);
  assert.doesNotMatch(prompt, /Profil : Notion Investment OS/);
});

test("demo AI selector uses only the local public company examples", () => {
  assert.deepEqual(demoAiCompanies, [
    { id: "demo-public-nvda", name: "NVIDIA", ticker: "NVDA" },
    { id: "demo-public-msft", name: "Microsoft", ticker: "MSFT" },
    { id: "demo-public-su", name: "Schneider Electric", ticker: "SU.PA" },
  ]);
  assert.ok(demoAiCompanies.every(company => company.id.startsWith("demo-public-")));
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
