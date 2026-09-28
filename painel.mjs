// Painel das ofertas: npm run painel → http://localhost:3000  (outra porta: PORT=3001 npm run painel)
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { db } from './banco.mjs';

const PORTA = process.env.PORT || 3000;

// Uma linha por página medida na última semana de coletas (página que sumiu da amostra não fica com número velho).
// Com um único MIN(), o SQLite pega as colunas soltas (link, texto, imagem...) da mesma linha do anúncio
// mais antigo — o criativo que mais se provou.
const ofertas = db.prepare(`
  SELECT m.page_id, a.page_name, a.nicho, m.ativos, m.dia,
    m.ativos - (SELECT o.ativos FROM medicoes o WHERE o.page_id = m.page_id
                AND o.dia >= date(m.dia, '-7 day') AND o.dia < m.dia ORDER BY o.dia LIMIT 1) AS cresc7d,
    MIN(a.inicio) AS inicio, a.dominio, a.link, a.texto, a.ad_id, a.imagem
  FROM medicoes m
  JOIN anuncios a ON a.page_id = m.page_id AND a.visto_em = m.dia
  WHERE m.dia >= date((SELECT MAX(dia) FROM medicoes), '-7 day')
    AND m.dia = (SELECT MAX(dia) FROM medicoes WHERE page_id = m.page_id)
  GROUP BY m.page_id
`);
const historico = db.prepare(`
  SELECT page_id, dia, ativos FROM medicoes
  WHERE dia >= date((SELECT MAX(dia) FROM medicoes), '-30 day')
    AND page_id IN (SELECT page_id FROM medicoes WHERE dia >= date((SELECT MAX(dia) FROM medicoes), '-7 day'))
  ORDER BY dia
`);
const ultimaColeta = db.prepare('SELECT MAX(dia) AS dia FROM medicoes');

function dados() {
  const hist = {};
  for (const h of historico.all()) (hist[h.page_id] ??= []).push([h.dia, h.ativos]);
  return { ofertas: ofertas.all(), hist, ultima: ultimaColeta.get().dia };
}

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Radar de Ofertas</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>
:root {
  color-scheme: dark;
  --bg:#05070b; --painel:#0b1119; --painel-2:#0f1621;
  --linha:rgba(148,163,184,.12); --linha-2:rgba(148,163,184,.22);
  --tinta:#e6edf5; --tinta-2:#94a3b8; --tinta-3:#64748b;
  --ciano:#22d3ee; --verde:#34d399; --vermelho:#fb7185; --ambar:#fbbf24;
  --mono:"JetBrains Mono", ui-monospace, "Cascadia Code", Consolas, monospace;
  --sans:Inter, system-ui, "Segoe UI", sans-serif;
}
* { box-sizing:border-box; }
html { scrollbar-color:#1e293b transparent; }
body { margin:0; min-height:100vh; color:var(--tinta); font:14px/1.5 var(--sans); -webkit-font-smoothing:antialiased;
  background:radial-gradient(1000px 460px at 50% -140px, rgba(34,211,238,.14), transparent 70%), var(--bg); }
body::before { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background-image:linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px);
  background-size:44px 44px; -webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 0%, #000 20%, transparent 100%);
  mask-image:radial-gradient(ellipse 90% 70% at 50% 0%, #000 20%, transparent 100%); }
::selection { background:rgba(34,211,238,.3); }
a { color:inherit; }
button, select, input { font:inherit; color:inherit; }
:focus-visible { outline:2px solid var(--ciano); outline-offset:2px; }
main { max-width:1280px; margin:0 auto; padding:28px 16px 40px; }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }

/* ── topo ── */
.topo { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px; margin-bottom:28px; }
.marca { display:flex; align-items:center; gap:14px; }
.radar { position:relative; flex:none; width:44px; height:44px; border-radius:50%; overflow:hidden; border:1px solid rgba(34,211,238,.45);
  background:repeating-radial-gradient(circle, transparent 0 7px, rgba(34,211,238,.16) 7px 8px);
  box-shadow:0 0 28px rgba(34,211,238,.25), inset 0 0 12px rgba(34,211,238,.15); }
.radar::before { content:""; position:absolute; inset:0; border-radius:50%; background:conic-gradient(from 0deg, rgba(34,211,238,.6), transparent 28%); animation:giro 3s linear infinite; }
.radar::after { content:""; position:absolute; left:50%; top:50%; width:4px; height:4px; margin:-2px; border-radius:50%; background:var(--ciano); box-shadow:0 0 8px var(--ciano); }
.radar i { position:absolute; top:11px; left:28px; width:4px; height:4px; border-radius:50%; background:var(--verde); box-shadow:0 0 6px var(--verde); animation:blip 3s linear infinite; }
@keyframes giro { to { transform:rotate(360deg); } }
@keyframes blip { 0%, 8% { opacity:1; } 40%, 100% { opacity:0; } }
h1 { margin:0; font:700 18px/1.2 var(--mono); letter-spacing:.16em; text-transform:uppercase; }
h1 span { color:var(--ciano); text-shadow:0 0 16px rgba(34,211,238,.6); }
.sub { margin:3px 0 0; color:var(--tinta-2); font-size:12.5px; }
.status { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; font:500 11px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--tinta-2); }
.online { --c:var(--verde); display:inline-flex; align-items:center; gap:8px; color:var(--c); padding:5px 10px; border-radius:999px;
  border:1px solid color-mix(in srgb, var(--c) 35%, transparent); background:color-mix(in srgb, var(--c) 8%, transparent); }
.online i { width:7px; height:7px; border-radius:50%; background:var(--c); animation:pulso 2s infinite; }
.online.atraso { --c:var(--ambar); } .online.atraso i { animation:none; }
.online.off { --c:var(--tinta-3); } .online.off i { animation:none; }
@keyframes pulso { 0% { box-shadow:0 0 0 0 rgba(52,211,153,.6); } 70%, 100% { box-shadow:0 0 0 7px rgba(52,211,153,0); } }
.legenda { position:relative; }
.legenda summary { list-style:none; cursor:pointer; padding:5px 10px; border:1px solid var(--linha-2); border-radius:6px; }
.legenda summary::-webkit-details-marker { display:none; }
.legenda summary:hover, .legenda[open] summary { border-color:rgba(34,211,238,.6); color:var(--tinta); }
.legenda dl { position:absolute; right:0; top:calc(100% + 8px); z-index:20; width:min(380px, calc(100vw - 32px)); margin:0; padding:16px 18px;
  display:grid; gap:12px; background:var(--painel-2); border:1px solid var(--linha-2); border-radius:10px; box-shadow:0 24px 60px rgba(0,0,0,.55);
  font:13px/1.5 var(--sans); letter-spacing:0; text-transform:none; color:var(--tinta-2); }
.legenda dt { font:600 10.5px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ciano); }
.legenda dd { margin:-8px 0 0; }

/* ── indicadores ── */
.kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:14px; margin-bottom:22px; }
.kpi { --c:var(--tinta-2); all:unset; box-sizing:border-box; position:relative; cursor:pointer; display:flex; flex-direction:column; gap:6px; padding:16px 18px 14px;
  background:linear-gradient(180deg, rgba(17,24,36,.88), rgba(10,14,22,.88)); border:1px solid var(--linha); border-radius:4px;
  backdrop-filter:blur(6px); transition:border-color .2s, box-shadow .2s; }
.kpi::before, .kpi::after { content:""; position:absolute; width:12px; height:12px; border:0 solid var(--c); transition:width .2s, height .2s; }
.kpi::before { top:-1px; left:-1px; border-top-width:2px; border-left-width:2px; }
.kpi::after { bottom:-1px; right:-1px; border-bottom-width:2px; border-right-width:2px; }
.kpi:hover { border-color:var(--linha-2); }
.kpi:hover::before, .kpi:hover::after, .kpi[aria-pressed="true"]::before, .kpi[aria-pressed="true"]::after { width:20px; height:20px; }
.kpi[aria-pressed="true"] { border-color:color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow:0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent), 0 0 36px color-mix(in srgb, var(--c) 14%, transparent); }
.kpi:focus-visible { outline:2px solid var(--ciano); outline-offset:3px; }
.kpi.validada { --c:var(--verde); } .kpi.nova { --c:var(--ambar); } .kpi.escalando { --c:var(--ciano); }
.kpi-rot { display:flex; justify-content:space-between; align-items:center; gap:8px; font:600 10.5px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-2); }
.kpi-rot b { font-weight:500; color:var(--tinta-3); }
.led { display:inline-block; width:6px; height:6px; margin-right:8px; border-radius:1px; background:var(--c); box-shadow:0 0 8px var(--c); vertical-align:1px; }
.kpi-val { font:600 34px/1.1 var(--mono); letter-spacing:-.02em; text-shadow:0 0 28px color-mix(in srgb, var(--c) 40%, transparent); }
.kpi-sub { font-size:12px; color:var(--tinta-2); }
.kpi-medidor { height:3px; margin-top:4px; border-radius:2px; overflow:hidden; background:rgba(148,163,184,.12); }
.kpi-medidor i { display:block; width:0; height:100%; background:var(--c); box-shadow:0 0 10px var(--c); transition:width .7s cubic-bezier(.2,.8,.2,1); }

/* ── filtros ── */
.barra { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin-bottom:14px; }
.busca { flex:1 1 280px; max-width:440px; display:flex; align-items:center; gap:10px; height:40px; padding:0 8px 0 12px;
  background:rgba(12,17,25,.85); border:1px solid var(--linha-2); border-radius:8px; transition:border-color .2s, box-shadow .2s; }
.busca:focus-within { border-color:var(--ciano); box-shadow:0 0 0 3px rgba(34,211,238,.12); }
.busca svg { flex:none; color:var(--tinta-3); }
.busca input { all:unset; flex:1; min-width:0; font-size:13.5px; }
.busca input::placeholder { color:var(--tinta-3); }
kbd { font:500 11px var(--mono); color:var(--tinta-2); padding:1px 7px; border:1px solid var(--linha-2); border-bottom-width:2px; border-radius:5px; }
select { height:40px; padding:0 34px 0 12px; appearance:none; cursor:pointer; font-size:13.5px; border:1px solid var(--linha-2); border-radius:8px;
  background:rgba(12,17,25,.85) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5l3 3 3-3' fill='none' stroke='%2394a3b8' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center; }
select:hover { border-color:rgba(34,211,238,.5); }
option { background:var(--painel-2); }
.chave { display:inline-flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; color:var(--tinta-2); user-select:none; }
.chave input { position:absolute; opacity:0; width:1px; height:1px; }
.chave .trilho { position:relative; flex:none; width:34px; height:20px; border-radius:999px; background:rgba(148,163,184,.18); border:1px solid var(--linha-2); transition:background .2s, border-color .2s; }
.chave .trilho::after { content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--tinta-2); transition:transform .2s, background .2s; }
.chave input:checked + .trilho { background:rgba(34,211,238,.22); border-color:rgba(34,211,238,.6); }
.chave input:checked + .trilho::after { transform:translateX(14px); background:var(--ciano); box-shadow:0 0 8px var(--ciano); }
.chave input:focus-visible + .trilho { outline:2px solid var(--ciano); outline-offset:2px; }
#contagem { margin-left:auto; font:500 11px var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--tinta-2); }

/* ── tabela ── */
.cartao { background:rgba(10,14,21,.84); border:1px solid var(--linha); border-radius:10px; overflow:hidden; backdrop-filter:blur(8px); box-shadow:0 30px 80px rgba(0,0,0,.35); }
.cartao-topo { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 12px; padding:11px 16px; border-bottom:1px solid var(--linha);
  font:600 10.5px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--tinta-2); background:linear-gradient(90deg, rgba(34,211,238,.08), transparent 45%); }
.cartao-topo span:first-child { color:var(--ciano); }
.rolagem { overflow-x:auto; }
table { width:100%; min-width:1000px; border-collapse:collapse; }
th { text-align:left; padding:10px 14px; font:600 10.5px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-3); border-bottom:1px solid var(--linha); white-space:nowrap; }
th button { all:unset; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
th button:hover { color:var(--tinta); }
th button:focus-visible { outline:2px solid var(--ciano); outline-offset:3px; border-radius:3px; }
th[aria-sort] { color:var(--ciano); }
.seta { width:10px; height:10px; opacity:0; } th[aria-sort] .seta { opacity:1; }
td { padding:12px 14px; border-bottom:1px solid var(--linha); vertical-align:middle; }
tbody tr { cursor:pointer; transition:background .15s; }
tbody tr:hover { background:linear-gradient(90deg, rgba(34,211,238,.09), rgba(34,211,238,.02) 60%, transparent); }
tbody tr:hover td:first-child { box-shadow:inset 2px 0 0 var(--ciano); }
tbody tr:last-child td { border-bottom:0; }
.anima tr { animation:entra .45s cubic-bezier(.2,.8,.2,1) both; animation-delay:calc(var(--i) * 22ms); }
@keyframes entra { from { opacity:0; transform:translateY(6px); } }
.rank { width:40px; font:500 11px var(--mono); color:var(--tinta-3); }
tr:hover .rank { color:var(--ciano); }
.oferta { display:flex; align-items:center; gap:14px; min-width:360px; }
.thumb { flex:none; width:52px; height:52px; display:grid; place-items:center; overflow:hidden; border-radius:6px; border:1px solid var(--linha-2); background:var(--painel-2); transition:border-color .2s, box-shadow .2s; }
tr:hover .thumb { border-color:rgba(34,211,238,.6); box-shadow:0 0 18px rgba(34,211,238,.25); }
.thumb img, .g-img img { display:block; width:100%; height:100%; object-fit:cover; }
.letra { font:600 18px var(--mono); color:var(--tinta-3); }
.info { min-width:0; }
.nome { font-weight:600; }
.meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; margin-top:2px; }
.dominio { font:12px var(--mono); color:#67e8f9; }
.nicho { font:500 10px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--tinta-2); padding:2px 6px; border:1px solid var(--linha-2); border-radius:3px; }
.texto { max-width:430px; margin-top:4px; font-size:12.5px; color:var(--tinta-2); display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
.tag { --c:var(--tinta-3); display:inline-flex; align-items:center; gap:7px; padding:5px 9px; border-radius:4px; white-space:nowrap;
  font:600 10.5px/1 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--tinta);
  border:1px solid color-mix(in srgb, var(--c) 45%, transparent); background:color-mix(in srgb, var(--c) 10%, transparent); }
.tag i { width:6px; height:6px; border-radius:50%; background:var(--c); box-shadow:0 0 8px var(--c); }
.tag.validada { --c:var(--verde); } .tag.nova { --c:var(--ambar); }
.vol { display:flex; flex-direction:column; gap:7px; min-width:150px; }
.vol-n { font:600 15px var(--mono); }
.medidor { position:relative; display:block; width:150px; height:8px; }
.medidor b, .medidor i::before { content:""; position:absolute; inset:0;
  -webkit-mask:repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 6px); mask:repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 6px); }
.medidor b { background:rgba(148,163,184,.13); }
.medidor i { position:absolute; top:0; bottom:0; left:0; min-width:4px; filter:drop-shadow(0 0 3px rgba(34,211,238,.55)); }
.medidor i::before { background:linear-gradient(90deg, #0e7490, var(--ciano)); }
.tend { display:flex; flex-direction:column; gap:3px; min-width:130px; }
.delta { font:600 11px var(--mono); letter-spacing:.04em; }
.sobe { color:var(--verde); } .desce { color:var(--vermelho); } .igual { color:var(--tinta-2); }
.vazio { font:11px var(--mono); color:var(--tinta-3); }
.idade b { display:block; font:600 15px var(--mono); }
.idade span { font:11px var(--mono); color:var(--tinta-3); white-space:nowrap; }
.abrir { width:48px; text-align:right; }
.icone-btn { all:unset; display:inline-grid; place-items:center; width:30px; height:30px; border-radius:6px; cursor:pointer; color:var(--tinta-3); border:1px solid transparent; transition:.15s; }
.icone-btn:hover, tr:hover .icone-btn { color:var(--ciano); border-color:rgba(34,211,238,.4); background:rgba(34,211,238,.08); }
.icone-btn:focus-visible { outline:2px solid var(--ciano); outline-offset:2px; }
.nada { padding:56px 16px; text-align:center; font:12px var(--mono); letter-spacing:.06em; color:var(--tinta-2); }
tbody tr.fixa { cursor:default; }
tbody tr.fixa:hover { background:none; }
tbody tr.fixa:hover td:first-child { box-shadow:none; }
.mais { padding:16px; text-align:center; }
.mais button { all:unset; cursor:pointer; padding:8px 16px; border-radius:6px; border:1px solid rgba(34,211,238,.4);
  font:600 11px var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--ciano); }
.mais button:hover { background:rgba(34,211,238,.08); }
.mais button:focus-visible { outline:2px solid var(--ciano); outline-offset:2px; }
.rodape { margin:18px 0 0; font:11px var(--mono); letter-spacing:.04em; color:var(--tinta-3); }

/* ── gráficos ── */
.spark { display:block; overflow:visible; cursor:crosshair; }
.grafico { display:block; width:100%; height:auto; overflow:visible; cursor:crosshair; }
.traco { fill:none; stroke:var(--ciano); stroke-width:2; stroke-linejoin:round; stroke-linecap:round; filter:drop-shadow(0 0 4px rgba(34,211,238,.55)); }
.cursor { fill:var(--ciano); stroke:var(--painel); stroke-width:2; }
.grade { stroke:rgba(148,163,184,.12); stroke-width:1; }
.eixo { fill:var(--tinta-3); font:10px var(--mono); }
.mira { stroke:rgba(34,211,238,.4); stroke-width:1; }
#dica { position:fixed; z-index:50; pointer-events:none; opacity:0; transition:opacity .1s; white-space:nowrap;
  font:500 11px var(--mono); padding:6px 9px; border-radius:6px; background:#0b1220; color:var(--tinta);
  border:1px solid rgba(34,211,238,.4); box-shadow:0 0 18px rgba(34,211,238,.18); }
#dica.on { opacity:1; }

/* ── dossiê (painel lateral) ── */
#fundo { position:fixed; inset:0; z-index:30; background:rgba(2,4,8,.62); backdrop-filter:blur(3px); opacity:0; pointer-events:none; transition:opacity .25s; }
#fundo.aberto { opacity:1; pointer-events:auto; }
#gaveta { position:fixed; z-index:31; top:0; right:0; bottom:0; width:min(500px, 100vw); display:flex; flex-direction:column;
  background:linear-gradient(180deg, #0c121c, #080c13); border-left:1px solid rgba(34,211,238,.25); box-shadow:-30px 0 80px rgba(0,0,0,.5);
  transform:translateX(100%); visibility:hidden; transition:transform .3s cubic-bezier(.2,.8,.2,1), visibility 0s .3s; }
#gaveta.aberta { transform:none; visibility:visible; transition:transform .3s cubic-bezier(.2,.8,.2,1); }
.g-topo { display:flex; justify-content:space-between; align-items:center; padding:10px 12px 10px 18px; border-bottom:1px solid var(--linha);
  font:600 10.5px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ciano); }
#g-corpo { overflow-y:auto; padding:20px 18px 28px; display:flex; flex-direction:column; gap:22px; }
#g-corpo > * { flex-shrink:0; }
.g-criativo { position:relative; }
.g-img { display:grid; place-items:center; aspect-ratio:16/10; text-decoration:none; overflow:hidden; border-radius:8px; border:1px solid var(--linha-2); background:var(--painel-2); }
.g-img .letra { font-size:48px; }
.g-selo { position:absolute; left:10px; top:10px; pointer-events:none; padding:4px 8px; border-radius:4px; font:600 10px var(--mono); letter-spacing:.1em; text-transform:uppercase;
  color:var(--ciano); background:rgba(5,7,11,.82); border:1px solid rgba(34,211,238,.35); backdrop-filter:blur(4px); }
.g-cab h2 { margin:0 0 6px; font-size:20px; font-weight:650; line-height:1.3; }
.g-stats { display:grid; grid-template-columns:1fr 1fr; gap:1px; overflow:hidden; border-radius:8px; border:1px solid var(--linha); background:var(--linha); }
.stat { display:flex; flex-direction:column; gap:4px; padding:12px 14px; background:var(--painel); }
.stat-rot { font:600 10px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--tinta-3); }
.stat-val { font:600 20px var(--mono); }
.g-bloco h3 { margin:0 0 10px; font:600 10.5px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--tinta-2); }
.copy { margin:0; padding:14px; white-space:pre-wrap; font-size:13px; line-height:1.6; color:var(--tinta-2); border-left:2px solid var(--ciano); border-radius:0 6px 6px 0; background:rgba(34,211,238,.04); }
.g-acoes { display:flex; flex-direction:column; gap:8px; }
.botao { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:11px 14px; border-radius:8px; border:1px solid var(--linha-2);
  text-decoration:none; font-size:13.5px; font-weight:500; transition:.15s; }
.botao:hover { border-color:rgba(34,211,238,.5); background:rgba(34,211,238,.06); }
.botao.primario { color:#021016; font-weight:600; border-color:transparent; background:linear-gradient(90deg, #0891b2, var(--ciano)); box-shadow:0 0 24px rgba(34,211,238,.25); }
.botao.primario:hover { filter:brightness(1.1); }

@media (max-width:520px) { .kpi { padding:12px 14px; } .kpi-val { font-size:26px; } }
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
</style></head><body>
<main>
  <header class="topo">
    <div class="marca">
      <div class="radar" aria-hidden="true"><i></i></div>
      <div>
        <h1>Radar<span>//</span>Ofertas</h1>
        <p class="sub">Inteligência de anúncios escalados · Meta Ad Library · Brasil</p>
      </div>
    </div>
    <div class="status">
      <span id="online" class="online"><i></i><span>Monitorando</span></span>
      <span id="ultima"></span>
      <details class="legenda">
        <summary>[?] Como ler</summary>
        <dl>
          <dt>Anúncios ativos</dt><dd>Quantos anúncios a página tem no ar hoje. Muito anúncio = verba alta = oferta vendendo.</dd>
          <dt>No ar</dt><dd>Idade do anúncio mais antigo ainda ativo. Ninguém paga meses de anúncio que dá prejuízo.</dd>
          <dt>Tendência 30d</dt><dd>Anúncios ativos em cada coleta dos últimos 30 dias. Subindo = escalando agora.</dd>
          <dt>Dossiê</dt><dd>Clique numa oferta para ver o criativo, o histórico, a copy e os links.</dd>
        </dl>
      </details>
    </div>
  </header>

  <section class="kpis" aria-label="Resumo e filtro por sinal">
    <button class="kpi todas" data-status="todas"><span class="kpi-rot"><span><i class="led"></i>Monitoradas</span><b id="p-todas"></b></span><span class="kpi-val" id="k-todas">0</span><span class="kpi-sub" id="s-todas"></span><span class="kpi-medidor"><i id="m-todas"></i></span></button>
    <button class="kpi validada" data-status="validada"><span class="kpi-rot"><span><i class="led"></i>Validadas</span><b id="p-validada"></b></span><span class="kpi-val" id="k-validada">0</span><span class="kpi-sub">30+ dias no ar e 50+ anúncios</span><span class="kpi-medidor"><i id="m-validada"></i></span></button>
    <button class="kpi nova" data-status="nova"><span class="kpi-rot"><span><i class="led"></i>Novas e fortes</span><b id="p-nova"></b></span><span class="kpi-val" id="k-nova">0</span><span class="kpi-sub">Menos de 30 dias e 100+ anúncios</span><span class="kpi-medidor"><i id="m-nova"></i></span></button>
    <button class="kpi escalando" data-status="escalando"><span class="kpi-rot"><span><i class="led"></i>Escalando</span><b id="p-escalando"></b></span><span class="kpi-val" id="k-escalando">0</span><span class="kpi-sub" id="s-escalando"></span><span class="kpi-medidor"><i id="m-escalando"></i></span></button>
  </section>

  <div class="barra">
    <label class="busca"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3" stroke-linecap="round"/></svg>
      <input id="busca" type="search" placeholder="Buscar oferta, domínio ou copy…" aria-label="Buscar" autocomplete="off"><kbd>/</kbd></label>
    <select id="nicho" aria-label="Nicho"><option value="">Todos os nichos</option></select>
    <label class="chave"><input id="semRedes" type="checkbox" role="switch" checked><span class="trilho"></span>Ocultar redes e marketplaces</label>
    <span id="contagem" aria-live="polite"></span>
  </div>

  <div class="cartao">
    <div class="cartao-topo"><span>▸ Feed de ofertas</span><span id="ordem"></span></div>
    <div class="rolagem"><table>
      <thead><tr>
        <th class="rank">#</th>
        <th data-k="page_name"><button>Oferta<svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th>Sinal</th>
        <th data-k="ativos"><button>Anúncios ativos<svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th data-k="cresc7d"><button>Tendência 30d<svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th data-k="dias"><button>No ar<svg class="seta" viewBox="0 0 10 10"></svg></button></th>
        <th><span class="sr">Abrir dossiê</span></th>
      </tr></thead>
      <tbody id="linhas"></tbody>
    </table></div>
  </div>
  <p class="rodape">Dados públicos da Biblioteca de Anúncios da Meta · atualize com npm run coletar</p>
</main>

<div id="fundo"></div>
<aside id="gaveta" role="dialog" aria-modal="true" aria-labelledby="g-nome">
  <div class="g-topo"><span>▸ Dossiê da oferta</span><button id="fechar" class="icone-btn" aria-label="Fechar dossiê"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button></div>
  <div id="g-corpo"></div>
</aside>
<div id="dica" role="tooltip"></div>

<script nonce="__NONCE__">
const { ofertas: DADOS, hist: HIST, ultima: ULTIMA } = __DADOS__;
const REDES = /instagram|whatsapp|wa\\.me|facebook|fb\\.me|mercadolivre|shopee|amazon|magazineluiza|play\\.google|apple\\.com/;
const REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SITUACAO = { validada: 'Validada', nova: 'Nova e forte', teste: 'Em teste' };
const ORDEM = { page_name: 'nome', ativos: 'anúncios ativos', cresc7d: 'variação 7d', dias: 'tempo no ar' };
const ICONES = {
  fora: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg>',
  abrir: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>',
};

const $ = id => document.getElementById(id);
const num = n => Number(n).toLocaleString('pt-BR');
const diaBR = d => d.split('-').reverse().join('/');
const diaCurto = d => d.slice(8, 10) + '/' + d.slice(5, 7);
const data = (ts, op) => new Date(ts * 1000).toLocaleDateString('pt-BR', op);
const seguro = u => typeof u === 'string' && /^https?:\\/\\//.test(u);
const libPagina = r => 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&search_type=page&view_all_page_id=' + encodeURIComponent(r.page_id);
const libAnuncio = r => 'https://www.facebook.com/ads/library/?id=' + encodeURIComponent(r.ad_id);
function svg(html) { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstChild; } // só constantes e números, nunca texto de anúncio
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k === 'class' ? (e.className = v) : k.includes('-') ? e.setAttribute(k, v) : (e[k] = v);
  e.append(...filhos.filter(f => f != null && f !== false && f !== ''));
  return e;
}

for (const r of DADOS) {
  const fimDaMedicao = Date.parse(r.dia + 'T23:59:59') / 1000; // idade no dia da medição, não hoje
  r.dias = r.inicio ? Math.max(0, Math.floor((fimDaMedicao - r.inicio) / 86400)) : 0;
  r.situacao = r.dias >= 30 && r.ativos >= 50 ? 'validada' : r.dias < 30 && r.ativos >= 100 ? 'nova' : 'teste';
  r.hist = HIST[r.page_id] ?? [];
}
const TEM_HISTORICO = DADOS.some(r => r.cresc7d != null);
const PASSO = 200; // linhas desenhadas por vez: com milhares de páginas, desenhar tudo trava a digitação
const estado = { situacao: 'todas', nicho: '', busca: '', semRedes: true, chave: 'ativos', desc: true, limite: PASSO };

// Linha de 2px com lavagem em degradê, ponto final com anel e dica ao passar o mouse.
// eixos=true desenha grade, rótulos e mira vertical (gráfico grande do dossiê).
let seq = 0;
function grafico(pts, { W, H, eixos = false }) {
  const id = 'lav' + (++seq);
  const L = eixos ? 46 : 4, R = eixos ? 8 : 6, T = eixos ? 10 : 6, B = eixos ? 24 : 6;
  const vals = pts.map(p => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (eixos) { const f = (hi - lo) * 0.2 || Math.max(1, hi * 0.1); lo = Math.max(0, Math.floor(lo - f)); hi = Math.ceil(hi + f); }
  const ult = pts.length - 1, passo = (W - L - R) / ult;
  const x = i => L + i * passo;
  const y = v => hi === lo ? (T + H - B) / 2 : H - B - (v - lo) / (hi - lo) * (H - T - B);
  const linha = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
  let s = '<svg class="' + (eixos ? 'grafico' : 'spark') + '" viewBox="0 0 ' + W + ' ' + H + '"' + (eixos ? '' : ' width="' + W + '" height="' + H + '"') + ' role="img">'
    + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".3"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>';
  if (eixos) {
    for (const v of [lo, (lo + hi) / 2, hi]) s += '<line class="grade" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>'
      + '<text class="eixo" x="' + (L - 8) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + num(Math.round(v)) + '</text>';
    s += '<text class="eixo" x="' + L + '" y="' + (H - 6) + '">' + diaCurto(pts[0][0]) + '</text>'
      + '<text class="eixo" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + diaCurto(pts[ult][0]) + '</text>'
      + '<line class="mira" y1="' + T + '" y2="' + (H - B) + '" x1="-99" x2="-99"/>';
  }
  s += '<polygon points="' + x(0) + ',' + (H - B) + ' ' + linha + ' ' + x(ult) + ',' + (H - B) + '" fill="url(#' + id + ')"/>'
    + '<polyline class="traco" points="' + linha + '"/>'
    + '<circle class="cursor" r="4" cx="' + x(ult) + '" cy="' + y(pts[ult][1]) + '"/></svg>';
  const g = svg(s);
  g.setAttribute('aria-label', 'Anúncios ativos por dia: ' + pts.map(p => diaCurto(p[0]) + ' ' + p[1]).join(', '));
  const cursor = g.querySelector('.cursor'), mira = g.querySelector('.mira'), dica = $('dica');
  const marcar = (i, mx) => {
    cursor.setAttribute('cx', x(i)); cursor.setAttribute('cy', y(pts[i][1]));
    if (mira) { mira.setAttribute('x1', mx); mira.setAttribute('x2', mx); }
  };
  g.onmousemove = ev => {
    const b = g.getBoundingClientRect();
    const i = Math.max(0, Math.min(ult, Math.round(((ev.clientX - b.left) * W / b.width - L) / passo)));
    marcar(i, x(i));
    dica.textContent = diaBR(pts[i][0]) + ' · ' + num(pts[i][1]) + ' anúncios';
    dica.style.left = Math.min(ev.clientX + 14, innerWidth - dica.offsetWidth - 8) + 'px';
    dica.style.top = ev.clientY - 36 + 'px';
    dica.classList.add('on');
  };
  g.onmouseleave = () => { dica.classList.remove('on'); marcar(ult, -99); };
  return g;
}

function delta(c) {
  if (c == null) return null;
  if (c === 0) return el('span', { class: 'delta igual' }, '= estável · 7d');
  return el('span', { class: 'delta ' + (c > 0 ? 'sobe' : 'desce') }, (c > 0 ? '▲ ' : '▼ ') + num(Math.abs(c)) + ' · 7d');
}
const tag = s => el('span', { class: 'tag ' + s }, el('i', { 'aria-hidden': 'true' }), SITUACAO[s]);

function thumb(r, cls, href) {
  const letra = () => el('span', { class: 'letra', 'aria-hidden': 'true' }, ((r.page_name || '').trim()[0] || '?').toUpperCase());
  const caixa = href ? el('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Ver o criativo na Biblioteca de Anúncios' }) : el('div', { class: cls });
  if (seguro(r.imagem)) {
    const img = el('img', { src: r.imagem, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
    img.onerror = () => img.replaceWith(letra());
    caixa.append(img);
  } else caixa.append(letra());
  return caixa;
}

function linha(r, i, max) {
  const tr = el('tr', { style: '--i:' + Math.min(i, 24) },
    el('td', { class: 'rank' }, String(i + 1).padStart(2, '0')),
    el('td', {}, el('div', { class: 'oferta' }, thumb(r, 'thumb'),
      el('div', { class: 'info' },
        el('div', { class: 'nome' }, r.page_name || r.page_id),
        el('div', { class: 'meta' }, el('span', { class: 'dominio' }, r.dominio || 'sem site'), el('span', { class: 'nicho' }, r.nicho)),
        r.texto && el('div', { class: 'texto' }, r.texto)))),
    el('td', {}, tag(r.situacao)),
    el('td', {}, el('div', { class: 'vol' }, el('span', { class: 'vol-n' }, num(r.ativos)),
      el('span', { class: 'medidor', 'aria-hidden': 'true' }, el('b'), el('i', { style: 'width:' + (r.ativos / max * 100).toFixed(1) + '%' })))),
    el('td', {}, el('div', { class: 'tend' }, r.hist.length > 1 ? grafico(r.hist, { W: 116, H: 34 }) : el('span', { class: 'vazio' }, '— 1ª leitura'), delta(r.cresc7d))),
    el('td', { class: 'idade' }, el('b', {}, num(r.dias) + 'd'), r.inicio && el('span', {}, 'desde ' + data(r.inicio, { day: '2-digit', month: '2-digit', year: '2-digit' }))),
    el('td', { class: 'abrir' }, el('button', { class: 'icone-btn', 'aria-label': 'Abrir dossiê de ' + (r.page_name || r.page_id) }, svg(ICONES.abrir))));
  tr.onclick = () => abrir(r);
  return tr;
}

// ── dossiê ──
let focoAnterior;
const stat = (rot, val, cls = '') => el('div', { class: 'stat' }, el('span', { class: 'stat-rot' }, rot), el('span', { class: 'stat-val ' + cls }, val));
const botao = (texto, href, cls = '') => el('a', { class: 'botao ' + cls, href, target: '_blank', rel: 'noopener noreferrer' }, texto, svg(ICONES.fora));
function abrir(r) {
  focoAnterior = document.activeElement;
  const c = r.cresc7d;
  $('g-corpo').replaceChildren(
    el('div', { class: 'g-criativo' }, thumb(r, 'g-img', libAnuncio(r)), el('span', { class: 'g-selo' }, 'Criativo mais antigo no ar')),
    el('div', { class: 'g-cab' }, el('h2', { id: 'g-nome' }, r.page_name || r.page_id),
      el('div', { class: 'meta' }, el('span', { class: 'dominio' }, r.dominio || 'sem site'), el('span', { class: 'nicho' }, r.nicho), tag(r.situacao))),
    el('div', { class: 'g-stats' },
      stat('Anúncios ativos', num(r.ativos)),
      stat('Variação 7d', c == null ? '—' : (c > 0 ? '▲ ' : c < 0 ? '▼ ' : '') + num(Math.abs(c)), c > 0 ? 'sobe' : c < 0 ? 'desce' : ''),
      stat('No ar há', num(r.dias) + ' dias'),
      stat('Primeiro anúncio', r.inicio ? data(r.inicio, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')),
    el('section', { class: 'g-bloco' }, el('h3', {}, 'Histórico · anúncios ativos'),
      r.hist.length > 1 ? grafico(r.hist, { W: 460, H: 180, eixos: true }) : el('p', { class: 'vazio' }, 'O gráfico aparece a partir da 2ª coleta.')),
    r.texto && el('section', { class: 'g-bloco' }, el('h3', {}, 'Copy do anúncio'), el('p', { class: 'copy' }, r.texto)),
    el('div', { class: 'g-acoes' },
      botao('Ver todos os anúncios na Biblioteca', libPagina(r), 'primario'),
      seguro(r.link) && botao('Abrir página de vendas', r.link),
      botao('Ver o anúncio mais antigo', libAnuncio(r))));
  $('g-corpo').scrollTop = 0;
  $('gaveta').classList.add('aberta');
  $('fundo').classList.add('aberto');
  $('fechar').focus();
}
function fechar() {
  $('gaveta').classList.remove('aberta');
  $('fundo').classList.remove('aberto');
  $('dica').classList.remove('on');
  focoAnterior?.focus();
}

// ── indicadores e lista ──
let primeira = true;
function contar(alvo, valor) {
  if (!primeira || REDUZIDO) { alvo.textContent = num(valor); return; }
  const t0 = performance.now();
  const quadro = t => { const p = Math.min(1, (t - t0) / 800); alvo.textContent = num(Math.round(valor * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(quadro); };
  requestAnimationFrame(quadro);
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
  let anuncios = 0;
  for (const r of base) { anuncios += r.ativos; if (r.situacao !== 'teste') conta[r.situacao]++; if (r.cresc7d > 0) conta.escalando++; }
  for (const k in conta) {
    const vazio = k === 'escalando' && !TEM_HISTORICO;
    vazio ? ($('k-' + k).textContent = '—') : contar($('k-' + k), conta[k]);
    const p = vazio || !base.length ? 0 : conta[k] / base.length * 100;
    $('m-' + k).style.width = p + '%';
    $('p-' + k).textContent = vazio || k === 'todas' ? '' : Math.round(p) + '%';
  }
  $('s-todas').textContent = num(anuncios) + ' anúncios no ar';
  $('s-escalando').textContent = TEM_HISTORICO ? 'Mais anúncios que há 7 dias' : 'Disponível a partir da 2ª coleta';
  document.querySelectorAll('.kpi').forEach(b => b.setAttribute('aria-pressed', b.dataset.status === estado.situacao));

  const visiveis = base.filter(r => estado.situacao === 'todas' || (estado.situacao === 'escalando' ? r.cresc7d > 0 : r.situacao === estado.situacao)).sort(comparar);
  const max = Math.max(1, ...visiveis.map(r => r.ativos));
  $('linhas').classList.toggle('anima', primeira && !REDUZIDO);
  const faltam = visiveis.length - estado.limite;
  $('linhas').replaceChildren(...(visiveis.length ? visiveis.slice(0, estado.limite).map((r, i) => linha(r, i, max))
    : [el('tr', { class: 'fixa' }, el('td', { class: 'nada', colSpan: 7 }, DADOS.length ? 'Nenhuma oferta com esses filtros.' : 'Nenhuma coleta ainda. Rode npm run coletar e recarregue.'))]),
    ...(faltam > 0 ? [el('tr', { class: 'fixa' }, el('td', { class: 'mais', colSpan: 7 }, el('button', { onclick: () => {
      const antes = estado.limite;
      estado.limite += PASSO;
      render();
      $('linhas').rows[antes]?.querySelector('button')?.focus(); // teclado continua de onde parou
    } }, 'Mostrar mais ' + num(Math.min(PASSO, faltam)) + ' · faltam ' + num(faltam))))] : []));
  $('contagem').textContent = num(visiveis.length) + ' / ' + num(DADOS.length) + ' páginas';
  $('ordem').textContent = 'Ordem: ' + ORDEM[estado.chave] + (estado.desc ? ' ↓' : ' ↑');

  document.querySelectorAll('th[data-k]').forEach(th => {
    const ativo = th.dataset.k === estado.chave;
    ativo ? th.setAttribute('aria-sort', estado.desc ? 'descending' : 'ascending') : th.removeAttribute('aria-sort');
    th.querySelector('.seta').innerHTML = '<path d="' + (ativo && !estado.desc ? 'M2 6.5 5 3.5l3 3' : 'M2 3.5l3 3 3-3') + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
  });
  primeira = false;
}

// ── montagem ──
if (ULTIMA) {
  $('ultima').textContent = 'Última varredura ' + diaBR(ULTIMA);
  const atraso = Math.round((new Date(new Date().toLocaleDateString('sv')) - new Date(ULTIMA)) / 864e5);
  if (atraso > 1) { $('online').className = 'online atraso'; $('online').lastChild.textContent = 'Coleta atrasada'; }
} else { $('online').className = 'online off'; $('online').lastChild.textContent = 'Sem dados'; }
for (const n of [...new Set(DADOS.map(r => r.nicho))].sort()) $('nicho').append(el('option', { value: n }, n));

const refiltrar = () => { estado.limite = PASSO; render(); };
document.querySelectorAll('.kpi').forEach(b => b.onclick = () => { estado.situacao = b.dataset.status; refiltrar(); });
document.querySelectorAll('th[data-k] button').forEach(b => b.onclick = () => {
  const k = b.parentElement.dataset.k;
  estado.desc = estado.chave === k ? !estado.desc : k !== 'page_name';
  estado.chave = k;
  refiltrar();
});
let pausa;
$('busca').oninput = e => { clearTimeout(pausa); pausa = setTimeout(() => { estado.busca = e.target.value; refiltrar(); }, 120); };
$('nicho').onchange = e => { estado.nicho = e.target.value; refiltrar(); };
$('semRedes').onchange = e => { estado.semRedes = e.target.checked; refiltrar(); };
$('fechar').onclick = fechar;
$('fundo').onclick = fechar;
document.addEventListener('keydown', e => {
  const aberta = $('gaveta').classList.contains('aberta');
  if (aberta && e.key === 'Escape') fechar();
  else if (aberta && e.key === 'Tab') { // mantém o foco dentro do dossiê
    const f = [...$('gaveta').querySelectorAll('a[href], button')], pri = f[0], ult = f[f.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  } else if (!aberta && e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('busca').focus(); }
});
render();
</script></body></html>`;

http.createServer((req, res) => {
  // Só atende pelo nome local: um site malicioso não consegue ler o painel via DNS rebinding.
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return res.writeHead(403).end();
  try {
    const json = JSON.stringify(dados()).replace(/</g, '\\u003c'); // texto de anúncio não fecha o <script>
    const nonce = randomBytes(16).toString('base64');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      // Só o script desta página roda e imagens só vêm do CDN da Meta, mesmo que um texto de anúncio tente injetar algo.
      'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; `
        + `font-src https://fonts.gstatic.com; img-src https://*.fbcdn.net data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
    res.end(HTML.replace('__NONCE__', nonce).replace('__DADOS__', () => json));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Erro ao ler o banco: ' + e.message);
  }
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Porta ${PORTA} ocupada: o painel já está aberto em outro terminal? Feche ele e rode de novo.` : e.message);
  process.exit(1);
}).listen(PORTA, '127.0.0.1', () => console.log(`Painel em http://localhost:${PORTA}`));
