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

export function createAiPrompt(command, companyName, ticker) {
  const identity = `${companyName}${ticker ? ` (${ticker})` : ""}`;
  return `@Investment OS Analysis Utilise ${command} pour analyser ${identity}. Profil : Notion Investment OS. Rédige le rapport en français.`;
}

export function createChatGptUrl(prompt) {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}
