import { Box, Card, CardActionArea, CardContent, IconButton, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import type { ExpansionResponse } from "../../../types/api";
import { GameStatusIcons } from "./GameStatusIcons";

/**
 * Full-width row for one expansion; clicking the card body opens its details, the drag handle on the right
 * reorders it (see {@link ExpansionList}). The handle is a separate element from the clickable card body so
 * dragging it never triggers `onSelect`.
 */
export function ExpansionCard({
  expansion,
  onSelect,
}: {
  expansion: ExpansionResponse;
  onSelect: (expansion: ExpansionResponse) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: expansion.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card variant="outlined" ref={setNodeRef} style={style}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <CardActionArea onClick={() => onSelect(expansion)} aria-label={expansion.title} sx={{ flex: 1 }}>
          <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
            <Typography variant="body1">{expansion.title}</Typography>
            <GameStatusIcons ownership={expansion.ownership} progress={expansion.progress} hidden={false} />
          </CardContent>
        </CardActionArea>
        <IconButton
          {...attributes}
          {...listeners}
          disableRipple
          aria-label={t("games.expansions.dragHandle", { title: expansion.title })}
          sx={{ mr: 1, cursor: "grab", touchAction: "none" }}
        >
          <DragIndicatorIcon />
        </IconButton>
      </Box>
    </Card>
  );
}
