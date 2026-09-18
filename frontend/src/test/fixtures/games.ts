import type { GamePlatformResponse, GameResponse } from "../../types/api";

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
};

export const hades: GameResponse = {
  id: "id-2",
  title: "Hades",
  releaseYear: 2020,
  description: null,
  rating: null,
  platforms: [pc],
  coverImageUrl: null,
};
