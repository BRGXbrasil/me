# Arquivos Analisados

## 1. Matriz Ativações
- Tipo: planilha
- Finalidade provável: consolidar tipos de ação, frequência, status e resultado de ativações
- Campos identificados: Tipo de ação, Público, Frequência, Dia recomendado, Critério de entrada, Mensagem base, Responsável, Status, Resultado, Ativadas, Agendamentos gerados, Observações
- Regras explícitas: ações por frequência diária, semanal e mensal; dia recomendado por tipo de ação
- Lacunas: não há unidade, colaborador individual, prazo, cliente específico nem ID único por ação

## 2. POPs Recepção
- Tipo: PDF
- Finalidade provável: padronização da operação de recepção
- Campos identificados: setor, tarefa, responsável, frequência
- Regras explícitas: linguagem educada, registro no sistema, follow-up D0/D1/D3/D5/D7, não improvisar, acionar liderança quando houver dúvida
- Lacunas: não define estrutura única de banco de dados

## 3. Registro de ocorrências da recepção
- Tipo: documento
- Finalidade provável: registro livre de ocorrências, falhas e retrabalho
- Campos identificados: DATA, CLIENTE, OCORRIDO
- Lacunas: sem status, unidade, responsável, categoria ou prioridade

## 4. Pendências
- Tipo: planilha
- Finalidade provável: carteira de clientes/pedências com valor e ação
- Campos identificados: Cliente, Data de abertura, Valor, Ações
- Lacunas: sem status padronizado, sem responsável explícito, sem próxima ação estruturada

## 5. Controle de faltas
- Tipo: planilha
- Finalidade provável: controle por dia do mês e por colaborador
- Campos identificados: datas do mês e nomes de profissionais/colaboradores
- Lacunas: estrutura irregular para banco de dados; precisa normalização

## 6. Clientes que não conseguiram agendar
- Tipo: planilha
- Finalidade provável: registrar tentativas frustradas de agendamento e seus motivos
- Campos identificados: CLIENTE, PROFISSIONAL, PROCEDIMENTO(S), DATA, OBSERVAÇÃO
- Lacunas: sem status operacional e sem vínculo com unidade

## 7. Ação Aniversariantes - 2026
- Tipo: planilha
- Finalidade provável: campanha de aniversariantes com retorno de contato
- Campos identificados: Aniversario, Nome, Contato, Retorno Contato, Procedimento, Horario, Profissional, Data, OBSERVACÃO
- Lacunas: estrutura duplicada em blocos; precisa padronização para uma única tabela

## 8. Relatório de Resultado das Ativações
- Tipo: documento
- Finalidade provável: resultado resumido de ação por período
- Campos identificados: categoria da ativação, volume de agendamentos
- Lacunas: falta granularidade por unidade, colaborador e período

