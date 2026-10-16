// Only trust Codespaces metadata supplied by the process, never forwarded headers.
export function codespaceHost(port, environment = process.env) {
  if (environment.CODESPACES !== 'true') return null;
  const name = environment.CODESPACE_NAME;
  const domain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return null;
  if (domain !== 'app.github.dev') return null;
  return `${name}-${port}.${domain}`;
}

export function isAllowedRequest(headers, port, environment = process.env) {
  const remote = codespaceHost(port, environment);
  const host = headers.host;
  const local = host === `127.0.0.1:${port}` || host === `localhost:${port}`;
  if (!local && (!remote || host !== remote)) return false;
  if (headers['sec-fetch-site'] === 'cross-site') return false;
  if (!headers.origin) return true;
  // The Codespaces proxy may preserve the external Host or rewrite it to localhost.
  return (local && headers.origin === `http://${host}`) ||
    (remote !== null && headers.origin === `https://${remote}`);
}
