import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC = path.join(os.homedir(), 'ai-video-academy/resources');
const OUT = path.join(SRC, 'pdf');
fs.mkdirSync(OUT, { recursive: true });

const CSS = `
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 10.8pt; line-height: 1.55; color: #1b1d23; margin: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { color: #d23a63; font-size: 21pt; line-height: 1.15; margin: 0 0 6pt 0;
  padding-bottom: 8pt; border-bottom: 2.5pt solid #d23a63; break-after: avoid; }
h2 { color: #16181d; font-size: 14.5pt; margin: 18pt 0 6pt 0; padding-bottom: 4pt;
  border-bottom: 1pt solid #eceef1; break-after: avoid; }
h3 { color: #2b2e36; font-size: 12pt; margin: 13pt 0 4pt 0; break-after: avoid; }
h4 { color: #3a3d45; font-size: 10.8pt; margin: 10pt 0 3pt 0; break-after: avoid; }
p { margin: 5pt 0; }
a { color: #b3294e; text-decoration: none; word-break: break-all; }
ul, ol { margin: 4pt 0 8pt 0; padding-left: 18pt; }
li { margin: 2pt 0; }
strong { color: #16181d; }
hr { border: none; border-top: 1pt solid #eceef1; margin: 14pt 0; }
code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9pt;
  background: #f4f5f7; padding: 1pt 4pt; border-radius: 3px; color: #b3294e; }
pre { background: #16181d; color: #e8eaed; padding: 10pt 12pt; border-radius: 6px;
  overflow-x: auto; font-size: 8.6pt; line-height: 1.45; break-inside: avoid; white-space: pre-wrap; word-break: break-word; }
pre code { background: none; color: #e8eaed; padding: 0; }
blockquote { margin: 8pt 0; padding: 4pt 12pt; border-left: 3pt solid #f0b9c7;
  background: #fdf4f7; color: #4a4d55; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.4pt;
  break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #fbe9ef; color: #16181d; text-align: left; font-weight: 700;
  padding: 5pt 8pt; border: 0.5pt solid #f0c9d6; }
td { padding: 5pt 8pt; border: 0.5pt solid #ececec; vertical-align: top; }
tr:nth-child(even) td { background: #fafbfc; }
img { max-width: 100%; }
`;

const HEADER = `<div style="font-size:8px; width:100%; padding:0 14mm; color:#b3294e; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; display:flex; justify-content:space-between; -webkit-print-color-adjust:exact;">
  <span>AI Video Academy</span><span style="color:#9aa0ab;">Resource Library</span></div>`;

function footer(title){
  const t = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div style="font-size:7.5px; width:100%; padding:0 14mm; color:#9aa0ab; display:flex; justify-content:space-between; -webkit-print-color-adjust:exact;">
    <span>AI Video Academy &middot; ${t}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

function niceTitle(slug){
  const small = new Set(['and','or','the','a','an','to','of','in','on','for','by','vs','with']);
  const acro = {sqlite:'SQLite', crm:'CRM', dm:'DM', ai:'AI', qa:'QA', sop:'SOP', sow:'SOW'};
  const words = slug.replace(/[-_]/g,' ').split(' ');
  return words.map((w,i)=>{
    const lw=w.toLowerCase();
    if(acro[lw]) return acro[lw];
    if(/^[A-Z0-9]{1,3}$/.test(w) && /[A-Z]/.test(w)) return w;
    if(i>0 && small.has(lw)) return lw;
    return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();
  }).join(' ');
}

const mds = fs.readdirSync(SRC).filter(f=>f.endsWith('.md')).sort();
console.log(`Rendering ${mds.length} files with Playwright...`);

const browser = await chromium.launch();
const page = await browser.newPage();
let ok=0; const fail=[];
for(const md of mds){
  const slug = md.slice(0,-3);
  const title = niceTitle(slug);
  let body;
  try {
    body = execFileSync('pandoc', [path.join(SRC,md),'-f','gfm-tex_math_dollars','-t','html','--syntax-highlighting=none'], {encoding:'utf8', maxBuffer:1024*1024*20});
  } catch(e){ fail.push([md,'pandoc']); continue; }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
  await page.setContent(html, {waitUntil:'load'});
  try {
    await page.pdf({
      path: path.join(OUT, `${title}.pdf`),
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: HEADER,
      footerTemplate: footer(title),
      margin: { top: '20mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    ok++;
  } catch(e){ fail.push([md, String(e).slice(0,80)]); }
}
await browser.close();
console.log(`OK: ${ok}  FAIL: ${fail.length}`);
for(const [f,e] of fail) console.log('  FAIL', f, e);
console.log('final pdf count', fs.readdirSync(OUT).filter(f=>f.endsWith('.pdf')).length);
