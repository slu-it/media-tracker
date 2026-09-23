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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { BaseDialog } from "../../../components/dialog/BaseDialog";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { focusVisibleRingSx } from "../../../theme/focusRing";
import type { CoverMatchResponse, CoverOptionResponse } from "../../../types/api";
import { CoverThumbnail } from "./CoverThumbnail";
import { COVER_TYPES, DEFAULT_COVER_TYPE, type CoverType } from "../domain/coverTypes";
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH } from "../domain/gameValues";
import { useCoverOptions } from "../hooks/useCoverOptions";

interface CoverPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the search field (the game's or the draft's title, may be empty). */
  initialQuery: string;
  releaseYear: number | null;
  /** The cover that is highlighted as current (`aria-pressed`), null for none. */
  currentCoverUrl: string | null;
  /**
   * Receives the full-size URL; the host persists or fills a field and closes the dialog. A rejection shows the
   * pick error.
   */
  onPick: (imageUrl: string) => Promise<void> | void;
}

/** Search SteamGridDB for cover art; persistence is entirely up to the host via `onPick`. */
export function CoverPickerDialog({
  open,
  onClose,
  initialQuery,
  releaseYear,
  currentCoverUrl,
  onPick,
}: CoverPickerDialogProps) {
  if (!open) return null;
  return (
    <CoverPickerDialogContent
      onClose={onClose}
      initialQuery={initialQuery}
      releaseYear={releaseYear}
      currentCoverUrl={currentCoverUrl}
      onPick={onPick}
    />
  );
}

const TITLE_ID = "cover-picker-title";

function CoverPickerDialogContent({
  onClose,
  initialQuery,
  releaseYear,
  currentCoverUrl,
  onPick,
}: Omit<CoverPickerDialogProps, "open">) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState(initialQuery.slice(0, SEARCH_MAX_LENGTH));
  const [debouncedQuery, flushQuery] = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  // The picked match is remembered together with the query it was picked for, so a new search term evaluates to
  // "no override" (server ranking applies) in the same render instead of a reset effect - the same state-pairing
  // trick GamesView uses for its page reset.
  const [matchOverride, setMatchOverride] = useState<{ match: number; forQuery: string } | null>(null);
  const match = matchOverride && matchOverride.forQuery === debouncedQuery ? matchOverride.match : null;
  const [coverType, setCoverType] = useState<CoverType>(DEFAULT_COVER_TYPE);
  const {
    data,
    covers,
    totalCovers,
    hasMore,
    loading,
    loadingMore,
    error,
    errorSource,
    unavailable,
    reload,
    loadMore,
  } = useCoverOptions(debouncedQuery, releaseYear, match, coverType, t("games.coverPicker.loadFailed"));
  const selectedMatchId = match ?? data?.selectedMatchId ?? null;
  const hasQuery = debouncedQuery.trim().length > 0;
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = async (option: CoverOptionResponse) => {
    setBusy(true);
    setPickError(null);
    try {
      await onPick(option.imageUrl);
    } catch (cause: unknown) {
      setPickError(errorMessage(cause, t("errors.saveFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseDialog open onClose={onClose} titleId={TITLE_ID} maxWidth="md">
      <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ mb: 2 }}>
        {t("games.coverPicker.title")}
      </Typography>
      {pickError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pickError}
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
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          {hasQuery && !loading && !unavailable && !error && data && data.matches.length > 0 && (
            <TextField
              select
              label={t("games.coverPicker.match")}
              value={selectedMatchId ?? ""}
              onChange={(event) => setMatchOverride({ match: Number(event.target.value), forQuery: debouncedQuery })}
              fullWidth
              sx={{ flex: 1 }}
            >
              {data.matches.map((candidate) => (
                <MenuItem key={candidate.id} value={candidate.id}>
                  {matchLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!unavailable && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={coverType}
              onChange={(_event, value: CoverType | null) => {
                if (value) setCoverType(value);
              }}
              aria-label={t("games.coverPicker.type")}
            >
              {COVER_TYPES.map((value) => (
                <ToggleButton key={value} value={value}>
                  {t(value === "static" ? "games.coverPicker.typeStatic" : "games.coverPicker.typeAnimated")}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>
        {!hasQuery && <Typography color="text.secondary">{t("games.coverPicker.enterTerm")}</Typography>}
        {hasQuery && loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress aria-label={t("common.loading")} />
          </Box>
        )}
        {hasQuery && !loading && unavailable && <Alert severity="warning">{t("games.coverPicker.unavailable")}</Alert>}
        {hasQuery && !loading && !unavailable && error && (
          <Alert
            severity="error"
            // A load-more failure keeps the already-loaded pages visible below, with the "Load more" button
            // itself as the retry; only an initial-load failure (which leaves no covers to show) gets its own
            // Retry action here.
            action={
              errorSource === "initial" ? (
                <Button color="inherit" size="small" onClick={reload}>
                  {t("common.retry")}
                </Button>
              ) : undefined
            }
          >
            {error}
          </Alert>
        )}
        {hasQuery && !loading && !unavailable && !error && data && data.matches.length === 0 && (
          <Typography color="text.secondary">{t("games.coverPicker.noMatches", { term: data.query })}</Typography>
        )}
        {hasQuery &&
          !loading &&
          !error &&
          !unavailable &&
          selectedMatchId !== null &&
          covers.length === 0 &&
          !hasMore && <Typography color="text.secondary">{t("games.coverPicker.noCovers")}</Typography>}
        {/*
         * Not gated on `!error`: an error here can only mean a `loadMore()` failure once earlier pages already
         * loaded (an initial-load failure leaves `covers` empty, so these sections stay hidden regardless). The
         * blocking alert above still reports the failure; these keep the already-loaded pages visible next to it.
         */}
        {hasQuery && !loading && !unavailable && totalCovers > 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("games.coverPicker.shownOfTotal", { shown: covers.length, count: totalCovers })}
          </Typography>
        )}
        {hasQuery && !loading && !unavailable && covers.length > 0 && (
          <Box
            role="group"
            aria-label={t("games.coverPicker.title")}
            aria-busy={busy}
            sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
          >
            {covers.map((option, index) => {
              const isCurrent = option.imageUrl === currentCoverUrl;
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
                  <CoverThumbnail thumbnailUrl={option.thumbnailUrl} imageUrl={option.imageUrl} width={120} />
                </ButtonBase>
              );
            })}
          </Box>
        )}
        {hasQuery && !loading && !unavailable && hasMore && (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Button
              onClick={loadMore}
              disabled={loadingMore || busy}
              startIcon={loadingMore ? <CircularProgress size={16} aria-hidden /> : undefined}
            >
              {t("games.coverPicker.loadMore")}
            </Button>
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
