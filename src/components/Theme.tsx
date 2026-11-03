"use client";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        background: { default: "#F7F0DD", paper: "#FFFFFF" },
        text: { primary: "#123D20", secondary: "#46614C" },
        primary: { main: "#075B35", contrastText: "#FFFFFF" },
        secondary: { main: "#FF492D", contrastText: "#123D20" },
        error: { main: "#FF492D", contrastText: "#123D20" },
        info: { main: "#4D78E8" },
        divider: "#D9CBA9",
      },
    },
    dark: {
      palette: {
        background: { default: "#181E2B", paper: "#232B3B" },
        text: { primary: "#F7F0DD", secondary: "#C2C7D2" },
        primary: { main: "#45B879", contrastText: "#181E2B" },
        secondary: { main: "#FF725D", contrastText: "#181E2B" },
        error: { main: "#FF725D", contrastText: "#181E2B" },
        info: { main: "#83A2FF" },
        divider: "#414B5C",
      },
    },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: "Arial, Helvetica, sans-serif",
    h3: { fontWeight: 750 },
    h4: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": { "--exchange-retro-pink": "#F34E91" },
        ".dark": { "--exchange-retro-pink": "#FF78AF" },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: "1px solid",
          borderColor: theme.vars.palette.divider,
          boxShadow: "none",
          backgroundImage: "none",
        }),
      },
    },
  },
});
export default function Theme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
