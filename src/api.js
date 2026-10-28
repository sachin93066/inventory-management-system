
const TOKEN_KEY = "stockflow_token";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export async function apiFetch(url, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
