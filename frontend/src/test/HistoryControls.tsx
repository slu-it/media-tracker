import { useNavigate } from "react-router";

/**
 * Stands in for the browser's Back and Forward buttons: MemoryRouter keeps its own history, not window.history.
 * Render it next to the view under test and click the "Back" / "Forward" buttons.
 */
export function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate(-1)}>Back</button>
      <button onClick={() => void navigate(1)}>Forward</button>
    </>
  );
}
