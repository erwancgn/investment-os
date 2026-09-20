import assert from "node:assert/strict";
import test from "node:test";
import { documentPresentation } from "../app/lib/document-presentation.ts";

const technicalHandoff = "contract_version=1; run_id=NVDA-FULL-20260907-1552; module=CIO; business=Excellente 92/100; valuation=Attractive 75/100; short=No exploitable short; final_decision=Renforcer; initial=0.5 share; target=10% direct; ceiling=12% economic; confidence=Medium";

test("CIO memo uses its human introduction instead of the technical handoff", () => {
  const humanCallout = "Décision CIO : Renforcer — +0,5 action maximum. Business exceptionnel, mais concentration AI élevée.";
  const presentation = documentPresentation([
    { type: "callout", text: humanCallout },
    { type: "heading", level: 1, text: "Decision Card" },
  ], technicalHandoff, { category: "synthese", handoffSummary: technicalHandoff });

  assert.deepEqual(presentation.summaryItems, [humanCallout]);
  assert.doesNotMatch(presentation.summaryItems.join(" "), /contract_version|run_id|module=|final_decision/);
});

test("CIO memo humanizes a historical handoff only as a last resort", () => {
  const presentation = documentPresentation([], "", { category: "synthese", handoffSummary: technicalHandoff });
  const rendered = presentation.summaryItems.join(" ");

  assert.match(rendered, /Décision CIO : Renforcer/);
  assert.match(rendered, /taille initiale 0\.5 action/);
  assert.doesNotMatch(rendered, /contract_version|run_id|module=|final_decision/);
});

test("other analysis families preserve their property-first fallback", () => {
  const presentation = documentPresentation([
    { type: "callout", text: "Introduction suffisamment longue pour devenir un résumé de repli." },
    { type: "heading", level: 1, text: "Investment Card" },
  ], "Résumé éditorial Business", { category: "business" });

  assert.deepEqual(presentation.summaryItems, ["Résumé éditorial Business"]);
});
