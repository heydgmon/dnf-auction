import { NextRequest, NextResponse } from "next/server";
import { validateEmail } from "@/lib/utils";

const ALERT_API_URL = process.env.ALERT_API_URL || "https://s0fmsbmnji.execute-api.ap-northeast-2.amazonaws.com";

export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get("email");
  if (!email || !validateEmail(email)) {
    return NextResponse.json(
      { error: { message: "올바른 이메일을 입력해주세요." } },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${ALERT_API_URL}/alerts?email=${encodeURIComponent(email)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("alert GET error:", err);
    return NextResponse.json(
      { error: { message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email } = body;
    if (!id || !email) {
      return NextResponse.json(
        { success: false, message: "id and email required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${ALERT_API_URL}/alerts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("alert DELETE error:", err);
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}