import type { CreateGameRequest, GameDeveloperResponse, GameResponse, UpdateGameRequest } from "../../../types/api";
import { normalizeCoverImageUrl, normalizeDescription, sameIds } from "../../../domain/media/draft";
import {
  validateCoverImageUrl,
  validateDescription,
  validateReleaseDate,
  validateReleaseYear,
  validateTitle,
} from "../../../domain/media/values";
import { isExistingEntry, type VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { DEFAULT_HIDDEN, DEFAULT_OWNERSHIP, DEFAULT_PROGRESS, type Ownership, type Progress } from "./gameStatus";
import { validatePlatformIds, validateRating } from "./gameValues";

/** A selected developer chip: an existing developer or a pending free-solo name (see `VocabularyDraft`). */
export type DeveloperDraft = VocabularyDraft<GameDeveloperResponse>;

/** What the form edits: raw field values, possibly incomplete or invalid. */
export interface GameDraft {
  title: string;
  releaseYear: number | null;
  /** ISO-8601 `YYYY-MM-DD`; `null` when only the release year is known. Kept in sync via `withReleaseDate` (`domain/media/draft`). */
  releaseDate: string | null;
  platformIds: string[];
  description: string;
  rating: number | null;
  coverImageUrl: string;
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
  /**
   * Existing developers and pending free-solo names (see `DeveloperDraft`). The host resolves these into ids via
   * `resolveDeveloperIds` right before saving; `toCreateRequest`/`toUpdateRequest` take the resolved ids instead
   * of this field directly.
   */
  developers: DeveloperDraft[];
}

export function emptyGameDraft(): GameDraft {
  return {
    title: "",
    releaseYear: null,
    releaseDate: null,
    platformIds: [],
    description: "",
    rating: null,
    coverImageUrl: "",
    ownership: DEFAULT_OWNERSHIP,
    progress: DEFAULT_PROGRESS,
    hidden: DEFAULT_HIDDEN,
    developers: [],
  };
}

export function draftFromGame(game: GameResponse): GameDraft {
  return {
    title: game.title,
    releaseYear: game.releaseYear,
    releaseDate: game.releaseDate,
    platformIds: game.platforms.map((platform) => platform.id),
    description: game.description ?? "",
    rating: game.rating,
    coverImageUrl: game.coverImageUrl ?? "",
    ownership: game.ownership,
    progress: game.progress,
    hidden: game.hidden,
    developers: game.developers,
  };
}

export function isDraftValid(draft: GameDraft): boolean {
  return (
    validateTitle(draft.title) === null &&
    validateReleaseYear(draft.releaseYear) === null &&
    validateReleaseDate(draft.releaseDate) === null &&
    validatePlatformIds(draft.platformIds) === null &&
    validateDescription(draft.description) === null &&
    validateRating(draft.rating) === null &&
    validateCoverImageUrl(draft.coverImageUrl) === null
  );
}

/** The ids of the draft's already-existing developers; pending (not-yet-created) ones have no id yet. */
function existingDeveloperIds(draft: GameDraft): string[] {
  return draft.developers.filter(isExistingEntry).map((developer) => developer.id);
}

/**
 * A pending developer (typed but not yet created on the backend) always counts as a change: it cannot be
 * compared to the game's ids until `resolveDeveloperIds` runs, which only happens right before saving.
 */
function hasPendingDeveloper(draft: GameDraft): boolean {
  return draft.developers.some((developer) => !isExistingEntry(developer));
}

export function isDraftDirty(game: GameResponse, draft: GameDraft): boolean {
  if (hasPendingDeveloper(draft)) return true;
  return Object.keys(toUpdateRequest(game, draft, existingDeveloperIds(draft))).length > 0;
}

/**
 * Throws when the draft is invalid; callers keep the save button disabled until `isDraftValid`. `developerIds` is
 * the draft's developers already resolved to ids (see `resolveDeveloperIds`); omitted from the request when empty.
 */
export function toCreateRequest(draft: GameDraft, developerIds: string[]): CreateGameRequest {
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
    releaseDate: draft.releaseDate,
    ...(developerIds.length > 0 ? { developerIds } : {}),
  };
}

/**
 * Only the fields that differ from `game`; `null` clears `description`/`rating`/`coverImageUrl`. `developerIds`
 * is the draft's developers already resolved to ids (see `resolveDeveloperIds`); sent only when the set differs
 * from the game's, order-insensitive.
 */
export function toUpdateRequest(game: GameResponse, draft: GameDraft, developerIds: string[]): UpdateGameRequest {
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
  if (draft.releaseDate !== game.releaseDate) request.releaseDate = draft.releaseDate;
  const existingGameDeveloperIds = game.developers.map((developer) => developer.id);
  if (!sameIds(developerIds, existingGameDeveloperIds)) request.developerIds = developerIds;
  return request;
}
