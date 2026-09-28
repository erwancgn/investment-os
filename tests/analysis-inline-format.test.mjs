import assert from "node:assert/strict";
import test from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInlineFormat } from "../app/lib/inline-format.ts";
import { parseNotionBlocks } from "../app/lib/notion-block-parser.ts";

const markup = text => renderToStaticMarkup(createElement(Fragment, null, ...renderInlineFormat(text)));

test("Notion rich text annotations render emphasis without visible Markdown markers", () => {
  const blocks = parseNotionBlocks([{
    type: "paragraph",
    paragraph: { rich_text: [
      { plain_text: "Cible", annotations: { bold: true, italic: true } },
      { plain_text: " et " },
      { plain_text: "risque", annotations: { bold: true } },
    ] },
  }]);
  const rendered = markup(blocks[0].text);
  assert.equal(rendered, "<strong><em>Cible</em></strong> et <strong>risque</strong>");
  assert.doesNotMatch(rendered, /\*\*/);
});

test("adjacent emphasis and malformed bold delimiters do not leak double asterisks", () => {
  assert.equal(markup("**Premier****second**"), "<strong>Premier</strong><strong>second</strong>");
  assert.equal(markup("Résultat **incomplet"), "Résultat incomplet");
});
