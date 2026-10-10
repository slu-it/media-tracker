import { useRef, useState, type PointerEvent } from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon, useTheme } from "@mui/material";
import { chipColors } from "./chipColors";
import type { ColorChipItem } from "./ColorChip";

/** At most this many preset actions are offered. */
export const MAX_ADD_PRESETS = 5;

interface AddSpeedDialProps {
  /** Aria label of the main button (e.g. "Add book"). */
  label: string;
  /** The selectable values (book types, platforms); `null` while loading, which disables the button. */
  options: ColorChipItem[] | null;
  /** Usage count per option id; a missing id counts as 0. */
  counts?: Record<string, number>;
  /** `optionId` is set when a preset action was chosen, absent for the plain add. */
  onAdd: (optionId?: string) => void;
}

type OpenReason = "toggle" | "focus" | "mouseEnter";

/** The most used options first (stable for ties), capped at `MAX_ADD_PRESETS`. */
function topOptions(options: ColorChipItem[], counts: Record<string, number>): ColorChipItem[] {
  return options
    .map((option, index) => ({ option, index, count: counts[option.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, MAX_ADD_PRESETS)
    .map(({ option }) => option);
}

/**
 * Lower-right add button. A mouse click on it always adds without a preset (even one racing MUI's hover-open timer),
 * as does a click while the dial is open; a first touch or key press only fans out, and its actions add with one
 * option preselected. The dial opens upward, and MUI puts the first child closest
 * to the button, so the options are rendered most used first.
 */
export function AddSpeedDial({ label, options, counts = {}, onAdd }: AddSpeedDialProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  // Touch and pen emulate mouseenter around the click. MUI opens on mouseenter via a 0 ms timer and its click handler
  // clears it, so a same-task emulated mouseenter + click is already fine; this guard covers a click that arrives after
  // the timer fired (tap delay, iOS hover heuristics), which would make the first tap a plain add. Remember whether
  // the current non-mouse gesture is what opened the dial, and keep it open then.
  const touchGesture = useRef(false);
  // The pointer type of the last pointerdown on the button, consumed by the click it leads to (and cleared by a key
  // press), so a later keyboard Enter is not mistaken for a mouse click.
  const mousePointer = useRef(false);
  const openedInTouchGesture = useRef(false);
  // Closing the add dialog restores focus to the button, which would reopen the dial over the cards: ignore that one
  // focus-open (the focus itself stays, so keyboard users land back on the button).
  const ignoreNextFocusOpen = useRef(false);

  const onPointerDown = (event: PointerEvent) => {
    mousePointer.current = event.pointerType === "mouse";
    touchGesture.current = event.pointerType !== "mouse";
    openedInTouchGesture.current = false;
  };

  const add = (...args: [optionId?: string]) => {
    ignoreNextFocusOpen.current = true;
    onAdd(...args);
  };

  const handleOpen = (_event: unknown, reason: OpenReason) => {
    // A mouse click that beat MUI's 0 ms hover-open timer arrives as a "toggle" open: it is still the plain add.
    if (reason === "toggle" && mousePointer.current) {
      mousePointer.current = false;
      add();
      return;
    }
    if (reason === "focus" && ignoreNextFocusOpen.current) {
      ignoreNextFocusOpen.current = false;
      return;
    }
    ignoreNextFocusOpen.current = false;
    if (reason === "mouseEnter" && touchGesture.current) openedInTouchGesture.current = true;
    setOpen(true);
  };

  const handleClose = (_event: unknown, reason: string) => {
    mousePointer.current = false;
    if (reason !== "toggle") {
      setOpen(false);
      return;
    }
    if (touchGesture.current && openedInTouchGesture.current) {
      openedInTouchGesture.current = false;
      return;
    }
    setOpen(false);
    add();
  };

  const presets = options === null ? [] : topOptions(options, counts);

  return (
    <SpeedDial
      ariaLabel={label}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      icon={<SpeedDialIcon />}
      FabProps={{
        disabled: options === null,
        onPointerDown,
        onKeyDown: () => {
          mousePointer.current = false;
        },
      }}
      sx={{ position: "fixed", right: 24, bottom: 24 }}
    >
      {presets.map((option) => {
        const colors = chipColors(theme, option.associatedColor);
        return (
          <SpeedDialAction
            key={option.id}
            icon={option.label.charAt(0).toUpperCase()}
            slotProps={{
              tooltip: { open: true, title: option.label },
              // Closed actions stay mounted for the animation: keep them out of the tab order and the a11y tree.
              staticTooltip: { inert: !open, "aria-hidden": !open || undefined },
              fab: { sx: { ...colors, "&:hover": colors } },
            }}
            onClick={() => {
              setOpen(false);
              add(option.id);
            }}
          />
        );
      })}
    </SpeedDial>
  );
}
