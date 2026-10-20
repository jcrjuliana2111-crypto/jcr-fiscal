# Regras de casamento (como o robô decide)

Implementadas em `conciliacao-core.js`. Se mudar alguma regra, atualize este
arquivo, os testes e o espelho em `scripts/conciliacao-core.js`.

## 1. Extrato ↔ lançamento do Conta Azul (`conciliar`)

| Regra | Detalhe |
|---|---|
| Tipo | valor positivo no banco → conta a receber; negativo → conta a pagar |
| Valor | igual ao centavo ao valor em aberto da parcela (`nao_pago`) |
| Data | `|data do banco − vencimento| ≤ tolerância` (padrão 5 dias) |
| Pontuação | 60 + 20 × proximidade da data + 20 × semelhança de nome (contato, ou descrição × 0,8) |
| Unicidade | cada movimento e cada parcela entram em no máximo um par (o de maior pontuação ganha) |

Semelhança de nome = fração das palavras do nome do contato que aparecem no
histórico do banco, ignorando acentos, números, palavras curtas e termos como
PIX, TED, PAGTO, LTDA, ME.

Confiança:
- **alta**: nome ≥ 50% e ≤ 3 dias, **ou** candidato único dos dois lados e ≤ 3 dias;
- **média**: nome ≥ 50% ou candidato único;
- **baixa**: o resto.

Não casa (vai para "Extrato sem lançamento"): valor com juros/desconto,
pagamento agrupado de várias parcelas, lançamento fora da janela de datas.

## 2. Leitura do comprovante (`dadosComprovante`)

Fontes: texto do PDF (até 3 páginas) + nome do arquivo, juntos.

| Extrai | Reconhece |
|---|---|
| valores | `490,00`, `1.500,00`, `R$ 964,62`; no nome do arquivo também `320.40` |
| vencimentos | `V 051026`, `V051026`, `V 05/10/26`, `Vencimento: 05/10/2026`, `Data de vencimento 05.10.26` |
| datas de pagamento | demais datas: `06/10/2026`, `06-10-26`, `2026-10-06`, `20261006` |

`AGO 26` (competência) não é tratado como data.

## 3. Comprovante ↔ sugestão de baixa (`casarComprovantes`)

| Regra | Detalhe |
|---|---|
| Valor | o valor do movimento precisa estar entre os valores do comprovante |
| Vencimento | se o comprovante tem vencimento, ele deve estar a ≤ 3 dias do vencimento da parcela |
| Pagamento | se tem data de pagamento, ela deve estar a ≤ 3 dias da data do banco (dispensado se o vencimento já bateu) |
| Pontuação | 10 × nome do contato no texto + 10 × descrição da parcela no texto − dias |
| Segurança | sem data e sem nome/descrição batendo (< 50%): só liga se for a única opção de ambos os lados |
| Unicidade | cada comprovante em no máximo um movimento |

## Exemplos reais (viraram testes)

1. Duas folhas de R$ 490,00 no mesmo dia (Alana e Bruno), mesma descrição
   `FOLHA MULTI AGO 26`: cada comprovante vai para a pessoa certa pelo nome do
   favorecido.
2. F F Distribuidora, duas parcelas de R$ 964,62 (vencimentos 05/10 e 20/10):
   comprovante com `V 051026` vai para a de 05/10.
3. Boleto pago com atraso (venc. 05/10, pago 09/10): vencimento vem do
   `V 051026` / "Data de vencimento", pagamento do texto — liga certo.

## DDA (`parseDDA` + `conferirDDA`)

Leitura: o PDF vira linhas (itens na mesma altura). Modo **blocos** quando há 2+
linhas começando com "Beneficiário"/"Cedente"; senão modo **tabela** (linha com
data + valor, ou com linha digitável; nome numa linha anterior é aproveitado).
Vencimento: rotulado "Venc…" > linha digitável > data mais tarde da linha.
Linha digitável de 47 dígitos (ou código de barras de 44) que não começa com 8:
fator de vencimento (base 22/02/2025 = 1000) e valor.

Conferência contra contas a pagar (todas, inclusive pagas; valor = `total`):

| Situação | Regra |
|---|---|
| lancado | valor igual + vencimento ≤ 3 dias + nome ≥ 50% |
| provavel | valor igual + vencimento ≤ 3 dias, nome < 50% |
| divergente | nome ≥ 50% e (valor igual com vencimento ≤ 31 dias, ou vencimento ≤ 3 dias com valor até 15% diferente) |
| falta | nenhum dos anteriores |

Cada parcela atende no máximo um boleto (maior pontuação ganha).
