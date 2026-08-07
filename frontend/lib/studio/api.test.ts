import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStudy,
  deleteStudy,
  getStudy,
  listStudies,
  studiesUrl,
  studyUrl,
  updateStudy,
} from "./api";
import type { Study } from "./types";

const sampleStudy: Study = {
  id: "study-1",
  status: "draft",
  version: 1,
  updated_at: "2026-01-01T00:00:00Z",
  graph: {
    id: "g",
    version: 1,
    kind: "chart",
    nodes: [],
    edges: [],
  },
  presentation: {
    version: 1,
    panes: [],
    outputs: [],
  },
  title: "demo",
  created_by: "agent",
};

describe("studiesUrl / studyUrl", () => {
  it("builds list and detail URLs", () => {
    expect(studiesUrl()).toBe("/api/backend/v1/studies");
    expect(studiesUrl("draft")).toBe(
      "/api/backend/v1/studies?status=draft",
    );
    expect(studyUrl("abc")).toBe("/api/backend/v1/studies/abc");
    expect(studyUrl("a/b")).toBe("/api/backend/v1/studies/a%2Fb");
  });
});

describe("listStudies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns studies on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => [sampleStudy],
      }),
    );

    await expect(listStudies()).resolves.toEqual([sampleStudy]);
    expect(fetch).toHaveBeenCalledWith("/api/backend/v1/studies");
  });

  it("passes status query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => [],
      }),
    );

    await listStudies("draft,applied");
    expect(fetch).toHaveBeenCalledWith(
      "/api/backend/v1/studies?status=draft%2Capplied",
    );
  });

  it("throws on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 500, ok: false }),
    );
    await expect(listStudies()).rejects.toThrow(/500/);
  });
});

describe("getStudy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns study on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => sampleStudy,
      }),
    );

    await expect(getStudy("study-1")).resolves.toEqual(sampleStudy);
  });

  it("throws on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 404, ok: false }),
    );
    await expect(getStudy("missing")).rejects.toThrow(/404/);
  });
});

describe("createStudy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs body and returns study", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => sampleStudy,
    });
    vi.stubGlobal("fetch", fetchMock);

    const body = { graph: sampleStudy.graph, created_by: "agent" as const };
    await expect(createStudy(body)).resolves.toEqual(sampleStudy);

    expect(fetchMock).toHaveBeenCalledWith("/api/backend/v1/studies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });
});

describe("updateStudy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs accept status", async () => {
    const applied = { ...sampleStudy, status: "applied" as const, version: 2 };
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => applied,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateStudy("study-1", { status: "applied" }),
    ).resolves.toEqual(applied);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/v1/studies/study-1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "applied" }),
      },
    );
  });
});

describe("deleteStudy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DELETEs and resolves on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 204, ok: true }),
    );

    await expect(deleteStudy("study-1")).resolves.toBeUndefined();
  });

  it("throws on conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 409, ok: false }),
    );
    await expect(deleteStudy("study-1")).rejects.toThrow(/409/);
  });
});
