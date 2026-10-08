import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { currentLocation } from "../test/currentLocation";
import { renderWithProviders } from "../test/renderWithProviders";
import { useViewParams } from "./useViewParams";

function TwoWrites() {
  const [, write] = useViewParams();
  return (
    <button
      onClick={() => {
        write((prev) => new URLSearchParams([...prev, ["a", "1"]]));
        write((prev) => new URLSearchParams([...prev, ["b", "2"]]));
      }}
    >
      write
    </button>
  );
}

function WriteOne({ name, value }: { name: string; value: string }) {
  const [, write] = useViewParams();
  return <button onClick={() => write((prev) => new URLSearchParams([...prev, [name, value]]))}>write {name}</button>;
}

function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => void navigate(to)}>go {to}</button>;
}

describe("useViewParams", () => {
  it("merges two writes of the same commit instead of letting the last one win", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TwoWrites />, { route: "/x" });
    await user.click(screen.getByRole("button", { name: "write" }));
    expect(currentLocation()).toBe("/x?a=1&b=2");
  });

  it("starts the next write from the current URL after the router moved on", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TwoWrites />, { route: "/x?c=3" });
    await user.click(screen.getByRole("button", { name: "write" }));
    expect(currentLocation()).toBe("/x?c=3&a=1&b=2");
  });

  it("does not carry an earlier write into a location navigated to afterwards", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <WriteOne name="a" value="1" />
        <WriteOne name="b" value="2" />
        <GoTo to="/x?c=3" />
      </>,
      { route: "/x" },
    );
    await user.click(screen.getByRole("button", { name: "write a" }));
    expect(currentLocation()).toBe("/x?a=1");
    await user.click(screen.getByRole("button", { name: "go /x?c=3" }));
    await user.click(screen.getByRole("button", { name: "write b" }));
    expect(currentLocation()).toBe("/x?c=3&b=2");
  });
});
