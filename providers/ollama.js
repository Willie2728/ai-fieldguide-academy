'use strict';

async function complete({ messages, instructions, signal }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL;
  if (!model) throw Object.assign(new Error('OLLAMA_MODEL is not configured.'), { statusCode: 503 });
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: instructions }, ...messages] }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Ollama request failed (${response.status}).`), { statusCode: 502 });
  const text = data.message?.content?.trim();
  if (!text) throw Object.assign(new Error('Ollama returned no answer.'), { statusCode: 502 });
  return { text, model, provider: 'ollama' };
}

module.exports = { complete };
