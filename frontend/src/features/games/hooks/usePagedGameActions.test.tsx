import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import type { PageResponse } from "../../../types/api";
import { GAMES_PAGE_SIZE } from "../domain/gameValues";
import { usePagedGameActions } from "./usePagedGameActions";

function pageOf(items: (typeof celeste)[], page: number, totalPages: number): PageResponse<typeof celeste> {
  return { items, page, pageSize: GAMES_PAGE_SIZE, totalItems: items.length, totalPages };
}

describe("usePagedGameActions", () => {
  it("steps back immediately when deleting the last item of a later page, without reloading", () => {
    const reload = vi.fn();
    const reloadMeta = vi.fn();
    const setPage = vi.fn();
    const setSelected = vi.fn();
    const { result } = renderHook(() =>
      usePagedGameActions({
        data: pageOf([hades], 2, 2),
        loading: false,
        page: 2,
        setPage,
        reload,
        reloadMeta,
        setSelected,
      }),
    );

    result.current.onDeleted();

    expect(setSelected).toHaveBeenCalledWith(null);
    expect(reloadMeta).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(1, { replace: true });
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads the current page when more than one item remains after a delete", () => {
    const reload = vi.fn();
    const setPage = vi.fn();
    const { result } = renderHook(() =>
      usePagedGameActions({
        data: pageOf([celeste, hades], 2, 2),
        loading: false,
        page: 2,
        setPage,
        reload,
        reloadMeta: vi.fn(),
        setSelected: vi.fn(),
      }),
    );

    result.current.onDeleted();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(setPage).not.toHaveBeenCalled();
  });

  it("reloads the list and meta on update", () => {
    const reload = vi.fn();
    const reloadMeta = vi.fn();
    const { result } = renderHook(() =>
      usePagedGameActions({
        data: pageOf([hades], 1, 1),
        loading: false,
        page: 1,
        setPage: vi.fn(),
        reload,
        reloadMeta,
        setSelected: vi.fn(),
      }),
    );

    result.current.onUpdated();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadMeta).toHaveBeenCalledTimes(1);
  });

  it("steps back to the last existing page once a reload leaves a later page empty", () => {
    const setPage = vi.fn();
    const { rerender } = renderHook(
      (props: { data: PageResponse<typeof celeste> }) =>
        usePagedGameActions({
          data: props.data,
          loading: false,
          page: 2,
          setPage,
          reload: vi.fn(),
          reloadMeta: vi.fn(),
          setSelected: vi.fn(),
        }),
      { initialProps: { data: pageOf([hades], 2, 2) } },
    );
    expect(setPage).not.toHaveBeenCalled();

    // Some reload unrelated to a direct delete (e.g. an edit that moves the item off this view's filter) comes
    // back empty for the still-current page 2.
    rerender({ data: pageOf([], 2, 1) });

    expect(setPage).toHaveBeenCalledWith(1, { replace: true });
  });

  it("does not step back when already on page 1", () => {
    const setPage = vi.fn();
    renderHook(() =>
      usePagedGameActions({
        data: pageOf([], 1, 0),
        loading: false,
        page: 1,
        setPage,
        reload: vi.fn(),
        reloadMeta: vi.fn(),
        setSelected: vi.fn(),
      }),
    );

    expect(setPage).not.toHaveBeenCalled();
  });

  it("does not step back when loading is false but the data belongs to another page (failed request)", () => {
    const setPage = vi.fn();
    renderHook(() =>
      usePagedGameActions({
        data: pageOf([], 1, 1),
        loading: false,
        page: 3,
        setPage,
        reload: vi.fn(),
        reloadMeta: vi.fn(),
        setSelected: vi.fn(),
      }),
    );

    expect(setPage).not.toHaveBeenCalled();
  });

  it("does not step back while data is still null (nothing loaded yet)", () => {
    const setPage = vi.fn();
    renderHook(() =>
      usePagedGameActions({
        data: null,
        loading: true,
        page: 2,
        setPage,
        reload: vi.fn(),
        reloadMeta: vi.fn(),
        setSelected: vi.fn(),
      }),
    );

    expect(setPage).not.toHaveBeenCalled();
  });
});
