import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const body = await req.json();
    const update: { email?: string; password?: string; displayName?: string } = {};
    if (body.email) update.email = body.email;
    if (body.password) update.password = body.password;
    if (body.displayName !== undefined) update.displayName = body.displayName;

    await adminAuth.updateUser(uid, update);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
