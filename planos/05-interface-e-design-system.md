# 05 - Interface, Design System e Telas (Especificação Visual)

## 1. Princípios de Design & Identidade Visual
A interface do app foi concebida para transmitir o **clima de cinema premium e intimista**. A estética une o preto grafite profundo dos serviços de streaming modernos (Apple TV+, HBO Max) com toques sutis de **roxo violeta** e **azul ciano**, sem poluição visual ou cores saturadas em excesso.

---

## 2. Design Tokens e Configuração do Tailwind CSS

### 2.1 Paleta de Cores Precisa

| Token | Valor Hex | Aplicação no Sistema |
| :--- | :--- | :--- |
| `bg-cinema-base` | `#08090D` | Fundo principal da aplicação |
| `bg-cinema-surface` | `#11131C` | Fundo de cards, cabeçalho e componentes |
| `bg-cinema-elevated` | `#1A1D2B` | Modais, dropdowns e itens em destaque |
| `border-cinema` | `#23273B` | Bordas discretas e divisores sutis |
| `accent-purple` | `#8B5CF6` | Acento principal, botões de ação e gradientes |
| `accent-blue` | `#38BDF8` | Destaques secundários e elementos do Eduardo |
| `accent-pink` | `#F43F5E` | Destaques românticos, corações e elementos da Laura |
| `accent-gold` | `#FBBF24` | Estrelas de avaliação e filmes Nota 10 |
| `text-primary` | `#F8FAFC` | Títulos e textos de alta legibilidade |
| `text-secondary` | `#94A3B8` | Sinopses, durações e metadados secundários |
| `text-muted` | `#64748B` | Textos desativados e placeholders |

### 2.2 Configuração Extendida no `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          base: '#08090D',
          surface: '#11131C',
          elevated: '#1A1D2B',
          border: '#23273B',
        },
        accent: {
          purple: '#8B5CF6',
          blue: '#38BDF8',
          pink: '#F43F5E',
          gold: '#FBBF24',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-purple': '0 0 25px -5px rgba(139, 92, 246, 0.3)',
        'glow-blue': '0 0 25px -5px rgba(56, 189, 248, 0.3)',
        'glow-gold': '0 0 25px -5px rgba(251, 191, 36, 0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 3. Wireframes e Layouts de Tela

### 3.1 Header e Alternador de Perfil (Desktop & Mobile)
```
+─────────────────────────────────────────────────────────────────────────────+
|  🍿 NOSSA SESSÃO    [Filmes]  [Músicas]  [Histórico]      PERFIL ATIVO:     |
|                                                     [ 👤 Eduardo ] [ 🌸 Laura ]|
+─────────────────────────────────────────────────────────────────────────────+
```
- Efeito ao clicar em **Eduardo**: O botão ganha borda com brilho azul ciano e a saudação da tela muda para *"Bem-vindo de volta, Edu!"*.
- Efeito ao clicar em **Laura**: O botão ganha borda com brilho rosa violeta e a saudação muda para *"Bem-vinda de volta, Lau!"*.

---

### 3.2 Seção Hero: Destaque & Sorteador ("O que ver hoje? 🎲")
```
+─────────────────────────────────────────────────────────────────────────────+
|  [ Imagem de Fundo Desfocada com Backdrop do Último Match ]                 |
|                                                                             |
|  💖 VOCÊS TÊM 8 FILMES EM COMUM NA LISTA!                                  |
|  Que tal deixar a sorte decidir a sessão de hoje à noite?                   |
|                                                                             |
|  [ 🎲 SORTEAR FILME DE HOJE ]          [ + Sugerir Novo Filme ]             |
|                                                                             |
|  Status Rápido:  🔥 8 Matches  |  👤 4 do Edu  |  🌸 6 da Lau  |  ✅ 32 Vistos |
+─────────────────────────────────────────────────────────────────────────────+
```

---

### 3.3 Abas e Grid de Filmes (Estilo Cartazes de Cinema)
```
  [ 🔥 Match do Casal (8) ]  [ Sugeridos por Edu ]  [ Sugeridos por Lau ]  [ Já Vistos ]
  
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ [ PÔSTER ]   │   │ [ PÔSTER ]   │   │ [ PÔSTER ]   │   │ [ PÔSTER ]   │
  │              │   │              │   │              │   │              │
  │ Duna: Parte 2│   │ Oppenheimer  │   │ Pobres Criat.│   │ Interestelar │
  │ 2024 • 166m  │   │ 2023 • 180m  │   │ 2023 • 141m  │   │ 2014 • 169m  │
  │ [🔥 MATCH!]  │   │ [🔥 MATCH!]  │   │ [🔥 MATCH!]  │   │ ⭐ 9.6 Média │
  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

#### Microinteração ao Passar o Mouse (Hover no Desktop) ou Tocar (Mobile):
- O card eleva ligeiramente (`transform: translateY(-6px)`).
- Uma camada escura translúcida surge com a sinopse resumida.
- Botões de ação rápida:
  - `[ ✅ Marcar como Assistido ]`
  - `[ ℹ️ Ver Detalhes e Trailer ]`
  - `[ 🗑️ Remover da Lista ]`

---

### 3.4 Modal de Busca com Autocomplete TMDB
```
+─────────────────────────────────────────────────────────────────────────────+
|  🔍 Buscar filme ou série... [ Ex: Gladiador 2 ]                     [ ESC ]|
+─────────────────────────────────────────────────────────────────────────────+
|  RESULTADOS ENCONTRADOS:                                                    |
|                                                                             |
|  [Pôster 60x90] Gladiador II (2024)                                         |
|                 Ação, Aventura • 148 min                                    |
|                 "Anos depois de testemunhar a morte do herói Máximus..."     |
|                 [ + Quero Assistir ]                                        |
|  ─────────────────────────────────────────────────────────────────────────  |
|  [Pôster 60x90] Gladiador (2000)                                            |
|                 Ação, Drama • 155 min • ⭐ 8.5 TMDB                         |
|                 "Nos dias finais do reinado de Marcus Aurelius..."           |
|                 [ + Quero Assistir ]                                        |
+─────────────────────────────────────────────────────────────────────────────+
```

---

### 3.5 Modal de Avaliação Pós-Filme (Avaliação do Casal)
```
+─────────────────────────────────────────────────────────────────────────────+
|  🎬 AVALIAR SESSÃO: "Interestelar"                                   [ ✕ ]  |
+─────────────────────────────────────────────────────────────────────────────+
|                                                                             |
|  NOTA DO EDUARDO:                    NOTA DA LAURA:                         |
|  [ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ 9.5 ]        [ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ ⭐ 9.0 ]       |
|                                                                             |
|                      MÉDIA DO CASAL: 9.3 🏆 EXCELENTE                       |
|                                                                             |
|  QUEM DORMIU NO MEIO DO FILME?                                              |
|  ( ) Ninguém      (•) Eduardo      ( ) Laura      ( ) Ambos                 |
|                                                                             |
|  TAGS DO MOMENTO (Selecione):                                               |
|  [✓ 😭 Choramos]  [✓ 🤯 Explodiu a mente]  [ 💤 Deu soninho ]  [ 🍕 Conforto ] |
|                                                                             |
|  ONDE ASSISTIRAM?                                                           |
|  [ Cinema ]  [ (•) Max ]  [ Netflix ]  [ Prime Video ]                      |
|                                                                             |
|  COMENTÁRIO DO EDUARDO:              COMENTÁRIO DA LAURA:                   |
|  [ "A trilha sonora no cinema arre- ] [ "Chorei na cena das mensagens de   ] |
|  [ piava até a alma!"               ] [ vídeo. Filme perfeito!"             ] |
|                                                                             |
|  [ CANCELAR ]                                       [ SALVAR NO HISTÓRICO ] |
+─────────────────────────────────────────────────────────────────────────────+
```

---

### 3.6 Layout Mobile (Barra de Navegação Inferior Fixa)
No celular, a usabilidade precisa ser perfeita com uma mão só:
```
+──────────────────────────+
|      TELA DO CELULAR     |
|                          |
|                          |
+──────────────────────────+
|  [🍿 Filmes] [🎵 Som] [🎲 Sorteio] [📊 Stats] |  <- Barra Fixa no Rodapé
+──────────────────────────+
```
