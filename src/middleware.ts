import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/ads.txt") {
    return NextResponse.rewrite(new URL("/api/adstxt", request.url));
  }
  if (pathname === "/sitemap.xml") {
    return NextResponse.rewrite(new URL("/api/sitemap", request.url));
  }
  if (pathname === "/robots.txt") {
    return NextResponse.rewrite(new URL("/api/robotstxt", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ads.txt", "/sitemap.xml", "/robots.txt"],
};