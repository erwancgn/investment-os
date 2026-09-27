"use client";

import type { CompanyDocument, ResearchDocument } from "../lib/investment-data";
import { useClientResource } from "../lib/client-resource";
import { AnalysisReader } from "./analysis-reader";
import { AsyncState } from "./ui-primitives";

/** Company endpoints contain previews; the active report is fetched on demand. */
export function CompanyAnalysisDocument({ preview, companyName }: { preview: CompanyDocument; companyName: string }) {
  const hasFullPreview = Boolean(preview.plainText.trim() || preview.notionBlocks?.length);
  const { data, loading, error, refresh } = useClientResource<{ document: ResearchDocument }>(
    `/api/analyses/${encodeURIComponent(preview.id)}`, false, !hasFullPreview,
  );
  const document = hasFullPreview ? preview : data?.document;
  const sameDocument = document?.id.replaceAll("-", "").toLowerCase() === preview.id.replaceAll("-", "").toLowerCase();
  const hasBody = Boolean(document?.plainText.trim() || document?.notionBlocks?.length);

  if (!sameDocument || !hasBody) return <AsyncState
    title={loading ? "Chargement de l’analyse…" : "Document indisponible"}
    description={error || (loading ? "Récupération du contenu complet." : "Le contenu complet de cette analyse n’est pas disponible.")}
    action={!loading && !hasFullPreview && <button type="button" onClick={() => void refresh()}>Réessayer</button>}
  />;

  return <>
    {error && <p className="resource-error" role="status">{error} Le dernier contenu chargé reste affiché.</p>}
    <AnalysisReader document={document} companyName={companyName} embedded />
  </>;
}
