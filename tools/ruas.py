# -*- coding: utf-8 -*-
"""
Correção dos nomes de rua (a planilha vem digitada à mão: sem acento, com erros, "Rua:" colado, prefixos misturados).

Como funciona
  * data/enderecos.json guarda um dicionário "ruas": { chave → nome correto }.
    A chave é o nome sem acento, sem "Rua/Av.", sem "de/da/do" e sem título (Dr.), então "Rua: Piaui", "piauí" e "Rua Piauí"
    caem na mesma chave e viram "Rua Piauí".
  * Rua que não está no dicionário mas é parecida com uma que está (erro de digitação, nome abreviado) usa o nome do dicionário.
  * Rua realmente nova é só arrumada (maiúsculas, "Rua: x" → "Rua X"), recebe "Rua" na frente e entra no dicionário.
  * Referência do local ("- Loja de Gesso", "(Posto de Saúde)") é mantida, entre parênteses, depois do nome.
O mesmo cálculo existe em assets/js/app/08b-ruas.js (o mapa de campo importa a planilha sem o Python): mantenha os dois iguais.
"""
import re, unicodedata

SEM_VALOR = {'de', 'da', 'do', 'das', 'dos', 'e'}          # ignoradas na chave
TITULOS = {'dr', 'doutor', 'dra', 'doutora'}               # ignorados na chave
EXPANDE = {'cel': 'Coronel', 'eng': 'Engenheiro', 'prof': 'Professor', 'sta': 'Santa', 'sto': 'Santo'}
PARTICULAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'}
TIPOS = {'rua': 'Rua', 'r': 'Rua', 'av': 'Av.', 'avenida': 'Av.', 'ave': 'Av.', 'travessa': 'Travessa', 'trav': 'Travessa',
         'tv': 'Travessa', 'alameda': 'Alameda', 'rodovia': 'Rodovia', 'rod': 'Rodovia'}
LIMIAR = 0.8
LUGARES = ('cemiterio', 'borracharia', 'posto', 'ferro velho', 'guarda', 'igreja', 'escola', 'hospital', 'mercado', 'oficina',
           'fazenda', 'sitio', 'chacara', 'condominio', 'monte claro')      # endereço digitado como lugar: não leva "Rua" na frente
def eh_lugar(nome): return any(re.search(r'\b' + l + r'\b', sem_acento(nome).lower()) for l in LUGARES)


def sem_acento(t):
    t = unicodedata.normalize('NFD', str(t or ''))
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')


def lev(a, b):
    ant = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        atu = [i]
        for j, cb in enumerate(b, 1):
            atu.append(min(ant[j] + 1, atu[j - 1] + 1, ant[j - 1] + (ca != cb)))
        ant = atu
    return ant[-1]


def _sigla_rodovia(palavras):
    """'BR 463' / 'MS-164' / 'Rodovia MS 164' → 'BR-463' (ou None)."""
    t = ' '.join(palavras)
    m = re.fullmatch(r'(?:rodovia\s+)?([A-Za-z]{2})\s*[- ]?\s*(\d{2,3})', t.strip(), re.I)
    return '%s-%s' % (m.group(1).upper(), m.group(2)) if m else None


def _tipo_de(w):
    """'Rua', 'R.', 'Av.', 'Travesa' (erro) → tipo certo; senão None."""
    k = re.sub(r'[.]', '', sem_acento(w).lower())
    if k in TIPOS: return TIPOS[k]
    if k == 'ru': return 'Rua'
    if len(k) >= 6:
        for longo, tipo in (('avenida', 'Av.'), ('travessa', 'Travessa'), ('alameda', 'Alameda'), ('rodovia', 'Rodovia')):
            if lev(k, longo) <= 1: return tipo
    return None


def partes(rua):
    """Texto digitado → (tipo ou None, nome, referência). Ex.: 'Rua: Avenida Brasil - Produfértil' → ('Av.', 'Brasil', 'Produfértil')."""
    t = re.sub(r'\s+', ' ', str(rua or '').strip())
    t = t.lstrip(' :;,-')
    t = re.sub(r'^(\w+\.?)\s*[:;,]\s*', r'\1 ', t)                      # "Rua:x" / "Rua;x"
    t = re.sub(r'^(av|rua|r|trav|tv|rod)\.(?=\S)', r'\1. ', t, flags=re.I)  # "Av.belmiro"
    ref = ''
    mr = re.match(r'^(?:rodovia\s+|rod\.?\s+)?([A-Za-z]{2})\s*-?\s*(\d{2,3})\b[\s,;:-]*(.*)$', t, re.I)      # "MS 164", "MS - 164", "Rodovia Ms 164"
    if mr and mr.group(1).upper() in ('BR', 'MS'): return 'Rodovia', '%s-%s' % (mr.group(1).upper(), mr.group(2)), mr.group(3).strip(' ()')
    m = re.search(r'\s+-\s+(.+)$', t) or re.search(r'\s*\((.+)\)\s*$', t)
    if m: ref = m.group(1).strip(); ref = ref[:1].upper() + ref[1:]; t = t[:m.start()].strip()
    t = t.strip(' ,;:-')
    pal = t.split(' ') if t else []
    sig = _sigla_rodovia(pal)
    if sig: return 'Rodovia', sig, ref
    tipo = None
    while pal and _tipo_de(pal[0]):
        tipo = tipo or _tipo_de(pal[0])
        pal = pal[1:]
    if pal and tipo is None and pal[0].lower().rstrip('.') == 'a' and len(pal) > 1 and sem_acento(pal[1]).lower() == 'brasil':
        tipo, pal = 'Av.', pal[1:]
    # "Cel.Ponce" → "Cel. Ponce"
    pal = ' '.join(pal); pal = re.sub(r'\b(Cel|Eng|Prof|Dr|Dra|Sta|Sto)\.(?=\S)', r'\1. ', pal, flags=re.I).split(' ') if pal else []
    out = []
    for i, w in enumerate(pal):
        k = sem_acento(w).lower().rstrip('.')
        if k in EXPANDE: out.append(EXPANDE[k]); continue
        if k in ('dr', 'dra'): out.append(k.capitalize() + '.'); continue
        if len(w) > 1 and w.isupper() and not w.isdigit(): out.append(w); continue
        if any(c.isdigit() for c in w) or "'" in w: out.append(w); continue
        if w.lower() in PARTICULAS and (i > 0 or len(pal) > 1): out.append(w.lower()); continue
        out.append(w[:1].upper() + w[1:].lower())
    nome = ' '.join(out)
    if len(nome) > 4 and nome == nome.upper() and not any(c.isdigit() for c in nome):          # "ANSELMO SOARES" → "Anselmo Soares"
        nome = ' '.join(w.lower() if (i > 0 and w.lower() in PARTICULAS) else w[:1].upper() + w[1:].lower() for i, w in enumerate(nome.split(' ')))
    return tipo, nome, ref


def tira_numero(rua):
    """'Hélio Brandão 951' → ('Hélio Brandão', '951'). Não mexe em 'Rua 9', 'Projetada 04', '13 de Setembro' nem em 'quadra/lote'."""
    t = str(rua or '').strip()
    m = re.search(r'\s+(quadra\s+\S.*)$', t, re.I)                      # "Bandeirantes quadra 49 lote 491" → rua + "quadra 49 lote 491"
    if m: return t[:m.start()].strip(' ,;:'), m.group(1)
    tipo, nome, ref = partes(t)
    pal = nome.split(' ')
    if len(pal) >= 2 and re.fullmatch(r'\d{1,5}(?:[/-]\d+)?', pal[-1]) and not pal[0][:1].isdigit() \
            and sem_acento(pal[-2]).lower() not in ('projetada', 'quadra', 'lote'):
        return re.sub(r'[\s,]+' + re.escape(pal[-1]) + r'(\s*(\(.*\)|-\s.*))?\s*$', lambda m: m.group(1) or '', t).strip(' ,;:'), pal[-1]
    return t, None


def chave(nome):
    pal = re.sub(r'[^a-z0-9]+', ' ', sem_acento(nome).lower()).split()
    pal = [EXPANDE.get(w, w).lower() for w in pal]
    return ' '.join(w for w in pal if w not in SEM_VALOR and w not in TITULOS)


def _subsequencia(curta, longa):
    it = iter(longa)
    return all(w in it for w in curta)


def parecida(a, b, contido=True):
    """Mesma rua? Chaves iguais, parecidas (erro de digitação ≥ 80%), iniciais ('Jorge R.' = 'Jorge Roberto')
    ou nome mais curto contido no mais completo ('Pedro Ângelo' ⊂ 'Pedro Angelo da Rosa', ao menos 2 palavras)."""
    if a == b: return True
    if not a or not b: return False
    if {w for w in a.split() if any(c.isdigit() for c in w)} != {w for w in b.split() if any(c.isdigit() for c in w)}: return False   # "13 de Setembro" ≠ "7 de Setembro"
    if 1 - lev(a, b) / max(len(a), len(b)) >= LIMIAR: return True
    pa, pb = a.split(), b.split()
    if len(pa) == len(pb) and all(x == y or (len(x) == 1 and y.startswith(x)) or (len(y) == 1 and x.startswith(y)) for x, y in zip(pa, pb)): return True
    if not contido: return False
    c, l = (pa, pb) if len(pa) <= len(pb) else (pb, pa)
    return len(c) >= 2 and len(c) < len(l) and c[0] == l[0] and _subsequencia(c, l)


def acha(k, ruas):
    """Nome do dicionário para a chave k (igual ou parecida), ou None."""
    if k in ruas: return ruas[k]
    melhor = None
    for kk, nome in ruas.items():
        if parecida(k, kk):
            d = lev(k, kk)
            if melhor is None or d < melhor[0]: melhor = (d, nome)
    return melhor[1] if melhor else None


def corrige(rua, ruas, novas=None):
    """Nome de rua digitado → nome correto. Rua nova entra em 'ruas' (e em 'novas', para avisar)."""
    tipo, nome, ref = partes(rua)
    if not nome: return str(rua or '').strip()
    k = chave(nome)
    cano = acha(k, ruas) if k else None
    if cano is None:
        if re.search(r'\b(quadra|lote)\b', sem_acento(nome).lower()) or (tipo is None and eh_lugar(nome)): cano = nome   # loteamento/lugar: fica como digitado
        else:
            cano = nome if nome.startswith(('BR-', 'MS-')) and tipo == 'Rodovia' else '%s %s' % (tipo or 'Rua', nome)
            if tipo == 'Rodovia': cano = 'Rodovia ' + nome
        ruas[k] = cano
        if novas is not None: novas.append(cano)
    return cano + (' (%s)' % ref if ref else '')
