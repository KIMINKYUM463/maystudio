import { NextResponse, type NextRequest } from "next/server";

/**
 * Password lock for when the app is reachable from the internet (Cloudflare tunnel to mayaistudio.com).
 * Set MAYSTUDIO_PASSWORD in .env.local to turn it on. Work on this computer (localhost) is never asked;
 * followers' pages stay public: the link page, its /go redirects and the media it shows.
 */
const PUBLIC = [/^\/links\/?$/, /^\/go\//, /^\/api\/files\//, /^\/icon\.svg$/];
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function sameText(a: string, b: string): boolean {
  // Length-independent comparison so timing doesn't reveal how much of the password matched.
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env.MAYSTUDIO_PASSWORD;
  if (!password) return NextResponse.next();
  // Tunnel traffic always carries Cloudflare's visitor header; direct local use never does.
  const local = LOCAL_HOST.test(request.headers.get("host") ?? "") && !request.headers.get("cf-connecting-ip");
  if (local) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (request.method === "GET" && PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      // Browsers send UTF-8 (realm says charset="UTF-8"), so a Korean password works too.
      decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
    } catch {
      // malformed header → treated as no password
    }
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (sameText(given, password)) return NextResponse.next();
  }
  return new NextResponse("비밀번호가 필요해요.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MayAIStudio", charset="UTF-8"' },
  });
}

export const config = {
  // Static build files load without a password so the prompt itself and the link page render.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
