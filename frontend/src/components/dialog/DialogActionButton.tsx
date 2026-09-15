import type { ReactNode } from "react";
import { IconButton, Tooltip } from "@mui/material";

interface DialogActionButtonProps {
  icon: ReactNode;
  /** Tooltip and accessible name. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "default" | "primary" | "error";
}

/** Rounded-square icon button for the BaseDialog action sidebar. */
export function DialogActionButton({ icon, label, onClick, disabled, color = "default" }: DialogActionButtonProps) {
  return (
    <Tooltip title={label} placement="right">
      {/* span keeps the tooltip working while the button is disabled */}
      <span>
        <IconButton
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          color={color}
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
