'use strict';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const page = document.body.dataset.page || 'home';
let courseData;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function siteChrome() {
  const header = $('[data-site-header]');
  if (header) {
    const links = [
      ['home', '/', 'Home'], ['course', '/course', 'Course'], ['teams', '/for-teams', 'For teams'],
      ['income', '/ai-income', 'AI income'], ['plan', '/business-plan', 'Business plan'], ['brand', '/brand-lab', 'Brand lab']
    ];
    header.className = 'site-header';
    header.innerHTML = `<div class="container nav-wrap">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>AI FieldGuide<small>ACADEMY</small></span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Open navigation">☰</button>
      <nav class="site-nav" id="siteNav" aria-label="Primary">${links.map(([id, href, label]) => `<a href="${href}"${page === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a class="btn btn-ink btn-small" href="/app">Open learner app</a></nav>
    </div>`;
    $('.menu-toggle', header).addEventListener('click', event => {
      const nav = $('#siteNav');
      const open = nav.classList.toggle('open');
      event.currentTarget.setAttribute('aria-expanded', String(open));
    });
  }

  const footer = $('[data-site-footer]');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `<div class="container"><div class="footer-grid">
      <div><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>AI FieldGuide<small>ACADEMY</small></span></a><p>Practical AI education with Willie, your always-available Wisdom Guide.</p></div>
      <div><h3>Learn</h3><a href="/course">Curriculum</a><a href="/app">Learner app</a><a href="/course#prompts">Top 20 prompts</a></div>
      <div><h3>Programs</h3><a href="/for-teams">For teams</a><a href="/ai-income">AI income track</a><a href="/#pricing">Pricing</a></div>
      <div><h3>Company</h3><a href="/business-plan">Business plan</a><a href="/brand-lab">Brand lab</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></div>
    </div><div class="footer-bottom">© ${new Date().getFullYear()} AI FieldGuide Academy. Pre-launch working brand. AI can make mistakes; verify important information. Training and example projections do not guarantee income or employment.</div></div>`;
  }
}

function renderModules() {
  $$('[data-course-grid]').forEach(grid => {
    grid.replaceChildren(...courseData.modules.map(module => {
      const card = el('article', 'card module-card');
      card.innerHTML = `<div class="module-number">MODULE ${String(module.number).padStart(2, '0')}</div><h3>${module.title}</h3><p>${module.outcome}</p><div class="module-meta"><span>${module.duration}</span><span>${module.lessons.length} lessons</span></div>`;
      return card;
    }));
  });
}

function renderReasons() {
  $$('[data-reasons]').forEach(grid => {
    grid.replaceChildren(...courseData.reasons.map((reason, index) => {
      const card = el('article', 'card reason-card');
      card.innerHTML = `<div class="reason-index">${String(index + 1).padStart(2, '0')}</div><h3>${reason.title}</h3><p>${reason.copy}</p>`;
      return card;
    }));
  });
}

function renderPricing() {
  $$('[data-pricing]').forEach(grid => {
    grid.replaceChildren(...courseData.pricing.map(tier => {
      const card = el('article', `card price-card${tier.id === 'pro' ? ' featured' : ''}`);
      card.innerHTML = `<span class="pill">${tier.id === 'pro' ? 'Most practical' : tier.id === 'teams' ? '10 seats' : 'Self-paced'}</span><h3>${tier.name}</h3><div class="price">$${tier.monthly}<small>/month</small></div><p class="audience">${tier.audience}</p><ul>${tier.features.map(feature => `<li>${feature}</li>`).join('')}</ul><button class="btn ${tier.id === 'pro' ? 'btn-primary' : 'btn-ink'}" type="button" data-checkout="${tier.id}">Choose ${tier.name}</button><div class="billing-note">$${tier.annual}/year option · introductory pricing to validate</div>`;
      return card;
    }));
  });
  $$('[data-checkout]').forEach(button => button.addEventListener('click', startCheckout));
}

async function startCheckout(event) {
  const button = event.currentTarget;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'Connecting…';
  try {
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: button.dataset.checkout }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Checkout is unavailable.');
    location.assign(data.url);
  } catch (error) {
    button.textContent = error.message.includes('ready to connect') ? 'Payment link needed' : 'Try again';
    button.title = error.message;
    setTimeout(() => { button.textContent = old; button.disabled = false; }, 3500);
    return;
  }
  button.disabled = false;
}

function renderPrompts() {
  const grid = $('[data-prompts]');
  if (!grid) return;
  grid.replaceChildren(...courseData.prompts.map(prompt => {
    const card = el('article', 'card prompt-card');
    const number = el('div', 'prompt-number', `PROMPT ${String(prompt.number).padStart(2, '0')} · ${prompt.category}`);
    const title = el('h3', '', prompt.name);
    const template = el('div', 'prompt-template', prompt.template);
    const button = el('button', 'btn btn-light btn-small copy-prompt', 'Copy prompt');
    button.type = 'button';
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(prompt.template);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy prompt'; }, 1400);
    });
    card.append(number, title, template, button);
    return card;
  }));
}

function renderDashboard() {
  const root = $('[data-dashboard-modules]');
  if (!root) return;
  const key = 'fieldguideProgress';
  const completed = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  const total = courseData.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const update = () => {
    localStorage.setItem(key, JSON.stringify([...completed]));
    const percent = Math.round((completed.size / total) * 100);
    $('[data-progress-fill]').style.width = `${percent}%`;
    $('[data-progress-text]').textContent = `${completed.size} of ${total} lessons · ${percent}% complete`;
  };
  root.replaceChildren(...courseData.modules.map(module => {
    const card = el('section', 'card');
    card.innerHTML = `<div class="module-number">MODULE ${String(module.number).padStart(2, '0')} · ${module.duration}</div><h2 style="font-size:2rem;margin-top:8px">${module.title}</h2><p>${module.outcome}</p><p class="pill">Project: ${module.project}</p>`;
    module.lessons.forEach((lesson, index) => {
      const id = `${module.id}-${index}`;
      const row = el('label', 'lesson-row');
      const check = document.createElement('input');
      check.type = 'checkbox'; check.checked = completed.has(id);
      check.addEventListener('change', () => { check.checked ? completed.add(id) : completed.delete(id); update(); });
      row.append(check, el('span', '', lesson), el('small', '', 'Mark done'));
      card.append(row);
    });
    return card;
  }));
  update();
}

function wireLeadForms() {
  $$('[data-lead-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = $('.form-status', form);
    const button = $('button[type="submit"]', form);
    status.classList.remove('error'); status.textContent = 'Saving your place…'; button.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(form));
      body.consent = form.elements.consent.checked;
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your email.');
      status.textContent = data.message; form.reset();
    } catch (error) { status.classList.add('error'); status.textContent = error.message; }
    finally { button.disabled = false; }
  }));
}

function wireBrandLab() {
  const verdict = $('[data-brand-verdict]');
  if (!verdict) return;
  const options = [
    { id: '1', name: 'Compass', file: 'logo-1-compass.svg', tagline: 'Learn AI. Apply it. Make it work.' },
    { id: '2', name: 'Trail', file: 'logo-2-trail.svg', tagline: 'Your guided path from curious to capable.' },
    { id: '3', name: 'Signal', file: 'logo-3-signal.svg', tagline: 'Practical AI skills for work and what’s next.' },
    { id: '4', name: 'Bridge', file: 'logo-4-bridge.svg', tagline: 'Better prompts. Smarter workflows. Real progress.' },
    { id: '5', name: 'North Star', file: 'logo-5-northstar.svg', tagline: 'Find your AI advantage—with a guide beside you.' }
  ];
  const selected = localStorage.getItem('fieldguideBrand') || '1';
  const choose = option => {
    localStorage.setItem('fieldguideBrand', option.id);
    verdict.innerHTML = `<p class="eyebrow">Current selection</p><img src="/assets/logos/${option.file}" alt="Selected ${option.name} logo"><p><strong>${option.name}</strong> · ${option.tagline}</p><p class="fine-print">This is a working brand choice. Complete a trademark and domain review before commercial launch.</p>`;
  };
  $$('[data-brand-choice]').forEach(input => {
    input.checked = input.value === selected;
    input.addEventListener('change', () => choose(options.find(option => option.id === input.value)));
  });
  choose(options.find(option => option.id === selected));
}

function installWillie() {
  const root = el('div', 'willie-root');
  root.innerHTML = `<button class="willie-launcher" type="button" aria-label="Ask Willie, your AI Wisdom Guide" aria-expanded="false"><img src="/assets/willie-avatar.webp" alt=""></button>
  <aside class="willie-panel" aria-label="Willie AI Wisdom Guide" aria-hidden="true">
    <header class="willie-panel-head"><img src="/assets/willie-avatar.webp" alt="Willie"><div><strong>Willie · Wisdom Guide</strong><small data-willie-status>Checking connection…</small></div><button class="icon-btn" type="button" data-willie-close aria-label="Close Willie">×</button></header>
    <div><div class="willie-messages" aria-live="polite"><div class="message bot">I’m Willie. I can explain lessons, adapt examples to your job, and help you choose your next step—day or night.</div></div><div class="willie-quick"><button type="button">Explain P.R.O.</button><button type="button">Which module first?</button><button type="button">Help me use AI safely</button></div><div class="willie-tools"><span>AI can make mistakes. Verify important work.</span><button class="icon-btn" type="button" data-voice aria-label="Toggle spoken answers">🔊</button></div></div>
    <form class="willie-form"><label class="sr-only" for="willieInput">Ask Willie</label><textarea id="willieInput" maxlength="4000" placeholder="Ask Willie about this lesson…" required></textarea><button type="submit" aria-label="Send question">➜</button></form>
  </aside>`;
  document.body.append(root);
  const launcher = $('.willie-launcher', root), panel = $('.willie-panel', root), messages = $('.willie-messages', root), form = $('.willie-form', root), input = $('#willieInput', root), status = $('[data-willie-status]', root);
  let voice = localStorage.getItem('fieldguideVoice') === 'on';
  let history = [];
  let sessionId = localStorage.getItem('fieldguideSession');
  if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem('fieldguideSession', sessionId); }
  const open = () => { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); launcher.setAttribute('aria-expanded', 'true'); input.focus(); };
  const close = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); };
  launcher.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
  $('[data-willie-close]', root).addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.classList.contains('open')) close(); });

  const addMessage = (role, text) => { const node = el('div', `message ${role === 'user' ? 'user' : 'bot'}`, text); messages.append(node); messages.scrollTop = messages.scrollHeight; return node; };
  const speak = text => {
    if (!voice || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1800));
    utterance.rate = .97; utterance.pitch = .9;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(item => /david|mark|guy|daniel|george/i.test(item.name)) || voices.find(item => item.lang?.startsWith('en')) || null;
    utterance.onstart = () => root.classList.add('willie-speaking');
    utterance.onend = () => root.classList.remove('willie-speaking');
    speechSynthesis.speak(utterance);
  };
  $('[data-voice]', root).addEventListener('click', event => {
    voice = !voice; localStorage.setItem('fieldguideVoice', voice ? 'on' : 'off'); event.currentTarget.textContent = voice ? '🔊' : '🔇';
    if (!voice && 'speechSynthesis' in window) speechSynthesis.cancel();
  });

  fetch('/api/status').then(response => response.json()).then(data => {
    status.textContent = data.guideReady ? `Ready · ${data.provider}` : 'Connector ready · API key needed';
  }).catch(() => { status.textContent = 'Start the local server to connect'; });

  $$('.willie-quick button', root).forEach(button => button.addEventListener('click', () => { input.value = button.textContent; form.requestSubmit(); }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage('user', question); history.push({ role: 'user', content: question }); input.value = '';
    const waiting = addMessage('bot', 'Thinking…');
    root.classList.add('willie-thinking'); $('button[type="submit"]', form).disabled = true;
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-10), sessionId, pageContext: `${document.title}; ${location.pathname}` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Willie is unavailable.');
      waiting.textContent = data.reply; history.push({ role: 'assistant', content: data.reply }); speak(data.reply);
    } catch (error) {
      waiting.textContent = location.protocol === 'file:' ? 'Start the secure course server, then open http://localhost:8787. Willie cannot connect from a file:// page.' : `${error.message} The course remains available; add the server-side provider key to activate live answers.`;
    } finally { root.classList.remove('willie-thinking'); $('button[type="submit"]', form).disabled = false; input.focus(); }
  });
}

async function init() {
  siteChrome();
  installWillie();
  wireLeadForms();
  wireBrandLab();
  try {
    const response = await fetch('/data/course.json');
    courseData = await response.json();
    renderModules(); renderReasons(); renderPricing(); renderPrompts(); renderDashboard();
  } catch (error) {
    console.error('Course data failed to load', error);
    $$('[data-course-grid], [data-reasons], [data-pricing], [data-prompts]').forEach(node => { node.textContent = 'Start the course server to load this content.'; });
  }
}

init();
