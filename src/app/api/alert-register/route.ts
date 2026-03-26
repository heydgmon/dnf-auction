import { NextRequest, NextResponse } from "next/server";
import { addAlert } from "@/lib/alert-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/utils";
import { AlertRule, AlertRegisterRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: AlertRegisterRequest = await request.json();
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

    const rule: AlertRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email,
      itemName: itemName.trim(),
      targetPrice,
      condition,
      createdAt: new Date().toISOString(),
      fulfilled: false,
    };

    const result = await addAlert(rule);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message, rule });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
