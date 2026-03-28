import { DynamoDBClient, PutItemCommand, ScanCommand, DeleteItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AlertRule } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const ALERT_TABLE = process.env.ALERT_TABLE || "dnf-auction-alerts";

/* ─── Alert Rules (DynamoDB) ─── */

export async function addAlert(rule: AlertRule): Promise<{ success: boolean; message: string }> {
  // 이메일당 활성 알림 수 확인
  const existing = await getAlertsByEmail(rule.email);
  const activeCount = existing.filter(a => !a.fulfilled).length;
  if (activeCount >= 3) {
    return { success: false, message: "이메일당 최대 3개의 알림만 등록할 수 있습니다." };
  }

  // 중복 확인
  const duplicate = existing.find(
    a => a.itemName === rule.itemName &&
      a.targetPrice === rule.targetPrice &&
      a.condition === rule.condition &&
      !a.fulfilled
  );
  if (duplicate) {
    return { success: false, message: "이미 동일한 알림이 등록되어 있습니다." };
  }

  // DynamoDB 스키마에 맞춰 저장 (Lambda와 동일한 구조)
  await db.send(new PutItemCommand({
    TableName: ALERT_TABLE,
    Item: {
      alertId: { S: rule.id },
      email: { S: rule.email },
      itemName: { S: rule.itemName },
      targetPrice: { N: String(rule.targetPrice) },
      priceCondition: { S: rule.condition },
      wordType: { S: "match" },
      createdAt: { S: rule.createdAt },
      isActive: { BOOL: true },
    },
  }));

  return { success: true, message: "알림이 등록되었습니다." };
}

export async function getAlertsByEmail(email: string): Promise<AlertRule[]> {
  const result = await db.send(new ScanCommand({
    TableName: ALERT_TABLE,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: { ":email": { S: email } },
  }));

  return (result.Items || []).map(item => ({
    id: item.alertId?.S || "",
    email: item.email?.S || "",
    itemName: item.itemName?.S || "",
    targetPrice: Number(item.targetPrice?.N || 0),
    condition: (item.priceCondition?.S || "below") as "below" | "above",
    createdAt: item.createdAt?.S || "",
    fulfilled: !(item.isActive?.BOOL ?? true),
  }));
}

export async function deleteAlert(id: string, email: string): Promise<boolean> {
  try {
    // 먼저 해당 알림이 이 이메일의 것인지 확인
    const alerts = await getAlertsByEmail(email);
    const found = alerts.find(a => a.id === id);
    if (!found) return false;

    await db.send(new DeleteItemCommand({
      TableName: ALERT_TABLE,
      Key: { alertId: { S: id } },
    }));
    return true;
  } catch {
    return false;
  }
}

export async function fulfillAlert(id: string): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: ALERT_TABLE,
    Key: { alertId: { S: id } },
    UpdateExpression: "SET isActive = :f",
    ExpressionAttributeValues: { ":f": { BOOL: false } },
  }));
}

/* ─── Popular Items (인메모리, 파일 불필요) ─── */

interface PopularEntry {
  itemName: string;
  count: number;
  lastPrice?: number;
  itemRarity?: string;
}

const popularMap = new Map<string, PopularEntry>();

export async function getPopularItems(): Promise<PopularEntry[]> {
  return Array.from(popularMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function trackSearch(
  itemName: string,
  lastPrice?: number,
  itemRarity?: string
): Promise<void> {
  const existing = popularMap.get(itemName);
  if (existing) {
    existing.count += 1;
    if (lastPrice !== undefined) existing.lastPrice = lastPrice;
    if (itemRarity) existing.itemRarity = itemRarity;
  } else {
    popularMap.set(itemName, { itemName, count: 1, lastPrice, itemRarity });
  }
}