"use client";
import { useActionState, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ThemeSwitch from "@/components/ThemeSwitch";
import DeleteChristmas from "@/components/DeleteChristmas";
import { mutate, signIn, signOut, type Result } from "@/app/actions";
export type Person = {
  id: string;
  name: string;
  active: boolean;
  participant_access: { email: string; enabled: boolean } | null;
};
export type Exclusion = { id: string; person_a: string; person_b: string };
export type Exchange = { id: string; year: number; created_at: string };
export type Pair = {
  exchange_id: string;
  giver_id: string;
  recipient_id: string;
};
function ActionForm({
  children,
  actionName,
  label = "Save",
  color = "primary",
}: {
  children?: React.ReactNode;
  actionName: string;
  label?: string;
  color?: "primary" | "secondary";
}) {
  const [state, action, pending] = useActionState<Result, FormData>(mutate, {});
  return (
    <Box component="form" action={action}>
      <input type="hidden" name="action" value={actionName} />
      <Stack spacing={2}>
        {children}
        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.success && <Alert severity="success">{state.success}</Alert>}
        <Button
          type="submit"
          variant="contained"
          color={color}
          disabled={pending}
        >
          {pending ? "Saving…" : label}
        </Button>
      </Stack>
    </Box>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent
        sx={{
          p: { xs: 2.5, md: 4 },
          "&:last-child": { pb: { xs: 2.5, md: 4 } },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 1,
          }}
        >
          <Typography variant="h6" sx={{ minWidth: 0 }}>
            {title}
          </Typography>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
export default function Dashboard({
  authorized,
  admins,
  people,
  exclusions,
  exchanges,
  pairs,
  loadError,
  authError,
}: {
  authorized: boolean;
  admins: { email: string }[];
  people: Person[];
  exclusions: Exclusion[];
  exchanges: Exchange[];
  pairs: Pair[];
  loadError: string;
  authError: boolean;
}) {
  const [tab, setTab] = useState(0);
  const [login, loginAction, pending] = useActionState<Result, FormData>(
    signIn,
    {},
  );
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const active = people.filter((p) => p.active);
  const existing = exchanges.find((e) => e.year === year);
  const columns = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
    gap: 3,
    alignItems: "start",
  };
  const assignmentList = (id: string) => (
    <Stack divider={<Divider />} spacing={1.5}>
      {pairs
        .filter((p) => p.exchange_id === id)
        .sort((a, b) =>
          (names.get(a.giver_id) || "").localeCompare(
            names.get(b.giver_id) || "",
          ),
        )
        .map((p) => (
          <Box
            key={p.giver_id}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 2,
              py: 1,
            }}
          >
            <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
              {names.get(p.giver_id) || "Archived person"}
            </Typography>
            <Typography aria-label="gives to" color="text.secondary">
              →
            </Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {names.get(p.recipient_id) || "Archived person"}
            </Typography>
          </Box>
        ))}
    </Stack>
  );
  return (
    <>
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              py: 2.5,
            }}
          >
            <Typography
              sx={{
                color: "info.main",
                fontWeight: 800,
                letterSpacing: "-.5px",
              }}
            >
              CHRISTMAS EXCHANGE
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <ThemeSwitch />
              {authorized ? (
                <form action={signOut}>
                  <Button type="submit" size="small" color="info">
                    Sign out
                  </Button>
                </form>
              ) : null}
            </Stack>
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 7 } }}>
        <Stack spacing={2} sx={{ mb: 4 }}>
          <Typography
            variant="overline"
            color="secondary"
            sx={{ fontWeight: 800, letterSpacing: 2 }}
          >
            A FAMILY TRADITION, MADE SIMPLE
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: "2.5rem", md: "3.5rem" },
              maxWidth: 700,
              letterSpacing: "-2px",
            }}
          >
            {authorized ? (
              <>
                More joy.
                <br />
                Less drawing names.
              </>
            ) : (
              "Who's on your list?"
            )}
          </Typography>
          <Typography
            sx={{
              maxWidth: 600,
              fontSize: "1.1rem",
              color: authorized
                ? "text.secondary"
                : "var(--exchange-retro-pink)",
            }}
          >
            {authorized
              ? "Keep everyone together, make a little Christmas magic, and remember who gave to whom."
              : "The secret to your Secret Santa starts here."}
          </Typography>
        </Stack>
        {!authorized ? (
          <Box sx={{ maxWidth: 520 }}>
            <Panel
              title="Welcome, Gordon Gang"
              subtitle="Your family’s names and exchanges stay behind your sign-in."
            >
              <form action={loginAction}>
                <Stack spacing={2.5}>
                  {authError && (
                    <Alert severity="error">
                      Google sign-in could not be completed. Try again and
                      choose a Google account on your family’s invite list.
                    </Alert>
                  )}
                  {login.error && <Alert severity="error">{login.error}</Alert>}
                  {login.success && (
                    <Alert severity="success">{login.success}</Alert>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={pending}
                  >
                    {pending ? "Connecting…" : "Continue with Google"}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Use the Google account on your family’s invite list. You’ll
                    see your assignments or admin dashboard.
                  </Typography>
                </Stack>
              </form>
            </Panel>
          </Box>
        ) : (
          <>
            {loadError ? (
              <Alert severity="error">
                Couldn’t load your family data: {loadError}. If this is the
                first setup, run the supplied Supabase migration before
                continuing.
              </Alert>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: { xs: 1, sm: 2 },
                    mb: 3,
                  }}
                >
                  {[
                    [active.length, "Active people"],
                    [exclusions.length, "Excluded pairs"],
                    [exchanges.length, "Christmases saved"],
                  ].map(([value, label]) => (
                    <Card key={label}>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {label}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
                <Tabs
                  value={tab}
                  onChange={(_, v: number) => setTab(v)}
                  variant="scrollable"
                  allowScrollButtonsMobile
                  aria-label="Exchange sections"
                  sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
                >
                  <Tab label="This Christmas" />
                  <Tab label="People & Couples" />
                  <Tab label="Christmases Past" />
                </Tabs>
                {tab === 0 && (
                  <Box sx={columns}>
                    <Panel
                      title="Plan your Christmas"
                      subtitle="Choose a year and your participants. Couples and excluded pairs will never draw each other. Two people drawing each other is avoided whenever possible."
                    >
                      <Stack spacing={3}>
                        <TextField
                          label="Christmas year"
                          type="number"
                          value={year}
                          onChange={(e) => setYear(Number(e.target.value))}
                          slotProps={{ htmlInput: { min: 2000, max: 2200 } }}
                        />
                        {existing ? (
                          <Alert severity="info">
                            This year’s exchange is already saved. View its
                            assignments alongside this panel.
                          </Alert>
                        ) : active.length < 3 ? (
                          <Alert severity="info">
                            Add at least three active people in People & Couples
                            to get started.
                          </Alert>
                        ) : (
                          <ActionForm
                            key={`${year}-${active.map((p) => p.id).join()}`}
                            actionName="generate"
                            label="Generate & save exchange"
                          >
                            <input type="hidden" name="year" value={year} />
                            <Box
                              component="fieldset"
                              sx={{ border: 0, p: 0, m: 0 }}
                            >
                              <Typography
                                component="legend"
                                sx={{ fontWeight: 700, mb: 1 }}
                              >
                                Who’s joining?
                              </Typography>
                              <Stack>
                                {active.map((p) => (
                                  <FormControlLabel
                                    key={p.id}
                                    control={
                                      <Checkbox
                                        name="participants"
                                        value={p.id}
                                        defaultChecked
                                      />
                                    }
                                    label={p.name}
                                  />
                                ))}
                              </Stack>
                            </Box>
                            <Divider />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  name="avoid_previous"
                                  defaultChecked
                                />
                              }
                              label={`Avoid ${year - 1} assignments, if saved`}
                            />
                            <Alert severity="info">
                              Generating saves the final assignments for this
                              year. Review participants and exclusions first. To
                              redraw, delete the saved Christmas from Past
                              Christmases first.
                            </Alert>
                          </ActionForm>
                        )}
                      </Stack>
                    </Panel>
                    <Panel
                      title={
                        existing
                          ? `${year} assignments`
                          : "Ready for a little magic?"
                      }
                      subtitle={
                        existing
                          ? "Organizer view · each person gives once and receives once."
                          : "Your saved assignments will appear here."
                      }
                    >
                      {existing ? (
                        assignmentList(existing.id)
                      ) : (
                        <Box
                          sx={{
                            py: 6,
                            textAlign: "center",
                            bgcolor: "action.hover",
                            borderRadius: 3,
                          }}
                        >
                          <Typography sx={{ fontSize: 64 }} aria-hidden>
                            ✳
                          </Typography>
                          <Typography color="primary" sx={{ fontWeight: 700 }}>
                            A thoughtful gift starts here.
                          </Typography>
                        </Box>
                      )}
                    </Panel>
                  </Box>
                )}
                {tab === 1 && (
                  <Box sx={columns}>
                    <Panel
                      title="Your people"
                      subtitle="Names are remembered every year. Pause someone without losing their history."
                    >
                      <Stack spacing={3}>
                        <ActionForm actionName="add-person" label="Add person">
                          <TextField
                            name="name"
                            label="Name"
                            required
                            slotProps={{ htmlInput: { maxLength: 80 } }}
                          />
                        </ActionForm>
                        <Divider />
                        {people.length === 0 && (
                          <Typography color="text.secondary">
                            Start with your siblings, then add their partners.
                          </Typography>
                        )}
                        {people.map((p) => (
                          <Box key={p.id}>
                            <Stack
                              direction="row"
                              sx={{
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 2,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {p.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {p.active
                                    ? "Participating by default"
                                    : "Paused · history kept"}
                                </Typography>
                              </Box>
                              <ActionForm
                                actionName="toggle-person"
                                label={p.active ? "Pause" : "Activate"}
                              >
                                <input type="hidden" name="id" value={p.id} />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={String(!p.active)}
                                />
                              </ActionForm>
                            </Stack>
                            <Box sx={{ mt: 2 }}>
                              <ActionForm
                                actionName="save-access"
                                label="Save login access"
                              >
                                <input type="hidden" name="id" value={p.id} />
                                <TextField
                                  name="email"
                                  type="email"
                                  label="Google login email (optional)"
                                  defaultValue={
                                    p.participant_access?.email || ""
                                  }
                                  helperText="Leave blank and save to remove access. Each email can belong to one person."
                                  fullWidth
                                />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      name="enabled"
                                      defaultChecked={
                                        p.participant_access?.enabled ?? true
                                      }
                                    />
                                  }
                                  label="Allow this person to sign in"
                                />
                              </ActionForm>
                            </Box>
                            <Divider sx={{ mt: 3 }} />
                          </Box>
                        ))}
                      </Stack>
                    </Panel>
                    <Stack spacing={3}>
                      <Panel
                        title="Admins"
                        subtitle="Admins can manage people, login access, and all exchanges, and see every assignment. At least one admin must remain."
                      >
                        <Stack spacing={3}>
                          <ActionForm actionName="set-admin" label="Add admin">
                            <TextField
                              name="email"
                              type="email"
                              label="Google email"
                              required
                            />
                            <input type="hidden" name="admin" value="on" />
                          </ActionForm>
                          {admins.map((admin) => (
                            <ActionForm
                              key={admin.email}
                              actionName="set-admin"
                              label="Save admin access"
                            >
                              <input
                                type="hidden"
                                name="email"
                                value={admin.email}
                              />
                              <Typography sx={{ overflowWrap: "anywhere" }}>
                                {admin.email}
                              </Typography>
                              <FormControlLabel
                                control={
                                  <Checkbox name="admin" defaultChecked />
                                }
                                label="Admin access"
                              />
                            </ActionForm>
                          ))}
                        </Stack>
                      </Panel>
                      <Panel
                        title="Couples & exclusions"
                        subtitle="Each pair is blocked in both directions. Add couples or any other people who shouldn’t draw one another."
                      >
                        <Stack spacing={3}>
                          {people.length >= 2 && (
                            <ActionForm
                              actionName="add-exclusion"
                              label="Exclude this pair"
                            >
                              {["person_a", "person_b"].map((name, i) => (
                                <TextField
                                  key={name}
                                  select
                                  name={name}
                                  label={`Person ${i + 1}`}
                                  defaultValue=""
                                  required
                                >
                                  <MenuItem value="" disabled>
                                    Select someone
                                  </MenuItem>
                                  {people.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                      {p.name}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              ))}
                            </ActionForm>
                          )}
                          {exclusions.length === 0 && (
                            <Typography color="text.secondary">
                              No exclusions yet.
                            </Typography>
                          )}
                          {exclusions.map((e) => (
                            <Box key={e.id}>
                              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                                {names.get(e.person_a)} &{" "}
                                {names.get(e.person_b)}
                              </Typography>
                              <ActionForm
                                actionName="remove-exclusion"
                                label="Remove exclusion"
                                color="secondary"
                              >
                                <input type="hidden" name="id" value={e.id} />
                              </ActionForm>
                            </Box>
                          ))}
                        </Stack>
                      </Panel>
                    </Stack>
                  </Box>
                )}
                {tab === 2 && (
                  <Stack spacing={3}>
                    {exchanges.length === 0 ? (
                      <Panel
                        title="Your tradition starts here"
                        subtitle="Once you generate an exchange, it will be saved here for future Christmases."
                      >
                        <Typography color="text.secondary">
                          No Christmases saved yet.
                        </Typography>
                      </Panel>
                    ) : (
                      exchanges.map((e) => (
                        <Panel
                          key={e.id}
                          title={`Christmas ${e.year}`}
                          action={<DeleteChristmas id={e.id} year={e.year} />}
                          subtitle={`${pairs.filter((p) => p.exchange_id === e.id).length} participants · saved ${new Date(e.created_at).toLocaleDateString("en-US", { timeZone: "America/Denver" })}`}
                        >
                          {assignmentList(e.id)}
                        </Panel>
                      ))
                    )}
                  </Stack>
                )}
              </>
            )}
          </>
        )}
        <Typography
          component="footer"
          variant="body2"
          color="text.secondary"
          sx={{ mt: 6, textAlign: "center" }}
        >
          Made for the Gordons. Remembered for next Christmas.
        </Typography>
      </Container>
    </>
  );
}
