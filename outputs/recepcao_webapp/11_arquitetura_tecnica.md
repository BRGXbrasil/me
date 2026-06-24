# Arquitetura Técnica

## Stack
- Google Sheets
- Google Apps Script
- HTML/CSS/JavaScript puro
- Web App

## Leitura e gravação
- front-end chama funções do Apps Script
- back-end valida permissões
- gravações entram em `Registros`
- logs entram em `Logs`

## Concorrência
- ID único por registro
- atualização pontual de linha
- logs de alteração

## Validação
- front-end valida experiência do usuário
- back-end valida regra real

## Proteção
- acesso por e-mail
- permissões por perfil
- edição controlada

## Limite do Sheets
- suficiente para MVP
- pode exigir migração se volume crescer muito

## Quando migrar
- quando houver alto volume
- quando relatórios ficarem pesados
- quando precisar de trilha mais robusta

