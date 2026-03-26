export function getRarityColor(rarity: string): string {
  const map: Record<string, string> = {
    커먼: "var(--rarity-common)",
    언커먼: "var(--rarity-uncommon)",
    레어: "var(--rarity-rare)",
    유니크: "var(--rarity-unique)",
    에픽: "var(--rarity-epic)",
    크로니클: "var(--rarity-chronicle)",
    레전더리: "var(--rarity-legendary)",
    신화: "var(--rarity-mythic)",
  };
  return map[rarity] || "var(--text-primary)";
}

export function getRarityBg(rarity: string): string {
  const map: Record<string, string> = {
    커먼: "rgba(128,128,128,0.06)",
    언커먼: "rgba(58,154,48,0.06)",
    레어: "rgba(34,102,221,0.06)",
    유니크: "rgba(170,51,170,0.06)",
    에픽: "rgba(204,153,0,0.06)",
    크로니클: "rgba(221,102,0,0.06)",
    레전더리: "rgba(221,68,0,0.06)",
    신화: "rgba(221,0,136,0.06)",
  };
  return map[rarity] || "rgba(0,0,0,0.02)";
}

export function formatGold(num: number): string {
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
  if (num >= 10000) return `${(num / 10000).toFixed(0)}만`;
  return num.toLocaleString();
}

export function formatFullGold(num: number): string {
  return num.toLocaleString() + " 골드";
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatDate(iso: string): string {
  if (!iso) return "-";
  return iso.replace("T", " ").slice(0, 16);
}
