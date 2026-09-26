// Painel das ofertas: npm run painel → http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

if (!fs.existsSync('ofertas.db')) { console.error('Rode "npm run coletar" primeiro.'); process.exit(1); }
const db = new DatabaseSync('ofertas.db', { readOnly: true });

// Uma linha por página, na última medição. Com um único MIN(), o SQLite pega as colunas soltas
// (link, texto, domínio...) da mesma linha do anúncio mais antigo — o criativo que mais se provou.
const consulta = db.prepare(`
  SELECT m.page_id, a.page_name, a.nicho, m.ativos, m.dia,
    m.ativos - (SELECT o.ativos FROM medicoes o WHERE o.page_id = m.page_id
                AND o.dia >= date(m.dia, '-7 day') AND o.dia < m.dia ORDER BY o.dia LIMIT 1) AS cresc7d,
    CAST((unixepoch() - MIN(a.inicio)) / 86400 AS INTEGER) AS dias,
    a.dominio, a.link, a.texto, a.ad_id
  FROM medicoes m
  JOIN anuncios a ON a.page_id = m.page_id AND a.visto_em = m.dia
  WHERE m.dia = (SELECT MAX(dia) FROM medicoes WHERE page_id = m.page_id)
  GROUP BY m.page_id
`);

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ofertas escaladas</title>
<style>
:root { --bg:#fafaf9; --fg:#1c1917; --mut:#78716c; --line:#e7e5e4; --card:#fff; --up:#15803d; --down:#b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg:#0c0a09; --fg:#f5f5f4; --mut:#a8a29e; --line:#292524; --card:#1c1917; --up:#4ade80; --down:#f87171; } }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg); font:14px/1.45 system-ui, sans-serif; }
h1 { font-size:20px; margin:0 0 4px; }
p { color:var(--mut); margin:0 0 16px; }
.filtros { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center; margin-bottom:16px; }
input { font:inherit; padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:var(--card); color:var(--fg); }
input[type=number] { width:64px; }
#total { color:var(--mut); }
.tabela { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:var(--card); }
table { border-collapse:collapse; width:100%; }
th, td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
th button { all:unset; cursor:pointer; font-weight:600; white-space:nowrap; }
th button:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
.n { text-align:right; font-variant-numeric:tabular-nums; }
.up { color:var(--up); } .down { color:var(--down); }
.txt { min-width:260px; max-width:420px; color:var(--mut); }
a { color:inherit; }
</style></head><body>
<h1>Ofertas escaladas</h1>
<p>Páginas anunciando no Brasil. Muitos anúncios ativos + anúncio velho no ar = oferta que paga a conta.</p>
<div class="filtros">
  <input id="q" type="search" placeholder="Buscar página, domínio, texto…" aria-label="Buscar">
  <label>Mín. ativos <input id="minAtivos" type="number" min="0" value="5"></label>
  <label>Mín. dias no ar <input id="minDias" type="number" min="0" value="0"></label>
  <label><input id="semRedes" type="checkbox" checked> Esconder redes e marketplaces</label>
  <span id="total"></span>
</div>
<div class="tabela"><table>
<thead><tr>
  <th><button data-k="page_name">Página</button></th><th><button data-k="nicho">Nicho</button></th>
  <th class="n"><button data-k="ativos">Ativos</button></th><th class="n"><button data-k="cresc7d">Δ 7 dias</button></th>
  <th class="n"><button data-k="dias">Dias no ar</button></th><th><button data-k="dominio">Domínio</button></th>
  <th>Anúncio mais antigo</th><th><button data-k="dia">Medido em</button></th>
</tr></thead>
<tbody id="linhas"></tbody></table></div>
<script>
const DADOS = __DADOS__;
const REDES = /instagram|whatsapp|wa\\.me|facebook|fb\\.me|mercadolivre|shopee|amazon|magazineluiza|play\\.google|apps\\.apple/;
const $ = id => document.getElementById(id);
let chave = 'ativos', desc = true;

function cel(tr, texto, cls, href) {
  const td = tr.insertCell();
  if (cls) td.className = cls;
  if (href && /^https?:\\/\\//.test(href)) {
    const a = document.createElement('a');
    Object.assign(a, { href, target: '_blank', rel: 'noopener noreferrer', textContent: texto });
    td.append(a);
  } else td.textContent = texto;
}

function render() {
  const q = $('q').value.toLowerCase(), minA = +$('minAtivos').value, minD = +$('minDias').value, semRedes = $('semRedes').checked;
  const linhas = DADOS
    .filter(r => r.ativos >= minA && r.dias >= minD && !(semRedes && REDES.test(r.dominio))
      && [r.page_name, r.dominio, r.texto, r.nicho].join(' ').toLowerCase().includes(q))
    .sort((a, b) => ((a[chave] ?? -1e9) > (b[chave] ?? -1e9) ? 1 : (a[chave] ?? -1e9) < (b[chave] ?? -1e9) ? -1 : 0) * (desc ? -1 : 1));
  $('linhas').replaceChildren(...linhas.map(r => {
    const tr = document.createElement('tr');
    cel(tr, r.page_name, '', 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&search_type=page&view_all_page_id=' + r.page_id);
    cel(tr, r.nicho);
    cel(tr, r.ativos, 'n');
    cel(tr, r.cresc7d == null ? '—' : (r.cresc7d > 0 ? '+' : '') + r.cresc7d, 'n ' + (r.cresc7d > 0 ? 'up' : r.cresc7d < 0 ? 'down' : ''));
    cel(tr, r.dias, 'n');
    cel(tr, r.dominio || '—', '', r.link);
    cel(tr, (r.texto || '(sem texto)').slice(0, 160), 'txt', 'https://www.facebook.com/ads/library/?id=' + r.ad_id);
    cel(tr, r.dia);
    return tr;
  }));
  $('total').textContent = linhas.length + ' de ' + DADOS.length + ' páginas';
}

document.querySelectorAll('th button').forEach(b => b.onclick = () => {
  desc = chave === b.dataset.k ? !desc : true;
  chave = b.dataset.k;
  render();
});
for (const id of ['q', 'minAtivos', 'minDias', 'semRedes']) $(id).addEventListener('input', render);
render();
</script></body></html>`;

http.createServer((req, res) => {
  const dados = JSON.stringify(consulta.all()).replace(/</g, '\\u003c'); // texto de anúncio não fecha o <script>
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML.replace('__DADOS__', () => dados));
}).listen(3000, '127.0.0.1', () => console.log('Painel em http://localhost:3000'));
