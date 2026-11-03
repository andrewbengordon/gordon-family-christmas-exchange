"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateAssignments } from "@/lib/matching";
export type Result = { error?: string; success?: string };
async function organizer() {
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  const { data: allowed, error: accessError } = await db.rpc("is_organizer");
  if (error || !user || accessError || !allowed)
    throw new Error("Please sign in with the organizer email.");
  return db;
}
export async function signIn(): Promise<Result> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site)
    return {
      error: "Sign-in is not configured. Please contact the organizer.",
    };
  const db = await supabase();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${site.replace(/\/$/, "")}/auth/confirm`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url)
    return {
      error:
        "Google sign-in is unavailable. Please try again later or contact the organizer.",
    };
  redirect(data.url);
}
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/");
}
export async function mutate(_: Result, form: FormData): Promise<Result> {
  try {
    const db = await organizer();
    const action = String(form.get("action"));
    if (action === "set-admin") {
      const { error } = await db.rpc("set_admin", {
        target_email: String(form.get("email") || ""),
        make_admin: form.get("admin") === "on",
      });
      if (error) throw error;
    } else if (action === "add-person") {
      const name = String(form.get("name") || "").trim();
      if (!name || name.length > 80)
        throw new Error("Enter a name between 1 and 80 characters.");
      const { error } = await db.from("people").insert({ name });
      if (error) throw error;
    } else if (action === "save-access") {
      const id = String(form.get("id") || "");
      const email = String(form.get("email") || "")
        .trim()
        .toLowerCase();
      if (!email) {
        const { error } = await db
          .from("participant_access")
          .delete()
          .eq("person_id", id);
        if (error) throw error;
      } else {
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new Error("Enter a valid Google account email.");
        const { error } = await db
          .from("participant_access")
          .upsert(
            { person_id: id, email, enabled: form.get("enabled") === "on" },
            { onConflict: "person_id" },
          );
        if (error) throw error;
      }
    } else if (action === "toggle-person") {
      const { error } = await db
        .from("people")
        .update({ active: form.get("active") === "true" })
        .eq("id", String(form.get("id")));
      if (error) throw error;
    } else if (action === "add-exclusion") {
      const pair = [
        String(form.get("person_a")),
        String(form.get("person_b")),
      ].sort();
      if (pair[0] === pair[1] || pair.includes(""))
        throw new Error("Choose two different people.");
      const { error } = await db
        .from("exclusions")
        .insert({ person_a: pair[0], person_b: pair[1] });
      if (error) throw error;
    } else if (action === "remove-exclusion") {
      const { error } = await db
        .from("exclusions")
        .delete()
        .eq("id", String(form.get("id")));
      if (error) throw error;
    } else if (action === "delete-exchange") {
      const { error } = await db.rpc("delete_exchange", {
        target_id: String(form.get("id")),
      });
      if (error) throw error;
    } else if (action === "generate") {
      const year = Number(form.get("year"));
      if (!Number.isInteger(year) || year < 2000 || year > 2200)
        throw new Error("Choose a year from 2000 to 2200.");
      const ids = form.getAll("participants").map(String);
      const { data: exclusions, error } = await db
        .from("exclusions")
        .select("person_a,person_b");
      if (error) throw error;
      const { data: past, error: historyError } = await db
        .from("exchanges")
        .select("id,year")
        .lt("year", year);
      if (historyError) throw historyError;
      let history: { giver_id: string; recipient_id: string; year: number }[] =
        [];
      if (past?.length) {
        const { data, error } = await db
          .from("assignments")
          .select("exchange_id,giver_id,recipient_id")
          .in(
            "exchange_id",
            past.map((e) => e.id),
          );
        if (error) throw error;
        const years = new Map(past.map((e) => [e.id, e.year]));
        history = (data || []).map((a) => ({
          giver_id: a.giver_id,
          recipient_id: a.recipient_id,
          year: years.get(a.exchange_id)!,
        }));
      }
      const previous =
        form.get("avoid_previous") === "on"
          ? history.filter((a) => a.year === year - 1)
          : [];
      const assignments = generateAssignments(
        ids,
        exclusions || [],
        previous,
        history,
      );
      const { error: saveError } = await db.rpc("save_exchange", {
        exchange_year: year,
        pairs: assignments,
      });
      if (saveError) throw saveError;
    } else throw new Error("Unknown action.");
    revalidatePath("/");
    return {
      success:
        action === "generate"
          ? "Exchange saved! Your assignments are below."
          : "Changes saved.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : (error as { message?: string }).message ||
            "Something went wrong. Please try again.",
    };
  }
}
