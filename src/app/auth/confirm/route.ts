import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  // The request URL can contain the server bind address behind a proxy.
  // Use the same public origin that initiated the OAuth flow.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.url;
  const db = await supabase();
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: access, error: accessError } = await db.rpc("my_access");
      if (!accessError && access?.length)
        return NextResponse.redirect(new URL("/", siteUrl));
      await db.auth.signOut();
      return NextResponse.redirect(
        new URL("/?auth_error=access_denied", siteUrl),
      );
    }
    await db.auth.signOut();
  }
  return NextResponse.redirect(new URL("/?auth_error=1", siteUrl));
}
