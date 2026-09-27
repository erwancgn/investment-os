import type { extractValuationSummary } from "../lib/valuation-summary";
import { SecondaryBlock, SectionHeader } from "./ui-primitives";

type Summary = NonNullable<ReturnType<typeof extractValuationSummary>>;

export function ScenarioComparison({ summary, showThresholds = false }: { summary: Summary; showThresholds?: boolean }) {
  const base = summary.scenarios.find(scenario => scenario.name === "Base");
  const referenceThreshold = summary.thresholds.find(threshold => threshold.rate === "12 %");
  const baseRate = base ? Number(base.cagr.replace("−", "-").replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]) : Number.NaN;
  const targetRate = referenceThreshold ? Number(referenceThreshold.rate.match(/\d+(?:[.,]\d+)?/)?.[0].replace(",", ".")) : Number.NaN;
  const comparison = Number.isFinite(baseRate) && Number.isFinite(targetRate) ? baseRate < targetRate ? "sous" : baseRate > targetRate ? "au-dessus de" : "au niveau de" : null;
  return <>
    {summary.scenarios.length === 3 && <section className="analysis-scenario-comparison" aria-label="Comparaison des scénarios du rapport">
      <SectionHeader eyebrow="Scénarios du rapport" title={summary.horizon ? `Horizon ${summary.horizon}` : "Comparaison des scénarios"} />
      {summary.referencePrice && <p className="analysis-reference-line"><strong>Cours de référence :</strong> {summary.referencePrice}{summary.referenceDate ? ` · clôture du ${summary.referenceDate}` : ""} · non live</p>}
      {base && <p className="analysis-scenario-reading"><strong>Base :</strong> {base.cagr}/an{comparison && referenceThreshold ? `, ${comparison} l’objectif de ${referenceThreshold.rate}/an au cours de référence` : ""}.</p>}
      <div className="analysis-scenario-cards">{summary.scenarios.map(scenario => {
        return <SecondaryBlock as="article" className={`analysis-scenario-card${scenario.name === "Base" ? " is-base" : ""}`} key={scenario.name}>
          <h3>{scenario.name}</h3>
          <dl><div><dt>Prix terminal</dt><dd>{scenario.terminal}</dd></div><div><dt>CAGR annualisé</dt><dd>{scenario.cagr}/an</dd></div></dl>
        </SecondaryBlock>;
      })}</div>
      <p>Les prix terminaux sont des estimations, distinctes du cours de référence et des seuils d’entrée.</p>
    </section>}
    {showThresholds && summary.thresholds.length === 3 && <section className="analysis-thresholds" aria-label="Seuils conditionnels au scénario Base">
      <SectionHeader eyebrow="Prix discipliné" title="Seuils du scénario Base" />
      <div className="analysis-threshold-grid">{summary.thresholds.map(threshold => {
        return <SecondaryBlock as="article" className={`analysis-threshold${threshold.rate === "12 %" ? " is-reference" : ""}`} key={threshold.rate}>
          <span>Objectif {threshold.rate}/an</span><strong>{threshold.price}</strong>
        </SecondaryBlock>;
      })}</div>
      <p>Prix conditionnels au maintien de la thèse Base ; ces seuils ne sont pas des cours actuels.</p>
    </section>}
  </>;
}
