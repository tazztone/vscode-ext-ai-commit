'use strict';

/**
 * Serialize a chat-completions payload for the wire.
 *
 * Diagnostics such as `__meta` are kept on the payload object that backs the
 * "Show Last Payload" command, but strict OpenAI-compatible providers (Groq,
 * OpenAI, ...) reject unknown top-level properties. Strip them here so every
 * transport sends the same clean body.
 */
function toRequestBody(payload){
  const { __meta, ...body } = payload;
  return JSON.stringify(body);
}

module.exports = { toRequestBody };
