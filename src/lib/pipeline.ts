export const STAGES = [
  { id: "prospecting", label: "Prospecting", color: "oklch(0.6 0.1 240)" },
  { id: "bant", label: "BANT", color: "oklch(0.6 0.12 220)" },
  { id: "discovery", label: "Discovery", color: "oklch(0.62 0.14 200)" },
  { id: "solution_cpq", label: "Solution & CPQ", color: "oklch(0.65 0.16 75)" },
  { id: "negotiation", label: "Negotiation", color: "oklch(0.6 0.18 45)" },
  { id: "closed_won", label: "Closed Won", color: "oklch(0.6 0.16 150)" },
  { id: "handover", label: "Handover", color: "oklch(0.55 0.14 280)" },
] as const;

export type StageId = typeof STAGES[number]["id"];
