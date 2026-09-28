// Coleta anúncios ativos no Brasil da Biblioteca de Anúncios da Meta e mede quantos anúncios cada página tem no ar.
// Uso: npm run coletar                 (palavras de nichos.txt)
//      node coletar.mjs "renda extra"  (palavras avulsas)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { db } from './banco.mjs';

const ROLAGENS = 10;    // ~10 anúncios por rolagem na busca por palavra
const MAX_PAGINAS = 40; // ponytail: páginas medidas por nicho (1 acesso cada); subir se a Meta não bloquear
const BASE = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&media_type=all';

const nichos = process.argv.length > 2 ? process.argv.slice(2)
  : fs.readFileSync('nichos.txt', 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const hoje = new Date().toLocaleDateString('sv'); // AAAA-MM-DD no fuso local

const salvaAnuncio = db.prepare(`INSERT OR REPLACE INTO anuncios
  (ad_id, page_id, page_name, nicho, inicio, copias, link, dominio, texto, visto_em, imagem) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const salvaMedicao = db.prepare('INSERT OR REPLACE INTO medicoes VALUES (?,?,?)');

// Os anúncios vêm em JSON aninhado, tanto no HTML inicial quanto nas respostas do /api/graphql ao rolar.
function extrair(obj, out) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj.collated_results)) out.ads.push(...obj.collated_results);
  if (obj.search_results_connection?.count != null) out.total = obj.search_results_connection.count;
  for (const v of Object.values(obj)) extrair(v, out);
}
function parse(pedacos, out) {
  for (const p of pedacos) try { extrair(JSON.parse(p), out); } catch {}
}
const scriptsJson = html => [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'pt-BR' });
let atual; // coletor da navegação em andamento
page.on('response', async r => {
  if (!r.url().includes('/api/graphql')) return;
  const alvo = atual;
  parse((await r.text().catch(() => '')).split('\n'), alvo);
});

async function abrir(url, rolagens = 0) {
  const out = atual = { ads: [], total: null };
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.innerHTML.includes('search_results_connection'),
    null, { timeout: 20000, polling: 500 }).catch(() => {});
  parse(scriptsJson(await page.content()), out);
  for (let i = 0; i < rolagens; i++) { await page.mouse.wheel(0, 20000); await page.waitForTimeout(2500); }
  await page.waitForTimeout(1000 + Math.random() * 2000); // respiro pra não tomar bloqueio
  return out;
}

function salvar(ads, nicho) {
  for (const a of ads) {
    const s = a.snapshot ?? {};
    let dominio = '';
    try { dominio = new URL(s.link_url).hostname.replace(/^www\./, ''); } catch {}
    // anúncio de catálogo vem com texto modelo tipo {{product.brand}}; cai pro texto do card
    const texto = [s.body?.text, s.cards?.[0]?.body, s.title].find(t => t && !t.includes('{{')) ?? '';
    // ponytail: URL assinada do CDN da Meta, expira em dias; a coleta diária renova
    const imagem = s.images?.[0]?.resized_image_url ?? s.videos?.[0]?.video_preview_image_url
      ?? s.cards?.[0]?.resized_image_url ?? s.cards?.[0]?.video_preview_image_url ?? null;
    salvaAnuncio.run(a.ad_archive_id, a.page_id, a.page_name ?? s.page_name ?? null, nicho, a.start_date ?? null,
      a.collation_count ?? 1, s.link_url ?? null, dominio, texto.slice(0, 500), hoje, imagem);
  }
}

const medidas = new Set();
for (const nicho of nichos) {
  const { ads, total } = await abrir(`${BASE}&search_type=keyword_unordered&q=${encodeURIComponent(nicho)}`, ROLAGENS);
  if (!ads.length) { console.log(`${nicho}: nenhum anúncio (bloqueio ou a Meta mudou o layout?)`); continue; }
  salvar(ads, nicho);

  // Mede primeiro as páginas que mais duplicaram criativo na amostra.
  const peso = {};
  for (const a of ads) peso[a.page_id] = (peso[a.page_id] ?? 0) + (a.collation_count ?? 1);
  const paginas = Object.keys(peso).filter(id => !medidas.has(id)).sort((x, y) => peso[y] - peso[x]).slice(0, MAX_PAGINAS);
  console.log(`${nicho}: ${ads.length} anúncios na amostra (${total ?? '?'} no total), medindo ${paginas.length} páginas`);

  for (const id of paginas) {
    const r = await abrir(`${BASE}&search_type=page&view_all_page_id=${id}`);
    if (r.total == null) { console.log(`  ${id}: sem contagem, pulando`); continue; }
    salvar(r.ads, nicho);
    salvaMedicao.run(id, hoje, r.total);
    medidas.add(id);
    console.log(`  ${r.ads[0]?.page_name ?? id}: ${r.total} ativos`);
  }
}
await browser.close();
