import { useId, type ReactNode } from "react";
import { Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { CoverImage } from "../../../components/CoverImage";

export const CARD_COVER_WIDTH = 168;

interface GameCardShellProps {
  title: string;
  coverImageUrl: string | null;
  onClick: () => void;
  /**
   * Announced as the card's accessible description (`aria-describedby`), in addition to `title` as its accessible
   * name: the explicit `aria-label` below would otherwise hide any descendant content (e.g. a rating or release
   * date) from screen readers, since it overrides the button's normal "name from content" computation.
   */
  description?: ReactNode;
  /** Card body below the title/description, e.g. platform chips and status icons. */
  children?: ReactNode;
}

/** Cover with a 2-line clamped title centered underneath; the whole card opens on click or keyboard activation. */
export function GameCardShell({ title, coverImageUrl, onClick, description, children }: GameCardShellProps) {
  const descriptionId = useId();
  return (
    <Card variant="outlined">
      <CardActionArea
        onClick={onClick}
        aria-label={title}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        sx={{ height: "100%" }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <CoverImage src={coverImageUrl} alt="" width={CARD_COVER_WIDTH} />
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
          {description !== undefined && <Box id={descriptionId}>{description}</Box>}
          {children}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
