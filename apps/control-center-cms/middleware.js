import { NextResponse } from "next/server";

const REALM = "Control Center CMS";

function challenge() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store"
    }
  });
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function unauthorizedIfUnconfigured() {
  return new NextResponse("CMS auth is not configured", {
    status: 503,
    headers: { "Cache-Control": "no-store" }
  });
}

export function middleware(request) {
  const expectedUser = process.env.CMS_AUTH_USER;
  const expectedPassword = process.env.CMS_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return unauthorizedIfUnconfigured();

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return challenge();

  let decoded = "";
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return challenge();
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return challenge();

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  if (safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)) {
    return NextResponse.next();
  }

  return challenge();
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"]
};
