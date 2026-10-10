import { useState } from "react";
import { Box } from "@mui/material";
import { CoverImage } from "../../CoverImage";
import { COVER_ASPECT_RATIO, coverHeight } from "../../coverFrame";
import { isVideoThumbnail } from "../../../domain/media/coverThumbnail";

interface CoverThumbnailProps {
  thumbnailUrl: string;
  imageUrl: string;
  width: number;
  /** Omit to use the collection's standard cover ratio, derived from `width`. */
  height?: number;
  /** Used to derive the height from `width` when `height` is omitted; defaults to the standard cover ratio. */
  aspectRatio?: number;
}

/**
 * SteamGridDB serves WebM clips as the thumbnails of animated grids, while `imageUrl` is the full APNG/animated
 * WebP. An `<img>` cannot decode WebM (it fires `onerror` and `CoverImage` would show its placeholder), so a WebM
 * thumbnail is rendered with a `<video>` instead; anything else - and a WebM that itself fails to load - falls
 * back to `CoverImage`.
 */
export function CoverThumbnail({
  thumbnailUrl,
  imageUrl,
  width,
  height,
  aspectRatio = COVER_ASPECT_RATIO,
}: CoverThumbnailProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const resolvedHeight = height ?? coverHeight(width, aspectRatio);

  if (!isVideoThumbnail(thumbnailUrl) || videoFailed) {
    return <CoverImage src={videoFailed ? imageUrl : thumbnailUrl} alt="" width={width} height={resolvedHeight} />;
  }

  return (
    <Box
      sx={{
        width,
        height: resolvedHeight,
        borderRadius: 1,
        bgcolor: "action.hover",
        overflow: "hidden",
      }}
    >
      <video
        src={thumbnailUrl}
        role="presentation"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-hidden
        disablePictureInPicture
        onError={() => setVideoFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </Box>
  );
}
