#!/usr/bin/env python3
"""
Gera as tabelas da Reforma Tributária usadas pelo portal (reforma/dados/*.json)
a partir do repositório oficial da Receita Federal (licença MIT):

    https://github.com/ReceitaFederal/calculadora-rtc-regime-regular

Uso:
    git clone --depth 1 https://github.com/ReceitaFederal/calculadora-rtc-regime-regular /tmp/rtc
    python3 reforma/scripts/gerar_dados.py /tmp/rtc

O script monta o banco SQLite do mesmo jeito que o Flyway do projeto (beforeMigrate,
baseline B0001, migrações V* em ordem, cada uma numa transação, e afterMigrate) e
exporta só as tabelas oficiais (dados abertos). Nada de cliente entra aqui.
"""
import glob
import json
import os
import sqlite3
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.normpath(os.path.join(AQUI, '..', 'dados'))


def montar_banco(repo, caminho_db):
    sql = os.path.join(repo, 'flyway', 'sql')
    c = sqlite3.connect(caminho_db, isolation_level=None)
    ler = lambda f: open(f, encoding='utf-8').read()
    c.executescript(ler(os.path.join(sql, 'criacao', 'beforeMigrate.sql')))
    arquivos = sorted(glob.glob(os.path.join(sql, 'criacao', 'B*.sql'))) + sorted(glob.glob(os.path.join(sql, 'manutencao', 'V*.sql')))
    for f in arquivos:
        s = ler(f)
        # Scripts com PRAGMA foreign_keys rodam fora de transação (como no Flyway)
        c.executescript(s if 'PRAGMA foreign_keys' in s else 'BEGIN;\n' + s + '\nCOMMIT;')
    c.executescript(ler(os.path.join(sql, 'criacao', 'afterMigrate.sql')))
    return c


def linhas(c, sql):
    cur = c.execute(sql)
    nomes = [d[0] for d in cur.description]
    return [dict(zip(nomes, r)) for r in cur.fetchall()]


def gravar(nome, dados):
    os.makedirs(SAIDA, exist_ok=True)
    with open(os.path.join(SAIDA, nome), 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def exportar(c):
    tributos = {r['TBTO_ID']: r['TBTO_SIGLA'] for r in linhas(c, 'select TBTO_ID, TBTO_SIGLA from TRIBUTO')}
    reducoes = {}
    for r in linhas(c, 'select PERE_CLTR_ID, PERE_TBTO_ID, PERE_VALOR from PERCENTUAL_REDUCAO'):
        reducoes.setdefault(r['PERE_CLTR_ID'], {})[tributos[r['PERE_TBTO_ID']]] = r['PERE_VALOR']
    fund = {}
    for r in linhas(c, '''select f.FDCL_CLTR_ID id, l.FDLG_TEXTO_CURTO curto, l.FDLG_TEXTO texto
                          from FUNDAMENTACAO_CLASSIFICACAO f join FUNDAMENTACAO_LEGAL l on l.FDLG_ID = f.FDCL_FDLG_ID'''):
        fund.setdefault(r['id'], []).append({'curto': r['curto'], 'texto': (r['texto'] or '').replace('\\n', '\n')})
    trat = {r['id']: r['desc'] for r in linhas(c, '''select t.TRCL_CLTR_ID id, x.TRTR_DESCRICAO desc
                          from TRATAMENTO_CLASSIFICACAO t join TRATAMENTO_TRIBUTARIO x on x.TRTR_ID = t.TRCL_TRTR_ID''')}

    cclass = []
    for r in linhas(c, '''select t.*, s.SITR_CD cst, s.SITR_DESCRICAO cst_desc from CLASSIFICACAO_TRIBUTARIA t
                          join SITUACAO_TRIBUTARIA s on s.SITR_ID = t.CLTR_SITR_ID order by t.CLTR_CD, t.CLTR_ID'''):
        red = reducoes.get(r['CLTR_ID'], {})
        cclass.append({
            'id': r['CLTR_ID'], 'cd': r['CLTR_CD'], 'desc': r['CLTR_DESCRICAO'],
            'cst': r['cst'], 'cst_desc': r['cst_desc'],
            'tipo_aliquota': r['CLTR_TIPO_ALIQUOTA'], 'nomenclatura': r['CLTR_NOMENCLATURA'],
            'red': {'CBS': red.get('CBS'), 'IBSUF': red.get('IBSUF'), 'IBSMun': red.get('IBSMun')},
            'credito_adq': {'CBS': bool(r['CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_CBS']), 'IBS': bool(r['CLTR_IN_APROPRIACAO_CREDITOS_ADQUIRENTES_IBS'])},
            'cred_presumido': {'fornecedor': bool(r['CLTR_IN_CREDITO_PRESUMIDO_FORNECEDOR']), 'adquirente': bool(r['CLTR_IN_CREDITO_PRESUMIDO_ADQUIRENTE'])},
            'tratamento': trat.get(r['CLTR_ID']), 'anexo': r['CLTR_ANEXO'],
            'fundamento': fund.get(r['CLTR_ID'], []),
            'inicio': r['CLTR_INICIO_VIGENCIA'], 'fim': r['CLTR_FIM_VIGENCIA'],
        })
    gravar('cclasstrib.json', cclass)

    gravar('cst.json', linhas(c, '''select SITR_CD cd, SITR_DESCRICAO desc, SITR_INICIO_VIGENCIA inicio, SITR_FIM_VIGENCIA fim
                                    from SITUACAO_TRIBUTARIA order by SITR_CD'''))
    gravar('ncm.json', [[r['cd'], r['desc']] for r in linhas(c, '''select NCM_CD cd, NCM_DESCRICAO desc from NCM
                                    where NCM_FIM_VIGENCIA is null or NCM_FIM_VIGENCIA >= date('now') order by NCM_CD''')])
    gravar('nbs.json', [[r['cd'], r['desc'], r['lc116']] for r in linhas(c, '''select NBS_CD cd, NBS_DESCRICAO desc, NBS_LC_116 lc116 from NBS
                                    where NBS_FIM_VIGENCIA is null or NBS_FIM_VIGENCIA >= date('now') order by NBS_CD''')])
    # Vínculos NCM/NBS → cClassTrib (o código pode ser prefixo: capítulo, posição ou subposição)
    gravar('ncm_aplicavel.json', linhas(c, '''select a.NCMA_ID id, a.NCMA_NCM_CD ncm, a.NCMA_CLTR_ID cclass, x.ANXO_NUMERO anexo, x.ANXO_NUMERO_ITEM item,
                                    (select group_concat(e.ENCM_NCM_CD) from EXCECAO_NCM_APLICAVEL e where e.ENCM_NCMA_ID = a.NCMA_ID) excecoes
                                    from NCM_APLICAVEL a left join ANEXO x on x.ANXO_ID = a.NCMA_ANXO_ID
                                    where a.NCMA_FIM_VIGENCIA is null or a.NCMA_FIM_VIGENCIA >= date('now')'''))
    gravar('nbs_aplicavel.json', linhas(c, '''select a.NBSA_NBS_CD nbs, a.NBSA_CLTR_ID cclass, x.ANXO_NUMERO anexo, x.ANXO_NUMERO_ITEM item
                                    from NBS_APLICAVEL a left join ANEXO x on x.ANXO_ID = a.NBSA_ANXO_ID
                                    where a.NBSA_FIM_VIGENCIA is null or a.NBSA_FIM_VIGENCIA >= date('now')'''))
    gravar('anexos.json', linhas(c, '''select ANXO_NUMERO anexo, ANXO_NUMERO_ITEM item, ANXO_TEXTO_ITEM texto from ANEXO
                                    where ANXO_FIM_VIGENCIA is null or ANXO_FIM_VIGENCIA >= date('now') order by ANXO_ID'''))
    # Serviços: item da LC 116 (lista do ISS) → NBS → cClassTrib
    servicos = linhas(c, '''select l.LSLC_CD cd, l.LSLC_DESCRICAO desc,
                                    (select json_group_array(json_object('nbs', n.CNIL_NBS_CD, 'cclass', n.CNIL_CLTR_ID)) from CLASSIF_NBS_INDOP_LC n
                                      where n.CNIL_LSLC_CD = l.LSLC_CD and (n.CNIL_FIM_VIGENCIA is null or n.CNIL_FIM_VIGENCIA >= date('now'))) vinculos
                                    from LISTA_SERVICOS_LC_116 l where l.LSLC_FIM_VIGENCIA is null or l.LSLC_FIM_VIGENCIA >= date('now') order by l.rowid''')
    for r in servicos:
        r['vinculos'] = json.loads(r['vinculos'] or '[]')
    gravar('lc116.json', servicos)
    gravar('aliquotas_referencia.json', linhas(c, '''select t.TBTO_SIGLA tributo, a.ALRE_VALOR valor, a.ALRE_INICIO_VIGENCIA inicio, a.ALRE_FIM_VIGENCIA fim
                                    from ALIQUOTA_REFERENCIA a join TRIBUTO t on t.TBTO_ID = a.ALRE_TBTO_ID order by a.ALRE_INICIO_VIGENCIA'''))
    gravar('simples_atividades.json', linhas(c, '''select ATSN_ORDEM ordem, ATSN_DESCRICAO desc, ATSN_ANEXO_SEM_FATOR_R anexo, ATSN_ANEXO_COM_FATOR_R anexo_fator_r,
                                    ATSN_CATIVSN codigo, ATSN_INICIO_VIGENCIA inicio from ATIVIDADE_SIMPLES_NACIONAL order by ATSN_ORDEM'''))
    v = linhas(c, 'select VRBD_VERSAO_BASE_DADO versao, VRBD_DATA data, VRBD_DESCRICAO descricao from VERSAO_BASE_DADO order by rowid desc limit 1')[0]
    v['fonte'] = 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular'
    gravar('versao.json', v)
    return len(cclass)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with tempfile.TemporaryDirectory() as tmp:
        banco = montar_banco(sys.argv[1], os.path.join(tmp, 'rtc.db'))
        n = exportar(banco)
        banco.close()
    print(f'{n} cClassTrib exportadas para {SAIDA}')
