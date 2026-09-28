# Radar de Ofertas

Espião de ofertas escaladas. Varre a [Biblioteca de Anúncios da Meta](https://www.facebook.com/ads/library/) atrás de anúncios ativos no Brasil, mede quantos anúncios cada página tem no ar dia após dia e mostra tudo num painel local.

A lógica é simples: **ninguém mantém anúncio no ar dando prejuízo**. Por isso uma oferta que está vendendo deixa rastros públicos:

| Sinal | O que indica |
|---|---|
| Muitos anúncios ativos | Verba alta: a oferta paga a conta |
| Anúncio antigo ainda no ar | Criativo validado, que roda há semanas ou meses |
| Número de anúncios subindo | A oferta está escalando agora |

---

## Requisitos

- **Node.js 24** ou mais recente ([nodejs.org](https://nodejs.org/)). O projeto usa o SQLite e o servidor HTTP que já vêm no Node, sem banco externo.
- Windows, macOS ou Linux, com internet.

## Instalação

```bash
git clone https://github.com/DUZINz/bot-ofertas.git
cd bot-ofertas
npm install
npx playwright install chromium
```

O último comando baixa o navegador que o coletor usa para abrir a Biblioteca de Anúncios. Só precisa rodar uma vez.

---

## Como usar

O uso tem duas partes: o **coletor** busca os dados e o **painel** mostra os resultados.

### 1. Escolha os nichos

Edite o arquivo [`nichos.txt`](nichos.txt) e coloque uma palavra-chave por linha. Linhas que começam com `#` são ignoradas.

```text
# Uma palavra-chave por linha. Linhas com # são ignoradas.
emagrecer
renda extra
curso online
```

> **Dica:** termos genéricos como "renda extra" trazem empresas grandes (bancos, maquininhas). Para infoproduto, termos mais específicos funcionam melhor: "método comprovado", "aula gratuita", "desafio 21 dias".

### 2. Rode a coleta

```bash
npm run coletar
```

Para buscar palavras avulsas sem mexer no `nichos.txt`:

```bash
node coletar.mjs "aula gratuita" "desafio 21 dias"
```

Para cada nicho, o coletor faz duas coisas:

1. **Descoberta:** busca a palavra na Biblioteca de Anúncios (anúncios ativos no Brasil) e rola a página para juntar cerca de 100 anúncios.
2. **Medição:** abre as 40 páginas que mais duplicaram criativo e anota o total de anúncios ativos de cada uma.

Cada nicho leva uns **3 a 4 minutos**. O terminal mostra o progresso:

```text
emagrecer: 171 anúncios na amostra (41953 no total), medindo 40 páginas
  Andressa Carolina - Mães Que Treinam: 504 ativos
  Renato Cariani: 499 ativos
  ...
```

Tudo fica salvo em `ofertas.db`, um arquivo SQLite criado sozinho na pasta do projeto.

### 3. Abra o painel

```bash
npm run painel
```

Depois acesse **http://localhost:3000** no navegador. Para parar o painel, aperte `Ctrl+C` no terminal.

Para usar outra porta:

```bash
# macOS / Linux / Git Bash
PORT=3001 npm run painel
```

```powershell
# PowerShell
$env:PORT=3001; npm run painel
```

O painel lê o banco a cada recarregamento. Depois de uma coleta nova, basta apertar `F5`.

Ele só responde no próprio computador (`localhost`): outros aparelhos da rede e sites de fora não conseguem acessar.

---

## Lendo o painel

### Indicadores do topo

Clicar num cartão filtra a lista.

| Cartão | Critério |
|---|---|
| **Monitoradas** | Todas as páginas medidas, com o total de anúncios no ar |
| **Validadas** | 30+ dias no ar **e** 50+ anúncios ativos |
| **Novas e fortes** | Menos de 30 dias no ar **e** 100+ anúncios ativos, ou seja, oferta nova escalando rápido |
| **Escalando** | Mais anúncios ativos do que há 7 dias |

### Colunas da lista

| Coluna | Significado |
|---|---|
| **Oferta** | Miniatura do criativo mais antigo, nome da página, domínio da página de vendas e nicho |
| **Sinal** | Validada, Nova e forte ou Em teste |
| **Anúncios ativos** | Total que a página tem no ar hoje. A barra compara com a maior da lista |
| **Tendência 30d** | Anúncios ativos em cada coleta dos últimos 30 dias, mais a variação em 7 dias |
| **No ar** | Idade do anúncio mais antigo ainda ativo |

Clique no título de uma coluna para ordenar por ela.

A lista traz as páginas medidas na **última semana de coletas**. Uma página que saiu das buscas some da lista em vez de ficar parada com um número velho; o histórico dela continua no banco. A lista mostra 200 linhas por vez, e o botão **Mostrar mais** no fim carrega as próximas.

### Dossiê da oferta

Clique em qualquer linha para abrir o painel lateral com:
- o criativo em tamanho grande;
- o histórico com eixos, que mostra o valor de cada dia ao passar o mouse;
- a copy completa do anúncio;
- links para a Biblioteca de Anúncios, a página de vendas e o anúncio mais antigo.

Fecha com `Esc`, com o `X` ou clicando fora.

### Filtros e atalhos

- `/` leva o cursor para a busca, que procura por nome da página, domínio ou texto do anúncio.
- **Nicho** mostra só um nicho.
- **Ocultar redes e marketplaces** esconde páginas cujo link vai para Instagram, WhatsApp, Mercado Livre, Shopee, Amazon, lojas de apps etc. Vem ligado por padrão.

### Status da coleta

O selo no topo mostra **MONITORANDO** quando a última coleta foi hoje ou ontem, e **COLETA ATRASADA** quando passou mais tempo que isso.

> A tendência e o cartão **Escalando** só aparecem **a partir do 2º dia de coleta**, porque é a comparação entre dias que mostra quem está crescendo.

---

## Coleta automática diária

A tendência só tem valor com uma coleta por dia. Agende pra rodar sozinha:

**Windows** (PowerShell ou Prompt, todo dia às 8h). Troque o caminho pelo da sua pasta:

```powershell
schtasks /create /tn "bot-ofertas" /sc daily /st 08:00 /tr "cmd /c cd /d C:\caminho\para\bot-ofertas && npm run coletar >> coleta.log 2>&1"
```

Para remover: `schtasks /delete /tn "bot-ofertas"`.

**macOS / Linux** (`crontab -e`):

```text
0 8 * * * cd /caminho/para/bot-ofertas && npm run coletar >> coleta.log 2>&1
```

O computador precisa estar ligado no horário. O resultado de cada execução fica em `coleta.log`.

---

## Ajustes

| O quê | Onde | Padrão |
|---|---|---|
| Rolagens na busca por palavra (cerca de 10 anúncios cada) | `ROLAGENS` em [`coletar.mjs`](coletar.mjs) | `10` |
| Páginas medidas por nicho | `MAX_PAGINAS` em [`coletar.mjs`](coletar.mjs) | `40` |
| Critérios de Validada / Nova e forte | linha `r.situacao = ...` em [`painel.mjs`](painel.mjs) | 30 dias, 50 e 100 anúncios |
| Domínios escondidos pelo filtro de redes | `REDES` em [`painel.mjs`](painel.mjs) | redes sociais, marketplaces, lojas de apps |

Aumentar `ROLAGENS` e `MAX_PAGINAS` pega mais ofertas, mas deixa a coleta mais lenta e aumenta a chance de a Meta bloquear o acesso.

## Estrutura

| Arquivo | Função |
|---|---|
| [`coletar.mjs`](coletar.mjs) | Abre a Biblioteca de Anúncios com Playwright, lê os dados e grava no banco |
| [`painel.mjs`](painel.mjs) | Servidor local com o painel (HTML, CSS e JS num arquivo só) |
| [`banco.mjs`](banco.mjs) | Cria e atualiza as tabelas do SQLite, usado pelos dois acima |
| [`nichos.txt`](nichos.txt) | Palavras-chave da coleta |
| `ofertas.db` | Banco com os dados coletados (gerado automaticamente) |

O banco tem duas tabelas:
- `anuncios`: um registro por anúncio, com página, texto, link, miniatura e data de início;
- `medicoes`: total de anúncios ativos de cada página em cada dia. É daqui que saem a tendência e a variação em 7 dias.

---

## Problemas comuns

| Mensagem / sintoma | O que fazer |
|---|---|
| `Porta 3000 ocupada` | O painel já está aberto em outro terminal. Feche-o ou use outra porta (`PORT=3001`) |
| `Executable doesn't exist` ao coletar | Falta o navegador do Playwright: `npx playwright install chromium` |
| `nenhum anúncio (bloqueio ou a Meta mudou o layout?)` | A Meta pode ter limitado o acesso. Espere algumas horas e diminua `MAX_PAGINAS`. Se continuar, a estrutura da página mudou e o coletor precisa de ajuste |
| `sem contagem, pulando` | Aquela página não carregou a tempo. É normal acontecer de vez em quando |
| `falha ao abrir ... net::ERR_...` | Queda de internet ou timeout naquela página. A coleta registra e segue com as próximas |
| Tarefa agendada aparece como falha | Nenhuma página foi medida (sem internet ou bloqueio). Veja o motivo no `coleta.log` |
| Miniatura mostra só uma letra | O link da imagem expirou (o CDN da Meta renova em poucos dias) ou a página foi coletada numa versão antiga. A próxima coleta resolve |
| Tendência mostra "1ª leitura" | Só existe uma coleta daquela página. Espere a coleta do dia seguinte |

## Aviso

O coletor lê páginas públicas da Biblioteca de Anúncios pelo navegador, o que vai contra os termos de uso da Meta. Use com moderação, com uma coleta por dia e poucos nichos, para não ter o IP bloqueado. Os dados servem para pesquisa de mercado; não copie criativos ou copies de terceiros.
