import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, mockApi, noContent } from "../../../test/mockFetch";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BooksConfigurationTab } from "./BooksConfigurationTab";

const SUMMARIES = [
  { id: "b1", label: "Audiobook", associatedColor: "0070D1", bookCount: 0 },
  { id: "b2", label: "Kindle", associatedColor: "107C10", bookCount: 1 },
  { id: "b3", label: "Paperback", associatedColor: "E60012", bookCount: 5 },
];

describe("BooksConfigurationTab", () => {
  it("lists the book types with pluralised counts", async () => {
    mockApi({ "GET /api/book-types.summaries": () => jsonResponse(SUMMARIES) });
    renderWithProviders(<BooksConfigurationTab />);
    expect(await screen.findByRole("heading", { name: "Book types" })).toBeInTheDocument();
    expect(await screen.findByText("0 books")).toBeInTheDocument();
    expect(screen.getByText("1 book")).toBeInTheDocument();
    expect(screen.getByText("5 books")).toBeInTheDocument();
  });

  it("uses the book type endpoints for rename, add and delete and reports changes", async () => {
    const calls = mockApi({
      "GET /api/book-types.summaries": () => jsonResponse(SUMMARIES),
      "PATCH /api/book-types/:id": () => jsonResponse({}),
      "POST /api/book-types": () => jsonResponse({}, 201),
      "DELETE /api/book-types/:id": () => noContent(),
    });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<BooksConfigurationTab onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Rename Kindle" }));
    await user.clear(screen.getByRole("textbox", { name: "Rename Kindle" }));
    await user.paste("Kobo");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("textbox", { name: "New book type" }));
    await user.paste("Vinyl");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Delete Audiobook" }));
    expect(screen.getByText('Delete the book type "Audiobook"?')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(3));

    expect(calls.filter((call) => call.method !== "GET")).toEqual([
      { method: "PATCH", url: "/api/book-types/b2", body: { label: "Kobo" } },
      { method: "POST", url: "/api/book-types", body: { label: "Vinyl", associatedColor: "757575" } },
      { method: "DELETE", url: "/api/book-types/b1", body: undefined },
    ]);
  });
});
