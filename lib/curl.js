'use strict';

/**
 * Helpers for the curl transport.
 *
 * The Authorization header must never reach curl's argv: on Linux every local
 * user can read `/proc/<pid>/cmdline`. Headers travel in a 0600 file inside a
 * 0700 temp directory instead, and the arguments only reference that file.
 */

function headerValue(value){
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * @param {{apiKey?: string, referer?: string, title?: string}} cfg
 * @returns {string} one header per line, curl `-H @file` format
 */
function formatCurlHeaders({ apiKey, referer, title } = {}){
  return [
    `Authorization: Bearer ${headerValue(apiKey)}`,
    'Content-Type: application/json',
    `HTTP-Referer: ${headerValue(referer)}`,
    `X-Title: ${headerValue(title)}`,
    'Accept: application/json'
  ].join('\n') + '\n';
}

/**
 * @param {{endpoint: string, headerFile: string, bodyFile: string, timeoutMs?: number}} options
 * @returns {string[]} curl arguments, never containing the API key
 */
function buildCurlArgs({ endpoint, headerFile, bodyFile, timeoutMs }){
  const seconds = Math.max(1, Math.ceil((Number(timeoutMs) || 25000) / 1000));
  return [
    '-sS', '-L',
    '--max-time', String(seconds),
    '-H', `@${headerFile}`,
    '-d', `@${bodyFile}`,
    endpoint
  ];
}

module.exports = { buildCurlArgs, formatCurlHeaders };
