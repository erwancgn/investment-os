"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ActionButton, SectionHeader } from "./ui-primitives";
import { NotionDocumentRefresh } from "./notion-document-refresh";
import { NotionGlobalRefresh } from "./notion-global-refresh";

export function InvestmentLogo() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function AccountMenu({ onOpenManagement }: { onOpenManagement: () => void }) {
  const [avatar, setAvatar] = useState("/avatar-profile.jpeg");
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false);

  useEffect(() => {
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
  }, []);

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
    setAvatar("/avatar-profile.jpeg");
    setHasCustomAvatar(false);
  };

  return <details className="account-menu"><summary className="avatar" aria-label="Compte Erwan"><span className="avatar-image" aria-hidden="true" style={{ backgroundImage: `url(${avatar})` }} /></summary><div className="account-menu-panel"><label className="account-menu-upload">Changer l’image<input type="file" accept="image/*" onChange={changeAvatar} /></label>{hasCustomAvatar && <button type="button" onClick={resetAvatar}>Réinitialiser l’image</button>}<button type="button" onClick={onOpenManagement}>⚙ Gestion Notion</button><small className="account-menu-note">Image enregistrée sur cet appareil</small></div></details>;
}

export function AppPageHeader({ title, eyebrow, onOpenManagement }: { title: string; eyebrow: string; onOpenManagement: () => void }) {
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
  const marketFreshness = (() => {
    if (!quoteAsOf) return "Dernier marché —";
    const date = new Date(quoteAsOf);
    if (Number.isNaN(date.getTime())) return "Dernier marché —";
    const day = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `Dernier marché ${day} à ${time}`;
  })();

  return <header className="page-header portfolio-page-header">
    <div className="portfolio-header-title-row"><h1>Portefeuille</h1><AccountMenu onOpenManagement={onOpenManagement}/></div>
    <div className="portfolio-header-actions">
      <NotionDocumentRefresh/>
      <NotionGlobalRefresh/>
      <ActionButton compact onClick={onRefresh} disabled={loading} title="Rafraîchir les cours et recalculer le portefeuille" ariaLabel="Rafraîchir les cours et recalculer le portefeuille">{loading ? "Actualisation…" : "Actualiser"}</ActionButton>
    </div>
    <p className="portfolio-header-market">{marketFreshness}</p>
  </header>;
}
