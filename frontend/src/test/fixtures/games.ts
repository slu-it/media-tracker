import type { ExpansionResponse, GameMetaResponse, GamePlatformResponse, GameResponse } from "../../types/api";

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

export const meta: GameMetaResponse = {
  platforms: [nintendo, pc],
  ownership: ["watchlist", "owned"],
  progress: ["playing", "completed"],
  releaseYears: [2018, 2020],
};
