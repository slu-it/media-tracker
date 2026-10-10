# 0040: The add button becomes a speed dial with type and platform presets, ordered by usage counts from `.meta`

Status: accepted, 2026-10

## Context

Most books and games are added by hand, and almost every one needs a type (books) or a platform (games). With
the plain add FAB, every add starts with an empty form and the same picks in the types or platforms field.
Both lists are seeded reference data with a colour per value (records 0009, 0034). Today there are four values
per kind, and the owner uses some of them far more than others.

## Decision

- **MUI `SpeedDial` instead of the `Fab`, as one shared component.** The add button becomes a speed dial with one
  action per type or platform. The same component, `components/media/AddSpeedDial`, serves both kinds.
  - Each action is coloured like that value's chip, through one shared colour helper.
  - Each action's label is always shown, because touch has no hover tooltips.
  - Clicking an action opens the add dialog with that one value preselected.
- **The main button keeps the plain add.** Hovering or focusing the main button fans the actions out, and
  clicking it opens the empty dialog as before.
  - On touch and pen, the browser emulates a `mouseenter` before the click. MUI opens on `mouseenter` through a
    0 ms timer, which its click handler clears. So when both arrive in the same task, the first tap only opens
    the dial anyway.
  - When the click arrives after that timer has fired (tap delay, iOS hover heuristics), the first tap would
    open the empty dialog straight away. A guard covers that case: a non-mouse tap that has just fanned the
    actions out keeps them open, and only a second tap on the main button adds without a preset.
  - Keyboard and screen-reader users reach the presets with the arrow keys. Enter on the main button adds
    without a preset.
  - Closed actions are `inert`, so assistive technology does not see them.
  - Each action's icon is the first letter of its label. Letters can repeat (PC, PlayStation); the label
    that is always shown tells the actions apart.
- **Ordered by usage, most used closest to the main button, capped at five.** Ties keep the API's label order.
  Values no item uses yet count as zero and come last. Four values per kind fit, so the cap only matters once the
  seeds grow.
- **The counts come from the existing `.meta` endpoints** (record 0021):
  - `GameMetaResponse.platformCounts` and `BookMetaResponse.typeCounts`, each a map from id to number of items.
  - One `GROUP BY` replaces the `DISTINCT` select on the link table, so this costs no extra request.
  - The counts are global, like the rest of `.meta` and like the data itself.
  - Every view refreshes `.meta` after create, update and delete. The book groups view now loads it too.
  - The reference endpoints `/api/game-platforms` and `/api/book-types` stay plain lists. They are loaded once
    per dialog host and are not refreshed after a save.

## Consequences

- Without counts, the actions keep the API's order. This applies to a host used without meta, or while meta
  is still loading.
- The speed dial has no knowledge of either kind. A new kind with seeded coloured values (movie media, series
  services) plugs in the same way.
