import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { CoverImage } from "../../../components/CoverImage";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { focusVisibleRingSx } from "../../../theme/focusRing";
import type { CoverMatchResponse, CoverOptionResponse, GameResponse } from "../../../types/api";
import { updateGame } from "../api/gamesApi";
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH } from "../domain/gameValues";
import { useCoverOptions } from "../hooks/useCoverOptions";

interface CoverPickerDialogProps {
  game: GameResponse;
  open: boolean;
  onClose: () => void;
  /** Called after a cover was picked and saved; the dialog does not close itself. */
  onSaved: (updated: GameResponse) => void;
}

/** Search SteamGridDB for cover art and PATCH the chosen one onto the game. */
export function CoverPickerDialog({ game, open, onClose, onSaved }: CoverPickerDialogProps) {
  if (!open) return null;
  return <CoverPickerDialogContent key={game.id} game={game} onClose={onClose} onSaved={onSaved} />;
}

const TITLE_ID = "cover-picker-title";

function CoverPickerDialogContent({ game, onClose, onSaved }: Omit<CoverPickerDialogProps, "open">) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState(game.title.slice(0, SEARCH_MAX_LENGTH));
  const [debouncedQuery, flushQuery] = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  // The picked match is remembered together with the query it was picked for, so a new search term evaluates to
  // "no override" (server ranking applies) in the same render instead of a reset effect - the same state-pairing
  // trick GamesView uses for its page reset.
  const [matchOverride, setMatchOverride] = useState<{ match: number; forQuery: string } | null>(null);
  const match = matchOverride && matchOverride.forQuery === debouncedQuery ? matchOverride.match : null;
  const { data, loading, error, unavailable, reload } = useCoverOptions(
    game.id,
    debouncedQuery,
    match,
    t("games.coverPicker.loadFailed"),
  );
  const selectedMatchId = match ?? data?.selectedMatchId ?? null;
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pick = async (option: CoverOptionResponse) => {
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await updateGame(game.id, { coverImageUrl: option.imageUrl });
      onSaved(updated);
    } catch (cause: unknown) {
      setSaveError(errorMessage(cause, t("errors.saveFailed")));
      setBusy(false);
    }
  };

  return (
    <BaseDialog open onClose={onClose} titleId={TITLE_ID} maxWidth="md">
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t("games.coverPicker.title")}
      </Typography>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      <Stack spacing={2}>
        <TextField
          label={t("games.coverPicker.search")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") flushQuery();
          }}
          slotProps={{ htmlInput: { maxLength: SEARCH_MAX_LENGTH } }}
          fullWidth
          autoFocus
        />
        {!loading && !unavailable && !error && data && data.matches.length > 0 && (
          <TextField
            select
            label={t("games.coverPicker.match")}
            value={selectedMatchId ?? ""}
            onChange={(event) => setMatchOverride({ match: Number(event.target.value), forQuery: debouncedQuery })}
            fullWidth
          >
            {data.matches.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {matchLabel(candidate)}
              </MenuItem>
            ))}
          </TextField>
        )}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress aria-label={t("common.loading")} />
          </Box>
        )}
        {!loading && unavailable && <Alert severity="warning">{t("games.coverPicker.unavailable")}</Alert>}
        {!loading && !unavailable && error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={reload}>
                {t("common.retry")}
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!loading && !unavailable && !error && data && data.matches.length === 0 && (
          <Typography color="text.secondary">{t("games.coverPicker.noMatches", { term: data.query })}</Typography>
        )}
        {!loading && !unavailable && !error && data && data.matches.length > 0 && data.covers.length === 0 && (
          <Typography color="text.secondary">{t("games.coverPicker.noCovers")}</Typography>
        )}
        {!loading && !unavailable && !error && data && data.covers.length > 0 && (
          <Box
            role="group"
            aria-label={t("games.coverPicker.title")}
            aria-busy={busy}
            sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
          >
            {data.covers.map((option, index) => {
              const isCurrent = option.imageUrl === game.coverImageUrl;
              return (
                <ButtonBase
                  key={option.imageUrl}
                  onClick={() => void pick(option)}
                  disabled={busy}
                  aria-label={t("games.coverPicker.pick", { index: index + 1 })}
                  aria-pressed={isCurrent}
                  sx={{
                    borderRadius: 1,
                    border: 2,
                    borderColor: isCurrent ? "primary.main" : "transparent",
                    ...focusVisibleRingSx,
                  }}
                >
                  <CoverImage src={option.thumbnailUrl} alt="" width={120} height={160} />
                </ButtonBase>
              );
            })}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          {t("games.coverPicker.attribution")}
        </Typography>
      </Stack>
    </BaseDialog>
  );
}

function matchLabel(candidate: CoverMatchResponse): string {
  return candidate.releaseYear === null ? candidate.name : `${candidate.name} (${candidate.releaseYear})`;
}
