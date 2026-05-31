"use client";

import { useQuery } from "@tanstack/react-query";
import type { IngestJob } from "@/lib/types";

export interface UseIngestionJobsOptions {
  active?: boolean;
  status?: string; // comma-separated, e.g. "pending,running"
  limit?: number;
}

export interface ActiveJobSummary {
  totalActive: number;
  running: number;
  pending: number;
  jobs: IngestJob[];
}

/**
 * Fetch ingestion jobs with optional filtering.
 * Use this when you need the full list or custom filters.
 */
export function useIngestionJobs(options: UseIngestionJobsOptions = {}) {
  const { active, status, limit } = options;

  const params = new URLSearchParams();
  if (active) params.set("active", "true");
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));

  const queryString = params.toString();
  const url = `/api/backend/v1/candles/ingest/jobs${queryString ? `?${queryString}` : ""}`;

  return useQuery<IngestJob[]>({
    queryKey: ["ingest-jobs", { active, status, limit }] as const,
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load ingestion jobs: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds — jobs change more frequently than catalog
    refetchOnWindowFocus: false,
  });
}

/**
 * Convenience hook that returns a summary for the "Active Jobs" KPI card.
 * Fetches only active (pending + running) jobs.
 */
export function useActiveJobSummary(): {
  data: ActiveJobSummary | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: jobs = [], isLoading, error } = useIngestionJobs({ active: true, limit: 100 });

  const summary: ActiveJobSummary = {
    totalActive: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    pending: jobs.filter((j) => j.status === "pending").length,
    jobs,
  };

  return {
    data: jobs.length > 0 || !isLoading ? summary : undefined,
    isLoading,
    error: error ?? null,
  };
}
