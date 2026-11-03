# Sistema de ovitrampas — Prefeitura de Ponta Porã/MS

Dois sistemas que leem os mesmos arquivos de dados:

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | coordenação e agentes | mapa de campo: agentes e equipes, relatórios (PNG/PDF), grid, rota com QR, importação de planilhas, registros de campo |
| `gestao.html` | gestores | painel somente leitura: indicadores, mapa, análise mensal, focos e alertas, impressão em PDF |

## Estrutura

```
index.html  gestao.html  sw.js
assets/   css/ (tokens, base, app, gestao) · js/ (boot, ui, gestao) · js/app/ (mapa de campo em 14 arquivos) · vendor/ (bibliotecas) · fonts/ · img/ (logo)
data/     manifest.json · enderecos.json · agentes.json · 2026.json (um arquivo por ano)
tools/    atualizar_dados.py · versao.py
```

**Dados (`data/`)** — cada informação existe em um único lugar:
- `enderecos.json`: rua, número e coordenadas das ovitrampas (+ pontos extras e o registro de correções). Não muda com as planilhas de resultados.
- `agentes.json`: agentes, áreas, zonas e equipes.
- `AAAA.json`: resultados do ano (série mensal por ovitrampa, média histórica, registros de campo). Um arquivo por ano; os anos antigos não são recarregados.
- `manifest.json`: lista de arquivos e a versão (hash) de cada um. As páginas buscam o manifesto sempre e os demais arquivos só quando a versão muda (cache).

**Carregamento leve:** o HTML tem ~20 KB. As bibliotecas pesadas (PDF, ZIP, QR, mapa vetorial) só são baixadas quando você usa o recurso. O service worker guarda o sistema e os dados para uso sem internet.

## Publicar no GitHub Pages (uma vez)
1. Crie um repositório e envie **todo o conteúdo desta pasta** (mantendo as subpastas).
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Endereços: `https://SEU-USUARIO.github.io/REPO/` (mapa de campo) e `.../gestao.html` (painel).

> O sistema precisa ser aberto pelo endereço do site (ou por um servidor local, ex.: `python -m http.server`). Abrir o arquivo direto do disco não permite ler os dados.

## Atualizar os dados (sem perder o histórico)

**Opção A — pelo mapa de campo:** Dados e conferência → Importar planilha (CSV "contaovos-ovitrampas", com todas as leituras do ano) → Aplicar → **Publicar dados para a gestão** → baixa `dados-publicacao-AAAA-MM-DD.zip`. Extraia e envie a pasta `data/` ao GitHub (Add file → Upload files), substituindo os arquivos. O pacote parte dos dados já publicados e acrescenta o que mudou; meses anteriores e registros de campo são preservados.

**Opção B — pelo script (computador com Python 3):**
```
python tools/atualizar_dados.py planilha.csv     # mescla a planilha em data/AAAA.json
python tools/atualizar_dados.py --verificar      # confere integridade (IDs, coordenadas, séries, hashes)
```
O script **nunca altera** `enderecos.json` (só lista coordenadas que diferem mais de 50 m), usa a média das leituras quando um mês tem mais de uma, e é idempotente (rodar duas vezes não muda nada).

## Regras mantidas
- Faixas de ovos: 0 · 1–20 · 21–50 · 51–100 · 101+ · sem informação (cores e limites inalterados).
- IPO = positivas ÷ ovitrampas com contagem · IDO = ovos ÷ positivas · IDV = ovos ÷ ovitrampas com contagem.
- Coordenadas e IDs (1–242) preservados; nenhum endereço ou coordenada foi inventado.

## Privacidade
Em repositório **público**, qualquer pessoa com o link vê as páginas e baixa os arquivos de `data/`. Ao publicar pelo mapa de campo dá para desmarcar "nomes dos agentes" e "ruas, números e coordenadas exatas".

## Para quem for alterar o código (guia rápido)
O mapa de campo (`index.html`) foi dividido em arquivos pequenos em `assets/js/app/`. Eles são carregados **nesta ordem** por `assets/js/boot.js` e compartilham as mesmas variáveis. Para mudar algo, abra só o arquivo da função:

| Arquivo | Função |
|---|---|
| `01-dados.js` | lista oficial das ovitrampas, correções, dados guardados no aparelho, utilidades |
| `02-mapa.js` | mapa, filtros, pesquisa, menu móvel, mapa guardado no aparelho |
| `03-agrupar-validar.js` | agrupar por proximidade; conferência das coordenadas |
| `04-grid.js` | grid de quadrículas |
| `05-relatorio.js` | relatório de campo (folha do agente) |
| `06-print.js` | print do mapa em PNG/PDF |
| `07-agentes-lote.js` | agentes, equipes e mapas em lote |
| `08-importar.js` | importar planilha (leituras ou mensal), exportar CSV/JSON |
| `09-indicadores.js` | registro de campo, IPO/IDO/IDV, resumo gerencial |
| `10-rota.js` | rota sugerida e QR |
| `11-grid-analise.js` | análise do grid e KML |
| `12-offline.js` | uso sem internet |
| `13-publicar.js` | publicar pacote `data/` para a gestão |
| `14-inicio.js` | início (**sempre o último**) |

Ao criar um arquivo novo, inclua o nome na lista de `boot.js` e de `sw.js`. Ao mudar qualquer arquivo de código, rode `python tools/versao.py`: ele troca sozinho o código de versão (`?v=...`) em `index.html`, `gestao.html`, `boot.js` e `sw.js`. Sem isso, os aparelhos continuam usando a versão guardada. `python tools/versao.py --verificar` só confere, sem alterar.

## Planilha de leituras (a que chega todo mês)
Arquivo CSV `contaovos-ovitrampas-ponta-pora.csv` (uma linha por ovitrampa e semana, aceita acentos em UTF-8 ou Windows-1252).
Só estas colunas são lidas; **todas as outras são ignoradas** (município, IDs do sistema, responsável pelo imóvel, bairro, local, rua e número da planilha etc.):

| Coluna da planilha | Para quê |
|---|---|
| `Ovitrampa (número no município)` | qual ovitrampa (1–242; pontos como "500 PE" entram como pontos extras) |
| `Ovos` | contagem de ovos |
| `Data de coleta da palheta` | define o **mês** da leitura |
| `Média histórica de ovos da ovitrampa` | linha de base |
| `Latitude`, `Longitude` | só para conferência e pontos extras novos |

Várias leituras no mesmo mês (ex.: duas semanas de fevereiro) viram a **média**. Coordenadas da planilha que diferem mais de 50 m da base são apenas listadas, nunca aplicadas. Pode importar a planilha inteira todo mês: o resultado é o mesmo e o histórico é mantido.

## Cadastro unificado, última instalação e pontos à parte
- **Um só lugar para endereço e coordenadas:** a planilha de leituras alimenta tudo. Ao importar (pelo mapa ou por `tools/atualizar_dados.py`), `data/enderecos.json` é atualizado sozinho a partir da **leitura mais recente de cada ovitrampa** (a última instalação). Não há cadastro manual separado para manter.
- **Coordenada:** é sempre a da última instalação. Cada mudança fica no registro de correções (painel de conferência), com a data.
- **Endereço:** é sempre o da última instalação (rua e número da planilha). Se a rua da planilha for a mesma com erro de digitação ("Travesa Iguatemi"), fica a grafia já conferida; se for outra rua, entra a da planilha. O texto é limpo ("Rua: x" → "Rua X") e cada troca fica no registro de correções.
- **Relatório do agente:** a coluna "Última instalação" mostra a data de instalação, a data de recolhimento e as 3 últimas contagens (`data/AAAA.json`, campo `campo`). O balão da ovitrampa mostra o mesmo.
- **Contagens à parte (não entram no IPO/IDO/IDV da malha 1–242):** ids com `PE` ("500 PE") são **pontos estratégicos**; ids com `AI` são **aldeia**; qualquer outro id fora da malha entra em "outros pontos". Aparecem no painel da gestão, em "Contagens à parte" e na aba de focos, cada grupo com seu IPO. A planilha atual não tem pontos AI; quando chegarem, entram sozinhos.
- **Não são lidos nem guardados:** nome e telefone do responsável pelo imóvel, bairro, local no imóvel e IDs internos do sistema.

## Correção dos nomes de rua
A rua da planilha vem digitada à mão (sem acento, "Rua:" colado, erros como "Travesa", números dentro do nome, prefixos misturados). Por isso **todo nome de rua passa por um dicionário** guardado em `data/enderecos.json` (campo `ruas`: nome sem acento e sem "Rua/Av." → nome correto). Vale para o cadastro inteiro e para cada planilha nova, igual no script Python (`tools/ruas.py`) e no mapa de campo (`assets/js/app/08b-ruas.js`).
- Padroniza o tipo (`Rua`, `Av.`, `Travessa`, `Alameda`, `Rodovia BR-463`), os acentos e as maiúsculas ("ANSELMO SOARES" → "Rua Anselmo Soares").
- Erro de digitação e nome abreviado viram o nome do dicionário ("Travesa Iguatemi" → "Travessa Iguatemi", "Jorge R. Salomão" → "Rua Jorge Roberto Salomão"). Datas diferentes nunca se misturam ("13 de Setembro" ≠ "7 de Setembro").
- Referência do local fica entre parênteses: "Av. Brasil (Loja de Gesso)". Número digitado dentro da rua ("Hélio Brandão 951") vai para a coluna do número. Lugares como "Cemitério …" ou "Guarda (AGETRAN)" não ganham "Rua".
- Rua que não está no dicionário entra nele, arrumada e com "Rua" na frente, e o importador avisa em **RUAS NOVAS** para você conferir a grafia.
- Cada nome padronizado fica no registro de correções (`correcoes`, campo `rua`).

## Visual (cores e formas)
- Faixas de ovos: cores fortes em `assets/js/boot.js` (`COR_FAIXA`, `FORMA_FAIXA`; as mesmas em `01-dados.js`, `gestao.js` e `tokens.css`). Cada faixa tem também uma forma (círculo, triângulo, losango, quadrado, estrela, triângulo invertido), para impressão em preto e branco e daltonismo.
- Painel de gestão: cartões separados para malha, pontos estratégicos (PE) e aldeia (AI), cada um com seu IPO (`resumoAParte` em `gestao.js`).
- Mapa de campo: dicas de cada seção ficam atrás do botão "?" (código no fim de `14-inicio.js`).
- Relatório: coluna "Última instalação" mais larga e com letra maior (`06-print.js`, objeto `col`).
- Depois de qualquer mudança de código: `python tools/versao.py`.

## Alertas e histórico (painel de gestão)
- Aba "Resumo atual": bloco "Alertas" compara o último mês com o anterior: ficaram positivas (0 → mais de 0), subiram muito (+30 ovos e 1,5× ou mais; ajuste em `LIM_SUBIDA`, `gestao.js`) e negativaram.
- Aba "Histórico por ovitrampa": escolha o número (ou toque no ID nos alertas) para ver gráfico do ano, média histórica, meses positivos e últimas contagens semanais; abaixo, tabela com todas as ovitrampas.

## Ajustes de novembro
- Mapa de campo (relatório do agente): a altura do mapa acompanha o formato da área dos pontos, com margem menor e zoom até 19 (`renderMapa` em `06-print.js`).
- Painel de gestão: o mapa esconde as ovitrampas com 0 ovos; marque "Mostrar também as ovitrampas com 0 ovos" para voltar (vale para o mapa do resumo e o do mês).
- Evolução semanal: o número do maior valor não fica mais cortado, e a ovitrampa lida mais de uma vez na mesma semana vale uma vez (média). Antes, a SE 6 contava em dobro.
- Zonas 43 (Sanga 1) e 44 (Sanga 2) marcadas como zona rural em `data/agentes.json`.

## Visual do painel de gestão (estilo dashboard)
Cabeçalho escuro com os indicadores gerais (IPO, IDO, IDV, positivas, ovos, sem contagem) e cartões brancos limpos em fundo claro. As cores ficam no fim de `assets/css/gestao.css` (variáveis `--hd`, `--ac`, `--ac2`). Na impressão o cabeçalho volta a ser claro.

## Fontes
Unbounded (títulos e números do painel) e Bricolage Grotesque (texto), ambas licença OFL, em `assets/fonts/`. As folhas impressas/PDF continuam com Archivo (mais legível no papel).

## Números inteiros e ordenação
- A contagem mensal de cada ovitrampa é sempre um número inteiro: se houve mais de uma leitura no mês, vale a média arredondada (qualquer média acima de 0 vale ao menos 1). Regra igual em `tools/atualizar_dados.py` (`ovos_int`) e em `08-importar.js`.
- Qualquer tabela do painel e do mapa de campo ordena ao tocar no título da coluna (A–Z / Z–A, números e datas). Código no fim de `assets/js/boot.js`.

## Imprimir só uma parte
Cada tabela e cartão do painel de gestão tem um ícone de impressora no título; ele imprime só aquela parte, com cabeçalho (logo, título e data). Na aba "Histórico por ovitrampa", o botão "Imprimir esta ovitrampa" gera a folha com o gráfico e os números dela para entregar ao agente da área. Código: `imprimeAlvo` em `assets/js/gestao.js`.

## Mapa de calor
Marque "Mapa de calor" acima do mapa (resumo e mapa do mês) para ver a concentração de ovos: azul/verde = pouco, amarelo/laranja = médio, vermelho = muito (100 ovos ou mais pesa o máximo; 0 ovos não esquenta). Biblioteca: `assets/vendor/leaflet-heat.js`; código: `calorCamada` em `gestao.js`.

## Resumo para WhatsApp
Aba "Resumo para WhatsApp" do painel de gestão: escolha o mês e copie o texto pronto (IPO, ovos, positivas, IDO, alertas, equipes e maiores contagens, sempre comparando com o mês anterior) ou baixe/compartilhe a imagem 1080×1920 para o status. Código: `zapDados`, `zapTexto`, `zapImagem` e `zapRender` em `assets/js/gestao.js`.

## Média histórica
Saiu de todas as telas do painel de gestão (indicador, gráfico, tabelas, balões do mapa e histórico por ovitrampa), para não confundir quem não é da área. A coluna continua sendo lida da planilha e guardada nos dados (`base` em `data/2026.json`), caso precise voltar a usar.

## Ajustes de novembro/2026
- Organizar por: padrão "por zona". Buscar e selecionar: botão "Selecionar" em cada resultado e botão "Gerar mapa". Relatório com lista de endereços até 40 ovitrampas e QR de rota em trechos de 10.
- Agrupar por proximidade: usa as selecionadas (≥2) ou as visíveis; divide grupos grandes.
- Menu Indicadores em destaque, com o mês no título.
- Gestão: botão imprimir no canto superior direito de cada tabela; mapa de calor liga cada positiva à positiva mais próxima (até 700 m) com cores mais fortes; cabeçalho alinhado com a página; botão "Esconder equipes".
