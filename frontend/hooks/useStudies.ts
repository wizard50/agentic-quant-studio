"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { deleteStudy, listStudies, updateStudy } from "@/lib/studio/api";
import { resolveSelectedStudyId } from "@/lib/studio/studySelection";
import type { Study } from "@/lib/studio/types";

/** Select value for local layers chart (no backend study). */
export const LAYERS_SELECTION = "__layers__";

const hydrateSubscribe = () => () => {};

/** false on server + first client paint; true after hydration (no setState-in-effect). */
function useHydrated(): boolean {
  return useSyncExternalStore(hydrateSubscribe, () => true, () => false);
}

export interface UseStudiesResult {
  studies: Study[];
  selectedId: string | null;
  selected: Study | null;
  /** True while a list fetch is in flight (may be true during SSR). */
  loading: boolean;
  /**
   * Safe for `disabled={...}` on controls: false until hydrated so SSR HTML matches
   * the first client render, then tracks loading/busy.
   */
  disableControls: boolean;
  error: Error | null;
  actionError: Error | null;
  select: (id: string | null) => void;
  reload: () => void;
  accept: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  busy: boolean;
}

export function useStudies(): UseStudiesResult {
  const hydrated = useHydrated();
  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Initial true for first fetch; do not setLoading(true) inside effects (React compiler).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  /** When true, stay on layers path after list reloads until user picks a study. */
  const preferLayersRef = useRef(false);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const select = useCallback((id: string | null) => {
    setActionError(null);
    if (id == null) {
      preferLayersRef.current = true;
      setSelectedId(null);
      return;
    }
    preferLayersRef.current = false;
    setSelectedId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listStudies().then(
      (items) => {
        if (cancelled) {
          return;
        }
        setStudies(items);
        setError(null);
        setLoading(false);
        setSelectedId((prev) => {
          if (preferLayersRef.current && prev == null) {
            return null;
          }
          if (preferLayersRef.current && prev != null) {
            preferLayersRef.current = false;
          }
          return resolveSelectedStudyId(items, prev);
        });
      },
      (cause: unknown) => {
        if (cancelled) {
          return;
        }
        setStudies([]);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selected = useMemo(
    () => studies.find((study) => study.id === selectedId) ?? null,
    [studies, selectedId],
  );

  const accept = useCallback(async (id: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await updateStudy(id, { status: "applied" });
      preferLayersRef.current = false;
      setSelectedId(id);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteStudy(id);
      setSelectedId((prev) => (prev === id ? null : prev));
      preferLayersRef.current = false;
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    studies,
    selectedId,
    selected,
    loading,
    disableControls: hydrated && (loading || busy),
    error,
    actionError,
    select,
    reload,
    accept,
    remove,
    busy,
  };
}
