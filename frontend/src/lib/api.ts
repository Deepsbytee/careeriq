import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** The message to show a user for a failed request: the server's own explanation when it gave one. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: unknown } }; code?: string; message?: string };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!e?.response) return "Can't reach the server. Check that the backend is running.";
  return fallback;
}

/** Download a file the API protects behind login (a plain link can't send the token). */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function scoreTone(score: number | null | undefined): "good" | "mid" | "low" | "none" {
  if (score == null) return "none";
  return score >= 75 ? "good" : score >= 50 ? "mid" : "low";
}

export interface Health {
  status: string;
  demo_mode: boolean;
  ai: { provider: string; model: string; configured: boolean };
}

/** Server status, including whether demo accounts exist. Lives at the API root, outside /api/v1. */
export async function fetchHealth(): Promise<Health | null> {
  try {
    const root = BASE_URL.replace(/\/api\/v1\/?$/, "");
    const res = await axios.get(`${root}/health`, { timeout: 5000 });
    return res.data;
  } catch {
    return null;
  }
}
