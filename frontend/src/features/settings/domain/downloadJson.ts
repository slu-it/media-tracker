/**
 * Triggers a browser download of `data` as pretty-printed JSON, named `media-tracker-export-YYYY-MM-DD.json`
 * (local date). Blob -> `URL.createObjectURL` -> a temporary, clicked `<a download>` -> revoke. The revoke is
 * deferred to the next macrotask: revoking right after `click()` can cancel the download in some browsers
 * (Safari, older Firefox).
 */
export function downloadJson(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `media-tracker-export-${localDateStamp()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function localDateStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
