import { NextResponse } from "next/server";

export async function GET() {
  const content = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://dnfprice.link/sitemap.xml`;

  return new NextResponse(content, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}