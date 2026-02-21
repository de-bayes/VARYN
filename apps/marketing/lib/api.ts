import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  Project,
  CreateProjectRequest,
  DatasetMeta,
  ExecuteRequest,
  ExecuteResponse,
  ArtifactDownload,
} from '@varyn/shared';

const BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api-production-5af3.up.railway.app'
    : 'http://localhost:4000');

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('varyn_token');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (init?.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach server at ${BASE}. Check your connection.`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.message ?? body?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ──────────────────────────────────────────────
export function signup(body: SignupRequest): Promise<AuthResponse> {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify(body) });
}

export function login(body: LoginRequest): Promise<AuthResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

// ── Projects ─────────────────────────────────────────
export function listProjects(): Promise<Project[]> {
  return request('/projects');
}

export function createProject(body: CreateProjectRequest): Promise<Project> {
  return request('/projects', { method: 'POST', body: JSON.stringify(body) });
}

export function getProject(id: string): Promise<Project> {
  return request(`/projects/${id}`);
}

// ── Datasets ─────────────────────────────────────────
export function listDatasets(projectId: string): Promise<DatasetMeta[]> {
  return request(`/projects/${projectId}/datasets`);
}

export function uploadDataset(projectId: string, file: File): Promise<DatasetMeta> {
  const form = new FormData();
  form.append('file', file);
  return request(`/projects/${projectId}/datasets`, { method: 'POST', body: form });
}

export function getDatasetPreview(
  projectId: string,
  datasetId: string,
): Promise<{ meta: DatasetMeta; downloadUrl: string }> {
  return request(`/projects/${projectId}/datasets/${datasetId}/preview`);
}

// ── Execution ────────────────────────────────────────
export function execute(projectId: string, body: ExecuteRequest): Promise<ExecuteResponse> {
  return request(`/projects/${projectId}/execute`, { method: 'POST', body: JSON.stringify(body) });
}

// ── Artifacts ────────────────────────────────────────
export function getArtifactUrl(id: string): Promise<ArtifactDownload> {
  return request(`/artifacts/${id}`);
}
