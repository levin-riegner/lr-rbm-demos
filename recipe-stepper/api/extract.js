const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_HTML_CHARS = 60000;

const SYSTEM_PROMPT = [
  'You extract cookable recipes from web pages.',
  'Return STRICT JSON only with this exact shape:',
  '{ "title": string, "totalTime": string|null, "servings": number|null, "steps": string[] }',
  'Rules for steps:',
  '- One self contained instruction per item, written in active voice.',
  '- Aim for 80 to 200 characters per step. Split very long steps at natural sentence breaks.',
  '- Include all timings, temperatures, and quantities the cook needs at that moment.',
  '- Do NOT prefix with numbers, labels, or markdown.',
  '- Do NOT include the ingredients list as steps.',
  'Output JSON only, no prose, no code fences.',
].join('\n');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJsonLd(html) {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of matches) {
    const inner = block.replace(/^[\s\S]*?<script[^>]*>/i, '').replace(/<\/script>[\s\S]*$/i, '');
    try {
      const parsed = JSON.parse(inner);
      const recipes = collectRecipes(parsed);
      if (recipes.length > 0) return recipes[0];
    } catch (_) {}
  }
  return null;
}

function collectRecipes(node) {
  const out = [];
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((n) => out.push(...collectRecipes(n)));
    return out;
  }
  if (typeof node === 'object') {
    const t = node['@type'];
    const isRecipe = t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
    if (isRecipe) out.push(node);
    if (Array.isArray(node['@graph'])) out.push(...collectRecipes(node['@graph']));
  }
  return out;
}

function fromJsonLd(recipe) {
  const steps = [];
  const inst = recipe.recipeInstructions;
  const push = (s) => { if (typeof s === 'string' && s.trim()) steps.push(s.trim()); };
  if (typeof inst === 'string') {
    inst.split(/(?:\r?\n|\.\s+(?=[A-Z]))/).forEach(push);
  } else if (Array.isArray(inst)) {
    inst.forEach((it) => {
      if (!it) return;
      if (typeof it === 'string') push(it);
      else if (it['@type'] === 'HowToStep' && it.text) push(it.text);
      else if (it['@type'] === 'HowToSection' && Array.isArray(it.itemListElement)) {
        it.itemListElement.forEach((sub) => { if (sub && sub.text) push(sub.text); });
      } else if (it.text) push(it.text);
    });
  }
  if (steps.length === 0) return null;
  return {
    title: typeof recipe.name === 'string' ? recipe.name : 'Recipe',
    totalTime: typeof recipe.totalTime === 'string' ? recipe.totalTime : null,
    servings: recipe.recipeYield ? parseInt(String(recipe.recipeYield), 10) || null : null,
    steps: steps,
  };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function callAnthropic(text, sourceUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const body = {
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: 'Source URL: ' + sourceUrl + '\n\nPage text (truncated):\n' + text,
      },
    ],
  };

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error('Anthropic API ' + response.status + ': ' + errText.slice(0, 200));
  }
  const data = await response.json();
  const block = (data.content || []).find((c) => c.type === 'text');
  if (!block) throw new Error('No text content in model response');
  const cleaned = block.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Model returned no steps');
  }
  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Recipe',
    totalTime: typeof parsed.totalTime === 'string' ? parsed.totalTime : null,
    servings: typeof parsed.servings === 'number' ? parsed.servings : null,
    steps: parsed.steps.filter((s) => typeof s === 'string' && s.trim().length > 0),
  };
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'POST only' }));
  }

  let url;
  try {
    const body = await readJsonBody(req);
    url = body && body.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('body.url must be an http(s) URL');
    }
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }

  try {
    const pageRes = await fetch(url, {
      headers: { 'user-agent': 'recipe-stepper/1.0 (+meta-wearables-webapp)' },
      redirect: 'follow',
    });
    if (!pageRes.ok) throw new Error('Page fetch returned ' + pageRes.status);
    const html = await pageRes.text();

    const ldRecipe = extractJsonLd(html);
    if (ldRecipe) {
      const built = fromJsonLd(ldRecipe);
      if (built) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(built));
      }
    }

    const text = stripHtml(html).slice(0, MAX_HTML_CHARS);
    const result = await callAnthropic(text, url);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: err.message || 'extract failed' }));
  }
};
