"use client";
import { useActionState, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  SvgIcon,
  Tooltip,
} from "@mui/material";
import { mutate, type Result } from "@/app/actions";
export default function DeleteChristmas({
  id,
  year,
}: {
  id: string;
  year: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<Result, FormData>(mutate, {});
  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);
  return (
    <>
      <Tooltip title={`Delete Christmas ${year}`}>
        <IconButton
          aria-label={`Delete Christmas ${year}`}
          color="error"
          onClick={() => setOpen(true)}
        >
          <SvgIcon>
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </SvgIcon>
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        aria-labelledby={`delete-title-${id}`}
        aria-describedby={`delete-description-${id}`}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id={`delete-title-${id}`}>
          Delete Christmas {year}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id={`delete-description-${id}`}>
            This permanently removes every assignment for {year}, including
            participants’ history for that year. People, login access, and
            couple exclusions will stay. You can generate a new exchange
            afterward. This cannot be undone.
          </DialogContentText>
          {state.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {state.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setOpen(false)}>
            Keep Christmas
          </Button>
          <form action={action}>
            <input type="hidden" name="action" value="delete-exchange" />
            <input type="hidden" name="id" value={id} />
            <Button
              type="submit"
              color="error"
              variant="contained"
              disabled={pending}
            >
              {pending ? "Deleting…" : `Delete ${year}`}
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </>
  );
}
