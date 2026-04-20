const SUPABASE_URL = 'https://pkootwezezmqwopveigu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrb290d2V6ZXptcXdvcHZlaWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAyMDE1MiwiZXhwIjoyMDkxNTk2MTUyfQ.Xwj-X0co_aQMLFFWhnzuazs7iVz7Yzztx5k-IYe2x6Q';
const VOYAGE_KEY = 'pa-subXscuX1onmIGPmhWxZ73eMzLK52OHSCefMPAp-g1b';
const KB_URL = 'https://raw.githubusercontent.com/nathanw-hash/Love-Your-Liver/main/lyl_knowledge_base.json';

async function fetchKnowledgeBase() {
  const res = await fetch(KB_URL);
  if (!res.ok) throw new Error('Failed to fetch: ' + res.status);
  return res.json();
}

async function generateEmbedding(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + VOYAGE_KEY },
    body: JSON.stringify({ input: [text], model: 'voyage-3' }),
  });
  if (!res.ok) throw new Error('Voyage failed: ' + await res.text());
  const data = await res.json();
  return data.data[0].embedding;
}

async function upsertEntry(entry, embedding) {
  const payload = {
    entry_id: entry.id, title: entry.title, category: entry.category,
    subcategory: entry.subcategory || null, tags: entry.tags || [],
    content: buildContentString(entry), summary: entry.summary || null,
    cross_refs: entry.cross_refs || [], app_note: entry.app_note || null,
    embedding: embedding, updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal', 'Resolution': 'merge-duplicates' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Upsert failed: ' + await res.text());
}

function buildContentString(entry) {
  const SKIP = new Set(['id','category','subcategory','title','source','tags','summary','app_note','cross_refs','embedding']);
  const parts = [];
  for (const [key, val] of Object.entries(entry)) {
    if (SKIP.has(key)) continue;
    if (!val) continue;
    const label = key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    parts.push('## ' + label);
    parts.push(extractText(val));
  }
  return parts.filter(Boolean).join('\n\n').substring(0,8000);
}

function extractText(obj, depth = 0) {
  if (depth > 6) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) return obj.map(i => extractText(i, depth + 1)).filter(Boolean).join('\n');
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj).map(([k, v]) => { const val = extractText(v, depth + 1); return val ? `${k}: ${val}` : ''; }).filter(Boolean).join('\n');
  }
  return '';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Fetching LYL knowledge base...');
  const kb = await fetchKnowledgeBase();
  const entries = kb.entries || [];
  console.log(`Found ${entries.length} entries\n`);
  let success = 0, failed = 0;
  const errors = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    process.stdout.write(`[${i+1}/${entries.length}] ${entry.id}... `);
    try {
      const content = buildContentString(entry);
      const embedding = await generateEmbedding(content);
      await upsertEntry(entry, embedding);
      console.log(`OK (${embedding.length}d)`);
      success++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      errors.push({ id: entry.id, error: err.message });
      failed++;
    }
    if (i < entries.length - 1) await sleep(300);
  }
  console.log(`\nComplete: ${success} succeeded, ${failed} failed`);
  if (errors.length > 0) { console.log('\nFailed:'); errors.forEach(e => console.log(`  ${e.id}: ${e.error}`)); }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
