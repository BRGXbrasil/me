# Estrutura Final da Planilha Google Sheets

## 1. Registros
Finalidade: banco principal do app

Colunas:
- ID_Registro
- Data_Criacao
- Hora_Criacao
- Unidade
- Colaborador
- Email_Usuario
- Cliente
- Tipo_Atividade
- Categoria
- Canal
- Descricao
- Status
- Prioridade
- Proxima_Acao
- Prazo
- Responsavel
- Observacoes
- Data_Atualizacao
- Atualizado_Por

Campos obrigatórios:
- ID_Registro
- Data_Criacao
- Hora_Criacao
- Unidade
- Colaborador
- Email_Usuario
- Tipo_Atividade
- Status

## 2. Usuarios
Finalidade: controle de acesso

Colunas:
- Email
- Nome
- Perfil
- Unidade
- Ativo
- Pode_Criar
- Pode_Editar
- Pode_Aprovar
- Pode_Ver_Todas_Unidades

## 3. Unidades
Finalidade: lista de unidades da rede

Colunas:
- Unidade
- Ativa
- Observacao

## 4. Tipos_Atividade
Finalidade: listas dinâmicas do formulário

Colunas:
- Tipo_Atividade
- Categoria
- Frequencia
- Dia_Recomendado
- Ativo

## 5. Status
Finalidade: lista padronizada de status

Colunas:
- Status
- Exibe_No_App
- Ordem
- Cor

## 6. Clientes
Finalidade: cadastro de clientes e referência

Colunas:
- Cliente
- Contato
- Unidade
- Profissional
- Observacao
- Ativo

## 7. Cronograma
Finalidade: rotina por dia da semana

Colunas:
- Dia_Semana
- Tipo_Atividade
- Obrigatorio
- Ordem
- Observacao

## 8. Matriz
Finalidade: espelho da matriz de ativações

Colunas:
- Tipo_Atividade
- Publico
- Frequencia
- Dia_Recomendado
- Criterio_Entrada
- Mensagem_Base
- Responsavel
- Status
- Resultado
- Ativadas
- Agendamentos_Gerados
- Observacoes

## 9. Logs
Finalidade: auditoria

Colunas:
- ID_Log
- Data_Hora
- Email_Usuario
- Acao
- Entidade
- ID_Registro
- Detalhe

## 10. Configuracoes
Finalidade: parâmetros gerais

Colunas:
- Chave
- Valor
- Observacao

## 11. Dashboard
Finalidade: apoio visual

Colunas sugeridas:
- Indicador
- Valor
- Periodo
- Unidade

