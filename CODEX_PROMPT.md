Use este projeto para reorganizar meu Google Drive.

Objetivo:
Criar duas pastas gemeas a partir da pasta base Sala D'Oro.

Pasta 1:
Sistema Operacional Atual
Uso real na operacao atual.
Manter estrutura, unidades e particularidades do caso atual.

Pasta 2:
Sistema Operacional Modelo
Uso comercial neutro.
Remover nome de empresa, nome de metodo e referencias locais.
Nao usar ProPositivo por enquanto.
Nao usar nome de empresa.
Nao manter divisao de unidades fixas.
Trocar lead por cliente.
Trocar follow up por Sequencia de Conversao.
Trocar Clube 30 por Plano de Recorrencia.
Trocar Indica 3 por Plano de Indicacao.
Pós Atendimento deve ser entendido como clientes novas.
Link de avaliacao deve ser tratado como etapa posterior apenas quando houver retorno positivo da cliente nova.

Regras:
Nao apagar nada.
Nao mover duplicidades sem revisao.
Criar pasta excluir apenas para futura organizacao.
Rodar primeiro em simulacao.
Gerar relatorio.
Depois rodar execucao real.

Comandos:

pip install -r requirements.txt
cp config.example.json config.json

Editar config.json com o ID da pasta base.

Simulacao:
python drive_reorganizer.py --config config.json --report relatorio_simulacao.json

Execucao real:
python drive_reorganizer.py --config config.json --execute --report relatorio_final.json

Ao final, me entregue:
1. Link da pasta Sistema Operacional Atual.
2. Link da pasta Sistema Operacional Modelo.
3. Link da pasta excluir.
4. Lista de arquivos que nao puderam ser copiados.
5. Lista de ajustes feitos em nomes e conteudo.
6. Lista de itens que precisam revisao humana.
