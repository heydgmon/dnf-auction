import { promises as fs } from "fs";
import path from "path";
import { AlertRule } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const ALERTS_FILE = path.join(DATA_DIR, "alerts.json");
const POPULAR_FILE = path.join(DATA_DIR, "popular.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

/* ─── Alert Rules ─── */

export async function getAlerts(): Promise<AlertRule[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(ALERTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveAlerts(alerts: AlertRule[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

export async function addAlert(rule: AlertRule): Promise<{ success: boolean; message: string }> {
  const alerts = await getAlerts();

  // 이메일당 최대 3개 제한
  const emailCount = alerts.filter((a) => a.email === rule.email && !a.fulfilled).length;
  if (emailCount >= 3) {
    return { success: false, message: "이메일당 최대 3개의 알림만 등록할 수 있습니다." };
  }

  // 중복 등록 방지
  const duplicate = alerts.find(
    (a) =>
      a.email === rule.email &&
      a.itemName === rule.itemName &&
      a.targetPrice === rule.targetPrice &&
      a.condition === rule.condition &&
      !a.fulfilled
  );
  if (duplicate) {
    return { success: false, message: "이미 동일한 알림이 등록되어 있습니다." };
  }

  alerts.push(rule);
  await saveAlerts(alerts);
  return { success: true, message: "알림이 등록되었습니다." };
}

export async function getAlertsByEmail(email: string): Promise<AlertRule[]> {
  const alerts = await getAlerts();
  return alerts.filter((a) => a.email === email);
}

export async function fulfillAlert(id: string): Promise<void> {
  const alerts = await getAlerts();
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    alerts[idx].fulfilled = true;
    await saveAlerts(alerts);
  }
}

export async function deleteAlert(id: string, email: string): Promise<boolean> {
  const alerts = await getAlerts();
  const idx = alerts.findIndex((a) => a.id === id && a.email === email);
  if (idx >= 0) {
    alerts.splice(idx, 1);
    await saveAlerts(alerts);
    return true;
  }
  return false;
}

/* ─── Popular Items (조회수 트래킹) ─── */

interface PopularEntry {
  itemName: string;
  count: number;
  lastPrice?: number;
  itemRarity?: string;
}

export async function getPopularItems(): Promise<PopularEntry[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(POPULAR_FILE, "utf-8");
    const items: PopularEntry[] = JSON.parse(raw);
    return items.sort((a, b) => b.count - a.count).slice(0, 20);
  } catch {
    return [];
  }
}

export async function trackSearch(
  itemName: string,
  lastPrice?: number,
  itemRarity?: string
): Promise<void> {
  await ensureDataDir();
  let items: PopularEntry[] = [];
  try {
    const raw = await fs.readFile(POPULAR_FILE, "utf-8");
    items = JSON.parse(raw);
  } catch {}

  const existing = items.find((i) => i.itemName === itemName);
  if (existing) {
    existing.count += 1;
    if (lastPrice !== undefined) existing.lastPrice = lastPrice;
    if (itemRarity) existing.itemRarity = itemRarity;
  } else {
    items.push({ itemName, count: 1, lastPrice, itemRarity });
  }

  await fs.writeFile(POPULAR_FILE, JSON.stringify(items, null, 2));
}
