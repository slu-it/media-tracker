import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IconButton, InputAdornment, Stack, TextField, Tooltip } from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import { MASKED_VALUE } from "../domain/apiKeyMask";

const COPIED_FEEDBACK_MS = 2000;

interface ApiKeyFieldProps {
  label: string;
  value: string | null;
  busy: boolean;
  onRegenerate: () => void;
}

/** One API key: a masked/revealable read-only field plus copy and (re)generate actions. */
export function ApiKeyField({ label, value, busy, onRegenerate }: ApiKeyFieldProps) {
  const { t } = useTranslation();
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const revealed = revealedFor !== null && revealedFor === value;
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(copiedTimer.current);
    },
    [],
  );

  const copy = async () => {
    if (value === null) return;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return;
      } catch {
        // Fall through to the reveal-and-select fallback below.
      }
    }
    // Non-secure contexts (plain-HTTP LAN) have no Clipboard API, or the write was rejected: reveal and select.
    // flushSync forces the reveal to render before select() runs, so it selects the key, not the mask.
    flushSync(() => setRevealedFor(value));
    inputRef.current?.select();
  };

  const startRegenerate = () => {
    if (value === null) onRegenerate();
    else setConfirmOpen(true);
  };

  const regenerateLabel = t(value === null ? "settings.apiKeys.generate" : "settings.apiKeys.regenerate", { label });
  const revealLabel = t(revealed ? "settings.apiKeys.hide" : "settings.apiKeys.show", { label });
  const copyLabel = t(copied ? "settings.apiKeys.copied" : "settings.apiKeys.copy", { label });

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value === null ? "" : revealed ? value : MASKED_VALUE}
        placeholder={value === null ? t("settings.apiKeys.empty") : undefined}
        slotProps={{
          input: {
            readOnly: true,
            inputRef,
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={revealLabel}>
                  <span>
                    <IconButton
                      aria-label={revealLabel}
                      onClick={() => setRevealedFor(revealed ? null : value)}
                      disabled={value === null}
                      edge="end"
                      size="small"
                    >
                      {revealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <Tooltip title={copyLabel}>
        <span>
          <IconButton aria-label={copyLabel} onClick={() => void copy()} disabled={value === null}>
            <ContentCopyIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={regenerateLabel}>
        <span>
          <IconButton aria-label={regenerateLabel} onClick={startRegenerate} disabled={busy}>
            <AutorenewIcon />
          </IconButton>
        </span>
      </Tooltip>
      <ConfirmDialog
        open={confirmOpen}
        question={t("settings.apiKeys.regenerateQuestion", { label })}
        destructive
        onDecision={(confirmed) => {
          setConfirmOpen(false);
          if (confirmed) onRegenerate();
        }}
      />
    </Stack>
  );
}
