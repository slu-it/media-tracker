import type { CreateGameRequest, GameResponse, UpdateGameRequest } from "../../../types/api";
import { DEFAULT_HIDDEN, DEFAULT_OWNERSHIP, DEFAULT_PROGRESS, type Ownership, type Progress } from "./gameStatus";
import {
  validateCoverImageUrl,
  validateDescription,
  validatePlatformIds,
  validateRating,
  validateReleaseYear,
  validateTitle,
} from "./gameValues";

/** What the form edits: raw field values, possibly incomplete or invalid. */
export interface GameDraft {
  title: string;
  releaseYear: number | null;
  platformIds: string[];
  description: string;
  rating: number | null;
  coverImageUrl: string;
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
}

export function emptyGameDraft(): GameDraft {
  return {
    title: "",
    releaseYear: null,
    platformIds: [],
    description: "",
    rating: null,
    coverImageUrl: "",
    ownership: DEFAULT_OWNERSHIP,
    progress: DEFAULT_PROGRESS,
    hidden: DEFAULT_HIDDEN,
  };
}

export function draftFromGame(game: GameResponse): GameDraft {
  return {
    title: game.title,
    releaseYear: game.releaseYear,
    platformIds: game.platforms.map((platform) => platform.id),
    description: game.description ?? "",
    rating: game.rating,
    coverImageUrl: game.coverImageUrl ?? "",
    ownership: game.ownership,
    progress: game.progress,
    hidden: game.hidden,
  };
}

export function isDraftValid(draft: GameDraft): boolean {
  return (
    validateTitle(draft.title) === null &&
    validateReleaseYear(draft.releaseYear) === null &&
    validatePlatformIds(draft.platformIds) === null &&
    validateDescription(draft.description) === null &&
    validateRating(draft.rating) === null &&
    validateCoverImageUrl(draft.coverImageUrl) === null
  );
}

/** Trimmed URL, or `null` for "no cover". */
export function normalizeCoverImageUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Trimmed description, or `null` for "no description". */
export function normalizeDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function isDraftDirty(game: GameResponse, draft: GameDraft): boolean {
  return Object.keys(toUpdateRequest(game, draft)).length > 0;
}

/** Throws when the draft is invalid; callers keep the save button disabled until `isDraftValid`. */
export function toCreateRequest(draft: GameDraft): CreateGameRequest {
  if (!isDraftValid(draft) || draft.releaseYear === null) {
    throw new Error("draft is not valid");
  }
  return {
    title: draft.title.trim(),
    releaseYear: draft.releaseYear,
    platformIds: draft.platformIds,
    description: normalizeDescription(draft.description),
    rating: draft.rating,
    coverImageUrl: normalizeCoverImageUrl(draft.coverImageUrl),
    ownership: draft.ownership,
    progress: draft.progress,
    hidden: draft.hidden,
  };
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

/** Only the fields that differ from `game`; `null` clears `description`/`rating`/`coverImageUrl`. */
export function toUpdateRequest(game: GameResponse, draft: GameDraft): UpdateGameRequest {
  const request: UpdateGameRequest = {};
  const title = draft.title.trim();
  if (title !== game.title) request.title = title;
  if (draft.releaseYear !== null && draft.releaseYear !== game.releaseYear) request.releaseYear = draft.releaseYear;
  const existingPlatformIds = game.platforms.map((platform) => platform.id);
  if (!sameIds(draft.platformIds, existingPlatformIds)) request.platformIds = draft.platformIds;
  const description = normalizeDescription(draft.description);
  if (description !== game.description) request.description = description;
  if (draft.rating !== game.rating) request.rating = draft.rating;
  const cover = normalizeCoverImageUrl(draft.coverImageUrl);
  if (cover !== game.coverImageUrl) request.coverImageUrl = cover;
  if (draft.ownership !== game.ownership) request.ownership = draft.ownership;
  if (draft.progress !== game.progress) request.progress = draft.progress;
  if (draft.hidden !== game.hidden) request.hidden = draft.hidden;
  return request;
}
