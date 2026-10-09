import { useId, type ReactNode } from "react";
import { Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { CoverImage } from "../CoverImage";

export const CARD_COVER_WIDTH = 168;
/** Gap (theme spacing units) between the card's stacked blocks; descriptions mirror it between their own blocks. */
export const CARD_CONTENT_GAP = 1.5;

interface MediaCardShellProps {
  title: string;
  coverImageUrl: string | null;
  onClick: () => void;
  /**
   * Announced as the card's accessible description (`aria-describedby`), in addition to `title` as its accessible
   * name: the explicit `aria-label` below would otherwise hide any descendant content (e.g. a rating or release
   * date) from screen readers, since it overrides the button's normal "name from content" computation.
   */
  description?: ReactNode;
  /**
   * Where the description sits in the centered column: `"bottom"` (default) after the title, `"top"` first, above the
   * cover. In both cases it stays referenced by `aria-describedby`.
   */
  descriptionPlacement?: "top" | "bottom";
  /** Cover shape; defaults to the standard cover ratio. */
  coverAspectRatio?: number;
  /** Shows the cover in grayscale at half opacity; set by cards for watchlist items, which are not owned yet. */
  desaturateCover?: boolean;
  /** Card body below the title/description, e.g. platform chips and status icons. */
  children?: ReactNode;
}

/** Cover with a 2-line clamped title centered underneath; the whole card opens on click or keyboard activation. */
export function MediaCardShell({
  title,
  coverImageUrl,
  onClick,
  description,
  descriptionPlacement = "bottom",
  coverAspectRatio,
  desaturateCover,
  children,
}: MediaCardShellProps) {
  const descriptionId = useId();
  const descriptionBox = description !== undefined && (
    <Box id={descriptionId} sx={{ maxWidth: "100%" }}>
      {description}
    </Box>
  );
  return (
    <Card variant="outlined">
      <CardActionArea
        onClick={onClick}
        aria-label={title}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        sx={{ height: "100%" }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: CARD_CONTENT_GAP }}>
          {descriptionPlacement === "top" && descriptionBox}
          <CoverImage
            src={coverImageUrl}
            alt=""
            width={CARD_COVER_WIDTH}
            aspectRatio={coverAspectRatio}
            sx={desaturateCover ? { filter: "grayscale(1)", opacity: 0.5 } : undefined}
          />
          <Typography
            variant="subtitle1"
            component="h3"
            align="center"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
              minHeight: "2.6em",
            }}
          >
            {title}
          </Typography>
          {descriptionPlacement === "bottom" && descriptionBox}
          {children}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
