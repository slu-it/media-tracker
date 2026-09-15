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
}

/** Generic yes/no confirmation. */
export function ConfirmDialog({ open, question, onDecision, destructive }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={() => onDecision(false)} maxWidth="xs" fullWidth aria-describedby="confirm-question">
      <DialogContent>
        <DialogContentText id="confirm-question" color="text.primary">
          {question}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onDecision(false)}>{t("common.no")}</Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          onClick={() => onDecision(true)}
          autoFocus
        >
          {t("common.yes")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
