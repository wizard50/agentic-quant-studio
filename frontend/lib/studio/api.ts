import type {
  CreateStudyRequest,
  Study,
  StudioRunRequest,
  StudioRunResponse,
  StudioSeriesValue,
  UpdateStudyRequest,
} from "./types";

const STUDIO_RUNS_URL = "/api/backend/v1/studio/runs";
const STUDIES_URL = "/api/backend/v1/studies";

export function studiesUrl(status?: string): string {
  if (status == null || status === "") {
    return STUDIES_URL;
  }
  return `${STUDIES_URL}?status=${encodeURIComponent(status)}`;
}

export function studyUrl(id: string): string {
  return `${STUDIES_URL}/${encodeURIComponent(id)}`;
}

export async function runStudioGraph(
  request: StudioRunRequest,
): Promise<StudioRunResponse> {
  const res = await fetch(STUDIO_RUNS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Studio run failed: ${res.status}`);
  }

  return res.json() as Promise<StudioRunResponse>;
}

/** List studies. Default backend filter is draft+applied when status is omitted. */
export async function listStudies(status?: string): Promise<Study[]> {
  const res = await fetch(studiesUrl(status));

  if (!res.ok) {
    throw new Error(`List studies failed: ${res.status}`);
  }

  return res.json() as Promise<Study[]>;
}

/** Get one study by id. Throws on 404 and other errors. */
export async function getStudy(id: string): Promise<Study> {
  const res = await fetch(studyUrl(id));

  if (!res.ok) {
    throw new Error(`Get study failed: ${res.status}`);
  }

  return res.json() as Promise<Study>;
}

/** Create a draft study. */
export async function createStudy(
  body: CreateStudyRequest,
): Promise<Study> {
  const res = await fetch(STUDIES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Create study failed: ${res.status}`);
  }

  return res.json() as Promise<Study>;
}

/** Update a draft and/or accept (`status: "applied"`). */
export async function updateStudy(
  id: string,
  body: UpdateStudyRequest,
): Promise<Study> {
  const res = await fetch(studyUrl(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Update study failed: ${res.status}`);
  }

  return res.json() as Promise<Study>;
}

/** Delete a draft or archived study. */
export async function deleteStudy(id: string): Promise<void> {
  const res = await fetch(studyUrl(id), {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Delete study failed: ${res.status}`);
  }
}

export function parseSeriesI64(
  value: StudioSeriesValue | undefined,
  port: string,
): (number | null)[] {
  if (!value || value.kind !== "series_i64" || !value.values) {
    throw new Error(`Expected series_i64 for ${port}`);
  }

  return value.values as (number | null)[];
}

export function parseSeriesF64(
  value: StudioSeriesValue | undefined,
  port: string,
): (number | null)[] {
  if (!value || value.kind !== "series_f64" || !value.values) {
    throw new Error(`Expected series_f64 for ${port}`);
  }

  return value.values as (number | null)[];
}

export function parseSeriesBool(
  value: StudioSeriesValue | undefined,
  port: string,
): (boolean | null)[] {
  if (!value || value.kind !== "series_bool" || !value.values) {
    throw new Error(`Expected series_bool for ${port}`);
  }

  return value.values as (boolean | null)[];
}
