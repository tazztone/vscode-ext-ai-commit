'use strict';

/**
 * URL helper used as the API-key identity.
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

module.exports = { endpointOrigin };
