const BASE_URL = import.meta.env.VITE_API_ENDPOINT ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getDocuments:   ()                            => request("/documents"),
  getDocument:    (slug: string)                => request(`/documents/${slug}`),
  getVersions:    (slug: string)                => request(`/documents/${slug}/versions`),
  publishVersion: (slug: string, body: unknown) =>
    request(`/documents/${slug}/versions`, { method: "POST", body: JSON.stringify(body) }),
};
