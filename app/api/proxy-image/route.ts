import { NextResponse } from "next/server";

const ALLOWED_HOSTS = ["firebasestorage.googleapis.com", "storage.googleapis.com"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: upstream.status });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e) {
    console.error("proxy-image failed:", e);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
