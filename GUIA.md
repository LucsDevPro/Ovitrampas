# GUIA RÁPIDO (leia só este arquivo primeiro; o README.md é o detalhe)

Sistema estático (GitHub Pages) de ovitrampas — Prefeitura de Ponta Porã/MS, SEV - Setor de endemias e vetores.
Duas páginas: `index.html` (mapa de campo) e `gestao.html` (painel da gestão, somente leitura). Sem build.

## Onde mexer em cada assunto
| Assunto | Arquivo |
|---|---|
| Textos/menus/botões do mapa de campo | `index.html` |
| Textos/abas do painel de gestão | `gestao.html` |
| Cores, fontes, espaçamentos base | `assets/css/tokens.css` (variáveis) · `base.css` |
| Visual do mapa de campo | `assets/css/app.css` |
| Visual da gestão (tema claro/escuro, impressão) | `assets/css/gestao.css` (blocos finais vencem os iniciais) |
| Faixas de ovos (cores/formas), categorias PE/AI, carregamento | `assets/js/boot.js` |
| Mapa de campo, por arquivo (carregados em ordem pelo boot.js) | `assets/js/app/` |
| Painel de gestão, por arquivo (ordem em `gestao.html`) | `assets/js/gestao/` |
| Dados | `data/` (`2026.json` contagens, `enderecos.json`, `agentes.json`, `manifest.json`) |
| Atualizar dados / corrigir ruas / versão | `tools/` |

### assets/js/app/ (mapa de campo)
01-dados (carga) · 02-mapa (mapa, busca, seleção) · 03-agrupar-validar (agrupar por proximidade, coordenadas) · 04-grid · 05-relatorio (abre a folha) · 06-print (imagem do relatório, mapa MapLibre, QR) · 07-agentes-lote (agentes, equipes, lote) · 08-importar (planilhas) · 08b-ruas (correção de nomes de rua) · 09-indicadores (IPO/IDO/IDV e Resumo gerencial PDF) · 10-rota (ordem e link Google Maps) · 11-grid-analise · 12-offline · 13-publicar (pacote de dados) · 14-inicio (por último).

### assets/js/gestao/ (painel de gestão)
01-base (dados, filtros, indicadores, mapa, mapa de calor) · 02-anual-focos (abas Análise anual e Focos) · 03-alertas-hist (alertas e histórico por ovitrampa) · 04-imprimir (ícone de impressora) · 05-whatsapp (resumo texto+imagem) · 06-extras (esconder equipes, tema, impressão do mapa).

## Regras
- Todos os `.js` de cada página dividem o MESMO escopo global: uma função/const definida em um arquivo vale nos outros. Não duplicar nomes.
- Fontes: Unbounded (títulos/números) e Bricolage (texto); definidas em `tokens.css` (`--font`, `--font-d`).
- Termo oficial: "SEV - Setor de endemias e vetores". "Ovitrampas fixas" = as numeradas 1–242. PE = ponto estratégico, AI = aldeia.
- Contagens mensais são sempre inteiros.

## Depois de QUALQUER mudança (obrigatório)
1. `node --check arquivo.js` em cada JS alterado.
2. `python3 tools/versao.py` e depois `python3 tools/versao.py --verificar` (atualiza o `?v=` em tudo e no `sw.js`).
3. Se mudou dados: `python3 tools/atualizar_dados.py --manifest` e `--verificar`.
4. Subir para o GitHub. Novo arquivo JS: acrescentar em `gestao.html`/`boot.js` (ordem) e na lista do `sw.js`.

## Para economizar tokens
Abra só o arquivo da tabela acima; use `grep -n "palavra" assets/js/...` em vez de ler arquivos inteiros. Não precisa ler `assets/vendor/` (bibliotecas) nem `data/*.json`.
