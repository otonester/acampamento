# Gestor de Acampamento

Aplicativo web para organizar acampamentos e eventos dos Desbravadores: cronograma, cardápio, caronas, participantes e brincadeiras, com vários eventos separados na mesma conta. Funciona no celular e no computador, e pode ser instalado na tela inicial (PWA).

Feito com React, TypeScript, Tailwind CSS, Lucide e Supabase. Hospedagem preparada para o Netlify e para a Vercel.

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/migrations/20261106000000_gestor_acampamento.sql` e clique em **Run**. Isso cria as tabelas, as regras de segurança e o gerador do evento de exemplo.
3. Abra **Project Settings > API** e copie a **Project URL** e a chave pública (**anon** ou **publishable**).
4. Abra **Authentication > URL Configuration** e informe em **Site URL** o endereço do app (depois de publicar). Isso faz os links de confirmação e de recuperação de senha funcionarem.

Se preferir a CLI: `supabase link --project-ref SEU_REF` e `supabase db push`.

**Confirmação de e-mail:** por padrão o Supabase pede confirmação ao criar conta. Para entrar direto, desative em **Authentication > Sign In / Providers > Email > Confirm email**.

**Depois de criar a sua conta:** desative novos cadastros em **Authentication > Sign In / Providers > Allow new users to sign up**. Mesmo com cadastro aberto, cada conta só enxerga os próprios eventos.

## 2. Executar no computador

É necessário ter o Node.js 20 ou mais recente.

```bash
cp .env.example .env     # preencha com a URL e a chave pública
npm install
npm run dev              # abre em http://localhost:5173
```

Outros comandos: `npm test` (regras de negócio) e `npm run build` (versão de produção).

## 3. Publicar

### No Netlify

1. Envie o projeto para um repositório no GitHub.
2. No Netlify, clique em **Add new project > Import an existing project** e escolha o repositório. As configurações de compilação já vêm do `netlify.toml`.
3. Em **Environment variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. Depois, informe o endereço gerado na **Site URL** do Supabase (passo 1.4).

Se alterar as variáveis, publique de novo com **Deploys > Trigger deploy**: elas entram no aplicativo no momento da compilação.

Sem GitHub: crie o arquivo `.env`, execute `npm install` e `npm run build`, e arraste a pasta `dist` para a área de publicação manual do Netlify. Nesse caso, as rotas funcionam porque o arquivo `dist/_redirects` é gerado junto.

### Na Vercel

1. Envie o projeto para um repositório no GitHub.
2. Na Vercel, clique em **Add New > Project** e importe o repositório. As configurações vêm do `vercel.json`.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. Depois, informe o endereço gerado na **Site URL** do Supabase (passo 1.4).

## 4. Primeiro uso

Crie sua conta na tela de entrada. Em seguida, escolha **Novo evento** para começar do zero ou **Criar evento de exemplo** para carregar os dados de demonstração, todos editáveis.

## 5. Instalar no celular

- **iPhone:** abra o endereço no Safari, toque em Compartilhar e em **Adicionar à Tela de Início**.
- **Android:** abra no Chrome, toque no menu e em **Instalar app** ou **Adicionar à tela inicial**.

A interface abre mesmo sem internet, mas ver e alterar os dados exige conexão.

## Segurança

- O app usa somente a chave pública do Supabase. Nunca coloque a chave `service_role` no `.env` nem na Vercel.
- Sem login, nada pode ser lido: o acesso anônimo é revogado em todas as tabelas.
- Row Level Security está ativa em todas as tabelas: cada evento só é acessível pela conta que o criou.

## Como os dados de exemplo foram tratados

- **Daniel** e **Brian** aparecem em duas categorias nos exemplos. Cada um tem um só registro com as duas funções e uma observação pedindo revisão.
- **Daniel** está em dois carros na ida, como nos exemplos, e fica sinalizado para revisão. Nada é removido automaticamente.
- **Pedro** não aparece em nenhum carro, então surge como sem carona.
- **Gilson, Fernanda, Mabillys, Gi e Erivelton** são motoristas externos, com **4 vagas** cada (valor inicial a ajustar).
- **Caminhada de 8 km** recebeu 2 horas, o intervalo até a chegada às 11:45. As pausas ficam sinalizadas como possíveis conflitos: marque como simultâneas se for de propósito.
- As datas de exemplo são o próximo sábado e domingo.

## Regras úteis

- **Mudança de duração:** o app pergunta se mantém os horários seguintes ou os recalcula, mostrando a prévia. O recálculo vale para as atividades pendentes ou em andamento do mesmo dia.
- **Arrastar uma atividade:** entre atividades de mesmo horário, só muda a ordem. Se a nova posição contrariar os horários, o app pergunta como ajustar, e nada muda sem confirmação.
- **Em andamento:** é destacada pelo status manual ou automaticamente pelo relógio do aparelho.
- **Lista de compras:** une itens de mesmo nome (ignorando acentos e maiúsculas) e soma as quantidades de mesma unidade.

## Estrutura

```
supabase/migrations/   esquema, RLS, duplicação de evento e dados de exemplo
src/lib/               regras de negócio, datas, exportações e testes
src/context/           autenticação, dados do evento, avisos e confirmações
src/components/        componentes reutilizáveis
src/pages/             Início, Cronograma, Cardápio, Caronas, Participantes, Brincadeiras, Eventos
```
