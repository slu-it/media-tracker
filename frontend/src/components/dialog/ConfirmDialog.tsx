import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from "@mui/material";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  open: boolean;
  /** The yes/no question to show. */
  question: string;
  /** Called exactly once per interaction: `true` for yes, `false` for no, Escape or backdrop click. */
  onDecision: (confirmed: boolean) => void;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  /** Label of the confirm button; defaults to "Yes". */
  confirmLabel?: string;
  /** Label of the decline button; defaults to "No". */
  cancelLabel?: string;
  /** Focuses the decline button instead of the confirm button, so Enter cannot trigger an irreversible action. */
  focusCancel?: boolean;
}

/** Generic yes/no confirmation; the button labels can be overridden. */
export function ConfirmDialog({
  open,
  question,
  onDecision,
  destructive,
  confirmLabel,
  cancelLabel,
  focusCancel = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={() => onDecision(false)} maxWidth="xs" fullWidth aria-describedby="confirm-question">
      <DialogContent>
        <DialogContentText id="confirm-question" color="text.primary">
          {question}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onDecision(false)} autoFocus={focusCancel}>
          {cancelLabel ?? t("common.no")}
        </Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          onClick={() => onDecision(true)}
          autoFocus={!focusCancel}
        >
          {confirmLabel ?? t("common.yes")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
