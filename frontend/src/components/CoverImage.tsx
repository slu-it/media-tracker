import { useState } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import { useTranslation } from "react-i18next";

interface CoverImageProps {
  /** Image URL; `null`/empty shows the placeholder. */
  src: string | null;
  alt: string;
  width: number | string;
  height: number | string;
  sx?: SxProps<Theme>;
}

/**
 * Fixed-size frame for cover art. The image keeps its own aspect ratio and fills whichever dimension it hits
 * first (`object-fit: contain`), so covers of different shapes still line up in a grid.
 */
export function CoverImage({ src, alt, width, height, sx }: CoverImageProps) {
  const { t } = useTranslation();
  const url = src?.trim() ?? "";
  return (
    <Box
      sx={{
        width,
        height,
        maxWidth: "100%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: 1,
        bgcolor: "action.hover",
        ...sx,
      }}
    >
      {url ? (
        // Keyed by URL so a failed load is forgotten when the URL changes.
        <Img key={url} src={url} alt={alt} placeholderLabel={t("games.noCover")} />
      ) : (
        <Placeholder label={t("games.noCover")} />
      )}
    </Box>
  );
}

function Img({ src, alt, placeholderLabel }: { src: string; alt: string; placeholderLabel: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Placeholder label={placeholderLabel} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
    />
  );
}

function Placeholder({ label }: { label: string }) {
  return <ImageNotSupportedIcon color="disabled" fontSize="large" titleAccess={label} />;
}
