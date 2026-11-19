#!/usr/bin/env python3
"""Monta os fluxos do n8n do Societário e do Comercial a partir dos arquivos *.code.js (fonte do código dos nós).
Rodar depois de mudar um .code.js:  python3 automacoes/n8n/gerar-fluxos.py"""
import json, os, uuid
AQUI = os.path.dirname(os.path.abspath(__file__))
SUPA = 'https://onecnoicxqjhgolqncjj.supabase.co'
codigo = lambda nome: open(os.path.join(AQUI, nome), encoding='utf-8').read()
uid = lambda semente: str(uuid.uuid5(uuid.NAMESPACE_URL, 'jcr-n8n/' + semente))

def agenda(nome, cron, fluxo):
    return {'id': uid(fluxo + nome), 'name': nome, 'type': 'n8n-nodes-base.scheduleTrigger', 'typeVersion': 1.2, 'position': [0, 0],
            'parameters': {'rule': {'interval': [{'field': 'cronExpression', 'expression': cron}]}}}
def config(campos, fluxo):
    return {'id': uid(fluxo + 'cfg'), 'name': 'Configuração', 'type': 'n8n-nodes-base.set', 'typeVersion': 3.4, 'position': [220, 0],
            'parameters': {'assignments': {'assignments': [{'id': uid(fluxo + k), 'name': k, 'value': v, 'type': 'number' if isinstance(v, (int, float)) and not isinstance(v, bool) else 'boolean' if isinstance(v, bool) else 'string'} for k, v in campos]}, 'options': {}}}
def rpc(nome, funcao, corpo, x, fluxo):
    return {'id': uid(fluxo + 'rpc'), 'name': nome, 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [x, 0],
            'parameters': {'method': 'POST', 'url': f'{SUPA}/rest/v1/rpc/{funcao}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi',
                           'sendBody': True, 'specifyBody': 'json', 'jsonBody': corpo, 'options': {}}}
def code(nome, arquivo, x, fluxo):
    return {'id': uid(fluxo + 'code'), 'name': nome, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [x, 0], 'parameters': {'jsCode': codigo(arquivo)}}
def gmail(x, fluxo):
    return {'id': uid(fluxo + 'gmail'), 'name': 'Enviar e-mail (Gmail)', 'type': 'n8n-nodes-base.gmail', 'typeVersion': 2.1, 'position': [x, 0],
            'parameters': {'sendTo': "={{ $('Configuração').first().json.destinatario }}", 'subject': '={{ $json.assunto }}', 'emailType': 'html', 'message': '={{ $json.html }}', 'options': {'appendAttribution': False}}}
def ligar(nos):
    return {a['name']: {'main': [[{'node': b['name'], 'type': 'main', 'index': 0}]]} for a, b in zip(nos, nos[1:])}
def gravar(arquivo, nome, nos):
    fluxo = {'name': nome, 'nodes': nos, 'connections': ligar(nos), 'settings': {'executionOrder': 'v1', 'timezone': 'America/Sao_Paulo'}, 'pinData': {}}
    with open(os.path.join(AQUI, arquivo), 'w', encoding='utf-8') as f:
        json.dump(fluxo, f, ensure_ascii=False, indent=2); f.write('\n')
    print('ok:', arquivo)

DEST = 'coloque-aqui-o-seu-email@exemplo.com'
PORTAL = 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/'

f = 'alerta-societario'
gravar(f + '.json', 'JCR — Societário: exigências, processos parados e vencimentos', [
    agenda('Todo dia útil às 7h10', '10 7 * * 1-5', f),
    config([('destinatario', DEST), ('dias', 30), ('portal', PORTAL), ('enviar_vazio', False)], f),
    rpc('Buscar alertas (Supabase)', 'alerta_societario', '={{ JSON.stringify({ dias: $json.dias }) }}', 440, f),
    code('Montar e-mail', 'alerta-societario.code.js', 660, f), gmail(880, f)])

f = 'alerta-comercial'
gravar(f + '.json', 'JCR — Comercial: retornos de propostas e pesquisa de satisfação', [
    agenda('Todo dia útil às 8h20', '20 8 * * 1-5', f),
    config([('destinatario', DEST), ('portal', PORTAL), ('enviar_vazio', False)], f),
    rpc('Buscar retornos (Supabase)', 'alerta_comercial', '={{ JSON.stringify({}) }}', 440, f),
    code('Montar e-mail', 'alerta-comercial.code.js', 660, f), gmail(880, f)])

f = 'emails-jucesp'
gatilho = {'id': uid(f + 'gatilho'), 'name': 'Novos e-mails da Junta/REDESIM (Gmail)', 'type': 'n8n-nodes-base.gmailTrigger', 'typeVersion': 1.2, 'position': [0, 0],
           'parameters': {'pollTimes': {'item': [{'mode': 'everyX', 'value': 15, 'unit': 'minutes'}]}, 'simple': False,
                          'filters': {'q': 'from:(jucesp.sp.gov.br OR facilitasp OR vreredesim OR redesim OR receita.fazenda.gov.br) newer_than:2d'}, 'options': {}}}
gravar(f + '.json', 'JCR — Societário: ler e-mails da JUCESP e da REDESIM', [
    gatilho, dict(code('Entender o e-mail', 'emails-jucesp.code.js', 240, f)),
    rpc('Atualizar o processo (Supabase)', 'registrar_evento_societario',
        '={{ JSON.stringify({ p_protocolo: $json.protocolo, p_evento: $json.evento, p_texto: $json.texto, p_data: $json.data }) }}', 480, f)])
