import { useState } from "react";
import { Box } from "@mui/material";
import { CoverImage } from "../../../components/CoverImage";
import { coverHeight } from "../../../components/coverFrame";
import { isVideoThumbnail } from "../domain/coverThumbnail";

interface CoverThumbnailProps {
  thumbnailUrl: string;
  imageUrl: string;
  width: number;
  /** Omit to use the collection's standard 22:31 cover ratio, derived from `width`. */
  height?: number;
}

/**
 * SteamGridDB serves WebM clips as the thumbnails of animated grids, while `imageUrl` is the full APNG/animated
 * WebP. An `<img>` cannot decode WebM (it fires `onerror` and `CoverImage` would show its placeholder), so a WebM
 * thumbnail is rendered with a `<video>` instead; anything else - and a WebM that itself fails to load - falls
 * back to `CoverImage`.
 */
export function CoverThumbnail({ thumbnailUrl, imageUrl, width, height }: CoverThumbnailProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const resolvedHeight = height ?? coverHeight(width);

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
