import { useTranslation } from "react-i18next";
import { VocabularyField } from "../../../../components/media/fields/VocabularyField";
import { searchGameDevelopers } from "../../api/gamesApi";
import type { DeveloperDraft } from "../../domain/gameDraft";

interface DevelopersFieldProps {
  value: DeveloperDraft[];
  onChange: (value: DeveloperDraft[]) => void;
  disabled?: boolean;
}

/** The game developers: `VocabularyField` over `/api/game-developers` with the games label and hint. */
export function DevelopersField({ value, onChange, disabled }: DevelopersFieldProps) {
  const { t } = useTranslation();
  return (
    <VocabularyField
      value={value}
      onChange={onChange}
      disabled={disabled}
      fetchSuggestions={searchGameDevelopers}
      label={t("games.fields.developers")}
      hint={t("games.fields.developersHint")}
    />
  );
}
