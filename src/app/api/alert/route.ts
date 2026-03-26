import { NextRequest, NextResponse } from "next/server";
import { getAlertsByEmail, deleteAlert } from "@/lib/alert-store";
import { validateEmail } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get("email");
  if (!email || !validateEmail(email)) {
    return NextResponse.json({ error: { message: "올바른 이메일을 입력해주세요." } }, { status: 400 });
  }

  try {
    const rules = await getAlertsByEmail(email);
    return NextResponse.json({ rules });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, email } = await request.json();
    if (!id || !email) {
      return NextResponse.json({ success: false, message: "id and email required" }, { status: 400 });
    }
    const deleted = await deleteAlert(id, email);
    return NextResponse.json({ success: deleted, message: deleted ? "삭제되었습니다." : "알림을 찾을 수 없습니다." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
