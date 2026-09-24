import { act, useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { flushAsync } from "../../../../test/flushAsync";
import { jsonResponse, mockApi } from "../../../../test/mockFetch";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import type { CoverMatchResponse, TitleSuggestionsResponse } from "../../../../types/api";
import { GameTitleField } from "./GameTitleField";

const suggestions: CoverMatchResponse[] = [
  { id: 5245, name: "Hollow Knight", releaseYear: 2017, verified: true },
  { id: 9999, name: "Hollow Knight: Silksong", releaseYear: null, verified: false },
];
const response: TitleSuggestionsResponse = { suggestions };

/** A controlled wrapper: the real field never holds its own text, so typing/picking needs somewhere to land. */
function Harness({
  initialValue = "",
  onSuggestionPick,
  suggestionDebounceMs = 10,
}: {
  initialValue?: string;
  onSuggestionPick?: (suggestion: CoverMatchResponse) => void;
  suggestionDebounceMs?: number;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <GameTitleField
      value={value}
      onChange={setValue}
      onSuggestionPick={(suggestion) => {
        setValue(suggestion.name);
        onSuggestionPick?.(suggestion);
      }}
      suggestionDebounceMs={suggestionDebounceMs}
    />
  );
}

/** Same as `Harness`, but without `onSuggestionPick`: the feature-gating case (e.g. `ExpansionDialog`'s title). */
function NoPickHarness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <GameTitleField value={value} onChange={setValue} suggestionDebounceMs={10} />;
}

describe("GameTitleField", () => {
  // Without `onSuggestionPick` the field renders a plain `TextField` (textbox semantics, see `NoPickHarness`
  // below); these three cover the validation/counter behaviour that is shared with the suggestion-aware variant.
  it("shows the error only after the field was touched", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<GameTitleField value="" onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: /title/i });
    expect(screen.queryByText("Required")).not.toBeInTheDocument();

    await user.click(input);
    await user.tab();
    expect(screen.getByText("Required")).toBeInTheDocument();

    await user.type(input, "C");
    expect(onChange).toHaveBeenCalledWith("C");
  });

  it("shows errors immediately with showErrors and reports too-long titles", () => {
    renderWithProviders(<GameTitleField value={"x".repeat(257)} onChange={() => {}} showErrors />);
    expect(screen.getByText("At most 256 characters")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a character counter for valid input", () => {
    renderWithProviders(<GameTitleField value="Celeste" onChange={() => {}} />);
    expect(screen.getByText("7/256")).toBeInTheDocument();
  });

  it("sends no request while the typed title is under the minimum length", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Holl");

    // Wait past the 10ms debounce (not just one `flushAsync` macrotask) so this negative genuinely covers the
    // whole window a request could have fired in, not just the instant right after typing.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(calls).toHaveLength(0);

    // Positive control: typing past the minimum length from here, and getting a request for it, proves the
    // absence of a call above is the length gate at work, not the field failing to ever request anything.
    await user.paste("ow Knight");
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/games/title-suggestions?query=Hollow+Knight");
  });

  it("sends no request for an existing title that was never edited (e.g. opening edit mode)", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<Harness initialValue="An already long, existing title" />);

    await flushAsync();
    expect(calls).toHaveLength(0);

    // Positive control: editing the title from here, and getting a request for it, proves the un-edited value
    // above is gated on `enabled` (not just that the 10ms debounce never had a chance to fire).
    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.type(screen.getByRole("combobox", { name: /title/i }), "!");
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it("shows suggestions once typing settles and hides the entry matching the current title", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Knight");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/games/title-suggestions?query=Hollow+Knight");
    // "Hollow Knight" itself matches the current title exactly and is filtered out; only the other one shows.
    expect(await screen.findByRole("option", { name: /Silksong/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Hollow Knight" })).not.toBeInTheDocument();
  });

  it("marks a verified suggestion with an accessible 'Verified' icon", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Kn");

    // `suggestions[0]` ("Hollow Knight") is `verified: true`, `suggestions[1]` ("Silksong") is not; order is
    // preserved by the field (only an exact match to the current title is filtered out). MUI's `SvgIcon` only
    // exposes an accessible name (rather than being `aria-hidden`) when given `titleAccess`, so this also pins
    // that prop is actually set, not just present on the DOM element.
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(within(options[0]).getByRole("img", { name: /Verified/i })).toBeInTheDocument();
    expect(within(options[1]).queryByRole("img")).not.toBeInTheDocument();
  });

  it("picking a suggestion reports it and fills the title", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    renderWithProviders(<Harness onSuggestionPick={onSuggestionPick} />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Kn");
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.click(await screen.findByRole("option", { name: /Silksong/ }));

    expect(onSuggestionPick).toHaveBeenCalledExactlyOnceWith(suggestions[1]);
    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Hollow Knight: Silksong");
  });

  it("picks a suggestion via keyboard (ArrowDown + Enter)", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    renderWithProviders(<Harness onSuggestionPick={onSuggestionPick} />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Kn");
    await screen.findByRole("option", { name: /Silksong/ });

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSuggestionPick).toHaveBeenCalledExactlyOnceWith(suggestions[0]);
  });

  it("does not report a pick when Enter is pressed on unmatched free text", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    renderWithProviders(<Harness onSuggestionPick={onSuggestionPick} />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Some unmatched title");
    // Waiting for the (empty) response confirms the debounce has actually settled before Enter is pressed,
    // rather than the assertion below passing merely because the request had not fired yet.
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.keyboard("{Enter}");

    expect(onSuggestionPick).not.toHaveBeenCalled();
  });

  it("picking twice both report, even across separate suggestion requests", async () => {
    const calls = mockApi({
      "GET /api/games/title-suggestions": (_call, url) =>
        url.searchParams.get("query") === "Celeste"
          ? jsonResponse({ suggestions: [{ id: 2, name: "Celeste II", releaseYear: 2025, verified: false }] })
          : jsonResponse(response),
    });
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    renderWithProviders(<Harness onSuggestionPick={onSuggestionPick} />);
    const input = screen.getByRole("combobox", { name: /title/i });

    await user.click(input);
    await user.paste("Hollow Kn");
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(await screen.findByRole("option", { name: /Silksong/ }));
    expect(onSuggestionPick).toHaveBeenCalledTimes(1);

    await user.clear(input);
    await user.paste("Celeste");
    await waitFor(() => expect(calls).toHaveLength(2));
    await user.click(await screen.findByRole("option", { name: "Celeste II · 2025" }));

    expect(onSuggestionPick).toHaveBeenCalledTimes(2);
    expect(onSuggestionPick).toHaveBeenLastCalledWith({
      id: 2,
      name: "Celeste II",
      releaseYear: 2025,
      verified: false,
    });
  });

  it("does not start a new search for the name a suggestion was just picked with", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Kn");
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(await screen.findByRole("option", { name: /Silksong/ }));

    // The gate that suppresses the request is structural (the picked name stays disabled regardless of how much
    // time passes), so waiting past the 10ms debounce window here, not just one flush, is what makes this
    // conclusive: a broken gate would still fire once its timer elapses, just a little later.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(calls).toHaveLength(1);

    // Positive control: typing further from the picked name proves the debounce itself is still alive and would
    // have produced a second call above already if the gate were the thing actually broken.
    await user.type(screen.getByRole("combobox", { name: /title/i }), "!");
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toBe("/api/games/title-suggestions?query=Hollow+Knight%3A+Silksong%21");
  });

  it("keeps free text typing working when there are no suggestions", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Some unmatched title");

    expect(screen.getByRole("combobox", { name: /title/i })).toHaveValue("Some unmatched title");
  });

  it("renders no clear button (disableClearable), matching the plain-TextField branch", async () => {
    mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    const user = userEvent.setup();
    renderWithProviders(<Harness initialValue="Celeste" />);

    // MUI's Autocomplete clear ("X") button is an accessible button labelled "Clear" by default; without
    // `disableClearable` it would render once the field has a value, and clicking it would call `onInputChange`
    // with `reason: "clear"`, which snaps the controlled input back to the old title instead of clearing it.
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("sends no request when the host has not opted in via onSuggestionPick, rendering a plain textbox", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse(response) });
    const user = userEvent.setup();
    renderWithProviders(<NoPickHarness />);

    const input = screen.getByRole("textbox", { name: /title/i });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(input);
    await user.paste("Hollow Knight");

    await flushAsync();
    expect(calls).toHaveLength(0);

    // Positive control: mounting a suggestion-aware field alongside, in the same environment and debounce, and
    // getting a request from it, proves the absence of a call above is the missing `onSuggestionPick` gate, not
    // a race that never let the debounce fire. Using a different query ("Celeste") than the gated field's
    // ("Hollow Knight") makes the resulting call unambiguously this field's, not a late one the gate above
    // should have suppressed.
    renderWithProviders(<Harness />);
    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Celeste");
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls.map((call) => call.url)).toEqual(["/api/games/title-suggestions?query=Celeste"]);
  });

  it("renders no listbox for an empty suggestions response", async () => {
    const calls = mockApi({ "GET /api/games/title-suggestions": () => jsonResponse({ suggestions: [] }) });
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Hollow Kn");

    await waitFor(() => expect(calls).toHaveLength(1));
    await flushAsync();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
