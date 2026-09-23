import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { isVideoThumbnail } from "../domain/coverThumbnail";
import { CoverThumbnail } from "./CoverThumbnail";

describe("isVideoThumbnail", () => {
  it("recognises a lower case .webm URL", () => {
    expect(isVideoThumbnail("https://cdn2.steamgriddb.com/thumb/a.webm")).toBe(true);
  });

  it("recognises an upper case .WEBM extension", () => {
    expect(isVideoThumbnail("https://cdn2.steamgriddb.com/thumb/a.WEBM")).toBe(true);
  });

  it("recognises a .webm URL with a query string", () => {
    expect(isVideoThumbnail("https://cdn2.steamgriddb.com/thumb/a.webm?v=2")).toBe(true);
  });

  it("does not recognise a .jpg URL as a video", () => {
    expect(isVideoThumbnail("https://cdn2.steamgriddb.com/thumb/a.jpg")).toBe(false);
  });
});

describe("CoverThumbnail", () => {
  it("renders an image for a static thumbnail", () => {
    renderWithProviders(
      <CoverThumbnail
        thumbnailUrl="https://cdn2.steamgriddb.com/thumb/a.jpg"
        imageUrl="https://cdn2.steamgriddb.com/grid/a.png"
        width={120}
        height={160}
      />,
    );

    const img = screen.getByRole("presentation");
    expect(img).toHaveAttribute("src", "https://cdn2.steamgriddb.com/thumb/a.jpg");
  });

  it("renders a muted, looping, autoplaying video for a WebM thumbnail", () => {
    renderWithProviders(
      <CoverThumbnail
        thumbnailUrl="https://cdn2.steamgriddb.com/thumb/anim-a.webm"
        imageUrl="https://cdn2.steamgriddb.com/grid/anim-a.png"
        width={120}
        height={160}
      />,
    );

    // The video is `aria-hidden` (the surrounding button carries the label), so it needs `hidden: true` to be found.
    const video = screen.getByRole("presentation", { hidden: true });
    expect(video).toHaveAttribute("src", "https://cdn2.steamgriddb.com/thumb/anim-a.webm");
    // React sets `muted` as a DOM property rather than an attribute, so check the property, not the attribute.
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("autoplay");
  });

  it("falls back to the full image when the video fails to load", () => {
    renderWithProviders(
      <CoverThumbnail
        thumbnailUrl="https://cdn2.steamgriddb.com/thumb/anim-a.webm"
        imageUrl="https://cdn2.steamgriddb.com/grid/anim-a.png"
        width={120}
        height={160}
      />,
    );
    const video = screen.getByRole("presentation", { hidden: true });

    fireEvent.error(video);

    const fallback = screen.getByRole("presentation");
    expect(fallback.tagName).toBe("IMG");
    expect(fallback).toHaveAttribute("src", "https://cdn2.steamgriddb.com/grid/anim-a.png");
  });
});
