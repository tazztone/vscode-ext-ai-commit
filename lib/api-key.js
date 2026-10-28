'use strict';

const { endpointOrigin } = require('./endpoint');

const SECRET_PREFIX = 'kargnas.aiCommit.apiKey';

/**
 * @param {unknown} value raw setting or secret value
 * @returns {string} trimmed key, or '' when the value is not a string
 */
function normalizeApiKey(value){
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * SecretStorage id for the key belonging to an endpoint's origin.
 *
 * Origin-level ids keep one key per provider, so switching between providers
 * never sends one provider's key to another. SecretStorage has no list API,
 * which is why the endpoint is encoded in the id instead of a JSON map.
 *
 * @param {string} endpoint configured chat-completions endpoint
 * @returns {string} secret id
 */
function secretKeyFor(endpoint){
  return `${SECRET_PREFIX}::${endpointOrigin(endpoint)}`;
}

module.exports = { SECRET_PREFIX, normalizeApiKey, secretKeyFor };
