import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchDebounceContext } from "../../../hooks/useSearchDebounceMs";
import { flushAsync } from "../../../test/flushAsync";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SuggestingTitleField } from "./SuggestingTitleField";

interface Suggestion {
  id: string;
  title: string;
  author: string;
}

const suggestions: Suggestion[] = [
  { id: "1", title: "Der Hobbit", author: "Tolkien" },
  { id: "2", title: "Der Hobbit", author: "Someone Else" },
];

function Harness({
  fetchSuggestions,
  requestKey = "book",
  onSuggestionPick,
  hideExactMatch,
}: {
  fetchSuggestions: (query: string) => Promise<Suggestion[]>;
  requestKey?: string;
  onSuggestionPick?: (suggestion: Suggestion) => void;
  hideExactMatch?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <SearchDebounceContext value={10}>
      <SuggestingTitleField<Suggestion>
        value={value}
        onChange={setValue}
        onSuggestionPick={(suggestion) => {
          setValue(suggestion.title);
          onSuggestionPick?.(suggestion);
        }}
        fetchSuggestions={fetchSuggestions}
        requestKey={requestKey}
        minLength={3}
        hideExactMatch={hideExactMatch}
        getOptionName={(suggestion) => suggestion.title}
        getOptionKey={(suggestion) => suggestion.id}
        renderOptionLabel={(suggestion) => `${suggestion.title} · ${suggestion.author}`}
        renderOptionEnd={(suggestion) => <span data-testid="end">{suggestion.id}</span>}
      />
    </SearchDebounceContext>
  );
}

describe("SuggestingTitleField", () => {
  it("requests nothing until the user edits, then once the minimum length is reached", async () => {
    const user = userEvent.setup();
    const fetchSuggestions = vi.fn().mockResolvedValue(suggestions);
    renderWithProviders(<Harness fetchSuggestions={fetchSuggestions} />);
    expect(fetchSuggestions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hobbit");

    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledExactlyOnceWith("Der Hobbit"));
  });

  it("renders the option label and end content, keeping rows that share a title apart", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness fetchSuggestions={() => Promise.resolve(suggestions.map((s) => ({ ...s })))} />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hob");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Der Hobbit · Tolkien1");
    expect(options[1]).toHaveTextContent("Der Hobbit · Someone Else2");
  });

  it("reports the picked suggestion", async () => {
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    renderWithProviders(
      <Harness fetchSuggestions={() => Promise.resolve(suggestions)} onSuggestionPick={onSuggestionPick} />,
    );

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hob");
    await user.click(await screen.findByRole("option", { name: /Someone Else/ }));

    expect(onSuggestionPick).toHaveBeenCalledExactlyOnceWith(suggestions[1]);
  });

  it("refetches for the same title when the request key changes", async () => {
    const user = userEvent.setup();
    const fetchSuggestions = vi.fn().mockResolvedValue(suggestions);
    const { rerender } = renderWithProviders(<Harness fetchSuggestions={fetchSuggestions} requestKey="book" />);
    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hobbit");
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));

    rerender(<Harness fetchSuggestions={fetchSuggestions} requestKey="audiobook" />);

    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(2));
  });

  it("hides a suggestion equal to the title by default", async () => {
    const user = userEvent.setup();
    const fetchSuggestions = vi.fn().mockResolvedValue(suggestions);
    renderWithProviders(<Harness fetchSuggestions={fetchSuggestions} />);

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hobbit");
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));
    await flushAsync();

    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows and lets pick an exact match when hideExactMatch is off, without searching again", async () => {
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    const fetchSuggestions = vi.fn().mockResolvedValue(suggestions);
    renderWithProviders(
      <Harness fetchSuggestions={fetchSuggestions} onSuggestionPick={onSuggestionPick} hideExactMatch={false} />,
    );

    await user.click(screen.getByRole("combobox", { name: /title/i }));
    await user.paste("Der Hobbit");
    await user.click(await screen.findByRole("option", { name: /Someone Else/ }));

    expect(onSuggestionPick).toHaveBeenCalledExactlyOnceWith(suggestions[1]);
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    await flushAsync();
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
