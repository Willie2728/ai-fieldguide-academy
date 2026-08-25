'use strict';

const providers = {
  openai: require('./openai'),
  anthropic: require('./anthropic'),
  ollama: require('./ollama')
};

function getProvider(name = process.env.AI_PROVIDER || 'openai') {
  const provider = providers[name.toLowerCase()];
  if (!provider) throw Object.assign(new Error(`Unsupported AI provider: ${name}`), { statusCode: 500 });
  return provider;
}

module.exports = { getProvider, supportedProviders: Object.keys(providers) };
