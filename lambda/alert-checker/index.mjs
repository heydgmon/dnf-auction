/**
 * Lambda: alert-checker
 *
 * DynamoDB Streams에서 트리거 (price_history에 새 레코드 INSERT 시)
 * 또는 EventBridge에서 price-collector 직후 트리거.
 *
 * 알림 조건 충족 시 Resend API로 이메일 발송 후 alert fulfilled 처리.
 *
 * 환경변수:
 *   ALERT_TABLE     - DynamoDB alert_rules 테이블
 *   RESEND_API_KEY  - Resend API 키
 *   FROM_EMAIL      - 발신 이메일 주소
 *   NEOPLE_API_KEY  - Neople API (현재 가격 확인용)
 *
 * 배포:
 *   zip -r alert-checker.zip index.mjs
 *   aws lambda update-function-code --function-name alert-checker --zip-file fileb://alert-checker.zip
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({});
const API_BASE = "https://api.neople.co.kr";

export const handler = async (event) => {
  const alertTable = process.env.ALERT_TABLE || "alert_rules";
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "alerts@example.com";
  const apiKey = process.env.NEOPLE_API_KEY;

  if (!resendKey || !apiKey) {
    console.error("Missing env vars");
    return { statusCode: 500 };
  }

  // 1. 미완료 알림 조회
  const scan = await db.send(new ScanCommand({
    TableName: alertTable,
    FilterExpression: "fulfilled = :f",
    ExpressionAttributeValues: { ":f": { BOOL: false } },
  }));

  const rules = scan.Items || [];
  if (rules.length === 0) {
    console.log("No active alerts");
    return { statusCode: 200 };
  }

  // 아이템별 그룹핑
  const byItem = {};
  for (const rule of rules) {
    const name = rule.itemName?.S;
    if (!name) continue;
    if (!byItem[name]) byItem[name] = [];
    byItem[name].push(rule);
  }

  // 2. 아이템별 현재 시세 확인 + 알림 발송
  for (const [itemName, itemRules] of Object.entries(byItem)) {
    try {
      const url = `${API_BASE}/df/auction?itemName=${encodeURIComponent(itemName)}&wordType=match&limit=5&sort[unitPrice]=asc&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.rows || data.rows.length === 0) continue;

      const currentMin = data.rows[0].unitPrice;
      const currentAvg = Math.round(
        data.rows.map((r) => r.unitPrice).reduce((a, b) => a + b, 0) / data.rows.length
      );

      console.log(`${itemName}: min=${currentMin} avg=${currentAvg}`);

      for (const rule of itemRules) {
        const target = Number(rule.targetPrice?.N || 0);
        const condition = rule.condition?.S;
        const email = rule.email?.S;
        const ruleId = rule.id?.S;

        if (!email || !ruleId) continue;

        let triggered = false;
        if (condition === "below" && currentMin <= target) triggered = true;
        if (condition === "above" && currentMin >= target) triggered = true;

        if (!triggered) continue;

        // 3. Resend으로 이메일 발송
        console.log(`ALERT: ${itemName} ${condition} ${target} → ${email}`);

        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: `[던파 경매장] ${itemName} 시세 알림`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="color:#18182a;margin:0 0 16px">시세 알림</h2>
                  <div style="background:#f6f6f9;border-radius:8px;padding:16px;margin-bottom:16px">
                    <p style="margin:0 0 8px;font-size:14px;color:#4a4a6a">아이템</p>
                    <p style="margin:0;font-size:18px;font-weight:bold;color:#18182a">${itemName}</p>
                  </div>
                  <div style="display:flex;gap:12px;margin-bottom:16px">
                    <div style="flex:1;background:#f6f6f9;border-radius:8px;padding:12px">
                      <p style="margin:0 0 4px;font-size:12px;color:#8888a8">설정 가격</p>
                      <p style="margin:0;font-size:16px;font-weight:bold;color:#b87d20">${target.toLocaleString()} 골드 ${condition === "below" ? "이하" : "이상"}</p>
                    </div>
                    <div style="flex:1;background:#f6f6f9;border-radius:8px;padding:12px">
                      <p style="margin:0 0 4px;font-size:12px;color:#8888a8">현재 최저가</p>
                      <p style="margin:0;font-size:16px;font-weight:bold;color:#18804a">${currentMin.toLocaleString()} 골드</p>
                    </div>
                  </div>
                  <p style="font-size:12px;color:#8888a8;margin:0">
                    이 알림은 1회 발송 후 자동으로 종료됩니다.
                  </p>
                </div>
              `,
            }),
          });

          if (emailRes.ok) {
            // 4. 알림 완료 처리
            await db.send(new UpdateItemCommand({
              TableName: alertTable,
              Key: {
                PK: { S: rule.PK?.S },
                SK: { S: rule.SK?.S },
              },
              UpdateExpression: "SET fulfilled = :t, fulfilledAt = :now",
              ExpressionAttributeValues: {
                ":t": { BOOL: true },
                ":now": { S: new Date().toISOString() },
              },
            }));
            console.log(`Email sent and rule fulfilled: ${ruleId}`);
          } else {
            const errBody = await emailRes.text();
            console.error(`Resend error: ${errBody}`);
          }
        } catch (emailErr) {
          console.error(`Email send failed for ${email}:`, emailErr);
        }
      }
    } catch (err) {
      console.error(`Failed checking ${itemName}:`, err);
    }
  }

  return { statusCode: 200, body: "Done" };
};
