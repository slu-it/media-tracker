import type {
  CoverOptionsResponse,
  ExpansionResponse,
  GameMetaResponse,
  GamePlatformResponse,
  GameResponse,
} from "../../types/api";

export const pc: GamePlatformResponse = { id: "platform-pc", label: "PC", associatedColor: "757575" };
export const playstation: GamePlatformResponse = {
  id: "platform-playstation",
  label: "PlayStation",
  associatedColor: "0070D1",
};
export const xbox: GamePlatformResponse = { id: "platform-xbox", label: "Xbox", associatedColor: "107C10" };
export const nintendo: GamePlatformResponse = {
  id: "platform-nintendo",
  label: "Nintendo",
  associatedColor: "E60012",
};
export const platforms: GamePlatformResponse[] = [pc, playstation, xbox, nintendo];

export const celeste: GameResponse = {
  id: "id-1",
  title: "Celeste",
  releaseYear: 2018,
  description: null,
  rating: null,
  platforms: [nintendo],
  coverImageUrl: "https://img.example/c.png",
  ownership: "owned",
  progress: "playing",
  hidden: false,
};

export const hades: GameResponse = {
  id: "id-2",
  title: "Hades",
  releaseYear: 2020,
  description: null,
  rating: null,
  platforms: [pc],
  coverImageUrl: null,
  ownership: "watchlist",
  progress: "completed",
  hidden: true,
};

export const hadesExpansion1: ExpansionResponse = {
  id: "expansion-1",
  gameId: hades.id,
  sequence: 0,
  title: "Boon Pack",
  ownership: "owned",
  progress: "not_started",
};

export const hadesExpansion2: ExpansionResponse = {
  id: "expansion-2",
  gameId: hades.id,
  sequence: 1,
  title: "Soundtrack Edition",
  ownership: "watchlist",
  progress: "not_started",
};

export const hadesExpansions: ExpansionResponse[] = [hadesExpansion1, hadesExpansion2];

export const hadesCoverOptions: CoverOptionsResponse = {
  query: "Hades",
  matches: [
    { id: 5245, name: "Hades", releaseYear: 2020, verified: true },
    { id: 9999, name: "Hades II", releaseYear: 2024, verified: false },
  ],
  selectedMatchId: 5245,
  type: "static",
  covers: {
    items: [
      {
        thumbnailUrl: "https://cdn2.steamgriddb.com/thumb/a.jpg",
        imageUrl: "https://cdn2.steamgriddb.com/grid/a.png",
        width: 600,
        height: 900,
      },
      {
        thumbnailUrl: "https://cdn2.steamgriddb.com/thumb/b.jpg",
        imageUrl: "https://cdn2.steamgriddb.com/grid/b.png",
        width: 600,
        height: 900,
      },
    ],
    page: 1,
    pageSize: 50,
    totalItems: 120,
    totalPages: 3,
  },
};

export const hadesCoverOptionsPage2: CoverOptionsResponse = {
  ...hadesCoverOptions,
  covers: {
    items: [
      {
        thumbnailUrl: "https://cdn2.steamgriddb.com/thumb/c.jpg",
        imageUrl: "https://cdn2.steamgriddb.com/grid/c.png",
        width: 600,
        height: 900,
      },
      {
        thumbnailUrl: "https://cdn2.steamgriddb.com/thumb/d.jpg",
        imageUrl: "https://cdn2.steamgriddb.com/grid/d.png",
        width: 600,
        height: 900,
      },
    ],
    page: 2,
    pageSize: 50,
    totalItems: 120,
    totalPages: 3,
  },
};

export const hadesAnimatedCoverOptions: CoverOptionsResponse = {
  query: "Hades",
  matches: hadesCoverOptions.matches,
  selectedMatchId: 5245,
  type: "animated",
  covers: {
    items: [
      {
        thumbnailUrl: "https://cdn2.steamgriddb.com/thumb/anim-a.webm",
        imageUrl: "https://cdn2.steamgriddb.com/grid/anim-a.png",
        width: 600,
        height: 900,
      },
    ],
    page: 1,
    pageSize: 50,
    totalItems: 1,
    totalPages: 1,
  },
};

export const emptyCoverOptions: CoverOptionsResponse = {
  query: "Nonexistent Game",
  matches: [],
  selectedMatchId: null,
  type: "static",
  covers: { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
};

export const meta: GameMetaResponse = {
  platforms: [nintendo, pc],
  ownership: ["watchlist", "owned"],
  progress: ["playing", "completed"],
  releaseYears: [2018, 2020],
};
