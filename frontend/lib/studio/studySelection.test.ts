import { describe, expect, it } from "vitest";
import {
  formatStudyLabel,
  pickDefaultStudyId,
  resolveSelectedStudyId,
} from "./studySelection";
import type { Study } from "./types";

function study(
  partial: Pick<Study, "id" | "status"> & Partial<Study>,
): Study {
  return {
    version: 1,
    updated_at: "2026-01-01T00:00:00Z",
    graph: { id: "g", version: 1, kind: "chart", nodes: [], edges: [] },
    ...partial,
  };
}

describe("pickDefaultStudyId", () => {
  it("returns null for empty list", () => {
    expect(pickDefaultStudyId([])).toBeNull();
  });

  it("prefers applied over drafts", () => {
    const studies = [
      study({ id: "d1", status: "draft" }),
      study({ id: "a1", status: "applied" }),
      study({ id: "d2", status: "draft" }),
    ];
    expect(pickDefaultStudyId(studies)).toBe("a1");
  });

  it("uses first study when no applied", () => {
    const studies = [
      study({ id: "d1", status: "draft" }),
      study({ id: "d2", status: "draft" }),
    ];
    expect(pickDefaultStudyId(studies)).toBe("d1");
  });
});

describe("resolveSelectedStudyId", () => {
  it("keeps selection when still in list", () => {
    const studies = [
      study({ id: "d1", status: "draft" }),
      study({ id: "a1", status: "applied" }),
    ];
    expect(resolveSelectedStudyId(studies, "d1")).toBe("d1");
  });

  it("redefaults when selection missing", () => {
    const studies = [
      study({ id: "d1", status: "draft" }),
      study({ id: "a1", status: "applied" }),
    ];
    expect(resolveSelectedStudyId(studies, "gone")).toBe("a1");
  });
});

describe("formatStudyLabel", () => {
  it("uses title when present", () => {
    expect(
      formatStudyLabel(study({ id: "long-id-here", status: "draft", title: "Demo" })),
    ).toBe("draft · Demo");
  });

  it("falls back to short id", () => {
    expect(
      formatStudyLabel(study({ id: "abcdefghij", status: "applied" })),
    ).toBe("applied · abcdefgh…");
  });
});
