"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useClientResource } from "../lib/client-resource";
import type { CompanyListItem } from "../lib/investment-data";
import { aiWorkflows, createAiPrompt, createChatGptUrl } from "../lib/ai-prompt.js";
import { AppPageHeader } from "./app-page-header";
import { ActionButton, AsyncState, CompactControl, DisclosureSurface, PrimaryBlock, SearchField } from "./ui-primitives";

export function AiAnalysis({ onOpenManagement }: { onOpenManagement: () => void }) {
  const { data, loading, error } = useClientResource<{ companies: CompanyListItem[] }>("/api/companies");
  const companies = useMemo(() => data?.companies ?? [], [data]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [workflow, setWorkflow] = useState(aiWorkflows[0].command);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const selected = companies.find(company => company.id === selectedId);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return companies.filter(company => `${company.name} ${company.ticker}`.toLowerCase().includes(normalized)).slice(0, 6);
  }, [companies, query]);
  const prompt = selected ? createAiPrompt(workflow, selected.name, selected.ticker) : "";
  const openUrl = prompt ? createChatGptUrl(prompt) : undefined;

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  return <>
    <AppPageHeader title="Analyse IA" onOpenManagement={onOpenManagement} />
    <section className="ai-analysis-page" aria-label="Préparer une analyse IA">
      <div className="ai-analysis-field">
        <h2>1. Choisir une compagnie</h2>
        {selected ? <PrimaryBlock className="ai-selected-company">
          <span><strong>{selected.name}</strong><small>{selected.ticker || "Sans ticker"}</small></span>
          <ActionButton compact onClick={() => { setSelectedId(""); setQuery(""); }}>Changer</ActionButton>
        </PrimaryBlock> : <>
          <SearchField value={query} onChange={setQuery} placeholder="Nom ou ticker…" ariaLabel="Rechercher une compagnie" count={loading && !data ? "Chargement…" : `${companies.length} compagnies`} />
          {loading && !data ? <AsyncState title="Chargement des compagnies…" description="Lecture de la base Companies." /> : error && !data ? <AsyncState title="Base Companies indisponible" description={error} /> : companies.length === 0 ? <AsyncState title="Aucune compagnie disponible" description="La base Companies ne contient encore aucune société." /> : matches.length > 0 ? <PrimaryBlock className="ai-company-results"><ul>{matches.map(company => <li key={company.id}><button type="button" onClick={() => { setSelectedId(company.id); setQuery(""); }}>{company.name}<span>{company.ticker || "Sans ticker"}</span></button></li>)}</ul></PrimaryBlock> : query.trim() ? <AsyncState title="Aucune compagnie trouvée" description="Essayez un autre nom ou ticker." /> : <p className="ai-field-hint">Recherchez par nom ou ticker.</p>}
        </>}
      </div>
      <div className="ai-analysis-field">
        <h2>2. Choisir un workflow</h2>
        <CompactControl variant="select" value={workflow} options={aiWorkflows.map(item => ({ value: item.command, label: item.label }))} onChange={setWorkflow} ariaLabel="Workflow d’analyse" />
      </div>
      <a className="ai-chatgpt-launcher" href={openUrl ?? undefined} role={openUrl?undefined:"link"} tabIndex={openUrl?undefined:0} aria-label={openUrl?"Préparer le prompt et ouvrir une conversation dans ChatGPT":"Sélectionnez une compagnie pour ouvrir ChatGPT"} aria-disabled={!openUrl} title={openUrl?"Ouvrir dans ChatGPT":"Sélectionnez une compagnie"} onClick={event => { if (!openUrl) event.preventDefault(); }} onKeyDown={event => { if (!openUrl&&(event.key==="Enter"||event.key===" ")) event.preventDefault(); }}>
        <Image src="/chatgpt-favicon.ico" alt="" width={44} height={44} unoptimized/>
      </a>
      <ActionButton onClick={() => void copyPrompt()} disabled={!prompt}>{copied ? "Prompt copié" : "Copier le prompt"}</ActionButton>
      {copyError && <p className="ai-copy-error" role="status">Copie impossible dans ce navigateur. Ouvrez le prompt ci-dessous et copiez-le manuellement.</p>}
      <DisclosureSurface summary={<span>Voir le prompt</span>} className="ai-prompt-preview">{prompt || <span>Sélectionnez une compagnie pour afficher le prompt.</span>}</DisclosureSurface>
    </section>
  </>;
}
