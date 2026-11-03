"use client";
import { IconButton, SvgIcon, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
export default function ThemeSwitch() {
  const { mode, systemMode, setMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          disabled={!mode}
          onClick={() => setMode(dark ? "light" : "dark")}
          color="info"
        >
          <SvgIcon>
            {dark ? (
              <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-1-7h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM3.5 4.9l1.4-1.4 2.8 2.8-1.4 1.4zm12.8 12.8 1.4-1.4 2.8 2.8-1.4 1.4zm0-11.4 2.8-2.8 1.4 1.4-2.8 2.8zM3.5 19.1l2.8-2.8 1.4 1.4-2.8 2.8z" />
            ) : (
              <path d="M9.37 5.51A7 7 0 0 0 18.49 14.63 7 7 0 1 1 9.37 5.51z" />
            )}
          </SvgIcon>
        </IconButton>
      </span>
    </Tooltip>
  );
}
