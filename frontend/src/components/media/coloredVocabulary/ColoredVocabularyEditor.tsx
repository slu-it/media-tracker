import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiError, errorMessage } from "../../../api/client";
import { AddColoredEntryForm } from "./AddColoredEntryForm";
import type { ColoredEntry, ColoredEntryUpdate, ColoredVocabularyLabels } from "./coloredVocabulary";
import { ColoredVocabularyRow } from "./ColoredVocabularyRow";

interface ColoredVocabularyEditorProps {
  /** Must be a stable function (module-level): it is an effect dependency. */
  load: () => Promise<ColoredEntry[]>;
  create: (label: string, color: string) => Promise<unknown>;
  update: (id: string, changes: ColoredEntryUpdate) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
  labels: ColoredVocabularyLabels;
  /** Called after every successful mutation. */
  onChanged: () => void;
}

/** Lists, renames, recolors, adds and deletes the entries of a colored vocabulary (platforms, book types). */
export function ColoredVocabularyEditor({
  load,
  create,
  update,
  remove,
  labels,
  onChanged,
}: ColoredVocabularyEditorProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ColoredEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadFailedText = labels.loadFailed;

  useEffect(() => {
    let cancelled = false;
    load()
      .then((loaded) => {
        if (cancelled) return;
        setEntries(loaded);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, loadFailedText));
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadToken, loadFailedText]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const changed = () => {
    onChanged();
    reload();
  };

  const handleCreate = async (label: string, color: string) => {
    await create(label, color);
    changed();
  };

  const handleUpdate = async (id: string, changes: ColoredEntryUpdate) => {
    setActionError(null);
    try {
      await update(id, changes);
    } catch (cause: unknown) {
      const nameTaken = cause instanceof ApiError && cause.status === 409 && cause.body?.error === "name_taken";
      if (!nameTaken) setActionError(errorMessage(cause, t("errors.saveFailed")));
      throw cause;
    }
    changed();
  };

  const handleRemove = async (id: string) => {
    setActionError(null);
    try {
      await remove(id);
      changed();
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 409) reload();
      setActionError(errorMessage(cause, t("errors.deleteFailed")));
    }
  };

  if (entries === null) {
    return loadError === null ? (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress aria-label={t("common.loading")} />
      </Box>
    ) : (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={reload}>
            {t("common.retry")}
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      {loadError !== null && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              {t("common.retry")}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}
      {actionError !== null && <Alert severity="error">{actionError}</Alert>}
      {entries.length === 0 ? (
        <Typography color="text.secondary">{labels.empty}</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <ColoredVocabularyRow entry={entry} labels={labels} update={handleUpdate} remove={handleRemove} />
            </li>
          ))}
        </Box>
      )}
      <AddColoredEntryForm labels={labels} usedColors={entries.map((e) => e.associatedColor)} create={handleCreate} />
    </Stack>
  );
}
