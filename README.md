# Diretorio Gemeo Codex

Este pacote cria duas copias estruturadas a partir da pasta base atual no Google Drive.

Resultado esperado:

1. Sistema Operacional Atual
   Uso interno na operacao real.
   Mantem estrutura e particularidades do caso atual.

2. Sistema Operacional Modelo
   Uso comercial neutro.
   Remove marca, unidade fixa e termos locais.
   Mantem principios, textos operacionais e logica de execucao.

3. excluir
   Pasta preparada para receber duplicidades depois de revisao humana.
   O script nao apaga nada.

## O que o script faz

- Localiza a pasta base pelo ID ou pelo nome.
- Cria as duas pastas gemeas.
- Copia arquivos e subpastas.
- Na pasta modelo, neutraliza nomes de arquivos e textos em Docs e Sheets.
- Troca lead por cliente.
- Troca follow up por Sequencia de Conversao.
- Troca Clube 30 por Plano de Recorrencia.
- Troca Indica 3 por Plano de Indicacao.
- Remove extensoes visiveis de nomes importados.
- Remove numeracao inicial de nomes de arquivos.
- Cria POPs Complementares apenas com funcoes e tarefas que podem estar faltando.
- Pode aplicar protecao basica em Google Sheets, deixando editaveis colunas por cabecalho.
- Gera relatorio JSON com tudo que foi copiado, criado ou encontrou erro.

## Requisitos

Python 3.10 ou superior.

Instale dependencias:

```bash
pip install -r requirements.txt
```

## Autenticacao Google

1. Acesse Google Cloud Console.
2. Crie ou selecione um projeto.
3. Ative as APIs:
   - Google Drive API
   - Google Sheets API
   - Google Docs API
4. Crie uma credencial OAuth Client para aplicativo desktop.
5. Baixe o arquivo e salve como:

```bash
credentials.json
```

Na primeira execucao, o navegador vai abrir para autorizar sua conta Google.
O token sera salvo como `token.json`.

## Configuracao

Copie o exemplo:

```bash
cp config.example.json config.json
```

Edite `config.json` e preencha:

```json
"base_folder_id": "ID_DA_PASTA_SALA_DORO"
```

O ID esta na URL da pasta base.
Exemplo:

```text
https://drive.google.com/drive/folders/ID_DA_PASTA
```

## Simulacao

Rode primeiro sem alterar nada:

```bash
python drive_reorganizer.py --config config.json --report relatorio_simulacao.json
```

Leia o relatorio antes da execucao real.

## Execucao real

Depois da revisao:

```bash
python drive_reorganizer.py --config config.json --execute --report relatorio_final.json
```

## Protecao de planilhas

No `config.json`, use:

```json
"protect_sheets": true
```

Se `team_editor_emails` estiver vazio, o script cria protecoes em modo de aviso.
Se preencher e-mails, o script tenta restringir edicao conforme os e-mails definidos.

Campos editaveis sao controlados por `editable_headers`.
Exemplos:

- Status
- Observacao
- Responsavel
- Execucao
- Cliente
- Data
- Acao
- Prazo
- Decisao

## Pontos de seguranca

- O script nao exclui arquivos.
- O script nao move duplicidades automaticamente.
- O script cria pasta `excluir` para revisao posterior.
- A primeira rodada deve ser sempre em simulacao.

## Saidas

- Duas pastas gemeas no Drive.
- Pasta excluir.
- POPs Complementares na pasta modelo, se ativado.
- Relatorio JSON com links e IDs.
