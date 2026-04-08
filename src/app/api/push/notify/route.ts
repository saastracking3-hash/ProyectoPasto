import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Validate it's an internal call (check for a secret header)
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, title, body, url } = await req.json();
  const supabase = await createClient();

  // Fetch subscription
  const { data } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId)
    .single();

  if (!data) return NextResponse.json({ error: "No subscription" }, { status: 404 });

  const subscription = JSON.parse(data.subscription);

  // Use web-push library if available, otherwise return the subscription for manual sending
  // Since we can't install packages here, return the subscription data
  // The actual push sending requires web-push npm package
  return NextResponse.json({
    subscription,
    payload: JSON.stringify({ title, body, url }),
    message: "Install web-push npm package to enable actual push sending",
  });
}
