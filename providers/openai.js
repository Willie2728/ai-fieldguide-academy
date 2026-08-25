'use strict';

function extractText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function complete({ messages, instructions, safetyIdentifier, signal }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY is not configured.'), { statusCode: 503 });

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    instructions,
    input: messages,
    reasoning: { effort: 'low' },
    text: { verbosity: 'medium' },
    safety_identifier: safetyIdentifier,
    store: false
  };
  if (process.env.OPENAI_ALLOW_WEB_SEARCH === 'true') body.tools = [{ type: 'web_search' }];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `OpenAI request failed (${response.status}).`;
    throw Object.assign(new Error(message), { statusCode: response.status >= 500 ? 502 : 400 });
  }
  const text = extractText(data);
  if (!text) throw Object.assign(new Error('OpenAI returned no answer.'), { statusCode: 502 });
  return { text, model: data.model || body.model, provider: 'openai' };
}

module.exports = { complete };
