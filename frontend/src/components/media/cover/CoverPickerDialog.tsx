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
import { BaseDialog } from "../../dialog/BaseDialog";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { focusVisibleRingSx } from "../../../theme/focusRing";
import type { CoverOptionResponse } from "../../../types/api";
import { CoverThumbnail } from "./CoverThumbnail";
import { SEARCH_MAX_LENGTH } from "../../../domain/media/values";
import {
  useCoverOptions,
  type CoverMatchLike,
  type CoverOptionsLike,
  type CoverPageRequest,
} from "../../../hooks/useCoverOptions";
import { useSearchDebounceMs } from "../../../hooks/useSearchDebounceMs";

/** Already-translated, kind-specific texts; the kind-neutral ones come from `media.coverPicker.*`. */
export interface CoverPickerTexts {
  /** Label of the match select (games: "Matching game"). */
  match: string;
  noMatches: (term: string) => string;
  noCovers: string;
  /** Shown when the source answers 503 with `unavailableCode`. */
  unavailable: string;
  /** Source credit under the grid (games: "Covers from SteamGridDB"). */
  attribution: string;
}

/** An optional exclusive toggle next to the match select (games: static/animated; books: book/audiobook). */
export interface CoverPickerVariants<V extends string> {
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
  /** Accessible name of the toggle group. */
  ariaLabel: string;
}

export interface CoverPickerDialogProps<Id extends string | number, V extends string> {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the search field (the item's or the draft's title, may be empty). */
  initialQuery: string;
  releaseYear: number | null;
  /** The cover that is highlighted as current (`aria-pressed`), null for none. */
  currentCoverUrl: string | null;
  /**
   * Receives the full-size URL; the host persists or fills a field and closes the dialog. A rejection shows the
   * pick error.
   */
  onPick: (imageUrl: string) => Promise<void> | void;
  texts: CoverPickerTexts;
  /** The selected variant (controlled by the host, which resets it per open); sent to `fetchPage`. */
  variant: V;
  variants?: CoverPickerVariants<V>;
  /** Thumbnail frame ratio (width / height); defaults to the standard cover ratio. */
  aspectRatio?: number;
  /** See `useCoverOptions`. */
  fetchPage: (request: CoverPageRequest<Id, V>) => Promise<CoverOptionsLike<Id>>;
  unavailableCode: string;
}

/**
 * Search a cover source and pick one; persistence is entirely up to the host via `onPick`. The match select
 * only appears when the source returned matches (a flat source such as an audiobook catalogue has none).
 */
export function CoverPickerDialog<Id extends string | number, V extends string>({
  open,
  ...props
}: CoverPickerDialogProps<Id, V>) {
  if (!open) return null;
  return <CoverPickerDialogContent {...props} />;
}

const TITLE_ID = "cover-picker-title";
const THUMBNAIL_WIDTH = 120;

function CoverPickerDialogContent<Id extends string | number, V extends string>({
  onClose,
  initialQuery,
  releaseYear,
  currentCoverUrl,
  onPick,
  texts,
  variant,
  variants,
  aspectRatio,
  fetchPage,
  unavailableCode,
}: Omit<CoverPickerDialogProps<Id, V>, "open">) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState(initialQuery.slice(0, SEARCH_MAX_LENGTH));
  const [debouncedQuery, flushQuery] = useDebouncedValue(searchInput.trim(), useSearchDebounceMs());
  // The picked match is remembered together with the variant and query it was picked for, so a new search term or
  // variant evaluates to "no override" (server ranking applies) in the same render instead of a reset effect - the same state-pairing
  // trick GamesView uses for its page reset.
  const [matchOverride, setMatchOverride] = useState<{ match: Id; forKey: string } | null>(null);
  const matchKey = `${variant}:${debouncedQuery}`;
  const match = matchOverride && matchOverride.forKey === matchKey ? matchOverride.match : null;
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
  } = useCoverOptions({
    query: debouncedQuery,
    releaseYear,
    match,
    variant,
    fetchPage,
    unavailableCode,
    loadErrorText: t("media.coverPicker.loadFailed"),
  });
  const selectedMatchId = match ?? data?.selectedMatchId ?? null;
  const hasQuery = debouncedQuery.trim().length > 0;
  const matches = data?.matches ?? [];
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
        {t("media.coverPicker.title")}
      </Typography>
      {pickError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pickError}
        </Alert>
      )}
      <Stack spacing={2}>
        <TextField
          label={t("media.coverPicker.search")}
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
          {hasQuery && !loading && !unavailable && !error && matches.length > 0 && (
            <TextField
              select
              label={texts.match}
              value={selectedMatchId ?? ""}
              onChange={(event) => {
                const picked = matches.find((candidate) => String(candidate.id) === String(event.target.value));
                if (picked) setMatchOverride({ match: picked.id, forKey: matchKey });
              }}
              fullWidth
              sx={{ flex: 1 }}
            >
              {matches.map((candidate) => (
                <MenuItem key={candidate.id} value={candidate.id}>
                  {matchLabel(candidate)}
                </MenuItem>
              ))}
            </TextField>
          )}
          {variants && !unavailable && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={variant}
              onChange={(_event, value: V | null) => {
                if (value) variants.onChange(value);
              }}
              aria-label={variants.ariaLabel}
            >
              {variants.options.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>
        {!hasQuery && <Typography color="text.secondary">{t("media.coverPicker.enterTerm")}</Typography>}
        {hasQuery && loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress aria-label={t("common.loading")} />
          </Box>
        )}
        {hasQuery && !loading && unavailable && <Alert severity="warning">{texts.unavailable}</Alert>}
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
        {hasQuery && !loading && !unavailable && !error && data && matches.length === 0 && covers.length === 0 && (
          <Typography color="text.secondary">{texts.noMatches(data.query)}</Typography>
        )}
        {hasQuery && !loading && !error && !unavailable && matches.length > 0 && covers.length === 0 && !hasMore && (
          <Typography color="text.secondary">{texts.noCovers}</Typography>
        )}
        {/*
         * Not gated on `!error`: an error here can only mean a `loadMore()` failure once earlier pages already
         * loaded (an initial-load failure leaves `covers` empty, so these sections stay hidden regardless). The
         * blocking alert above still reports the failure; these keep the already-loaded pages visible next to it.
         */}
        {hasQuery && !loading && !unavailable && totalCovers > 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("media.coverPicker.shownOfTotal", { shown: covers.length, count: totalCovers })}
          </Typography>
        )}
        {hasQuery && !loading && !unavailable && covers.length > 0 && (
          <Box
            role="group"
            aria-label={t("media.coverPicker.title")}
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
                  aria-label={t("media.coverPicker.pick", { index: index + 1 })}
                  aria-pressed={isCurrent}
                  sx={{
                    borderRadius: 1,
                    border: 2,
                    borderColor: isCurrent ? "primary.main" : "transparent",
                    ...focusVisibleRingSx,
                  }}
                >
                  <CoverThumbnail
                    thumbnailUrl={option.thumbnailUrl}
                    imageUrl={option.imageUrl}
                    width={THUMBNAIL_WIDTH}
                    aspectRatio={aspectRatio}
                  />
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
              {t("media.coverPicker.loadMore")}
            </Button>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          {texts.attribution}
        </Typography>
      </Stack>
    </BaseDialog>
  );
}

function matchLabel(candidate: CoverMatchLike<string | number>): string {
  return candidate.releaseYear === null ? candidate.name : `${candidate.name} (${candidate.releaseYear})`;
}
