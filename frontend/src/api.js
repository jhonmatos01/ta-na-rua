export let token = '';
export let user = null;
let refreshPromise = null;
export function setSession(session) {
  token = session?.accessToken || '';
  user = session?.user || null;
}
export function setUser(value) {
  user = value;
}
export async function refresh() {
  if (!refreshPromise)
    refreshPromise = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          token = '';
          user = null;
          return false;
        }
        const body = await response.json();
        token = body.data.accessToken;
        user = body.data.user;
        return true;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
export async function api(path, { method = 'GET', body, raw = false, retry = true } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`/api/v1${path}`, { method, headers, body, credentials: 'include' });
  if (response.status === 401 && token && retry) {
    if (await refresh())
      return api(path, {
        method,
        body: body && !(body instanceof FormData) ? JSON.parse(body) : body,
        raw,
        retry: false,
      });
  }
  if (response.status === 204) return null;
  if (raw && response.ok) return response;
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message || 'Não foi possível concluir esta ação.');
  return result;
}
