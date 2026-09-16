⚡ Alpha Bot V5
Versão avançada do Alpha Bot para lojas Discord.
Recursos
Slash commands registrados automaticamente por servidor
Painel de compra com seleção de produto
Tickets privados por pedido
Produtos com preço, descrição e ID
Estoque por unidade
Reestoque com embed detalhado e histórico
Estoque antes → depois
PIX/PicPay semi-automático
Confirmação de pagamento pela staff
Entrega no ticket, por DM ou manual
Logs de tickets e vendas
Histórico de vendas
Sistema de avaliações
Cargo de staff
Categoria de tickets
Canal de logs
Painéis vinculados ao estoque
Modo manutenção
Alertas de estoque baixo
Backup manual
Banco JSON com gravação atômica
Railway
Configure:
TOKEN = token do bot
Opcionalmente não é necessário GUILD_ID: a V5 registra os comandos em cada servidor onde o bot está.
Importante
Nunca coloque o token no GitHub.
Reestoque
Exemplo:
/reestock produto:GOD HUMAN itens:conta1|conta2|conta3
Cada item é uma unidade que será entregue após a confirmação.
Fluxo de compra
/configurarproduto → /reestock → /configurarpix → /configurarentrega → /painel-ticket → cliente seleciona produto → ticket → pagamento → comprovante → staff usa /confirmarpagamento → estoque diminui → entrega.
Deploy automático
Conecte o repositório ao Railway. Cada commit no GitHub dispara um novo deploy se o Auto Deploy estiver ativo no serviço.
