'use strict';

async function complete({ messages, instructions, signal }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey || !model) throw Object.assign(new Error('ANTHROPIC_API_KEY and ANTHROPIC_MODEL are required.'), { statusCode: 503 });
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, max_tokens: 1200, system: instructions, messages }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || `Anthropic request failed (${response.status}).`), { statusCode: 502 });
  const text = (data.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n').trim();
  if (!text) throw Object.assign(new Error('Anthropic returned no answer.'), { statusCode: 502 });
  return { text, model, provider: 'anthropic' };
}

module.exports = { complete };
