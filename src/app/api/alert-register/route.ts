import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/utils";

const ALERT_API_URL = process.env.ALERT_API_URL || "https://s0fmsbmnji.execute-api.ap-northeast-2.amazonaws.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, itemName, targetPrice, condition } = body;

    // 입력 검증
    if (!email || !itemName || !targetPrice || !condition) {
      return NextResponse.json(
        { success: false, message: "모든 필드를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { success: false, message: "올바른 이메일 주소를 입력해주세요." },
        { status: 400 }
      );
    }

    if (targetPrice <= 0) {
      return NextResponse.json(
        { success: false, message: "목표 가격은 0보다 커야 합니다." },
        { status: 400 }
      );
    }

    if (condition !== "below" && condition !== "above") {
      return NextResponse.json(
        { success: false, message: "조건은 below 또는 above만 가능합니다." },
        { status: 400 }
      );
    }

    // 스팸 방지: 이메일 기반 레이트 리밋
    const rateCheck = checkRateLimit(email);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.retryAfterMs || 0) / 60000);
      return NextResponse.json(
        { success: false, message: `요청이 너무 많습니다. ${minutes}분 후에 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    // IP 기반 레이트 리밋
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const ipCheck = checkRateLimit(`ip:${ip}`);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    // API Gateway → Lambda → DynamoDB
    const res = await fetch(`${ALERT_API_URL}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, itemName, targetPrice, condition }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("alert-register error:", err);
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}