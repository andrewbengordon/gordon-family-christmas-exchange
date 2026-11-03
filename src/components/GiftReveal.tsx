"use client";
import { useId, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";

export default function GiftReveal({ recipient }: { recipient: string }) {
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  return (
    <>
      <ButtonBase
        onClick={() => setRevealed((value) => !value)}
        aria-label={
          revealed
            ? `Giving to ${recipient}. Hide assignment.`
            : "Reveal your Christmas recipient"
        }
        aria-expanded={revealed}
        aria-controls={id}
        sx={{
          width: "100%",
          height: 320,
          mt: 1,
          borderRadius: 2,
          position: "relative",
          "&.Mui-focusVisible": {
            outline: "3px solid",
            outlineColor: "info.main",
            outlineOffset: 2,
          },
          "@media (hover: hover)": { "&:hover": { bgcolor: "action.hover" } },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: revealed ? 0 : 1,
            transform: revealed ? "scale(.92)" : "scale(1)",
            transition: "opacity 220ms ease, transform 220ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          <Box
            component="span"
            sx={{
              display: "block",
              width: 288,
              maxWidth: "100%",
              height: 288,
              bgcolor: "info.main",
              mask: "url(/images/gift-box.svg) center / contain no-repeat",
              WebkitMask:
                "url(/images/gift-box.svg) center / contain no-repeat",
            }}
          />
        </Box>
        <Box
          id={id}
          sx={{
            position: "absolute",
            inset: 0,
            px: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            opacity: revealed ? 1 : 0,
            visibility: revealed ? "visible" : "hidden",
            transition: "opacity 220ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          {revealed && (
            <>
              <Typography variant="h6">You’re giving to</Typography>
              <Typography
                variant="h4"
                sx={{
                  color: "primary.main",
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                  fontSize:
                    recipient.length > 40
                      ? "1.25rem"
                      : recipient.length > 20
                        ? "1.6rem"
                        : "2.125rem",
                  lineHeight: 1.2,
                }}
              >
                {recipient}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click to hide
              </Typography>
            </>
          )}
        </Box>
      </ButtonBase>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        {revealed ? `You’re giving to ${recipient}.` : ""}
      </Box>
    </>
  );
}
