export const aiWorkflows = [
  { command: "/business", label: "Business" },
  { command: "/valorisation", label: "Valorisation" },
  { command: "/short", label: "Short" },
  { command: "/earnings", label: "Earnings" },
  { command: "/pf-fit", label: "PF Fit" },
  { command: "/memo", label: "Mémo CIO" },
  { command: "/full-value", label: "Full Value" },
  { command: "/full-analyse", label: "Full Analyse" },
];

export const demoAiCompanies = [
  { id: "demo-public-nvda", name: "NVIDIA", ticker: "NVDA" },
  { id: "demo-public-msft", name: "Microsoft", ticker: "MSFT" },
  { id: "demo-public-su", name: "Schneider Electric", ticker: "SU.PA" },
];

export function createAiPrompt(command, companyName, ticker, scope = "personal") {
  const identity = `${companyName}${ticker ? ` (${ticker})` : ""}`;
  const profile = scope === "demo" ? "Profil et portefeuille fictifs de démonstration. La société est seulement un sujet d’analyse, sans position détenue réelle. N’utilise aucune donnée personnelle ni aucun espace Notion privé." : "Profil : Notion Investment OS.";
  return `@Investment OS Analysis Utilise ${command} pour analyser ${identity}. ${profile} Rédige le rapport en français.`;
}

export function createChatGptUrl(prompt) {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}
