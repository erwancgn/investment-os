import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

let projection;
async function moduleUnderTest() {
  if (projection) return projection;
  const result = await build({ entryPoints: ['app/lib/presentation-projection.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  projection = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  return projection;
}

const payload = () => ({
  presentationContractVersion: '1.0.0',
  analysisType: 'business',
  identity: { company: 'Example Corp', ticker: 'EXM', exchange: null, currency: 'USD', evidenceIds: ['ev-metric'] },
  generatedAt: '2026-09-01T10:00:00Z',
  reportSha256: '0'.repeat(64),
  summary: { text: 'Revenue was 123 USD at period end.', evidenceIds: ['ev-metric'] },
  facts: [{ id: 'revenue', label: 'Revenue', value: 123, unit: 'USD', status: 'known', asOf: '2026-06-30T00:00:00Z', evidenceIds: ['ev-metric'] }],
  scenarios: [{ id: 'base', label: 'Base', condition: 'Revenue remains above 100 USD.', impact: 'Terminal value is 123 USD.', status: 'known', asOf: '2026-06-30T00:00:00Z', evidenceIds: ['ev-metric'], terminalValue: { id: 'base-value', label: 'Terminal value', value: 123, unit: 'USD', status: 'known', asOf: '2026-06-30T00:00:00Z', evidenceIds: ['ev-metric'] } }],
  thresholds: [],
  sources: [{ id: 'src-report', title: 'Annual report', url: 'https://example.com/report', publishedAt: '2026-07-01T00:00:00Z', retrievedAt: '2026-09-01T10:00:00Z', asOf: '2026-06-30T00:00:00Z', dataCategory: 'financial_results', freshness: 'known', provenance: 'collected_this_run' }],
  evidence: [{ id: 'ev-metric', sourceId: 'src-report', claim: 'Revenue is 123 USD.', locator: 'Page 4, Revenue table', supportingData: 'Revenue: 123 USD', supportingDataSha256: '0'.repeat(64), captureMethod: 'source_retrieval', capturedAt: '2026-09-01T10:00:00Z', asOf: '2026-06-30T00:00:00Z', freshness: 'known', freshnessCheckId: 'freshness-1' }],
  freshnessChecks: [{ id: 'freshness-1', dataCategory: 'financial_results', method: 'latest_results_or_filings_search', result: 'latest_verified', checkedAt: '2026-09-01T10:00:00Z', checkedSourceIds: ['src-report'], supportingData: 'No later quarterly filing found.', supportingDataSha256: '0'.repeat(64), captureMethod: 'source_retrieval', capturedAt: '2026-09-01T10:00:00Z', locator: 'Search results, first page' }],
  provenance: { runId: 'run-123', pluginVersion: '1.2.6', contractVersion: '1.2.6' },
});

const notionHeading = (id = 'heading-id') => ({ id, type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'INVESTMENT_OS_PRESENTATION_JSON' }] } });
const codeBlock = value => ({ id: 'projection-code', type: 'code', code: { language: 'json', rich_text: [{ plain_text: JSON.stringify(value) }] } });
const reportHeading = { id: 'report-heading', type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Business model' }] } };
const reportParagraph = { id: 'report-paragraph', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Annual revenue was reported at 123 USD.' }] } };
const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
async function validBlocks(api) {
  const value = payload();
  value.evidence[0].supportingDataSha256 = digest(value.evidence[0].supportingData);
  value.freshnessChecks[0].supportingDataSha256 = digest(value.freshnessChecks[0].supportingData);
  const blocks = [reportHeading, reportParagraph, notionHeading(), codeBlock(value)];
  value.reportSha256 = digest(api.canonicalHumanReport(blocks));
  return [reportHeading, reportParagraph, notionHeading(), codeBlock(value)];
}

test('accepts only a captured projection with resolved freshness checks and exact numeric support', async () => {
  const api = await moduleUnderTest();
  assert.equal(digest(api.canonicalHumanReport([reportHeading, reportParagraph])), 'a7f821ae94d87ecddd390bcfc3de7e77fe9e3fe5ddaba177e4b26d2e257b3425');
  const blocks = await validBlocks(api);
  const extracted = api.extractPresentationProjection(blocks);
  assert.equal(extracted.status, 'valid');
  assert.equal(api.validatePresentationProjection(extracted.projection, Date.parse('2026-09-28T00:00:00Z')), true);
  assert.equal((await api.verifyPresentationProjection(blocks)).status, 'valid');
  const unsupported = structuredClone(extracted.projection);
  unsupported.facts[0].value = 12_300;
  assert.equal(api.validatePresentationProjection(unsupported, Date.parse('2026-09-28T00:00:00Z')), false);
  const unresolved = structuredClone(extracted.projection);
  unresolved.summary.evidenceIds = ['missing'];
  assert.equal(api.validatePresentationProjection(unresolved, Date.parse('2026-09-28T00:00:00Z')), false);
});

test('rejects stale or malformed metadata and future timestamps deterministically', async () => {
  const api = await moduleUnderTest();
  const blocks = await validBlocks(api);
  const malformed = api.extractPresentationProjection(blocks).projection;
  assert.equal(api.validatePresentationProjection(malformed, Date.parse('2026-08-01T00:00:00Z')), false);
  const tampered = structuredClone(malformed);
  tampered.evidence[0].supportingData = 'Revenue: 124 USD';
  assert.equal((await api.verifyPresentationProjection([reportHeading, reportParagraph, notionHeading(), codeBlock(tampered)])).status, 'invalid');
  const reportChanged = [reportHeading, { ...reportParagraph, paragraph: { rich_text: [{ plain_text: 'Revenue is now 124 USD.' }] } }, notionHeading(), codeBlock(malformed)];
  assert.equal((await api.verifyPresentationProjection(reportChanged)).status, 'invalid');
  const malformedSchema = structuredClone(malformed);
  malformedSchema.extra = true;
  assert.equal(api.validatePresentationProjection(malformedSchema, Date.parse('2026-09-28T00:00:00Z')), false);
});

test('projection is absent without the exact marker and invalid on duplicates or bad JSON', async () => {
  const api = await moduleUnderTest();
  assert.equal(api.extractPresentationProjection([]).status, 'absent');
  const blocks = await validBlocks(api);
  assert.equal((await api.verifyPresentationProjection(blocks)).status, 'valid');
  assert.equal(api.extractPresentationProjection([notionHeading(), codeBlock(payload()), notionHeading(), codeBlock(payload())]).status, 'invalid');
  assert.equal(api.extractPresentationProjection([notionHeading(), { type: 'code', code: { language: 'json', rich_text: [{ plain_text: '{bad' }] } }]).status, 'invalid');
});

test('machine payload is excluded from the human-facing Notion body', async () => {
  const api = await moduleUnderTest();
  const blocks = [{ id: 'body', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Readable report text.' }] } }, notionHeading(), codeBlock(payload())];
  const visible = api.humanReadableNotionBlocks(blocks);
  assert.equal(visible.length, 1);
  assert.match(visible[0].paragraph.rich_text[0].plain_text, /Readable report text/);
  assert.doesNotMatch(JSON.stringify(visible), /INVESTMENT_OS_PRESENTATION_JSON|"presentationContractVersion"/);
});
