# Checklist de Entrada e Credenciais do Projeto

> **Status:** ✅ TODAS AS CREDENCIAIS ESSENCIAIS FORAM CONFIGURADAS!
> **Data de Atualização:** 25/09/2026
> **Arquivo .env:** Já criado na raiz do projeto com os valores preenchidos.

---

## 1. Banco de Dados (Supabase)
- **URL do Projeto:** `https://xfceyuragbhyelmgpamw.supabase.co`
- **Chave Pública (Anon/Publishable):** `sb_publishable_HUvn_XgYmlT68yYPeVdzYQ_9KuJ6uYf`
- **Status do Banco:** ✅ Tabelas, Views, Triggers e RPC já criados no SQL Editor do Supabase.

---

## 2. Catálogo de Cinema (TMDB)
- **API Key v3:** `56d7cfa1f23f581dfec3200d18cc3de0`
- **Idioma Padrão:** `pt-BR`
- **Status da API:** ✅ Ativa e pronta para consumo.

---

## 3. Dados do Casal
- **Casal:** Eduardo & Laura
- **Início do Namoro:** `24/03/2024` (Data base para o contador de dias juntos e sessões de cinema).
- **Fotos de Avatar:** Serão adicionadas depois (usar avatares modernos SVG de fallback até lá: um azul com iniciais "E" e um lilás/rosa com iniciais "L").

---

## 4. Playlists de Música (Spotify & Deezer)
- **Cenário Atual:** Não possuem uma playlist pronta ainda.
- **Como vai funcionar:**
  1. **Playlist Geral do App ("Nossa Trilha"):** Vocês adicionam músicas uma a uma colando o link (de qualquer app). O sistema automaticamente cria o card com o link para o **Spotify** (Eduardo) e para o **Deezer** (Laura).
  2. **Playlists Embutidas:** Deixaremos na interface um botão discreto de *"Configurar link da Playlist do Spotify/Deezer"*. Quando vocês criarem a playlist oficial de vocês em qualquer momento futuro, basta colar o link lá que o player embutido passa a funcionar!

---

## 5. Instrução para o Próximo Chat / Execução
O próximo chat (ou esta mesma sessão) pode iniciar **imediatamente** a Etapa 2 do [00-plano-de-execucao-mestre.md](file:///c:/Users/Inteli/Documents/app%20filmes/planos/00-plano-de-execucao-mestre.md), pois todas as dependências externas já estão satisfeitas:
```bash
npm create vite@latest . -- --template react-ts
npm install @supabase/supabase-js @tanstack/react-query zustand lucide-react framer-motion canvas-confetti clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa @types/canvas-confetti
npx tailwindcss init -p
```
