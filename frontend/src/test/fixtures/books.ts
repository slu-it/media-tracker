import type { BookAuthorResponse, BookMetaResponse, BookResponse, BookTypeResponse } from "../../types/api";

export const hardcover: BookTypeResponse = {
  id: "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0001",
  label: "Hardcover",
  associatedColor: "5D4037",
};
export const paperback: BookTypeResponse = {
  id: "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0002",
  label: "Paperback",
  associatedColor: "00796B",
};
export const kindle: BookTypeResponse = {
  id: "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0003",
  label: "Kindle",
  associatedColor: "1A73B5",
};
export const audible: BookTypeResponse = {
  id: "6b00c5e1-7d2a-4f3b-9c4e-1a2b3c4d0004",
  label: "Audible",
  associatedColor: "F7991C",
};
export const bookTypes: BookTypeResponse[] = [hardcover, paperback, kindle, audible];

export const herbert: BookAuthorResponse = { id: "author-1", name: "Frank Herbert" };
export const leGuin: BookAuthorResponse = { id: "author-2", name: "Ursula K. Le Guin" };
export const authors: BookAuthorResponse[] = [herbert, leGuin];

export const dune: BookResponse = {
  id: "book-1",
  title: "Dune",
  releaseYear: 1965,
  releaseDate: null,
  description: null,
  coverImageUrl: "https://img.example/dune.png",
  ownership: "owned",
  progress: "reading",
  types: [hardcover, kindle],
  authors: [herbert],
};

export const earthsea: BookResponse = {
  id: "book-2",
  title: "A Wizard of Earthsea",
  releaseYear: 1968,
  releaseDate: null,
  description: null,
  coverImageUrl: null,
  ownership: "watchlist",
  progress: "not_started",
  types: [],
  authors: [leGuin],
};

export const meta: BookMetaResponse = {
  types: [hardcover, kindle],
  ownership: ["watchlist", "owned"],
  progress: ["not_started", "reading"],
  releaseYears: [1968, 1965],
};
