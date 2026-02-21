'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  Project,
  DatasetMeta,
  ExecuteResponse,
  ArtifactRef,
} from '@varyn/shared';
import * as api from './api';
import type { CardData } from '@/components/Canvas';

interface WorkspaceContextValue {
  // Project
  currentProject: Project | null;
  projects: Project[];
  // Datasets
  datasets: DatasetMeta[];
  activeDataset: DatasetMeta | null;
  setActiveDataset: (ds: DatasetMeta | null) => void;
  // Data view
  dataViewUrl: string | null;
  showDataView: boolean;
  openDataView: () => void;
  closeDataView: () => void;
  // Execution output
  cards: CardData[];
  logs: string | null;
  logStatus: 'success' | 'error' | undefined;
  logDuration: number | undefined;
  isExecuting: boolean;
  // Actions
  loadProjects: () => Promise<void>;
  loadDatasets: () => Promise<void>;
  uploadDataset: (file: File) => Promise<void>;
  executeCommand: (command: string) => Promise<void>;
  selectDataset: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetMeta | null>(null);
  const [dataViewUrl, setDataViewUrl] = useState<string | null>(null);
  const [showDataView, setShowDataView] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [logs, setLogs] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<'success' | 'error' | undefined>(undefined);
  const [logDuration, setLogDuration] = useState<number | undefined>(undefined);
  const [isExecuting, setIsExecuting] = useState(false);

  const loadProjects = useCallback(async () => {
    const list = await api.listProjects();
    if (list.length === 0) {
      const p = await api.createProject({ name: 'My Project' });
      setProjects([p]);
      setCurrentProject(p);
    } else {
      setProjects(list);
      setCurrentProject(list[0]);
    }
  }, []);

  const loadDatasets = useCallback(async () => {
    if (!currentProject) return;
    const list = await api.listDatasets(currentProject.id);
    setDatasets(list);
  }, [currentProject]);

  const uploadDataset = useCallback(async (file: File) => {
    if (!currentProject) return;
    const ds = await api.uploadDataset(currentProject.id, file);
    setDatasets((prev) => [...prev, ds]);
    setActiveDataset(ds);
  }, [currentProject]);

  const selectDataset = useCallback(
    (id: string) => {
      const ds = datasets.find((d) => d.id === id) ?? null;
      setActiveDataset(ds);
      // Fetch preview URL for data view
      if (ds && currentProject) {
        api.getDatasetPreview(currentProject.id, ds.id).then(({ downloadUrl }) => {
          setDataViewUrl(downloadUrl);
        }).catch(() => {
          setDataViewUrl(null);
        });
      } else {
        setDataViewUrl(null);
        setShowDataView(false);
      }
    },
    [datasets, currentProject],
  );

  const openDataView = useCallback(() => setShowDataView(true), []);
  const closeDataView = useCallback(() => setShowDataView(false), []);

  const executeCommand = useCallback(async (command: string) => {
    if (!currentProject) return;
    setIsExecuting(true);
    setLogs(null);
    setLogStatus(undefined);
    setLogDuration(undefined);

    try {
      const res: ExecuteResponse = await api.execute(currentProject.id, {
        command,
        datasetId: activeDataset?.id,
      });

      setLogs(res.logs || null);
      setLogStatus(res.status);
      setLogDuration(res.durationMs);

      // Process artifacts into cards
      const newCards: CardData[] = [];
      for (const art of res.artifacts) {
        const { url } = await api.getArtifactUrl(art.id);
        if (art.kind === 'table') {
          try {
            const tableRes = await fetch(url);
            const tableData = await tableRes.json();
            newCards.push({
              id: art.id,
              kind: 'table',
              title: art.title,
              columns: tableData.columns,
              rows: tableData.rows,
            });
          } catch {
            // Skip failed artifact loads
          }
        } else if (art.kind === 'plot') {
          newCards.push({
            id: art.id,
            kind: 'plot',
            title: art.title,
            imageUrl: url,
          });
        }
      }
      setCards((prev) => [...prev, ...newCards]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setLogs(msg);
      setLogStatus('error');
    } finally {
      setIsExecuting(false);
    }
  }, [currentProject, activeDataset]);

  // Auto-load projects on mount
  useEffect(() => {
    loadProjects().catch(() => {});
  }, [loadProjects]);

  // Auto-load datasets when project changes
  useEffect(() => {
    if (currentProject) loadDatasets();
  }, [currentProject, loadDatasets]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentProject,
        projects,
        datasets,
        activeDataset,
        setActiveDataset,
        dataViewUrl,
        showDataView,
        openDataView,
        closeDataView,
        cards,
        logs,
        logStatus,
        logDuration,
        isExecuting,
        loadProjects,
        loadDatasets,
        uploadDataset,
        executeCommand,
        selectDataset,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
