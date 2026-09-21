"use client";
import { useMemo } from "react";
import { useClientResource } from "../lib/client-resource";
import type { LivePortfolio, LivePosition } from "../lib/investment-data";
import { PrimaryBlock, SecondaryBlock } from "./ui-primitives";

const money = (value: number | null, digits = 0) => value == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const number = (value: number, digits = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
const native = (value: number | null, currency: string) => value == null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;

function HoldingMetrics({ positions, detailed, onRefresh, loading }: { positions: LivePosition[]; detailed?: boolean; onRefresh: () => void; loading: boolean }) {
  const quantity = positions.reduce((sum, item) => sum + item.quantity, 0);
  const cost = positions.reduce((sum, item) => sum + item.costBasisEur, 0);
  const market = positions.reduce((sum, item) => sum + (item.marketValueEur ?? 0), 0);
  const pnl = positions.reduce((sum, item) => sum + (item.pnlEur ?? 0), 0);
  const weightedPru = quantity > 0 ? cost / quantity : null;
  const avgPriceEur = quantity > 0 && positions.some(item => item.marketValueEur != null) ? market / quantity : null;
  const weight = positions.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  const target = positions.reduce((sum, item) => sum + item.targetWeight, 0);
  const pnlPercent = cost > 0 ? pnl / cost * 100 : null;
  const firstQuote = positions.find(item => item.nativePrice != null);
  const accounts = [...new Set(positions.map(item => item.account).filter(Boolean))].join(" · ");
  return <PrimaryBlock as="section" className={`holding-summary ${detailed ? "holding-summary-detailed" : ""}`}>
    <div className="holding-summary-head"><div><p className="eyebrow">Position live</p><h2>Données du portefeuille</h2></div><div className="holding-summary-actions"><span className="holding-source">Yahoo + conversion EUR</span><button className="holding-refresh" onClick={onRefresh} disabled={loading} title="Rafraîchir le cours et recalculer la position" aria-label="Rafraîchir le cours et recalculer la position"><span aria-hidden="true">{loading ? "…" : "↻"}</span></button></div></div>
    <div className="holding-metric-grid">
      <SecondaryBlock as="article"><span>Nombre de titres</span><strong>{number(quantity, 4)}</strong><small>{accounts || "Enveloppe non renseignée"}</small></SecondaryBlock>
      <SecondaryBlock as="article"><span>PRU réel</span><strong>{money(weightedPru, 2)}</strong><small>coût Notion : {money(cost)}</small></SecondaryBlock>
      <SecondaryBlock as="article"><span>Cours actuel</span><strong>{native(firstQuote?.nativePrice ?? null, firstQuote?.nativeCurrency ?? "EUR")}</strong><small>{avgPriceEur == null ? "—" : `${money(avgPriceEur, 2)} équivalent EUR`}</small></SecondaryBlock>
      <SecondaryBlock as="article"><span>Valeur de ligne</span><strong>{money(market)}</strong><small>{weight.toFixed(1)}% du PF</small></SecondaryBlock>
      <SecondaryBlock as="article"><span>PV latente</span><strong className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{money(pnl)}</strong><small className={pnl >= 0 ? "positive" : "negative"}>{pnlPercent == null ? "—" : `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%`}</small></SecondaryBlock>
      <SecondaryBlock as="article"><span>Cible</span><strong>{target.toFixed(1)}%</strong><small>{target > 0 ? `${(weight - target >= 0 ? "+" : "")}${(weight - target).toFixed(1)} pts vs cible` : "Cible non reliée"}</small></SecondaryBlock>
    </div>
    {detailed && <p className="holding-summary-note">Ces valeurs sont recalculées à l’ouverture ou via ↻ depuis les positions actives Notion. La PV est latente uniquement : les gains réalisés, frais et dividendes ne sont pas inclus.</p>}
  </PrimaryBlock>;
}

export function LiveHoldingSummary({ companyId, companyName, detailed = false }: { companyId: string; companyName?: string; detailed?: boolean }) {
  const { data, error, loading, refresh } = useClientResource<LivePortfolio>("/api/portfolio/live", true);
  const positions = useMemo(() => { if (!data) return []; return data.positions.filter(item => item.companyIds.includes(companyId) || (companyName && item.name.toLowerCase().includes(companyName.toLowerCase()))); }, [data, companyId, companyName]);
  if (error && !data) return <PrimaryBlock as="section" className="holding-summary-state"><strong>Position live indisponible</strong><span>{error}</span></PrimaryBlock>;
  if (!data) return <PrimaryBlock as="section" className="holding-summary-state holding-summary-loading" aria-busy="true" aria-live="polite"><div className="holding-summary-loading-copy"><p className="eyebrow">Données du portefeuille</p><strong>Actualisation de la position…</strong><span>Calcul des cours et de la PV.</span></div><div className="holding-summary-loading-track" aria-hidden="true"><span /></div></PrimaryBlock>;
  if (!positions.length) return null;
  return <>{error && <p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p>}<HoldingMetrics positions={positions} detailed={detailed} onRefresh={() => void refresh()} loading={loading}/></>;
}
