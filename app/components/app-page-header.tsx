"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ActionButton, SectionHeader } from "./ui-primitives";
import { NotionDocumentRefresh } from "./notion-document-refresh";
import { NotionGlobalRefresh } from "./notion-global-refresh";
import { switchAppScope, useAppSession } from "../lib/client-resource";

export function InvestmentLogo() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function AccountMenu({ onOpenManagement }: { onOpenManagement: () => void }) {
  const session = useAppSession();
  const isPersonal = session.scope === "personal";
  const [scopeError, setScopeError] = useState("");
  const changeScope = (scope: "demo" | "personal") => { setScopeError(""); void switchAppScope(scope).catch(() => setScopeError("Changement d’espace impossible. Réessaie.")); };
  const [avatar, setAvatar] = useState("");
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false);

  useEffect(() => {
    if (!isPersonal) return;
    try {
      const stored = window.localStorage.getItem("investment-os:profile-image");
      if (stored) {
        const frame = window.requestAnimationFrame(() => {
          setAvatar(stored);
          setHasCustomAvatar(true);
        });
        return () => window.cancelAnimationFrame(frame);
      }
    } catch { /* Local storage may be unavailable in private browsing. */ }
  }, [isPersonal]);

  const changeAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      try { window.localStorage.setItem("investment-os:profile-image", reader.result); } catch { /* Keep the in-memory preview. */ }
      setAvatar(reader.result);
      setHasCustomAvatar(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const resetAvatar = () => {
    try { window.localStorage.removeItem("investment-os:profile-image"); } catch { /* Ignore unavailable local storage. */ }
    setAvatar("");
    setHasCustomAvatar(false);
  };

  return <details className="account-menu"><summary className="avatar" aria-label={isPersonal ? "Compte personnel" : "Compte démo"}><span className="avatar-image" aria-hidden="true" style={isPersonal ? { backgroundImage: `url(${avatar})` } : undefined}>{isPersonal ? null : "D"}</span></summary><div className="account-menu-panel">{session.canAccessPersonal && !isPersonal && <button type="button" onClick={() => changeScope("personal")}>Espace personnel</button>}{isPersonal && <><label className="account-menu-upload">Changer l’image<input type="file" accept="image/*" onChange={changeAvatar} /></label>{hasCustomAvatar && <button type="button" onClick={resetAvatar}>Réinitialiser l’image</button>}<button type="button" onClick={() => changeScope("demo")}>Espace démo</button><button type="button" onClick={onOpenManagement}>⚙ Gestion Notion</button><small className="account-menu-note">Image enregistrée sur cet appareil</small></>}{!isPersonal && <small className="account-menu-note">Espace démo</small>}{scopeError && <small className="account-menu-note" role="status">{scopeError}</small>}</div></details>;
}

export function AppPageHeader({ title, eyebrow, onOpenManagement }: { title: string; eyebrow?: string; onOpenManagement: () => void }) {
  return <SectionHeader className="page-header" heading="h1" eyebrow={eyebrow} title={title} actions={<AccountMenu onOpenManagement={onOpenManagement}/>} />;
}

export function PortfolioPageHeader({
  quoteAsOf,
  loading,
  onRefresh,
  onOpenManagement,
}: {
  quoteAsOf?: string | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenManagement: () => void;
}) {
  const session = useAppSession();
  const marketFreshness = (() => {
    if (!quoteAsOf) return "Dernier marché —";
    const date = new Date(quoteAsOf);
    if (Number.isNaN(date.getTime())) return "Dernier marché —";
    const day = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `Dernier marché ${day} à ${time}`;
  })();
  const refreshAction = session.scope === "personal" ? onRefresh : () => window.location.reload();

  return <header className="page-header portfolio-page-header">
    <div className="portfolio-header-title-row"><h1>Portefeuille</h1><AccountMenu onOpenManagement={onOpenManagement}/></div>
    <div className="portfolio-header-actions">
      {session.scope === "personal" && <><NotionDocumentRefresh/><NotionGlobalRefresh/></>}
      <ActionButton compact onClick={refreshAction} disabled={session.scope === "personal" && loading} title={session.scope === "personal" ? "Rafraîchir les cours et recalculer le portefeuille" : "Recharger la démonstration"} ariaLabel={session.scope === "personal" ? "Rafraîchir les cours et recalculer le portefeuille" : "Recharger la démonstration"}>{session.scope === "personal" ? loading ? "Actualisation…" : "Actualiser" : "Recharger la démo"}</ActionButton>
    </div>
    {session.scope === "personal" && <p className="portfolio-header-market">{marketFreshness}</p>}
  </header>;
}
