import type { ReactNode } from "react";
import { Box, Dialog, IconButton, Stack, type DialogProps } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";

interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional action buttons (see DialogActionButton) rendered at the top of a sidebar on the left. */
  actions?: ReactNode;
  /** Optional action buttons rendered at the bottom of the sidebar, pushed down from `actions`. */
  bottomActions?: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  /** id of the element that titles the dialog, for `aria-labelledby`. */
  titleId?: string;
  /**
   * Fixed paper height (number = px, or a CSS size string), capped by the viewport. Without it the paper
   * sizes to its content up to `calc(100vh - 96px)`, as before.
   */
  height?: number | string;
  /**
   * `"self"` (default): the content box is the single scroll region.
   * `"children"`: from `sm` up the contract is that a child declares its own `overflow: auto`; the box itself
   * falls back to scrolling if none does, so a child that forgets to constrain itself degrades to the old
   * single-scrollbox behaviour instead of clipping unreachable content. At `xs` it behaves like `"self"`.
   * Requires `height` — without one there is nothing to distribute.
   */
  contentScroll?: "self" | "children";
}

/**
 * The house dialog: a rectangle with a round close button that pokes out over its top-right corner, and an
 * optional column of actions on the left (top-aligned `actions`, bottom-aligned `bottomActions`). Scrolling
 * happens inside the content box so the Paper can keep `overflow: visible` for the protruding button.
 */
export function BaseDialog({
  open,
  onClose,
  children,
  actions,
  bottomActions,
  maxWidth = "md",
  titleId,
  height,
  contentScroll = "self",
}: BaseDialogProps) {
  const { t } = useTranslation();
  const resolvedHeight =
    height === undefined
      ? undefined
      : `min(${typeof height === "number" ? `${height}px` : height}, calc(100vh - 96px))`;
  const childrenScroll = contentScroll === "children" && resolvedHeight !== undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: { overflow: "visible", position: "relative", ...(resolvedHeight && { height: resolvedHeight }) } },
      }}
    >
      <IconButton
        aria-label={t("common.close")}
        onClick={onClose}
        size="small"
        sx={{
          position: "absolute",
          top: -16,
          right: -16,
          width: 36,
          height: 36,
          zIndex: 1,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          boxShadow: 3,
          "&:hover": { bgcolor: "background.paper" },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <Box
        sx={{
          display: "flex",
          ...(resolvedHeight ? { height: "100%" } : { maxHeight: "calc(100vh - 96px)" }),
          borderRadius: "inherit",
          overflow: "hidden",
        }}
      >
        {(actions || bottomActions) && (
          <Stack
            spacing={1}
            useFlexGap
            sx={{
              p: 1.5,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            {actions}
            {bottomActions && (
              <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 1 }}>{bottomActions}</Box>
            )}
          </Stack>
        )}
        <Box
          sx={
            childrenScroll
              ? {
                  flex: 1,
                  minWidth: 0,
                  p: 3,
                  display: { xs: "block", sm: "flex" },
                  flexDirection: "column",
                  overflow: "auto",
                }
              : { flex: 1, minWidth: 0, p: 3, overflow: "auto" }
          }
        >
          {children}
        </Box>
      </Box>
    </Dialog>
  );
}
