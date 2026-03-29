/**
 * Lambda: alert-checker (외부 패키지 없음 — Lambda 콘솔 에디터에서 바로 사용 가능)
 *
 * DynamoDB 테이블: dnf-auction-alerts (파티션 키: alertId)
 * Resend API: fetch로 직접 호출
 *
 * 환경변수:
 *   ALERT_TABLE_NAME  - DynamoDB 테이블명 (dnf-auction-alerts)
 *   RESEND_API_KEY    - Resend API 키
 *   FROM_EMAIL        - 발신 이메일 (Resend 인증 주소 또는 onboarding@resend.dev)
 *   NEOPLE_API_KEY    - Neople Open API 키
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const NEOPLE_API_KEY = process.env.NEOPLE_API_KEY;
const TABLE_NAME = process.env.ALERT_TABLE_NAME || "dnf-auction-alerts";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

export const handler = async (event) => {
  console.log("Alert checker triggered", new Date().toISOString());

  if (!RESEND_API_KEY || !NEOPLE_API_KEY) {
    console.error("Missing env vars: RESEND_API_KEY or NEOPLE_API_KEY");
    return { statusCode: 500, body: "Missing env vars" };
  }

  // 1. 활성화된 알림 조건 전부 조회
  const alertsResult = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "isActive = :active",
      ExpressionAttributeValues: { ":active": true },
    })
  );

  const alerts = alertsResult.Items || [];
  console.log(`Active alerts: ${alerts.length}`);

  if (alerts.length === 0) {
    return { statusCode: 200, body: "No active alerts" };
  }

  // 2. 아이템별 그룹핑 (같은 아이템 중복 API 호출 방지)
  const itemGroups = {};
  for (const alert of alerts) {
    const key = `${alert.itemName}__${alert.wordType || "match"}`;
    if (!itemGroups[key]) itemGroups[key] = [];
    itemGroups[key].push(alert);
  }

  // 3. 아이템별 Neople API 시세 조회 + 조건 매칭 + 알림 발송
  for (const [key, groupAlerts] of Object.entries(itemGroups)) {
    const [itemName, wordType] = key.split("__");

    try {
      const params = new URLSearchParams({
        itemName,
        wordType: wordType || "match",
        limit: "10",
        "sort[unitPrice]": "asc",
        apikey: NEOPLE_API_KEY,
      });

      const res = await fetch(
        `https://api.neople.co.kr/df/auction?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      const rows = data.rows || [];

      if (rows.length === 0) {
        console.log(`No auction data for: ${itemName}`);
        continue;
      }

      const lowestPrice = rows[0].unitPrice;
      const avgPrice = Math.round(
        rows.reduce((s, r) => s + r.unitPrice, 0) / rows.length
      );

      console.log(`${itemName}: lowest=${lowestPrice} avg=${avgPrice}`);

      // 각 알림 조건과 매칭
      for (const alert of groupAlerts) {
        const shouldNotify = checkCondition(
          alert.priceCondition,
          alert.targetPrice,
          lowestPrice,
          avgPrice
        );

        if (!shouldNotify) continue;

        // 중복 알림 방지: 마지막 알림에서 30분 이내면 스킵
        if (alert.lastNotified) {
          const lastTime = new Date(alert.lastNotified).getTime();
          if (Date.now() - lastTime < 30 * 60 * 1000) {
            console.log(`Skipping ${alert.alertId}: notified within 30min`);
            continue;
          }
        }

        // Resend API로 이메일 발송 (fetch 직접 호출)
        console.log(`Sending alert: ${itemName} → ${alert.email}`);

        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [alert.email],
              subject: `[던프] ${itemName} 시세 알림`,
              html: buildEmailHtml(itemName, lowestPrice, avgPrice, alert, rows),
            }),
          });

          if (emailRes.ok) {
            const result = await emailRes.json();
            console.log(`Email sent: ${result.id}`);

            // 수정 (1회 발송 후 종료)
            await docClient.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { alertId: alert.alertId },
                UpdateExpression: "SET lastNotified = :now, isActive = :inactive",
                ExpressionAttributeValues: {
                  ":now": new Date().toISOString(),
                  ":inactive": false,
                },
              })
            );
          } else {
            const errBody = await emailRes.text();
            console.error(`Resend error (${emailRes.status}): ${errBody}`);
          }
        } catch (emailErr) {
          console.error(`Email send failed for ${alert.email}:`, emailErr);
        }
      }
    } catch (err) {
      console.error(`Error processing ${itemName}:`, err);
    }
  }

  return { statusCode: 200, body: "Done" };
};

function checkCondition(condition, targetPrice, lowestPrice, avgPrice) {
  switch (condition) {
    case "below":
      return lowestPrice <= targetPrice;
    case "above":
      return lowestPrice >= targetPrice;
    case "avg_below":
      return avgPrice <= targetPrice;
    default:
      return lowestPrice <= targetPrice;
  }
}

function buildEmailHtml(itemName, lowestPrice, avgPrice, alert, rows) {
  const topItems = rows
    .slice(0, 5)
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #2a2a42;">
            ${r.reinforce > 0 ? `+${r.reinforce} ` : ""}${r.itemName}
          </td>
          <td style="padding:8px;border-bottom:1px solid #2a2a42;text-align:right;color:#f0c040;">
            ${r.unitPrice.toLocaleString()} 골드
          </td>
        </tr>`
    )
    .join("");

  return `
    <div style="background:#0a0a0f;color:#e8e8f0;padding:24px;font-family:sans-serif;max-width:500px;">
      <h2 style="color:#f0c040;margin:0 0 16px;">던프 시세 알림</h2>
      <p style="color:#9898b4;margin:0 0 8px;">
        <strong style="color:#e8e8f0;">${itemName}</strong> 아이템이
        설정하신 조건에 도달했습니다.
      </p>
      <div style="background:#1a1a28;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;color:#9898b4;">현재 최저가</p>
        <p style="margin:0;font-size:24px;font-weight:bold;color:#f0c040;">
          ${lowestPrice.toLocaleString()} 골드
        </p>
        <p style="margin:8px 0 0;color:#6a6a88;font-size:14px;">
          설정 조건: ${alert.targetPrice.toLocaleString()} 골드 ${alert.priceCondition === "below" ? "이하" : "이상"}
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="color:#6a6a88;font-size:12px;">
          <td style="padding:8px;border-bottom:1px solid #2a2a42;">아이템</td>
          <td style="padding:8px;border-bottom:1px solid #2a2a42;text-align:right;">가격</td>
        </tr>
        ${topItems}
      </table>
      <p style="color:#6a6a88;font-size:12px;margin-top:16px;">
        이 알림은 30분 내 중복 발송되지 않습니다.
      </p>
    </div>
  `;
}
