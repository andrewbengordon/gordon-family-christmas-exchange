import { supabase } from "@/lib/supabase";
import Participant from "@/components/Participant";
import { Alert, Container } from "@mui/material";
import Dashboard, {
  type Person,
  type Exclusion,
  type Exchange,
  type Pair,
} from "@/components/Dashboard";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  const params = await searchParams;
  const { data: adminAccess, error: adminError } = user
    ? await db.rpc("is_organizer")
    : { data: false, error: null };
  if (adminError)
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error">
          Unable to check admin access. Please try again.
        </Alert>
      </Container>
    );
  const authorized = !!user && adminAccess === true;
  if (user && !authorized) {
    const { data: access, error: accessError } = await db.rpc("my_access");
    if (accessError)
      return (
        <Container sx={{ py: 6 }}>
          <Alert severity="error">
            Unable to check family access. Please contact the organizer.
          </Alert>
        </Container>
      );
    if (access?.[0]?.role === "participant") {
      const { data, error } = await db.rpc("my_assignments");
      return (
        <Participant
          name={access[0].name}
          assignments={data || []}
          error={!!error}
        />
      );
    }
    return <Participant denied name="" assignments={[]} error={false} />;
  }
  let admins: { email: string }[] = [];
  let people: Person[] = [],
    exclusions: Exclusion[] = [],
    exchanges: Exchange[] = [],
    pairs: Pair[] = [],
    error = "";
  if (authorized) {
    const results = await Promise.all([
      db
        .from("people")
        .select("*, participant_access(email,enabled)")
        .order("name"),
      db.from("exclusions").select("*"),
      db.from("exchanges").select("*").order("year", { ascending: false }),
      db.from("assignments").select("*"),
      db.from("admin_access").select("email").order("email"),
    ]);
    error = results.find((r) => r.error)?.error?.message || "";
    people = results[0].data || [];
    exclusions = results[1].data || [];
    exchanges = results[2].data || [];
    pairs = results[3].data || [];
    admins = results[4].data || [];
  }
  return (
    <Dashboard
      admins={admins}
      authorized={authorized}
      people={people}
      exclusions={exclusions}
      exchanges={exchanges}
      pairs={pairs}
      loadError={error}
      authError={!!params.auth_error}
    />
  );
}
