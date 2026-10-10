import VerifiedIcon from "@mui/icons-material/Verified";
import { useTranslation } from "react-i18next";
import type { CoverMatchResponse } from "../../../../types/api";
import { SuggestingTitleField } from "../../../../components/media/fields/SuggestingTitleField";
import { TitleField } from "../../../../components/media/fields/TitleField";
import { getTitleSuggestions } from "../../api/gamesApi";
import { TITLE_SUGGESTION_MIN_LENGTH } from "../../domain/gameValues";

interface GameTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Reports a picked suggestion; the host decides what to do with it (e.g. also filling the release year).
   * Also gates the suggestion feature itself: omitting it (e.g. `ExpansionDialog`'s DLC title, which reuses
   * this field) means no title-suggestions request is ever made, since SteamGridDB only knows games, not DLC,
   * and the field falls back to a plain `TextField` with textbox semantics.
   */
  onSuggestionPick?: (suggestion: CoverMatchResponse) => void;
  disabled?: boolean;
  /** Show errors even before the field was touched (e.g. after a save attempt). */
  showErrors?: boolean;
  autoFocus?: boolean;
}

const fetchGameTitleSuggestions = (query: string) => getTitleSuggestions(query).then((data) => data.suggestions);

/**
 * Title input with the domain constraints built in, plus SteamGridDB title suggestions (the shared
 * `SuggestingTitleField`, with a "verified" icon per row) once the host opted in via `onSuggestionPick`. Without
 * it (DLC titles, see above), this renders a plain `TextField` instead, keeping textbox semantics and never
 * requesting suggestions.
 */
export function GameTitleField({ onSuggestionPick, ...props }: GameTitleFieldProps) {
  const { t } = useTranslation();
  if (onSuggestionPick === undefined) return <TitleField {...props} />;
  return (
    <SuggestingTitleField<CoverMatchResponse>
      {...props}
      onSuggestionPick={onSuggestionPick}
      fetchSuggestions={fetchGameTitleSuggestions}
      requestKey="games"
      minLength={TITLE_SUGGESTION_MIN_LENGTH}
      getOptionName={(suggestion) => suggestion.name}
      getOptionKey={(suggestion) => suggestion.id}
      renderOptionLabel={(suggestion) =>
        suggestion.releaseYear !== null ? `${suggestion.name} · ${suggestion.releaseYear}` : suggestion.name
      }
      renderOptionEnd={(suggestion) =>
        suggestion.verified && (
          <VerifiedIcon fontSize="small" color="action" titleAccess={t("games.fields.titleSuggestionVerified")} />
        )
      }
    />
  );
}
