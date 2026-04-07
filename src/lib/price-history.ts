/**
 * DynamoDB 일별 시세 히스토리 모듈
 *
 * 테이블: dnf-price-history
 *   PK (파티션 키): itemName (String) — 아이템 이름
 *   SK (정렬 키):   date     (String) — "2026-04-07" 형식
 *
 * Attributes:
 *   avgPrice    (N) — 당일 평균 거래가
 *   minPrice    (N) — 당일 최저가
 *   maxPrice    (N) — 당일 최고가
 *   totalVolume (N) — 당일 총 거래 수량
 *   totalValue  (N) — 당일 총 거래액 (unitPrice × count 합산)
 *   itemId      (S) — 아이템 ID (이미지용)
 *   itemRarity  (S) — 레어리티
 *   TTL         (N) — 90일 후 자동 삭제
 */

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const TABLE_NAME = process.env.PRICE_HISTORY_TABLE || "dnf-price-history";

export interface DailyPriceRecord {
  itemName: string;
  date: string;       // "2026-04-07"
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalVolume: number; // 총 거래 수량
  totalValue: number;  // 총 거래액 (unitPrice × count 합산)
  itemId: string;
  itemRarity: string;
}

/**
 * 하루치 평균 시세를 DynamoDB에 저장 (품목당 1건)
 */
export async function saveDailyPrice(record: DailyPriceRecord): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90일 TTL

  await db.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      itemName:    { S: record.itemName },
      date:        { S: record.date },
      avgPrice:    { N: String(record.avgPrice) },
      minPrice:    { N: String(record.minPrice) },
      maxPrice:    { N: String(record.maxPrice) },
      totalVolume: { N: String(record.totalVolume) },
      totalValue:  { N: String(record.totalValue) },
      itemId:      { S: record.itemId },
      itemRarity:  { S: record.itemRarity },
      TTL:         { N: String(ttl) },
    },
  }));
}

/**
 * 여러 품목의 하루치 시세를 배치로 저장
 */
export async function saveDailyPricesBatch(records: DailyPriceRecord[]): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;

  // DynamoDB BatchWrite는 최대 25건
  const chunks: DailyPriceRecord[][] = [];
  for (let i = 0; i < records.length; i += 25) {
    chunks.push(records.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const requests = chunk.map(record => ({
      PutRequest: {
        Item: {
          itemName:    { S: record.itemName },
          date:        { S: record.date },
          avgPrice:    { N: String(record.avgPrice) },
          minPrice:    { N: String(record.minPrice) },
          maxPrice:    { N: String(record.maxPrice) },
          totalVolume: { N: String(record.totalVolume) },
          totalValue:  { N: String(record.totalValue) },
          itemId:      { S: record.itemId },
          itemRarity:  { S: record.itemRarity },
          TTL:         { N: String(ttl) },
        },
      },
    }));

    try {
      await db.send(new BatchWriteItemCommand({
        RequestItems: { [TABLE_NAME]: requests },
      }));
    } catch (err) {
      console.error("[PriceHistory] BatchWrite error:", err);
      // fallback: 개별 저장
      for (const record of chunk) {
        try { await saveDailyPrice(record); } catch {}
      }
    }
  }
}

/**
 * 특정 아이템의 최근 N일 시세 조회
 */
export async function getItemPriceHistory(
  itemName: string,
  days: number = 7
): Promise<DailyPriceRecord[]> {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().slice(0, 10);

  try {
    const result = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "itemName = :name AND #d >= :start",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: {
        ":name":  { S: itemName },
        ":start": { S: startDateStr },
      },
      ScanIndexForward: true, // 오래된 순
    }));

    return (result.Items || []).map(item => ({
      itemName:    item.itemName?.S || "",
      date:        item.date?.S || "",
      avgPrice:    Number(item.avgPrice?.N || 0),
      minPrice:    Number(item.minPrice?.N || 0),
      maxPrice:    Number(item.maxPrice?.N || 0),
      totalVolume: Number(item.totalVolume?.N || 0),
      totalValue:  Number(item.totalValue?.N || 0),
      itemId:      item.itemId?.S || "",
      itemRarity:  item.itemRarity?.S || "",
    }));
  } catch (err) {
    console.error("[PriceHistory] Query error for", itemName, ":", err);
    return [];
  }
}

/**
 * 여러 아이템의 최근 N일 시세 조회 (병렬)
 */
export async function getMultiItemPriceHistory(
  itemNames: string[],
  days: number = 7
): Promise<Map<string, DailyPriceRecord[]>> {
  const results = await Promise.all(
    itemNames.map(async (name) => ({
      name,
      records: await getItemPriceHistory(name, days),
    }))
  );

  const map = new Map<string, DailyPriceRecord[]>();
  for (const { name, records } of results) {
    map.set(name, records);
  }
  return map;
}

/**
 * 특정 아이템의 어제 시세 조회 (변동률 계산용)
 */
export async function getYesterdayPrice(itemName: string): Promise<DailyPriceRecord | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  try {
    const result = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "itemName = :name AND #d = :date",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: {
        ":name": { S: itemName },
        ":date": { S: dateStr },
      },
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const item = result.Items[0];
    return {
      itemName:    item.itemName?.S || "",
      date:        item.date?.S || "",
      avgPrice:    Number(item.avgPrice?.N || 0),
      minPrice:    Number(item.minPrice?.N || 0),
      maxPrice:    Number(item.maxPrice?.N || 0),
      totalVolume: Number(item.totalVolume?.N || 0),
      totalValue:  Number(item.totalValue?.N || 0),
      itemId:      item.itemId?.S || "",
      itemRarity:  item.itemRarity?.S || "",
    };
  } catch {
    return null;
  }
}