"use client";
import type { ResearchDocument } from "../lib/investment-data";
import { useClientResource } from "../lib/client-resource";
import { AnalysisReader } from "./analysis-reader";
import { BackButton, AsyncState } from "./ui-primitives";

export function DocumentView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, loading, error, refresh } = useClientResource<{ document: ResearchDocument }>(`/api/analyses/${encodeURIComponent(id)}`);
  if (!data) return <div className="detail-loading"><div className="detail-navigation"><BackButton onBack={onBack} /></div><AsyncState title={loading ? "Ouverture du document…" : "Document indisponible"} description={error || "Chargement du contenu complet."} />{error && <button onClick={() => void refresh()}>Réessayer</button>}</div>;
  return <>{error && <p role="status" className="resource-error">{error} Le contenu précédent reste affiché.</p>}<AnalysisReader document={data.document} companyName={data.document.companyName} onBack={onBack} /></>;
}
