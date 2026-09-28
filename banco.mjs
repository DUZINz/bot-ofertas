// Banco SQLite compartilhado pelo coletor e pelo painel.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Caminho fixo ao lado do código: o agendador roda de qualquer pasta sem criar um banco novo por engano.
export const db = new DatabaseSync(fileURLToPath(new URL('ofertas.db', import.meta.url)), { timeout: 5000 }); // espera se o outro processo estiver gravando
db.exec(`
  CREATE TABLE IF NOT EXISTS anuncios (ad_id TEXT PRIMARY KEY, page_id TEXT, page_name TEXT, nicho TEXT,
    inicio INTEGER, copias INTEGER, link TEXT, dominio TEXT, texto TEXT, visto_em TEXT, imagem TEXT);
  CREATE TABLE IF NOT EXISTS medicoes (page_id TEXT, dia TEXT, ativos INTEGER, PRIMARY KEY (page_id, dia));
`);
try { db.exec('ALTER TABLE anuncios ADD COLUMN imagem TEXT'); } catch {} // bancos criados antes da miniatura
db.exec(`
  CREATE INDEX IF NOT EXISTS anuncios_pagina ON anuncios (page_id, visto_em);
  CREATE INDEX IF NOT EXISTS medicoes_dia ON medicoes (dia);
`);
