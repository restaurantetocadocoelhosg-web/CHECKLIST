# 🐰 Toca do Coelho — Checklists Operacionais

## Logins da Equipe

| Nome     | Usuário   | Senha    | Cargo     |
|----------|-----------|----------|-----------|
| Nayara   | nayara    | nay123   | Admin     |
| Simone   | simone    | sim123   | Gerente   |
| Neia     | neia      | neia123  | Gerente   |
| Thiago   | thiago    | thi123   | Operador  |
| Leonardo | leonardo  | leo123   | Operador  |
| Deivison | deivison  | dei123   | Operador  |
| Paulo    | paulo     | pau123   | Operador  |
| Jorge    | jorge     | jor123   | Operador  |

## Como colocar no GitHub (passo a passo)

1. Crie uma conta no GitHub: https://github.com
2. Clique em **"New repository"** (botão verde)
3. Nome: `toca-checklist`
4. Marque **Public**
5. Clique **Create repository**
6. Na página que abrir, clique em **"uploading an existing file"**
7. Arraste TODOS os arquivos desta pasta (server.js, package.json, Dockerfile, .gitignore, e a pasta public/)
8. Clique **Commit changes**

## Como colocar no Railway (grátis)

1. Acesse https://railway.app e faça login com GitHub
2. Clique **New Project**
3. Escolha **Deploy from GitHub repo**
4. Selecione o repositório `toca-checklist`
5. Railway vai detectar o Dockerfile automaticamente
6. **IMPORTANTE** — Adicione o volume para o banco de dados:
   - Clique no serviço criado
   - Vá em **Volumes** → **Add Volume**
   - Mount Path: `/data`
7. Em **Variables**, confirme que existe:
   - `DB_PATH` = `/data/checklist.db`
   - `PORT` = `3000`
8. Clique **Deploy**
9. Quando ficar verde, vá em **Settings** → **Domains** → **Generate Domain**
10. Pronto! O link gerado é o seu app rodando.

## Funcionalidades

- ☀️ Checklist de Abertura e 🌙 Fechamento
- 5 setores: Salão, Cozinha, Copa, Banheiro, Área Gourmet
- Nome e hora de quem marcou cada tarefa
- Finalização de setor com responsável
- 📊 Relatórios com histórico detalhado
- ⚙️ Admin para editar tarefas, adicionar/remover funcionários
- Todos os funcionários compartilham os mesmos dados em tempo real
