import type { Study } from "./types";

/** Prefer applied; else first item (list is newest-first from API). */
export function pickDefaultStudyId(studies: Study[]): string | null {
  if (studies.length === 0) {
    return null;
  }

  const applied = studies.find((study) => study.status === "applied");
  if (applied) {
    return applied.id;
  }

  return studies[0]?.id ?? null;
}

/** Keep selection if still present; otherwise fall back to default. */
export function resolveSelectedStudyId(
  studies: Study[],
  selectedId: string | null,
): string | null {
  if (selectedId != null && studies.some((study) => study.id === selectedId)) {
    return selectedId;
  }
  return pickDefaultStudyId(studies);
}

export function formatStudyLabel(study: Study): string {
  const shortId =
    study.id.length > 8 ? `${study.id.slice(0, 8)}…` : study.id;
  const name = study.title?.trim() || shortId;
  return `${study.status} · ${name}`;
}
