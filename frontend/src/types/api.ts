// Hand-written mirrors of the Kotlin DTOs in backend/src/main/kotlin/de/sluit/mediatracker/common/api/Dtos.kt,
// .../auth/api/AuthDtos.kt (MeResponse, ApiKeysResponse, ChangePasswordRequest), .../games/api/GameDtos.kt,
// .../games/api/ExpansionDtos.kt, .../books/api/BookDtos.kt, .../games/api/CoverOptionDtos.kt, .../backup/api/BackupDtos.kt and
// .../dropbox/api/DropboxDtos.kt. Keep them in sync.

/** Mirrors the Kotlin `Ownership` enum in games/domain/GameStatus.kt. */
export type Ownership = "watchlist" | "subscription" | "owned";

/** Mirrors the Kotlin `Progress` enum in games/domain/GameStatus.kt. */
export type Progress = "abandoned" | "not_started" | "paused" | "playing" | "finished" | "completed";

/**
 * Ordering for `GET /api/games`; mirrors the Kotlin `GameSort` enum in games/domain/GameSort.kt. Absent/`"title"`
 * is the default and is never sent on the wire (see `listGames` in games/api/gamesApi.ts).
 */
export type GameSort = "title" | "release_asc" | "release_desc" | "rating_desc";

export interface MeResponse {
  username: string;
}

/** The user's two MCP API keys; `null` means the slot has no key yet. */
export interface ApiKeysResponse {
  primary: string | null;
  secondary: string | null;
}

export type ApiKeySlot = "primary" | "secondary";

/** Body of `PUT /api/me/password`; mirrors `ChangePasswordRequest` in auth/api/AuthDtos.kt. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Body of every non-2xx API response. `message` is only present when the backend has a detail to add;
 * `existingId`/`existingName` only on a 409 `name_taken` (the entry that already has the name).
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  existingId?: string;
  existingName?: string;
}

/** One page of a list. `page` is 1-based; `totalPages` is 0 when there are no items. */
export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** A selectable platform; `associatedColor` is `"RRGGBB"` without a leading `#`. */
export interface GamePlatformResponse {
  id: string;
  label: string;
  associatedColor: string;
}

/** A game developer/studio; mirrors `GameDeveloperResponse` in games/api/GameDtos.kt. */
export interface GameDeveloperResponse {
  id: string;
  name: string;
}

/** Body of `POST /api/game-developers`; mirrors `CreateGameDeveloperRequest` in games/api/GameDtos.kt. */
export interface CreateGameDeveloperRequest {
  name: string;
}

/** The filter values that actually occur in the stored games; mirrors `GameMetaResponse` in games/api/GameDtos.kt. */
export interface GameMetaResponse {
  /** Only platforms in use, alphabetically by label. */
  platforms: GamePlatformResponse[];
  /** Number of games per platform id; only platforms in use are keys. */
  platformCounts: Record<string, number>;
  /** Only values in use, in enum declaration order. */
  ownership: Ownership[];
  /** Only values in use, in enum declaration order. */
  progress: Progress[];
  /** Only years in use, newest first. */
  releaseYears: number[];
}

export interface GameResponse {
  id: string;
  title: string;
  releaseYear: number;
  /** At least one, sorted by label. */
  platforms: GamePlatformResponse[];
  /** Free text, at most 10000 characters; `null` when not set. */
  description: string | null;
  /** 0.25..5 in steps of 0.25; `null` means not rated yet. */
  rating: number | null;
  coverImageUrl: string | null;
  ownership: Ownership;
  progress: Progress;
  hidden: boolean;
  /** ISO-8601 `YYYY-MM-DD`; `null` when only the release year is known. */
  releaseDate: string | null;
  developers: GameDeveloperResponse[];
}

export interface CreateGameRequest {
  title: string;
  /** Required unless `releaseDate` is given, in which case the date's year is used instead. */
  releaseYear?: number | null;
  platformIds: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
  /** Omit for the default (`"watchlist"`); can never be cleared. */
  ownership?: Ownership | null;
  /** Omit for the default (`"not_started"`); can never be cleared. */
  progress?: Progress | null;
  /** Omit for the default (`false`); can never be cleared. */
  hidden?: boolean | null;
  /** ISO-8601 `YYYY-MM-DD`; omit when only the release year is known. */
  releaseDate?: string | null;
  /** Omit for the default (no developers). */
  developerIds?: string[];
}

/** PATCH body: omit a key to leave the field unchanged; `null` clears `description`/`rating`/`coverImageUrl`/`releaseDate`. */
export interface UpdateGameRequest {
  title?: string;
  releaseYear?: number;
  platformIds?: string[];
  description?: string | null;
  rating?: number | null;
  coverImageUrl?: string | null;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  ownership?: Ownership;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  progress?: Progress;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  hidden?: boolean;
  /** Omit to leave unchanged; `null` clears it back to "only the release year is known". */
  releaseDate?: string | null;
  /** Omit to leave unchanged; replaces the full set (may be empty). */
  developerIds?: string[];
}

/** One SteamGridDB game matching a search term; mirrors `CoverMatchResponse` in games/api/CoverOptionDtos.kt. */
export interface CoverMatchResponse {
  id: number;
  name: string;
  releaseYear: number | null;
  verified: boolean;
}

/** One candidate cover image for the selected match; mirrors `CoverOptionResponse`. */
export interface CoverOptionResponse {
  thumbnailUrl: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

/** Mirrors the Kotlin `CoverType` enum in games/domain/CoverSource.kt. */
export type CoverType = "static" | "animated";

/**
 * Response of `GET /api/games/cover-options`; mirrors `CoverOptionsResponse`. `covers` holds one page of
 * candidates for `selectedMatchId` only; `selectedMatchId` is `null` (never absent) and `covers` empty when
 * nothing matched.
 */
export interface CoverOptionsResponse {
  query: string;
  matches: CoverMatchResponse[];
  selectedMatchId: number | null;
  type: CoverType;
  covers: PageResponse<CoverOptionResponse>;
}

/** Response of `GET /api/games/title-suggestions`; mirrors `TitleSuggestionsResponse`. */
export interface TitleSuggestionsResponse {
  suggestions: CoverMatchResponse[];
}

/** Mirrors the Kotlin `BookCoverSourceKind` wire values in books/domain/BookCoverSource.kt. */
export type BookCoverSource = "book" | "audiobook";

/** One Open Library work matching a search term; mirrors `BookCoverMatchResponse` in books/api/BookCoverOptionDtos.kt. */
export interface BookCoverMatchResponse {
  id: string;
  name: string;
  authors: string[];
  releaseYear: number | null;
}

/** Response of `GET /api/books/cover-options`; mirrors `BookCoverOptionsResponse`. `matches` is empty for audiobooks. */
export interface BookCoverOptionsResponse {
  query: string;
  source: BookCoverSource;
  matches: BookCoverMatchResponse[];
  selectedMatchId: string | null;
  covers: PageResponse<CoverOptionResponse>;
}

/** One title suggestion; mirrors `BookTitleSuggestionResponse`. `narrators` is empty for the `book` source. */
export interface BookTitleSuggestionResponse {
  name: string;
  authors: string[];
  narrators: string[];
  releaseYear: number | null;
  source: BookCoverSource;
}

/** Response of `GET /api/books/title-suggestions`; mirrors `BookTitleSuggestionsResponse`. */
export interface BookTitleSuggestionsResponse {
  suggestions: BookTitleSuggestionResponse[];
}

export interface ExpansionResponse {
  id: string;
  gameId: string;
  sequence: number;
  title: string;
  ownership: Ownership;
  progress: Progress;
}

export interface CreateExpansionRequest {
  title: string;
  /** Omit for the default (`"watchlist"`); can never be cleared. */
  ownership?: Ownership | null;
  /** Omit for the default (`"not_started"`); can never be cleared. */
  progress?: Progress | null;
}

/**
 * PATCH body: omit a key to leave the field unchanged; unlike a game, no expansion field can be cleared, so there
 * is no `null` variant for any of them. A present `sequence` is a move request: the new 0-based index among the
 * game's expansions.
 */
export interface UpdateExpansionRequest {
  title?: string;
  ownership?: Ownership;
  progress?: Progress;
  sequence?: number;
}

/** One table's row counts after `POST /api/backup/import`; mirrors `TableImportResultDto` in backup/api/BackupDtos.kt. */
export interface TableImportResult {
  inserted: number;
  skipped: number;
}

/** Response of `POST /api/backup/import`, one entry per table the payload named; mirrors `ImportResultResponse`. */
export interface ImportResultResponse {
  tables: Record<string, TableImportResult>;
}

/**
 * Response of `GET /api/dropbox`: whether the app key/secret are configured, whether a connection exists, and
 * since when (ISO-8601); mirrors `DropboxStatusResponse`.
 */
export interface DropboxStatusResponse {
  available: boolean;
  connected: boolean;
  connectedAt: string | null;
}

/** Response of `GET /api/dropbox/authorize-url`, opened in a new tab to start the in-app code flow. */
export interface AuthorizeUrlResponse {
  url: string;
}

/** Body of `POST /api/dropbox/connection`: the code the user pasted from Dropbox's authorization page. */
export interface ConnectDropboxRequest {
  code: string;
}

/** A single cloud-stored file's metadata; mirrors `StoredFileDto` (backup/api/BackupDtos.kt). */
export interface StoredFileDto {
  modifiedAt: string;
  sizeBytes: number;
}

/**
 * Response of `GET`/`POST /api/backup/dropbox`: the latest cloud backup, or `null` when none has been uploaded
 * yet; mirrors `CloudBackupResponse`.
 */
export interface CloudBackupResponse {
  lastBackup: StoredFileDto | null;
}

/** Mirrors the Kotlin `BookOwnership` enum in books/domain/BookStatus.kt. */
export type BookOwnership = "watchlist" | "owned";

/**
 * Ordering for `GET /api/books`; mirrors the Kotlin `BookSort` enum in books/domain/BookSort.kt. Absent/`"title"`
 * is the default and is never sent on the wire (see `listBooks` in books/api/booksApi.ts).
 */
export type BookSort = "title" | "release_asc" | "release_desc";

/** Mirrors the Kotlin `BookProgress` enum in books/domain/BookStatus.kt. */
export type BookProgress = "abandoned" | "not_started" | "paused" | "reading" | "finished";

/** A selectable book type (Hardcover, Kindle, ...); mirrors `BookTypeResponse` in books/api/BookDtos.kt. `associatedColor` is `"RRGGBB"`. */
export interface BookTypeResponse {
  id: string;
  label: string;
  associatedColor: string;
}

/** A book author; mirrors `BookAuthorResponse` in books/api/BookDtos.kt. */
export interface BookAuthorResponse {
  id: string;
  name: string;
}

/** Body of `POST /api/book-authors`; mirrors `CreateBookAuthorRequest` in books/api/BookDtos.kt. */
export interface CreateBookAuthorRequest {
  name: string;
}

/** Body of `PATCH /api/book-authors/{id}` and `/api/book-series/{id}`; mirrors `RenameVocabularyRequest` in common/api/Dtos.kt. */
export interface RenameVocabularyRequest {
  name: string;
}

/** Body of `POST /api/book-authors/{id}/merge` and `/api/book-series/{id}/merge`; mirrors `MergeVocabularyRequest` in common/api/Dtos.kt. */
export interface MergeVocabularyRequest {
  targetId: string;
}

/** A book narrator; mirrors `BookNarratorResponse` in books/api/BookDtos.kt. */
export interface BookNarratorResponse {
  id: string;
  name: string;
}

/** Body of `POST /api/book-narrators`; mirrors `CreateBookNarratorRequest` in books/api/BookDtos.kt. */
export interface CreateBookNarratorRequest {
  name: string;
}

/** A book series; mirrors `BookSeriesResponse` in books/api/BookDtos.kt. */
export interface BookSeriesResponse {
  id: string;
  name: string;
}

/** A series with its book count; mirrors `BookSeriesSummaryResponse` in books/api/BookDtos.kt. */
export interface BookSeriesSummaryResponse {
  id: string;
  name: string;
  bookCount: number;
}

/** An author with their book count; mirrors `BookAuthorSummaryResponse` in books/api/BookDtos.kt. */
export interface BookAuthorSummaryResponse {
  id: string;
  name: string;
  bookCount: number;
}

/** Body of `POST /api/book-series`; mirrors `CreateBookSeriesRequest` in books/api/BookDtos.kt. */
export interface CreateBookSeriesRequest {
  name: string;
}

/** One series a book belongs to; mirrors `BookSeriesEntryResponse` in books/api/BookDtos.kt. */
export interface BookSeriesEntryResponse {
  id: string;
  name: string;
  /** Number within the series (0 to 9999.99, at most 2 decimals); `null` when the book has no number there. */
  position: number | null;
}

/** One series link of a book in a request; mirrors `BookSeriesLinkRequest` in books/api/BookDtos.kt. */
export interface BookSeriesLinkRequest {
  seriesId: string;
  position?: number | null;
}

/** The filter values that actually occur in the stored books; mirrors `BookMetaResponse` in books/api/BookDtos.kt. */
export interface BookMetaResponse {
  /** Only types in use, alphabetically by label. */
  types: BookTypeResponse[];
  /** Number of books per type id; only types in use are keys. */
  typeCounts: Record<string, number>;
  /** Only values in use, in enum declaration order. */
  ownership: BookOwnership[];
  /** Only values in use, in enum declaration order. */
  progress: BookProgress[];
  /** Only years in use, newest first. */
  releaseYears: number[];
}

/** Mirrors `BookResponse` in books/api/BookDtos.kt. */
export interface BookResponse {
  id: string;
  title: string;
  releaseYear: number;
  /** ISO-8601 `YYYY-MM-DD`; `null` when only the release year is known. */
  releaseDate: string | null;
  /** Free text, at most 10000 characters; `null` when not set. */
  description: string | null;
  coverImageUrl: string | null;
  ownership: BookOwnership;
  progress: BookProgress;
  /** Zero or more, sorted by label. */
  types: BookTypeResponse[];
  /** Sorted by name. */
  authors: BookAuthorResponse[];
  /** Sorted by name. */
  narrators: BookNarratorResponse[];
  /** Sorted by series name. */
  series: BookSeriesEntryResponse[];
}

export interface CreateBookRequest {
  title: string;
  /** Required unless `releaseDate` is given, in which case the date's year is used instead. */
  releaseYear?: number | null;
  /** ISO-8601 `YYYY-MM-DD`; omit when only the release year is known. */
  releaseDate?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  /** Omit for the default (`"watchlist"`); can never be cleared. */
  ownership?: BookOwnership | null;
  /** Omit for the default (`"not_started"`); can never be cleared. */
  progress?: BookProgress | null;
  /** Omit for the default (no types). */
  typeIds?: string[];
  /** Omit for the default (no authors). */
  authorIds?: string[];
  /** Omit for the default (no narrators). */
  narratorIds?: string[];
  /** Omit for the default (no series). */
  series?: BookSeriesLinkRequest[];
}

/** PATCH body: omit a key to leave the field unchanged; `null` clears `description`/`coverImageUrl`/`releaseDate`. */
export interface UpdateBookRequest {
  title?: string;
  releaseYear?: number;
  /** Omit to leave unchanged; `null` clears it back to "only the release year is known". */
  releaseDate?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  ownership?: BookOwnership;
  /** Omit to leave unchanged; can never be cleared, so there is no `null` variant. */
  progress?: BookProgress;
  /** Omit to leave unchanged; replaces the full set (may be empty). */
  typeIds?: string[];
  /** Omit to leave unchanged; replaces the full set (may be empty). */
  authorIds?: string[];
  /** Omit to leave unchanged; replaces the full set (may be empty). */
  narratorIds?: string[];
  /** Omit to leave unchanged; replaces all links (empty clears). */
  series?: BookSeriesLinkRequest[];
}
