#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atualiza o código de versão (?v=XXXXXXXX) em todos os lugares de uma vez.

Use SEMPRE depois de mudar qualquer arquivo de código (html, js, css, sw.js):
    python tools/versao.py             # calcula a versão nova e troca em todos os arquivos
    python tools/versao.py --verificar # só confere se está tudo igual (não altera nada)

Por quê: os aparelhos guardam os arquivos pela versão. Se o código não mudar, eles continuam
usando a versão antiga. A versão é calculada a partir do conteúdo: se nada mudou, ela não muda
(rodar duas vezes seguidas não altera nada).
Só usa o Python 3 (sem instalar nada). Não mexe na pasta data/ (essa tem versão própria).
"""
import os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# arquivos que contêm o código de versão escrito
COM_VERSAO = ['index.html', 'gestao.html', 'sw.js', os.path.join('assets', 'js', 'boot.js')]
# pastas/arquivos que entram no cálculo (conteúdo do sistema; dados e imagens ficam de fora)
PASTAS = [os.path.join('assets', 'js'), os.path.join('assets', 'css'), os.path.join('assets', 'vendor')]
EXT = ('.js', '.css', '.html')


def fnv1a(b: bytes) -> str:
    h = 0x811c9dc5
    for x in b:
        h = ((h ^ x) * 0x01000193) & 0xffffffff
    return '%08x' % h


def ler(rel):
    with open(os.path.join(RAIZ, rel), 'rb') as f:
        return f.read()


def versao_atual():
    m = re.search(rb"VERSAO\s*=\s*'([0-9a-f]{8})'", ler('sw.js'))
    if not m:
        sys.exit('Não achei VERSAO no sw.js.')
    return m.group(1).decode()


def arquivos_do_sistema():
    lista = ['index.html', 'gestao.html', 'sw.js']
    for pasta in PASTAS:
        for r, _, fs in os.walk(os.path.join(RAIZ, pasta)):
            for f in fs:
                if f.endswith(EXT):
                    lista.append(os.path.relpath(os.path.join(r, f), RAIZ))
    return sorted(set(lista))


def calcula(atual):
    """Hash do conteúdo, ignorando o próprio código de versão (senão ele mudaria a cada rodada)."""
    junto = b''
    for rel in arquivos_do_sistema():
        junto += rel.replace('\\', '/').encode() + b'\0' + ler(rel).replace(atual.encode(), b'########') + b'\0'
    return fnv1a(junto)


def main():
    atual = versao_atual()
    if '--verificar' in sys.argv:
        ok = True
        for rel in COM_VERSAO:
            t = ler(rel).decode('utf-8')
            vs = set(re.findall(r'v=([0-9a-f]{8})', t)) | set(re.findall(r"VERSAO\s*=\s*'([0-9a-f]{8})'", t))
            if vs != {atual}:
                ok = False
                print('DIFERENTE em', rel, '→', sorted(vs) or 'sem versão', '(esperado', atual + ')')
        esperada = calcula(atual)
        if esperada != atual:
            ok = False
            print('Há arquivos alterados desde a última versão. Rode: python tools/versao.py')
        print('Tudo certo (versão %s).' % atual if ok else 'Precisa atualizar.')
        sys.exit(0 if ok else 1)

    nova = calcula(atual)
    if nova == atual:
        print('Nada mudou. Versão continua %s.' % atual)
        return
    for rel in COM_VERSAO:
        t = ler(rel).decode('utf-8')
        t2 = re.sub(r'(\?v=)[0-9a-f]{8}', r'\g<1>' + nova, t)
        t2 = re.sub(r"(VERSAO\s*=\s*')[0-9a-f]{8}(')", r'\g<1>' + nova + r'\g<2>', t2)
        with open(os.path.join(RAIZ, rel), 'w', encoding='utf-8', newline='') as f:
            f.write(t2)
    print('Versão atualizada: %s → %s (em %d arquivos).' % (atual, nova, len(COM_VERSAO)))


if __name__ == '__main__':
    main()
