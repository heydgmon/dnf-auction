import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = "https://dnfprice.link";
  const pages = [
    { loc: "/", priority: "1.0", changefreq: "hourly" },
    { loc: "/about", priority: "0.5", changefreq: "monthly" },
    { loc: "/privacy", priority: "0.3", changefreq: "monthly" },
    { loc: "/terms", priority: "0.3", changefreq: "monthly" },
    { loc: "/contact", priority: "0.3", changefreq: "monthly" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}