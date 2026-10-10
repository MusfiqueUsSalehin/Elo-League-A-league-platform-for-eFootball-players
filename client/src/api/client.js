const BASE_URL = '/api';

/** What every failed request throws, whether the server answered or not. */
export class ApiError extends Error {
  constructor(message, { status = 0, code, details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 means the server could not be reached
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

let unauthorizedHandler = null;

/** Called whenever the server answers 401, so the app can drop its signed-in state. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// A proxy or load balancer answers like this when the API behind it is down or restarting.
const GATEWAY_ERRORS = new Set([502, 503, 504]);

const fallbackMessage = (status) =>
  GATEWAY_ERRORS.has(status)
    ? 'The server is not responding. Try again shortly.'
    : 'Something went wrong. Try again.';

async function readJson(response) {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    // The session lives in an httpOnly cookie, which the browser attaches by itself.
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.');
  }

  const data = await readJson(response);
  if (response.ok) return data;

  if (response.status === 401) unauthorizedHandler?.();
  throw new ApiError(data?.message ?? fallbackMessage(response.status), {
    status: response.status,
    code: data?.code,
    details: data?.details,
    requestId: data?.requestId,
  });
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
