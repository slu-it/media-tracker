import { Stack, Typography } from "@mui/material";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { ExpansionResponse } from "../../../types/api";
import { ExpansionCard } from "./ExpansionCard";

/**
 * Vertical list of a game's expansions, headed by `games.expansions.heading`. Renders nothing at all when there
 * are none - no heading, no empty state. Drag-and-drop (pointer or keyboard, via each card's drag handle)
 * reorders the list; a drop calls `onMove` with the moved expansion's id and its new zero-based index.
 */
export function ExpansionList({
  expansions,
  onSelect,
  onMove,
}: {
  expansions: ExpansionResponse[];
  onSelect: (expansion: ExpansionResponse) => void;
  onMove: (expansionId: string, targetIndex: number) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (expansions.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const targetIndex = expansions.findIndex((expansion) => expansion.id === over.id);
    if (targetIndex !== -1) onMove(String(active.id), targetIndex);
  };

  return (
    <div>
      <Typography variant="overline" color="text.secondary" component="div">
        {t("games.expansions.heading")}
      </Typography>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={expansions.map((expansion) => expansion.id)} strategy={verticalListSortingStrategy}>
          <Stack spacing={1}>
            {expansions.map((expansion) => (
              <ExpansionCard key={expansion.id} expansion={expansion} onSelect={onSelect} />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </div>
  );
}
