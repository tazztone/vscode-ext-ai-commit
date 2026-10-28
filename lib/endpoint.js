'use strict';

/**
 * URL helpers shared by API-key storage and the ping command.
 *
 * Keys are stored per origin, not per full endpoint. The same provider key has
 * to survive switching between `/chat/completions` and `/responses`, and the
 * `endpointRewrite` setting already rewrites one path into another.
 */

function asString(value){
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Origin used as the API-key identity: scheme + host + port.
 *
 * @param {string} endpoint configured chat-completions endpoint
 * @returns {string} origin, or the trimmed input when it is not a valid URL
 */
function endpointOrigin(endpoint){
  const raw = asString(endpoint);
  if(!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

/**
 * Derive the provider's model-list URL from a configured endpoint.
 *
 * Uses the endpoint before `endpointRewrite` runs, so OpenRouter's
 * `/api/v1/responses` still maps to `/api/v1/models` rather than the
 * rewritten `/api/alpha/...` path.
 *
 * @param {string} endpoint configured chat-completions endpoint
 * @returns {string|null} models URL, or null when the endpoint is not a URL
 */
function modelsUrl(endpoint){
  const raw = asString(endpoint);
  if(!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const trimmed = url.pathname.replace(/\/+$/, '');
  const base = trimmed.replace(/\/(?:chat\/completions|responses)$/, '');
  url.pathname = `${base}/models`;
  url.hash = '';
  return url.toString();
}

module.exports = { endpointOrigin, modelsUrl };
