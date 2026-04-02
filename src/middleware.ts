import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import type { UserRole } from "@/lib/types/enums";
import { ROLE_HOME } from "@/lib/types/enums";

const PUBLIC_PATHS = ["/", "/login", "/registro"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.includes(".")) return true; // static files
  return false;
}

function getRequiredRoles(pathname: string): UserRole[] | null {
  if (pathname.startsWith("/admin"))
    return ["admin", "supervisor"];
  if (pathname.startsWith("/crew"))
    return ["crew_leader", "operator"];
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/solicitar") ||
    pathname.startsWith("/servicios") ||
    pathname.startsWith("/presupuestos") ||
    pathname.startsWith("/perfil")
  )
    return ["client"];
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Supabase entirely if not configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("tu-proyecto")) {
    // Supabase not configured yet - allow all requests
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    try {
      const { supabaseResponse } = await updateSession(request);
      return supabaseResponse;
    } catch {
      return NextResponse.next();
    }
  }

  try {
    const { supabaseResponse, user } = await updateSession(request);

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }

    const role = (user.app_metadata?.role as UserRole) || "client";
    const requiredRoles = getRequiredRoles(pathname);

    if (requiredRoles && !requiredRoles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    // Supabase error - allow request through for development
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
