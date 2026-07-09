# Credenciais

Os exports de credenciais do n8n não pertencem ao repositório.

Criar no n8n uma credencial **Basic Auth** chamada
`LusoPay Basic Auth`:

- User: username atribuído pela LusoPay à software house
- Password: password atribuído pela LusoPay à software house

Depois de importar os workflows, abrir os dois adapters LusoPay e selecionar
esta credencial nos respetivos nós HTTP Request.

O `owner` usado nos URLs é o Identificador Público de Conta do comerciante e
fica em `LUSOPAY_OWNER_ID`. Não é uma password, mas deve ser administrado
como configuração do deployment.

O endpoint MCP deve usar uma credencial própria de Bearer/Header Auth,
distinta da credencial LusoPay.
