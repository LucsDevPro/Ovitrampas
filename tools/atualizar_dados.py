#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atualiza os arquivos de dados do sistema de ovitrampas (pasta data/) sem perder o histórico.

Uso:
  python tools/atualizar_dados.py planilha-contaovos.csv     # mescla a planilha mensal nos arquivos por ano
  python tools/atualizar_dados.py --verificar                # confere a integridade dos arquivos
  python tools/atualizar_dados.py --manifest                 # só recalcula manifest.json (versões)

Regras (para preservar a integridade dos dados):
  * data/enderecos.json (ruas, números e coordenadas das ovitrampas) NUNCA é alterado pela planilha.
    Diferenças de coordenada maiores que 50 m são apenas listadas, para decisão humana.
    Só são acrescentados ali pontos extras novos (ex.: pontos estratégicos), com a coordenada da planilha.
  * data/AAAA.json recebe os meses da planilha. Meses que já existiam e não vêm na planilha são mantidos;
    meses que vêm na planilha substituem os de mesmo mês. Registros de campo ("campo") nunca são tocados.
  * Mês com mais de uma leitura por ovitrampa: usa-se a MÉDIA das leituras (somar dobraria os ovos).
Sem dependências além do Python 3.8+.
"""
import argparse, csv, io, json, math, os, re, sys, unicodedata
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ruas as RUAS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, 'data')
ESQUEMA = 2

def fnv1a(b: bytes) -> str:
    h = 0x811c9dc5
    for x in b:
        h ^= x
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def caminho(nome): return os.path.join(DATA, nome)

def ler_json(nome, padrao=None):
    p = caminho(nome)
    if not os.path.exists(p): return padrao
    with open(p, encoding='utf-8') as f: return json.load(f)

def texto_json(obj): return json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n'

def salvar_json(nome, obj):
    """Grava só se mudou. Retorna True se alterou."""
    novo = texto_json(obj)
    p = caminho(nome)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            if f.read() == novo: return False
    os.makedirs(DATA, exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f: f.write(novo)
    return True

def norm(t):
    t = unicodedata.normalize('NFD', str(t or ''))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9º° ]+', ' ', t)).strip()

def num(t):
    t = str(t or '').replace('*', '').strip().replace(',', '.')
    return float(t) if re.fullmatch(r'-?\d+(\.\d+)?', t) else None

def coord(t):
    t = str(t or '').strip().replace(',', '.')
    return t if re.fullmatch(r'-?\d{1,3}\.\d+', t) else None

def dist_m(la1, lo1, la2, lo2): return math.hypot((la2 - la1) * 110574, (lo2 - lo1) * 102500)

def mes_da_data(t):
    t = str(t or '').strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', t)
    if m: return '%s-%02d' % (m.group(3), int(m.group(2)))
    m = re.match(r'(\d{4})-(\d{2})-\d{2}', t)
    return '%s-%s' % (m.group(1), m.group(2)) if m else None

def data_br(t):
    """'08/10/2026' → '2026-10-08' (ou None)."""
    m = re.match(r'\s*(\d{1,2})/(\d{1,2})/(\d{4})', str(t or ''))
    return '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1))) if m else None

def ler_leituras(linhas, cab, col):
    """Planilha de leituras (uma linha por ovitrampa e semana). Usa só: nº da ovitrampa, ovos, datas de
    instalação/coleta, média histórica, latitude, longitude, rua e número. O resto é ignorado.
    Várias leituras no mês viram a MÉDIA. Devolve (linhas no formato mensal, colunas, última instalação de cada ovitrampa)."""
    I = dict(id=col(r'^ovitrampa( numero.*)?$'), ovos=col(r'^ovos$'), data=col(r'^data de coleta'), inst=col(r'^data de instalacao'),
             base=col(r'^media historica'), lat=col(r'^latitude'), lon=col(r'^longitude'), rua=col(r'^rua$'), num=col(r'^numero$'))
    if I['id'] is None or I['ovos'] is None or I['data'] is None: return None
    def cel(r, k):
        return r[I[k]].strip() if I[k] is not None and I[k] < len(r) else ''
    G, ign, ult, hist = {}, 0, {}, {}
    for r in linhas[1:]:
        if not r or len(r) <= max(I['id'], I['ovos'], I['data']): continue
        idt, mes, ov = r[I['id']].strip(), mes_da_data(r[I['data']]), num(r[I['ovos']])
        if not idt or not mes or ov is None: ign += 1; continue
        g = G.setdefault((mes, idt), dict(soma=0.0, n=0, base=None, lat='', lon=''))
        g['soma'] += ov; g['n'] += 1
        b = num(cel(r, 'base'))
        if b is not None: g['base'] = b
        la, lo = coord(cel(r, 'lat')), coord(cel(r, 'lon'))
        if la and lo: g['lat'], g['lon'] = la, lo
        dcol = data_br(r[I['data']])
        if dcol and categoria(idt) == 'malha': hist.setdefault(idt, {})[dcol] = (int(ov) if float(ov).is_integer() else ov, data_br(cel(r, 'inst')))
        if dcol and (idt not in ult or dcol >= ult[idt]['col']):       # última instalação = leitura de coleta mais recente
            ult[idt] = dict(col=dcol, inst=data_br(cel(r, 'inst')), rua=cel(r, 'rua'), num=cel(r, 'num'), lat=la, lon=lo)
    if ign: print('Linhas ignoradas (sem nº, data ou ovos): %d' % ign)
    print('Planilha de leituras reconhecida: %d leituras' % sum(g['n'] for g in G.values()))
    out = [[mes, idt, str(g['n']), repr(g['soma'] / g['n']), '' if g['base'] is None else repr(g['base']), g['lat'], g['lon']]
           for (mes, idt), g in sorted(G.items())]
    for k, h in hist.items(): ult[k]['hist'] = h
    return out, dict(mes=0, id=1, reg=2, soma=None, media=3, base=4, lat=5, lon=6), ult

def ler_planilha(caminho_csv):
    with open(caminho_csv, 'rb') as f: bruto = f.read()
    try: txt = bruto.decode('utf-8-sig')
    except UnicodeDecodeError: txt = bruto.decode('cp1252')   # planilha exportada com acentos em Windows-1252
    am = '\n'.join(txt.split('\n')[:8])
    d = '\t' if '\t' in am else (';' if am.count(';') >= am.count(',') and ';' in am else ',')
    linhas = list(csv.reader(io.StringIO(txt), delimiter=d))
    cab = [norm(x) for x in linhas[0]]
    def col(rx):
        for i, c in enumerate(cab):
            if re.search(rx, c): return i
        return None
    C = dict(mes=col(r'^mes$'), id=col(r'^ovitrampa( numero.*)?$'), reg=col(r'^registros$'), soma=col(r'^soma de ovos$'),
             media=col(r'^media de ovos$'), base=col(r'^media de media historica'), lat=col(r'^latitude'), lon=col(r'^longitude'))
    if C['mes'] is None:
        L = ler_leituras(linhas, cab, col)
        if L: return L
    if C['mes'] is None or C['id'] is None or (C['media'] is None and C['soma'] is None):
        sys.exit('Não reconheci as colunas da planilha (esperado: Mês, Ovitrampa, Registros, Média de ovos, ...). Cabeçalho lido: %s' % cab)
    return linhas[1:], C, None

def processar(linhas, C, ids_malha):
    v, base, ex, multi, geo = {}, {}, {}, {}, {}
    n_ok = 0
    usados = [x for x in C.values() if x is not None]
    for r in linhas:
        if not r or len(r) <= max(usados): continue
        mes, idt = r[C['mes']].strip(), r[C['id']].strip()
        if not re.fullmatch(r'\d{4}-\d{2}', mes) or not idt: continue
        reg = (num(r[C['reg']]) or 1) if C['reg'] is not None else 1
        val = num(r[C['media']]) if C['media'] is not None else None
        if val is None and C['soma'] is not None:
            s = num(r[C['soma']]); val = None if s is None else s / reg
        if val is None: continue
        n_ok += 1
        if reg > 1: multi[mes] = max(multi.get(mes, 0), int(reg))
        b = num(r[C['base']]) if C['base'] is not None else None
        la = coord(r[C['lat']]) if C['lat'] is not None else None
        lo = coord(r[C['lon']]) if C['lon'] is not None else None
        n = int(idt) if re.fullmatch(r'\d+', idt) else None
        if n in ids_malha:
            v.setdefault(n, {})[mes] = val
            if b is not None: base[n] = b
            if la and lo and (n not in geo or mes >= geo[n][0]): geo[n] = (mes, la, lo)
        else:
            e = ex.setdefault(idt, dict(v={}, base=None, lat=None, lon=None, mes=''))
            e['v'][mes] = val
            if b is not None: e['base'] = b
            if la and lo and mes >= e['mes']: e['lat'], e['lon'], e['mes'] = la, lo, mes
    return v, base, ex, multi, geo, n_ok

def categoria(idt):
    """malha (1–242) · pe (ponto estratégico: "500 PE", "P.E") · ai (aldeia: "AI") · outro."""
    t = str(idt).strip()
    if re.fullmatch(r'\d+', t): return 'malha'
    if re.search(r'(^|[\s._-])P\.?\s?E\.?($|[\s._-])', t, re.I): return 'pe'
    if re.search(r'(^|[\s._-])A\.?\s?I\.?($|[\s._-])', t, re.I): return 'ai'
    return 'outro'

def arred(x):
    """Mantém inteiros como inteiros e metades como .5 (média de 2 leituras)."""
    return int(x) if float(x).is_integer() else round(x, 4)

def ovos_int(x):
    """Contagem mensal sempre em número inteiro (média de 2 leituras arredonda; qualquer média acima de 0 vale ao menos 1)."""
    x = float(x)
    return 0 if x <= 0 else max(1, int(x + 0.5))

def mesclar_ano(ano, meses_novos, v, base, ex, multi, ult=None):
    nome = '%d.json' % ano
    atual = ler_json(nome) or dict(esquema=ESQUEMA, ano=ano, meses=[], multi={}, serie={}, base={}, extras={}, campo={}, atual={})
    def dic(meses, arr): return {m: x for m, x in zip(meses, arr) if x is not None}
    ant = atual['meses']
    S = {k: dic(ant, arr) for k, arr in atual['serie'].items()}
    X = {k: dict(base=e.get('base'), v=dic(ant, e['serie'])) for k, e in atual.get('extras', {}).items()}
    for n, mm in v.items():
        d = S.setdefault(str(n), {})
        for m, x in mm.items():
            if m.startswith(str(ano)) and m in meses_novos: d[m] = x
    for k, e in ex.items():
        d = X.setdefault(k, dict(base=None, v={}))
        for m, x in e['v'].items():
            if m.startswith(str(ano)): d['v'][m] = x
        if e['base'] is not None: d['base'] = e['base']
    meses = sorted(set(ant) | {m for m in meses_novos if m.startswith(str(ano))})
    atual['meses'] = meses
    atual['serie'] = {k: [ovos_int(S[k][m]) if m in S[k] else None for m in meses] for k in sorted(S, key=int)}
    atual['extras'] = {k: dict(base=(arred(X[k]['base']) if X[k]['base'] is not None else None),
                              serie=[ovos_int(X[k]['v'][m]) if m in X[k]['v'] else None for m in meses]) for k in sorted(X)}
    for n, b in base.items(): atual['base'][str(n)] = arred(b)
    atual['base'] = {k: atual['base'][k] for k in sorted(atual['base'], key=int)}
    for m, q in multi.items():
        if m.startswith(str(ano)): atual['multi'][m] = q
    atual['multi'] = dict(sorted(atual['multi'].items()))
    atual.setdefault('campo', {}); atual.setdefault('atual', {})
    # registro de campo de cada ovitrampa da malha: última instalação, último recolhimento e histórico de contagens.
    # A planilha atualiza as datas e as contagens de mesmo dia; o que já existia em outras datas é mantido.
    campo = atual.setdefault('campo', {})
    for k, u in (ult or {}).items():
        if not k.isdigit() or 'hist' not in u: continue
        c = campo.setdefault(k, {})
        hist = {x['d']: x['n'] for x in c.get('hist', [])}
        for d, (n, _) in u['hist'].items():
            if d.startswith(str(ano)): hist[d] = n
        if not hist: continue
        if u['col'].startswith(str(ano)) and u['inst'] and u['col'] >= c.get('rec', ''):
            c['inst'], c['rec'] = u['inst'], u['col']
        c['hist'] = [dict(d=d, n=hist[d]) for d in sorted(hist)]
    atual['campo'] = dict(sorted(campo.items(), key=lambda x: int(x[0])))
    return nome, atual

def atualizar_manifest(forcar=False):
    arquivos, anos = {}, []
    for nome in sorted(os.listdir(DATA)):
        if nome == 'manifest.json' or not nome.endswith('.json'): continue
        with open(caminho(nome), 'rb') as f: b = f.read()
        chave = nome[:-5]
        info = dict(url=nome, v=fnv1a(b))
        if re.fullmatch(r'\d{4}', chave):
            anos.append(int(chave)); info['meses'] = json.loads(b.decode('utf-8'))['meses']
        arquivos[chave] = info
    anos.sort()
    ant = ler_json('manifest.json') or {}
    novo = dict(esquema=ESQUEMA, atualizado=ant.get('atualizado'), anos=anos, ano_atual=anos[-1] if anos else None, arquivos=arquivos)
    comp = lambda m: {k: m.get(k) for k in ('esquema', 'anos', 'ano_atual', 'arquivos')}
    if forcar or comp(ant) != comp(novo) or not ant.get('atualizado'):
        novo['atualizado'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        salvar_json('manifest.json', novo); return True
    return False

def chave_num(t):
    t = re.sub(r'[^a-z0-9]', '', norm(t))
    return 'sn' if t in ('sn', 's') else t

def limpa_num(n):
    n = str(n or '').strip()
    if re.fullmatch(r's\s*/?\s*n', n, re.I): return 'S/N'
    return n[:1].upper() + n[1:] if n else n

def normaliza_cadastro(ender, novas):
    """Nome de rua de TODAS as ovitrampas passa pelo dicionário (acentos, "Rua"/"Av." padronizado, erros de digitação, referência entre parênteses)."""
    ruas = ender.setdefault('ruas', {})
    corr = ender.setdefault('correcoes', [])
    n = 0
    for o in ender['ovitrampas']:
        if not o.get('rua') or str(o['rua']).startswith('Sem endere'): continue
        novo = RUAS.corrige(o['rua'], ruas, novas)
        if novo != o['rua']:
            corr.append(dict(id=o['id'], campo='rua', de=o['rua'], para=novo, motivo='Nome da rua padronizado (dicionário de ruas)',
                             data=datetime.now(timezone.utc).strftime('%Y-%m-%d'), responsavel='Importação da planilha'))
            o['rua'] = novo; n += 1
    return n


def end_txt(rua, num):
    return ', '.join(x for x in (str(rua or '').strip(), str(num or '').strip()) if x)

def aplicar_ultima(ender, ult, ids, novas_ruas=None):
    """A coordenada (e o endereço, quando o ponto mudou de lugar) de cada ovitrampa é sempre o da ÚLTIMA instalação.
    Tudo o que mudar fica no registro de correções (enderecos.json)."""
    corr = ender.setdefault('correcoes', [])
    ender.setdefault('ruas', {})
    por_id = {o['id']: o for o in ender['ovitrampas']}
    ext = {e['id']: e for e in ender.setdefault('extras', [])}
    n_coord = n_end = n_ext = 0
    mudancas = []
    for idt, u in sorted(ult.items(), key=lambda x: (not x[0].isdigit(), int(x[0]) if x[0].isdigit() else 0, x[0])):
        data = u['col']
        if categoria(idt) == 'malha' and int(idt) in ids:
            o = por_id[int(idt)]
            dist = dist_m(float(o['lat']), float(o['lon']), float(u['lat']), float(u['lon'])) if u['lat'] and u['lon'] else 0
            mudou_lugar = dist > 30
            if u['lat'] and u['lon'] and dist > 1:
                de = '%s, %s' % (o['lat'], o['lon']); o['lat'], o['lon'] = u['lat'], u['lon']; n_coord += 1
                corr.append(dict(id=int(idt), campo='lat/lon', de=de, para='%s, %s' % (u['lat'], u['lon']),
                                 motivo='Última instalação (%s): coordenada da planilha, %d m de diferença' % (data, round(dist)),
                                 data=data, responsavel='Importação da planilha'))
            rua_txt, n_na_rua = RUAS.tira_numero(u['rua'])         # número digitado dentro do nome da rua ("Hélio Brandão 951")
            nu = limpa_num(u['num'] or n_na_rua)                    # a coluna Número manda; senão vale o que veio na rua
            rua_n = RUAS.corrige(rua_txt, ender['ruas'], novas_ruas) if str(rua_txt or '').strip() else ''
            if rua_n:      # o endereço é sempre o da última instalação (se a planilha trouxe rua), com o nome da rua corrigido
                mesma = RUAS.chave(RUAS.partes(rua_n)[1]) == RUAS.chave(RUAS.partes(o['rua'])[1])
                if mesma and (RUAS.partes(o['rua'])[2] or not RUAS.partes(rua_n)[2]): rua_n = o['rua']   # mesma rua: fica o texto já conferido (e a referência dele)
                novo_num = nu or (o['numero'] if mesma else '')
                if rua_n != o['rua'] or chave_num(novo_num) != chave_num(o['numero']):
                    de = end_txt(o['rua'], o['numero']); o['rua'], o['numero'] = rua_n, novo_num; n_end += 1
                    mudancas.append((int(idt), de, end_txt(rua_n, novo_num)))
                    corr.append(dict(id=int(idt), campo='endereco', de=de, para=end_txt(rua_n, novo_num),
                                     motivo='Última instalação (%s): endereço da planilha' % data, data=data, responsavel='Importação da planilha'))
        elif u['lat'] and u['lon']:      # pontos estratégicos (PE), aldeia (AI) e outros: só coordenada
            e = ext.get(idt)
            if e is None:
                e = dict(id=idt, lat=u['lat'], lon=u['lon']); ender['extras'].append(e); ext[idt] = e; n_ext += 1
            elif dist_m(float(e['lat']), float(e['lon']), float(u['lat']), float(u['lon'])) > 1:
                e['lat'], e['lon'] = u['lat'], u['lon']; n_ext += 1
    ender['extras'].sort(key=lambda e: e['id'])
    return n_coord, n_end, n_ext, mudancas

def importar(csv_path):
    ender = ler_json('enderecos.json')
    if not ender: sys.exit('data/enderecos.json não encontrado.')
    ids = {o['id'] for o in ender['ovitrampas']}
    linhas, C, ult = ler_planilha(csv_path)
    v, base, ex, multi, geo, n_ok = processar(linhas, C, ids)
    if not n_ok: sys.exit('Nenhuma linha válida na planilha.')
    meses = sorted({m for d in v.values() for m in d} | {m for e in ex.values() for m in e['v']})
    print('Planilha: %d linhas válidas · meses %s a %s · %d ovitrampas da malha · %d pontos extras' % (n_ok, meses[0], meses[-1], len(v), len(ex)))
    for ano in sorted({int(m[:4]) for m in meses}):
        nome, obj = mesclar_ano(ano, set(meses), v, base, ex, multi, ult)
        alt = salvar_json(nome, obj)
        print('  %s: %s (%d meses no arquivo)' % (nome, 'atualizado' if alt else 'sem mudanças', len(obj['meses'])))
    novas = []
    n_rua = normaliza_cadastro(ender, novas)
    if n_rua: salvar_json('enderecos.json', ender); print('  enderecos.json: %d nome(s) de rua padronizado(s)' % n_rua)
    if ult:
        n_coord, n_end, n_ext, mud = aplicar_ultima(ender, ult, ids, novas)
        if n_coord or n_end or n_ext or novas:
            salvar_json('enderecos.json', ender)
        print('  enderecos.json: %d coordenada(s) e %d endereço(s) atualizados pela última instalação; %d ponto(s) PE/AI/outros novos ou ajustados' % (n_coord, n_end, n_ext))
        for n, de, para in mud[:60]: print('     ovitrampa %d: %s  →  %s' % (n, de, para))
        if novas: print('  RUAS NOVAS (entraram no dicionário; confira a grafia): ' + '; '.join(sorted(set(novas))))
    cont = {}
    for k in list(ex): cont[categoria(k)] = cont.get(categoria(k), 0) + 1
    print('  pontos à parte (contagem separada): ' + (', '.join('%s: %d' % (c, n) for c, n in sorted(cont.items())) or 'nenhum'))
    print('manifest.json:', 'atualizado' if atualizar_manifest() else 'sem mudanças')

def verificar():
    erros, avisos = [], []
    ender, ag, man = ler_json('enderecos.json'), ler_json('agentes.json'), ler_json('manifest.json')
    if not ender or not ag or not man: sys.exit('Faltam arquivos em data/ (enderecos.json, agentes.json, manifest.json).')
    ids = [o['id'] for o in ender['ovitrampas']]
    if len(ids) != len(set(ids)): erros.append('IDs repetidos em enderecos.json')
    for o in ender['ovitrampas']:
        la, lo = coord(o['lat']), coord(o['lon'])
        if not la or not lo or not (-23 <= float(la) <= -22.2 and -56 <= float(lo) <= -55.3): erros.append('coordenada inválida/fora da região: ovitrampa %s' % o['id'])
    cob = set()
    for a in ag['agentes']:
        for k in range(a['ini'], a['fim'] + 1):
            if k in cob: erros.append('ovitrampa %d em mais de um agente' % k)
            cob.add(k)
    if cob != set(ids): avisos.append('agentes não cobrem exatamente as ovitrampas (faltam %s)' % sorted(set(ids) - cob)[:10])
    for ano in man['anos']:
        d = ler_json('%d.json' % ano)
        if not d: erros.append('arquivo %d.json ausente' % ano); continue
        n = len(d['meses'])
        for k, arr in d['serie'].items():
            if int(k) not in set(ids): erros.append('%d.json: série de ID inexistente %s' % (ano, k))
            if len(arr) != n: erros.append('%d.json: série de %s com %d valores (esperado %d)' % (ano, k, len(arr), n))
        for k, e in d['extras'].items():
            if len(e['serie']) != n: erros.append('%d.json: extra %s desalinhado' % (ano, k))
        if d['meses'] != sorted(d['meses']): erros.append('%d.json: meses fora de ordem' % ano)
        with open(caminho('%d.json' % ano), 'rb') as f: h = fnv1a(f.read())
        if man['arquivos'][str(ano)]['v'] != h: erros.append('manifest.json desatualizado para %d.json (rode --manifest)' % ano)
    for k in ('enderecos', 'agentes'):
        with open(caminho(k + '.json'), 'rb') as f: h = fnv1a(f.read())
        if man['arquivos'][k]['v'] != h: erros.append('manifest.json desatualizado para %s.json (rode --manifest)' % k)
    for a in avisos: print('AVISO:', a)
    for e in erros: print('ERRO:', e)
    print('Verificação concluída: %d erro(s), %d aviso(s).' % (len(erros), len(avisos)))
    sys.exit(1 if erros else 0)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Atualiza data/*.json a partir da planilha mensal, preservando o histórico.')
    ap.add_argument('planilha', nargs='?', help='CSV "contaovos" (leituras por semana ou contagens por mês)')
    ap.add_argument('--verificar', action='store_true'); ap.add_argument('--manifest', action='store_true')
    a = ap.parse_args()
    if a.verificar: verificar()
    elif a.manifest: print('manifest.json:', 'atualizado' if atualizar_manifest() else 'sem mudanças')
    elif a.planilha: importar(a.planilha)
    else: ap.print_help()
