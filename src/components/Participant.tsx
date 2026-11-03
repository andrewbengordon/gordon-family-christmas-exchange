import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import GiftReveal from "@/components/GiftReveal";
import ThemeSwitch from "@/components/ThemeSwitch";
import { signOut } from "@/app/actions";
export default function Participant({
  name,
  assignments,
  error,
  denied = false,
}: {
  name: string;
  assignments: { year: number; recipient_name: string }[];
  error: boolean;
  denied?: boolean;
}) {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "America/Denver",
    }).format(new Date()),
  );
  const current = assignments.find((a) => a.year === year);
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={3}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography sx={{ color: "info.main", fontWeight: 800 }}>
            CHRISTMAS EXCHANGE
          </Typography>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <ThemeSwitch />
            <form action={signOut}>
              <Button type="submit" color="info">
                Sign out
              </Button>
            </form>
          </Stack>
        </Stack>
        {denied ? (
          <Alert severity="warning">
            Access is limited to invited family members. Ask the organizer to
            add your Google account email, then sign out and try again.
          </Alert>
        ) : (
          <>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Let's Get Merry &amp; Bright
            </Typography>
            <Typography sx={{ color: "var(--exchange-retro-pink)" }}>
              Find out who you're shopping for!
              {current && !error ? " Click to reveal." : ""}
            </Typography>
            {error ? (
              <Alert severity="error">
                We couldn’t load your assignments. Please try again later.
              </Alert>
            ) : (
              <>
                <Card>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Typography variant="overline">CHRISTMAS {year}</Typography>
                    {current ? (
                      <GiftReveal
                        key={`${year}-${current.recipient_name}`}
                        recipient={current.recipient_name}
                      />
                    ) : (
                      <Typography variant="h6" sx={{ mt: 0.5 }}>
                        Your Christmas is on its way
                      </Typography>
                    )}
                    {!current && (
                      <Typography sx={{ mt: 2 }} color="text.secondary">
                        There’s no assignment for you yet this year. Check back
                        after your organizer saves the exchange.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: "error.main" }}>
                    Christmases Past
                  </Typography>
                  <Stack spacing={2}>
                    {assignments
                      .filter((a) => a.year < year)
                      .map((a) => (
                        <Card key={a.year}>
                          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                            <Typography variant="overline">
                              CHRISTMAS {a.year}
                            </Typography>
                            <Typography>
                              You gave to <strong>{a.recipient_name}</strong>
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    {!assignments.some((a) => a.year < year) && (
                      <Typography color="text.secondary">
                        Your past assignments will appear here.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
