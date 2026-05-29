import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const articleDir = path.join(root, 'content/articles');
const outDir = path.join(root, 'seo-dist');
const site = 'https://sourcingos.com';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
function parseMd(raw){
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {}; let body = raw;
  if(m){
    for(const line of m[1].split('\n')){ const idx=line.indexOf(':'); if(idx>0) meta[line.slice(0,idx).trim()] = line.slice(idx+1).trim(); }
    body = m[2];
  }
  return { meta, body };
}
function esc(s){ return String(s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function mdToHtml(md){
  let html = '';
  const lines = md.split('\n');
  let inCode = false, code = [];
  for(let line of lines){
    if(line.startsWith('```')){ if(!inCode){ inCode=true; code=[]; } else { html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; inCode=false; } continue; }
    if(inCode){ code.push(line); continue; }
    if(line.startsWith('# ')) html += `<h1>${esc(line.slice(2))}</h1>`;
    else if(line.startsWith('## ')) html += `<h2>${esc(line.slice(3))}</h2>`;
    else if(line.startsWith('### ')) html += `<h3>${esc(line.slice(4))}</h3>`;
    else if(line.startsWith('- ')) html += `<li>${esc(line.slice(2))}</li>`;
    else if(/^\d+\. /.test(line)) html += `<li>${esc(line.replace(/^\d+\. /,''))}</li>`;
    else if(line.trim()) html += `<p>${esc(line)}</p>`;
  }
  return html.replace(/(<li>.*?<\/li>)(?!(<li>|<\/ul>))/gs, '<ul>$1</ul>').replace(/<\/ul><ul>/g,'');
}
function layout({title, description, canonical, content}){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="article"><style>body{margin:0;background:#08111f;color:#eaf2ff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.65}.wrap{max-width:980px;margin:auto;padding:40px 22px}a{color:#67e8f9}.nav{display:flex;justify-content:space-between;gap:18px;align-items:center;border-bottom:1px solid #22314d;padding-bottom:18px;margin-bottom:34px}.nav strong{font-size:20px}.pill{display:inline-block;border:1px solid #2f4568;background:#0d1b2f;padding:4px 10px;border-radius:999px;color:#93c5fd;font-size:13px}h1{font-size:44px;line-height:1.05;margin:18px 0}h2{font-size:28px;margin-top:44px;color:#f8fafc}p,li{color:#cbd5e1;font-size:17px}pre{background:#020617;border:1px solid #334155;border-radius:14px;padding:18px;overflow:auto}code{color:#a7f3d0}.cta{margin-top:42px;padding:24px;border:1px solid #2563eb;border-radius:18px;background:linear-gradient(135deg,#0b1f3f,#071527)}.muted{color:#94a3b8}</style></head><body><main class="wrap"><div class="nav"><strong>SourcingOS</strong><span class="pill">Public SEO Export</span></div>${content}<div class="cta"><h2>Build this search in SourcingOS</h2><p>Use the free tools for Boolean, X-Ray, and JD strategy. Join the private beta for Candidate 360, Evidence Matrix, project memory, and rediscovery.</p><p><a href="${site}/waitlist">Join the private beta waitlist →</a></p></div><p class="muted">Generated from the SourcingOS V16.4 static SEO export.</p></main></body></html>`;
}
const pages=[];
// home
fs.writeFileSync(path.join(outDir,'index.html'), layout({title:'SourcingOS — Find who your search missed', description:'Free sourcing tools, search methods, recruiting tool intelligence, and private beta access for senior sourcers working hard-to-fill roles.', canonical:site+'/', content:'<h1>Find who your search missed.</h1><p>SourcingOS helps senior sourcers turn hard-to-fill roles into source packs, Boolean strings, X-Ray searches, evidence-backed profiles, and hiring-manager-ready summaries.</p><h2>Start with the free tools</h2><ul><li>BooleanOS</li><li>X-Ray Launcher</li><li>JD Strategy Tool</li><li>Recruiting Tool Directory</li><li>Sourcing Methods Library</li></ul>'}));
pages.push('/');
for(const file of fs.readdirSync(articleDir).filter(f=>f.endsWith('.md'))){
  const raw = fs.readFileSync(path.join(articleDir,file),'utf8');
  const {meta, body} = parseMd(raw);
  const slug = meta.slug || file.replace(/\.md$/,'');
  const dir = path.join(outDir,'blog',slug); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'), layout({title: meta.title, description: meta.description, canonical: `${site}/blog/${slug}`, content:`<span class="pill">${esc(meta.category||'Guide')}</span>`+mdToHtml(body)}));
  pages.push(`/blog/${slug}`);
}
// simple tool pages
const toolPages = [
 ['tools/boolean-generator','BooleanOS — Free Boolean Generator','Generate recruiter-ready Boolean strings for cleared, cyber, healthcare, AI/ML, and technical roles.'],
 ['tools/xray-search','SourcingOS X-Ray Launcher','Launch source-specific Google X-Ray searches for LinkedIn, GitHub, resumes, and target company pages.'],
 ['tools/jd-search-strategy','JD Search Strategy Tool','Turn messy job descriptions into search lanes, must-have evidence, and first-pass Boolean strings.'],
 ['directory','Recruiting Tool Directory','Recruiting tools mapped by workflow: sourcing, contact data, outreach, CRM, job boards, and public evidence.'],
 ['methods','Sourcing Methods Library','Practical sourcing methods for hard-to-fill roles, including source packs, X-Ray, GitHub, cleared, cyber, and healthcare searches.'],
 ['waitlist','SourcingOS Private Beta Waitlist','Request private beta access to Candidate 360, Evidence Matrix, project memory, and rediscovery.']
];
for(const [slug,title,description] of toolPages){ const dir=path.join(outDir,slug); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'), layout({title,description,canonical:`${site}/${slug}`,content:`<h1>${title}</h1><p>${description}</p><p>This page is part of the public SourcingOS SEO shell. The interactive version lives in the app build.</p>`})); pages.push('/'+slug); }
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${site}${p}</loc></url>`).join('')}</urlset>`;
fs.writeFileSync(path.join(outDir,'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(outDir,'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://sourcingos.com/sitemap.xml\n');
console.log(`Generated ${pages.length} SEO pages in seo-dist`);
