#!/usr/bin/env python3
"""Gera societario/jcr-preenchedor.zip com os arquivos da extensão (rodar depois de mudar a extensão)."""
import os, zipfile
AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, '..', 'societario', 'jcr-preenchedor.zip')
ARQUIVOS = ['manifest.json', 'background.js', 'portal.js', 'popup.html', 'popup.js', 'mapa.js', 'preencher.js', 'icone16.png', 'icone48.png', 'icone128.png']
with zipfile.ZipFile(DESTINO, 'w', zipfile.ZIP_DEFLATED) as z:
    for nome in ARQUIVOS:
        info = zipfile.ZipInfo('jcr-preenchedor/' + nome, date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o644 << 16
        with open(os.path.join(AQUI, nome), 'rb') as f:
            z.writestr(info, f.read(), zipfile.ZIP_DEFLATED)
print('ok:', os.path.normpath(DESTINO))
