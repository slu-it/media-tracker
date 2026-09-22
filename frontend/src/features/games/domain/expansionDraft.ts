import type { CreateExpansionRequest, ExpansionResponse, UpdateExpansionRequest } from "../../../types/api";
import { DEFAULT_OWNERSHIP, DEFAULT_PROGRESS, type Ownership, type Progress } from "./gameStatus";
import { validateTitle } from "./gameValues";

/** What the form edits: raw field values, possibly incomplete or invalid. */
export interface ExpansionDraft {
  title: string;
  ownership: Ownership;
  progress: Progress;
}

export function emptyExpansionDraft(): ExpansionDraft {
  return {
    title: "",
    ownership: DEFAULT_OWNERSHIP,
    progress: DEFAULT_PROGRESS,
  };
}

export function draftFromExpansion(expansion: ExpansionResponse): ExpansionDraft {
  return {
    title: expansion.title,
    ownership: expansion.ownership,
    progress: expansion.progress,
  };
}

export function isDraftValid(draft: ExpansionDraft): boolean {
  return validateTitle(draft.title) === null;
}

export function isDraftDirty(expansion: ExpansionResponse, draft: ExpansionDraft): boolean {
  return Object.keys(toUpdateRequest(expansion, draft)).length > 0;
}

/** Throws when the draft is invalid; callers keep the save button disabled until `isDraftValid`. */
export function toCreateRequest(draft: ExpansionDraft): CreateExpansionRequest {
  if (!isDraftValid(draft)) {
    throw new Error("draft is not valid");
  }
  return {
    title: draft.title.trim(),
    ownership: draft.ownership,
    progress: draft.progress,
  };
}

/** Only the fields that differ from `expansion`; no expansion field can be cleared, so `sequence` is never sent. */
export function toUpdateRequest(expansion: ExpansionResponse, draft: ExpansionDraft): UpdateExpansionRequest {
  const request: UpdateExpansionRequest = {};
  const title = draft.title.trim();
  if (title !== expansion.title) request.title = title;
  if (draft.ownership !== expansion.ownership) request.ownership = draft.ownership;
  if (draft.progress !== expansion.progress) request.progress = draft.progress;
  return request;
}
