import type { extractValuationSummary } from "../lib/valuation-summary";
import { SecondaryBlock, SectionHeader } from "./ui-primitives";

type Summary = NonNullable<ReturnType<typeof extractValuationSummary>>;

export function ScenarioComparison({ summary, showThresholds = false }: { summary: Summary; showThresholds?: boolean }) {
  return <>
    <section className="analysis-scenario-comparison" aria-label="Comparaison des scénarios du rapport">
      <SectionHeader eyebrow="Scénarios du rapport" title={summary.horizon ? `Horizon ${summary.horizon}` : "Comparaison des scénarios"} />
      <div className="analysis-scenario-cards">{summary.scenarios.map(scenario => {
        return <SecondaryBlock as="article" className={`analysis-scenario-card${scenario.name === "Base" ? " is-base" : ""}`} key={scenario.name}>
          <h3>{scenario.name}</h3>
          <dl><div><dt>Prix terminal</dt><dd>{scenario.terminal}</dd></div><div><dt>CAGR annualisé</dt><dd>{scenario.cagr}/an</dd></div></dl>
        </SecondaryBlock>;
      })}</div>
      <p>Prix terminaux et rendements annualisés estimés, distincts du cours de référence et des seuils d’entrée.</p>
    </section>
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
