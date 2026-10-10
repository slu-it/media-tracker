# Add speed dial with type and platform presets

ADR: [0040](../decisions/0040-add-speed-dial-presets.md).
Code:
- `frontend/src/components/media/AddSpeedDial.tsx`: the shared component.
- Used by `BookDialogsHost.tsx` and `GameDialogsHost.tsx`.
- Prefill props on `AddBookDialog` (`initialTypeIds`) and `AddGameDialog` (`initialPlatformIds`).
- Counts in `findUsedFilterValues()` of `Exposed{Book,Game}Repository`, exposed through `GET /api/{books,games}.meta`.

## Behaviour

- The add button in the lower right of every book and game page is an MUI `SpeedDial`.
- **Main button:** hovering or focusing it fans out one action per book type or game platform.
  - Clicking it opens the empty add dialog, as the plain FAB did.
  - On touch, the first tap fans out and a second tap on the main button adds without a preset.
- **Actions:** each one is coloured like the value's chip and always shows its label.
  - Clicking an action opens the add dialog with that type or platform preselected. It can still be changed
    there.
- **Order:** the action of the most-used value sits closest to the main button, then the others by descending
  count.
  - Ties keep label order. Unused values come last.
  - At most five actions are shown (`MAX_ADD_PRESETS`).
- **Disabled state:** the button is disabled until the types or platforms are loaded.
- **Accessibility:** closed actions are `inert`. When the dial is open, the arrow keys move between the actions.
- **After the dialog:** when the add dialog closes, the dial stays closed.

## Counts

- `GET /api/games.meta` returns `platformCounts` and `GET /api/books.meta` returns `typeCounts`. Each is a map
  from id to number of items.
  - A game or book counts once for each of its platforms or types.
  - The counts are global, like the rest of `.meta`.
- The views pass the map to their dialog host.
- `.meta` is reloaded after every create, update and delete, so the order follows the data.
