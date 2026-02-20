// ── Auth ──────────────────────────────────────────────
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string };
}

// ── Projects ─────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateProjectRequest {
  name: string;
}

// ── Datasets ─────────────────────────────────────────
export interface DatasetMeta {
  id: string;
  projectId: string;
  filename: string;
  sizeBytes: number;
  rowCount: number | null;
  columns: ColumnMeta[] | null;
  createdAt: string;
}
export interface ColumnMeta {
  name: string;
  type: 'numeric' | 'character' | 'factor' | 'logical' | 'date' | 'unknown';
  missing: number;
  uniqueCount: number | null;
}
export interface DatasetPreview {
  meta: DatasetMeta;
  head: Record<string, unknown>[];
  summary: VariableSummary[];
}
export interface VariableSummary {
  name: string;
  type: string;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  missing: number;
  n: number;
}

// ── Execution ────────────────────────────────────────
export interface ExecuteRequest {
  command: string;
  datasetId?: string;
}
export interface ExecuteResponse {
  runId: string;
  status: 'success' | 'error';
  artifacts: ArtifactRef[];
  logs: string;
  durationMs: number;
}

// ── Artifacts ────────────────────────────────────────
export type ArtifactKind = 'table' | 'plot' | 'model' | 'export';
export interface ArtifactRef {
  id: string;
  kind: ArtifactKind;
  title: string;
  storageKey: string;
  createdAt: string;
}
export interface ArtifactDownload {
  url: string;
  expiresAt: string;
}

// ── Generic ──────────────────────────────────────────
export interface ApiError {
  error: string;
  message: string;
}
