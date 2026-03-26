/**
 * Lambda: price-collector
 *
 * EventBridge Scheduler에서 5분마다 트리거.
 * 감시 대상 아이템들의 현재 경매장 시세를 수집하여 DynamoDB에 저장.
 *
 * 환경변수:
 *   NEOPLE_API_KEY     - Neople Open API 키
 *   DYNAMODB_TABLE     - DynamoDB 테이블 이름 (price_history)
 *   ALERT_TABLE        - DynamoDB 알림 테이블 이름 (alert_rules)
 *
 * 배포:
 *   zip -r price-collector.zip index.mjs
 *   aws lambda update-function-code --function-name price-collector --zip-file fileb://price-collector.zip
 */

import { DynamoDBClient, ScanCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({});
const API_BASE = "https://api.neople.co.kr";

export const handler = async () => {
  const apiKey = process.env.NEOPLE_API_KEY;
  const priceTable = process.env.DYNAMODB_TABLE || "price_history";
  const alertTable = process.env.ALERT_TABLE || "alert_rules";

  if (!apiKey) {
    console.error("NEOPLE_API_KEY not set");
    return { statusCode: 500, body: "Missing API key" };
  }

  // 1. 감시 대상 아이템 목록 조회 (alert_rules에서 unique itemName)
  const alertScan = await db.send(new ScanCommand({
    TableName: alertTable,
    ProjectionExpression: "itemName",
  }));

  const itemNames = [...new Set(
    (alertScan.Items || [])
      .map(i => i.itemName?.S)
      .filter(Boolean)
  )];

  if (itemNames.length === 0) {
    console.log("No items to watch");
    return { statusCode: 200, body: "No items to watch" };
  }

  console.log(`Watching ${itemNames.length} items: ${itemNames.join(", ")}`);

  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90일 TTL

  // 2. 각 아이템별 시세 수집
  for (const itemName of itemNames) {
    try {
      const url = `${API_BASE}/df/auction?itemName=${encodeURIComponent(itemName)}&wordType=match&limit=20&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.rows || data.rows.length === 0) {
        console.log(`No auction data for: ${itemName}`);
        continue;
      }

      const prices = data.rows.map((r) => r.unitPrice);
      const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // 3. DynamoDB에 저장
      await db.send(new PutItemCommand({
        TableName: priceTable,
        Item: {
          PK: { S: `ITEM#${itemName}` },
          SK: { S: `TS#${now}` },
          itemName: { S: itemName },
          avgPrice: { N: String(avgPrice) },
          minPrice: { N: String(minPrice) },
          maxPrice: { N: String(maxPrice) },
          volume: { N: String(data.rows.length) },
          TTL: { N: String(ttl) },
        },
      }));

      console.log(`Saved: ${itemName} avg=${avgPrice} min=${minPrice} max=${maxPrice}`);
    } catch (err) {
      console.error(`Failed for ${itemName}:`, err);
    }
  }

  return { statusCode: 200, body: `Processed ${itemNames.length} items` };
};
