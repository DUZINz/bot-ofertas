// Painel das ofertas: npm run painel → http://localhost:3000  (outra porta: PORT=3001 npm run painel)
import http from 'node:http';
import { db } from './banco.mjs';

const PORTA = process.env.PORT || 3000;

// Uma linha por página, na última medição. Com um único MIN(), o SQLite pega as colunas soltas
// (link, texto, imagem...) da mesma linha do anúncio mais antigo — o criativo que mais se provou.
const ofertas = db.prepare(`
  SELECT m.page_id, a.page_name, a.nicho, m.ativos, m.dia,
    m.ativos - (SELECT o.ativos FROM medicoes o WHERE o.page_id = m.page_id
                AND o.dia >= date(m.dia, '-7 day') AND o.dia < m.dia ORDER BY o.dia LIMIT 1) AS cresc7d,
    MIN(a.inicio) AS inicio, a.dominio, a.link, a.texto, a.ad_id, a.imagem
  FROM medicoes m
  JOIN anuncios a ON a.page_id = m.page_id AND a.visto_em = m.dia
  WHERE m.dia = (SELECT MAX(dia) FROM medicoes WHERE page_id = m.page_id)
  GROUP BY m.page_id
`);
const historico = db.prepare(`SELECT page_id, dia, ativos FROM medicoes WHERE dia >= date('now', 'localtime', '-30 day') ORDER BY dia`);
const ultimaColeta = db.prepare('SELECT MAX(dia) AS dia FROM medicoes');

function dados() {
  const hist = {};
  for (const h of historico.all()) (hist[h.page_id] ??= []).push([h.dia, h.ativos]);
  return { ofertas: ofertas.all(), hist, ultima: ultimaColeta.get().dia };
}

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ofertas escaladas</title>
<style>
:root {
  color-scheme: light;
  --plano:#f9f9f7; --sup:#fcfcfb; --sup-2:#f2f1ed;
  --tinta:#0b0b0b; --tinta-2:#52514e; --tinta-3:#898781;
  --grade:#e1e0d9; --borda:rgba(11,11,11,.10);
  --azul:#2a78d6; --azul-lav:rgba(42,120,214,.10);
  --sobe:#006300; --desce:#d03b3b; --bom:#0ca30c; --alerta:#fab219;
  --sombra:0 1px 2px rgba(11,11,11,.04), 0 6px 20px rgba(11,11,11,.04);
}
@media (prefers-color-scheme: dark) { :root {
  color-scheme: dark;
  --plano:#0d0d0d; --sup:#1a1a19; --sup-2:#242422;
  --tinta:#fff; --tinta-2:#c3c2b7; --tinta-3:#898781;
  --grade:#2c2c2a; --borda:rgba(255,255,255,.10);
  --azul:#3987e5; --azul-lav:rgba(57,135,229,.16);
  --sobe:#0ca30c; --desce:#e05555;
  --sombra:none;
} }
* { box-sizing:border-box; }
body { margin:0; background:var(--plano); color:var(--tinta); font:14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:1240px; margin:0 auto; padding:32px 16px 48px; }
a { color:inherit; }
button, select, input { font:inherit; color:inherit; }
:focus-visible { outline:2px solid var(--azul); outline-offset:2px; }

.topo { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:8px 24px; margin-bottom:24px; }
h1 { font-size:24px; font-weight:650; letter-spacing:-.01em; margin:0 0 2px; }
.sub { color:var(--tinta-2); margin:0; }
details { color:var(--tinta-2); font-size:13px; max-width:520px; }
summary { cursor:pointer; color:var(--tinta); font-weight:500; }
details dl { margin:8px 0 0; display:grid; grid-template-columns:auto 1fr; gap:4px 12px; }
details dt { color:var(--tinta); font-weight:500; }
details dd { margin:0; }

.kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:20px; }
@media (max-width:520px) { .kpi { padding:12px 14px; } .kpi-val { font-size:24px; } }
.kpi { all:unset; box-sizing:border-box; cursor:pointer; display:flex; flex-direction:column; gap:2px; padding:16px 18px;
  background:var(--sup); border:1px solid var(--borda); border-radius:12px; box-shadow:var(--sombra); transition:border-color .15s; }
.kpi:hover { border-color:var(--tinta-3); }
.kpi[aria-pressed="true"] { border-color:var(--azul); box-shadow:inset 0 0 0 1px var(--azul), var(--sombra); }
.kpi:focus-visible { outline:2px solid var(--azul); outline-offset:2px; }
.kpi-rot { display:flex; align-items:center; gap:6px; color:var(--tinta-2); font-size:13px; font-weight:500; }
.kpi-val { font-size:30px; font-weight:600; line-height:1.2; }
.kpi-sub { color:var(--tinta-2); font-size:12px; }

.filtros { display:flex; flex-wrap:wrap; align-items:center; gap:10px 12px; margin-bottom:12px; }
.filtros input[type=search], .filtros select { height:36px; padding:0 12px; border:1px solid var(--borda); border-radius:8px; background:var(--sup); }
.filtros input[type=search] { flex:1 1 240px; max-width:360px; }
.filtros label { display:flex; align-items:center; gap:8px; color:var(--tinta-2); cursor:pointer; }
.filtros input[type=checkbox] { width:16px; height:16px; accent-color:var(--azul); margin:0; }
#contagem { margin-left:auto; color:var(--tinta-2); font-size:13px; }

.cartao { background:var(--sup); border:1px solid var(--borda); border-radius:12px; box-shadow:var(--sombra); overflow-x:auto; }
table { width:100%; min-width:940px; border-collapse:collapse; }
th { text-align:left; font-size:12px; font-weight:500; color:var(--tinta-2); padding:12px 16px; border-bottom:1px solid var(--grade); white-space:nowrap; }
th button { all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
th button:hover { color:var(--tinta); }
th button:focus-visible { outline:2px solid var(--azul); outline-offset:2px; border-radius:4px; }
th .seta { width:10px; opacity:0; }
th[aria-sort] { color:var(--tinta); }
th[aria-sort] .seta { opacity:1; }
td { padding:14px 16px; border-bottom:1px solid var(--grade); vertical-align:middle; }
tbody tr:last-child td { border-bottom:0; }
tbody tr:hover { background:var(--sup-2); }

.oferta { display:flex; gap:14px; align-items:center; min-width:340px; }
.thumb { flex:none; width:56px; height:56px; border-radius:8px; overflow:hidden; background:var(--sup-2);
  border:1px solid var(--borda); display:grid; place-items:center; font-weight:600; font-size:20px; color:var(--tinta-3); text-decoration:none; }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.info { min-width:0; }
.nome { font-weight:600; text-decoration:none; }
.nome:hover { text-decoration:underline; }
.meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:var(--tinta-2); margin-top:1px; }
.pilula { padding:0 8px; border-radius:999px; background:var(--sup-2); border:1px solid var(--borda); }
.texto { font-size:12.5px; color:var(--tinta-2); margin-top:4px; max-width:440px;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

.selo { --c:var(--tinta-3); display:inline-flex; align-items:center; gap:6px; padding:3px 10px 3px 8px; border-radius:999px;
  font-size:12px; font-weight:500; white-space:nowrap; background:color-mix(in srgb, var(--c) 14%, transparent); }
.selo svg, .kpi-rot svg { color:var(--c); flex:none; }
.validada { --c:var(--bom); } .nova { --c:var(--alerta); } .teste { --c:var(--tinta-3); }

.vol { display:flex; flex-direction:column; gap:6px; min-width:130px; }
.vol-n { font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
.trilho { display:block; width:130px; height:6px; border-radius:3px; background:var(--grade); }
.barra { display:block; height:100%; min-width:2px; border-radius:0 3px 3px 0; background:var(--azul); }

.tend { display:flex; flex-direction:column; gap:2px; min-width:120px; }
.spark { display:block; cursor:crosshair; }
.delta { font-size:12px; font-weight:500; white-space:nowrap; }
.sobe { color:var(--sobe); } .desce { color:var(--desce); } .igual, .vazio { color:var(--tinta-2); }
.vazio { font-size:12px; }

.idade b { display:block; font-weight:600; }
.idade { white-space:nowrap; }
.idade span { font-size:12px; color:var(--tinta-2); }

.acoes { display:flex; gap:6px; }
.botao { display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:8px; border:1px solid var(--borda);
  font-size:12.5px; font-weight:500; text-decoration:none; white-space:nowrap; background:var(--sup); }
.botao:hover { background:var(--sup-2); }

.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.nada { text-align:center; color:var(--tinta-2); padding:48px 16px; }
#dica { position:fixed; pointer-events:none; opacity:0; transition:opacity .1s; background:var(--tinta); color:var(--plano);
  font-size:12px; padding:6px 8px; border-radius:6px; white-space:nowrap; z-index:10; }
</style></head><body>
<main>
  <header class="topo">
    <div>
      <h1>Ofertas escaladas</h1>
      <p class="sub">Biblioteca de Anúncios da Meta · Brasil · <span id="ultima"></span></p>
    </div>
    <details>
      <summary>Como ler este painel</summary>
      <dl>
        <dt>Anúncios ativos</dt><dd>Quantos anúncios a página tem no ar hoje. Muito anúncio = verba alta = oferta vendendo.</dd>
        <dt>No ar há</dt><dd>Idade do anúncio mais antigo ainda ativo. Ninguém paga meses de anúncio que dá prejuízo.</dd>
        <dt>Tendência</dt><dd>Anúncios ativos nos últimos 30 dias de coleta. Subindo = escalando agora.</dd>
      </dl>
    </details>
  </header>

  <section class="kpis" aria-label="Resumo e filtro por situação">
    <button class="kpi" data-status="todas"><span class="kpi-rot">Páginas monitoradas</span><span class="kpi-val" id="k-todas"></span><span class="kpi-sub" id="k-todas-sub"></span></button>
    <button class="kpi validada" data-status="validada"><span class="kpi-rot" data-icone="check">Validadas</span><span class="kpi-val" id="k-validada"></span><span class="kpi-sub">30+ dias no ar e 50+ anúncios</span></button>
    <button class="kpi nova" data-status="nova"><span class="kpi-rot" data-icone="raio">Novas e fortes</span><span class="kpi-val" id="k-nova"></span><span class="kpi-sub">Menos de 30 dias e 100+ anúncios</span></button>
    <button class="kpi" data-status="escalando"><span class="kpi-rot" data-icone="sobe">Escalando</span><span class="kpi-val" id="k-escalando"></span><span class="kpi-sub" id="k-escalando-sub"></span></button>
  </section>

  <div class="filtros">
    <input id="busca" type="search" placeholder="Buscar página, domínio ou texto do anúncio" aria-label="Buscar">
    <select id="nicho" aria-label="Nicho"><option value="">Todos os nichos</option></select>
    <label><input id="semRedes" type="checkbox" checked> Esconder redes sociais e marketplaces</label>
    <span id="contagem" aria-live="polite"></span>
  </div>

  <div class="cartao">
    <table>
      <thead><tr>
        <th data-k="page_name"><button>Oferta <svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th>Situação</th>
        <th data-k="ativos"><button>Anúncios ativos <svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th data-k="cresc7d"><button>Tendência · 30 dias <svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th data-k="dias"><button>No ar há <svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th><span class="sr">Links</span></th>
      </tr></thead>
      <tbody id="linhas"></tbody>
    </table>
  </div>
</main>
<div id="dica" role="tooltip"></div>
<script>
const { ofertas: DADOS, hist: HIST, ultima: ULTIMA } = __DADOS__;
const REDES = /instagram|whatsapp|wa\\.me|facebook|fb\\.me|mercadolivre|shopee|amazon|magazineluiza|play\\.google|apps\\.apple/;
const ICONES = {
  check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  raio: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.2 1 3 9.2h4.3L6.4 15 13 6.6H8.6z"/></svg>',
  ponto: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2.5 2.5" aria-hidden="true"><circle cx="8" cy="8" r="5"/></svg>',
  sobe: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--sobe)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12l4.5-4.5 3 3L14 6M10 6h4v4"/></svg>',
  fora: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>',
};
const SITUACAO = {
  validada: { rotulo: 'Validada', icone: 'check' },
  nova: { rotulo: 'Nova e forte', icone: 'raio' },
  teste: { rotulo: 'Em teste', icone: 'ponto' },
};

const $ = id => document.getElementById(id);
const num = n => n.toLocaleString('pt-BR');
const diaBR = d => d.split('-').reverse().join('/');
const seguro = u => typeof u === 'string' && /^https?:\\/\\//.test(u);
function svg(html) { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstChild; } // só constantes, nunca dado de anúncio
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k === 'class' ? (e.className = v) : k.includes('-') ? e.setAttribute(k, v) : (e[k] = v);
  e.append(...filhos.filter(f => f != null && f !== false));
  return e;
}

const agora = Date.now() / 1000;
for (const r of DADOS) {
  r.dias = r.inicio ? Math.max(0, Math.floor((agora - r.inicio) / 86400)) : 0;
  r.situacao = r.dias >= 30 && r.ativos >= 50 ? 'validada' : r.dias < 30 && r.ativos >= 100 ? 'nova' : 'teste';
  r.hist = HIST[r.page_id] ?? [];
}
const temHistorico = DADOS.some(r => r.cresc7d != null);

const estado = { situacao: 'todas', nicho: '', busca: '', semRedes: true, chave: 'ativos', desc: true };

// Minigráfico: linha 2px, lavagem 10%, ponto final com anel na cor da superfície, dica ao passar o mouse.
function sparkline(pts) {
  if (pts.length < 2) return el('span', { class: 'vazio', title: 'A tendência aparece a partir do 2º dia de coleta' }, '1ª medição');
  const W = 112, H = 34, P = 6, vals = pts.map(p => p[1]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = i => P + i * (W - 2 * P) / (pts.length - 1);
  const y = v => max === min ? H / 2 : H - P - (v - min) / (max - min) * (H - 2 * P);
  const linha = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
  const ult = pts.length - 1;
  const g = svg('<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img">'
    + '<polygon points="' + x(0) + ',' + (H - 2) + ' ' + linha + ' ' + x(ult) + ',' + (H - 2) + '" fill="var(--azul)" opacity=".1"/>'
    + '<polyline points="' + linha + '" fill="none" stroke="var(--azul)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle class="cursor" r="4" fill="var(--azul)" stroke="var(--sup)" stroke-width="2" cx="' + x(ult) + '" cy="' + y(pts[ult][1]) + '"/></svg>');
  g.setAttribute('aria-label', 'Anúncios ativos: ' + pts.map(p => diaBR(p[0]) + ' ' + p[1]).join(', '));
  const cursor = g.querySelector('.cursor'), dica = $('dica');
  g.onmousemove = ev => {
    const i = Math.max(0, Math.min(ult, Math.round((ev.offsetX - P) / ((W - 2 * P) / ult))));
    cursor.setAttribute('cx', x(i)); cursor.setAttribute('cy', y(pts[i][1]));
    dica.textContent = diaBR(pts[i][0]) + ' · ' + num(pts[i][1]) + ' anúncios';
    dica.style.left = ev.clientX + 12 + 'px'; dica.style.top = ev.clientY - 32 + 'px'; dica.style.opacity = 1;
  };
  g.onmouseleave = () => { dica.style.opacity = 0; cursor.setAttribute('cx', x(ult)); cursor.setAttribute('cy', y(pts[ult][1])); };
  return g;
}

function delta(c) {
  if (c == null) return null;
  if (c === 0) return el('span', { class: 'delta igual' }, 'estável em 7 dias');
  return el('span', { class: 'delta ' + (c > 0 ? 'sobe' : 'desce') }, (c > 0 ? '▲ ' : '▼ ') + num(Math.abs(c)) + ' em 7 dias');
}

function thumb(r) {
  const letra = () => el('span', { 'aria-hidden': 'true' }, ((r.page_name || '').trim()[0] || '?').toUpperCase());
  const caixa = el('a', { class: 'thumb', href: 'https://www.facebook.com/ads/library/?id=' + r.ad_id, target: '_blank', rel: 'noopener noreferrer', title: 'Ver o anúncio mais antigo' });
  if (seguro(r.imagem)) {
    const img = el('img', { src: r.imagem, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
    img.onerror = () => img.replaceWith(letra());
    caixa.append(img);
  } else caixa.append(letra());
  return caixa;
}

function linha(r, max) {
  const s = SITUACAO[r.situacao];
  const libPagina = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&search_type=page&view_all_page_id=' + r.page_id;
  return el('tr', {},
    el('td', {}, el('div', { class: 'oferta' },
      thumb(r),
      el('div', { class: 'info' },
        el('a', { class: 'nome', href: libPagina, target: '_blank', rel: 'noopener noreferrer' }, r.page_name || r.page_id),
        el('div', { class: 'meta' }, r.dominio || 'sem site', el('span', { class: 'pilula' }, r.nicho)),
        r.texto && el('div', { class: 'texto', title: r.texto }, r.texto)))),
    el('td', {}, el('span', { class: 'selo ' + r.situacao }, svg(ICONES[s.icone]), s.rotulo)),
    el('td', {}, el('div', { class: 'vol' },
      el('span', { class: 'vol-n' }, num(r.ativos)),
      el('span', { class: 'trilho' }, el('span', { class: 'barra', style: 'width:' + (r.ativos / max * 100).toFixed(1) + '%' })))),
    el('td', {}, el('div', { class: 'tend' }, sparkline(r.hist), delta(r.cresc7d))),
    el('td', { class: 'idade' }, el('b', {}, r.dias === 1 ? '1 dia' : num(r.dias) + ' dias'),
      r.inicio && el('span', {}, 'desde ' + new Date(r.inicio * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }))),
    el('td', {}, el('div', { class: 'acoes' },
      el('a', { class: 'botao', href: libPagina, target: '_blank', rel: 'noopener noreferrer' }, 'Anúncios', svg(ICONES.fora)),
      seguro(r.link) && el('a', { class: 'botao', href: r.link, target: '_blank', rel: 'noopener noreferrer' }, 'Site', svg(ICONES.fora)))));
}

function comparar(a, b) {
  const x = a[estado.chave], y = b[estado.chave];
  const r = estado.chave === 'page_name' ? String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR') : (x ?? -1e15) - (y ?? -1e15);
  return estado.desc ? -r : r;
}

function render() {
  const q = estado.busca.toLowerCase();
  const base = DADOS.filter(r => (!estado.nicho || r.nicho === estado.nicho) && !(estado.semRedes && REDES.test(r.dominio || ''))
    && [r.page_name, r.dominio, r.texto].join(' ').toLowerCase().includes(q));

  const conta = { todas: base.length, validada: 0, nova: 0, escalando: 0 };
  for (const r of base) { if (r.situacao !== 'teste') conta[r.situacao]++; if (r.cresc7d > 0) conta.escalando++; }
  for (const k of ['todas', 'validada', 'nova']) $('k-' + k).textContent = num(conta[k]);
  $('k-escalando').textContent = temHistorico ? num(conta.escalando) : '—';
  $('k-escalando-sub').textContent = temHistorico ? 'Mais anúncios que há 7 dias' : 'Aparece a partir do 2º dia de coleta';
  document.querySelectorAll('.kpi').forEach(b => b.setAttribute('aria-pressed', b.dataset.status === estado.situacao));

  const visiveis = base.filter(r => estado.situacao === 'todas' || (estado.situacao === 'escalando' ? r.cresc7d > 0 : r.situacao === estado.situacao)).sort(comparar);
  const max = Math.max(1, ...visiveis.map(r => r.ativos));
  $('linhas').replaceChildren(...(visiveis.length ? visiveis.map(r => linha(r, max))
    : [el('tr', {}, el('td', { class: 'nada', colSpan: 6 }, DADOS.length ? 'Nenhuma oferta com esses filtros.' : 'Nenhuma coleta ainda. Rode "npm run coletar" e recarregue.'))]));
  $('contagem').textContent = 'Mostrando ' + num(visiveis.length) + ' de ' + num(DADOS.length) + ' páginas';

  document.querySelectorAll('th[data-k]').forEach(th => {
    const ativo = th.dataset.k === estado.chave;
    ativo ? th.setAttribute('aria-sort', estado.desc ? 'descending' : 'ascending') : th.removeAttribute('aria-sort');
    th.querySelector('.seta').innerHTML = '<path d="' + (ativo && !estado.desc ? 'M2 6.5 5 3.5l3 3' : 'M2 3.5l3 3 3-3') + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
  });
}

// Montagem única
$('ultima').textContent = ULTIMA ? 'última coleta em ' + diaBR(ULTIMA) : 'nenhuma coleta ainda';
const nichos = [...new Set(DADOS.map(r => r.nicho))].sort();
$('k-todas-sub').textContent = nichos.length === 1 ? 'Em 1 nicho' : 'Em ' + nichos.length + ' nichos';
for (const n of nichos) $('nicho').append(el('option', { value: n }, n));
document.querySelectorAll('[data-icone]').forEach(e => e.prepend(svg(ICONES[e.dataset.icone])));
document.querySelectorAll('.kpi').forEach(b => b.onclick = () => { estado.situacao = b.dataset.status; render(); });
document.querySelectorAll('th[data-k] button').forEach(b => b.onclick = () => {
  const k = b.parentElement.dataset.k;
  estado.desc = estado.chave === k ? !estado.desc : k !== 'page_name';
  estado.chave = k;
  render();
});
$('busca').oninput = e => { estado.busca = e.target.value; render(); };
$('nicho').onchange = e => { estado.nicho = e.target.value; render(); };
$('semRedes').onchange = e => { estado.semRedes = e.target.checked; render(); };
render();
</script></body></html>`;

http.createServer((req, res) => {
  const json = JSON.stringify(dados()).replace(/</g, '\\u003c'); // texto de anúncio não fecha o <script>
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML.replace('__DADOS__', () => json));
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Porta ${PORTA} ocupada: o painel já está aberto em outro terminal? Feche ele e rode de novo.` : e.message);
  process.exit(1);
}).listen(PORTA, '127.0.0.1', () => console.log(`Painel em http://localhost:${PORTA}`));
