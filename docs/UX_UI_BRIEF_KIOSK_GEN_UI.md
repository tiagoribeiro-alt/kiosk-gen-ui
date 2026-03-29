# Kiosk Gen-UI — Brief Visual para UX/UI

> **Projeto**: Way Finder para Turismo Centro de Portugal (CIM)
> **Dispositivo**: Ecrã vertical **1080 × 1920 px** em modo kiosk (Chrome fullscreen)
> **Interação**: 100% por **voz** — sem touch, sem teclado
> **Duração por sessão**: 2–5 minutos
> **Fundo principal**: **Totalmente Claro (Branco / #F8FAFC)** em toda a aplicação

---

## 1. O Conceito — "Generative UI"

O kiosk é um **assistente de turismo por voz**. O visitante fala, e a IA (Gemini) responde com voz **e** gera a interface visual em tempo real.

**A UI não é pré-desenhada ecrã a ecrã** — é a IA que decide o que mostrar e quando, conforme a conversa. Tudo acontece em tempo real, sincronizado com a voz. Mantemos o comportamento original do fluxo conversacional, mas a apresentação é feita através de "Modern UI Cards" interligados numa **linha temporal horizontal (Jornada)**.

### Way Finder como shell reutilizável

**Way Finder** é a marca da shell da experiência. O agente regional ou parceiro pode ser CIM, PROVERE ou outro, mas o header, a linguagem do percurso e o comportamento da Journey mantêm-se consistentes. Em termos de produto, o topo do ecrã pode mostrar **Way Finder** como marca principal e a identidade do agente como contexto secundário.

### Journey como camada de representação

A Journey é uma camada de apresentação pura: recebe conteúdo já estruturado e mostra-o em paralelo com a conversa. Não gere WebSocket, não controla áudio e não mantém o estado de sessão. A sua função é apresentar cada novo elemento como mais um passo do percurso, ligado por um trilho orgânico e legível.

### Como funciona (simplificado)

```text
Visitante fala → IA ouve → IA responde com voz
                         → IA gera conteúdo visual (cards, mapas, fotos)
                         → Frontend renderiza em <600ms
```

---

## 2. Fluxo de Ecrãs — Visão Geral

O kiosk tem **4 estados** principais que definem a experiência:

```mermaid
stateDiagram-v2
    direction TB

    [*] --> IDLE
    
    IDLE --> LISTENING : Sensor detecta\nvisitante
    LISTENING --> IDLE : Timeout\n(sem interação)
    ACTIVE --> ACTIVE : Tool calls\n(POIs, mapa, meteo...)
    ACTIVE --> FAREWELL : Gemini invoca\nend_session
    ACTIVE --> IDLE : Timeout inatividade\n(30s sem voz)
    FAREWELL --> IDLE : Auto-retorno\n(5 segundos)

    state IDLE {
        [*] --> Screensaver
        note right of Screensaver
            Fundo claro (Branco / #F8FAFC)
            Branding Way Finder / agente
            no topo
            Texto de atração e Waveform base
        end note
    }

    state LISTENING {
        [*] --> Greeting
        note right of Greeting
            Áudio de boas-vindas
            Waveform animado (azul)
            Texto "A preparar..."
        end note
    }

    state ACTIVE {
        [*] --> Descobrir
        Descobrir --> Planear : Conversa evolui\n(via tool calls)
        Planear --> Levar : Visitante pronto\npara sair
        note right of Descobrir
            PASSO ①
            POIs, destinos, meteo
        end note
        note right of Planear
            PASSO ②
            Rotas, itinerários, galeria
        end note
        note right of Levar
            PASSO ③
            QR code, resumo
        end note
    }

    state FAREWELL {
        [*] --> Despedida
        note right of Despedida
            Fundo branco
            "Até breve!"
            QR code grande (300px)
            Countdown visual
        end note
    }
```

### Resumo dos estados

| Estado | Fundo | Duração | O que acontece |
|--------|-------|---------|---------------|
| **IDLE** (Screensaver) | Claro (Branco / `#F8FAFC`) | Indefinido | Ecrã atrai visitantes com ambiente visual claro. Onda na base. |
| **LISTENING** (Transição) | Claro | 3–5s | Greeting áudio toca, waveform azul pulsa na base. |
| **ACTIVE** (Conversa) | Claro | 2–5 min | Conversa ativa, UI gerada flui numa **Journey** horizontal, em paralelo com a voz. |
| **FAREWELL** (Despedida) | Claro | 15s | QR code, resumo final no extremo direito da Journey, auto-retorno. |

---

## 3. Ecrã a Ecrã — Layout do Shell + Journey

A interface utiliza um **layout fundamental inteiramente vertical (Column 100vh)** num fundo claro, contudo a disposição da informação central avança num fluxo interligado da **esquerda para a direita**. As gerações visuais (cards) comportam-se como pontos numa viagem ("journey"), muitas vezes unidos por uma linha orgânica, situados na área média/superior do ecrã, libertando a **área inferior exclusivamente para a Waveform de Voz**.

O princípio de implementação é separar a shell do kiosk da representação visual do percurso. A shell gere estados, presença, áudio e contexto; a **Journey** gere apenas cards, trilho, metáfora dos passos, foco e progressão visual. A referência histórica para esta linguagem é o **FlowTimeline** já validado no frontend anterior, agora reestruturado para ser mais robusto e desacoplado.

### 3.1 ESTRUTURA GERAL DO ECRÃ (Layout 100vh)

A proporção das secções no ecrã é rigorosamente distribuída de cima para baixo:

```mermaid
graph TB
    subgraph ECRÃ["ECRÃ VERTICAL 1080 × 1920 px (Fundo: #F8FAFC)"]
        direction TB
        
        HEADER["🔝 HEADER (10%)<br/>🧭 Way Finder + Agente & 📱 QR Badge mini"]
        SPACER["🟦 SPACER / TITLE (10%)<br/><i>Título do Passo Atual</i>"]
        
        subgraph FLOW["📚 JOURNEY (60%)<br/>Jornada Horizontal ligada por 'fio condutor'"]
            direction LR
            SLOT0["🃏 Card 1 (Início)"]
            SLOT1["🃏 Card 2 (Meio)"]
            SLOT2["🎴 Card 3 (Recente)"]
            
            SLOT0 -.- SLOT1
            SLOT1 -.- SLOT2
        end
        WAVE["〰️ WAVE PANEL (20%)<br/><i>Voice Wave afixada na BASE do ecrã<br/>Transcrição logo acima da onda</i>"]
    end
    
    HEADER --- SPACER
    SPACER --- FLOW
    FLOW --- WAVE

    style ECRÃ fill:#ffffff,stroke:#1a5276,stroke-width:3px
    style HEADER fill:#f8fafc,stroke:#e2e8f0,stroke-width:1px
    style SPACER fill:#ffffff,stroke:none
    style WAVE fill:#f8fafc,stroke:#e2e8f0,stroke-width:1px
    style FLOW fill:#f1f5f9,stroke:#cbd5e1,stroke-width:2px
    style SLOT2 fill:#ffffff,stroke:#1a5276,stroke-width:2px
    style SLOT1 fill:#f8fafc,stroke:#94a3b8,stroke-width:1px
    style SLOT0 fill:#f1f5f9,stroke:#cbd5e1,stroke-width:1px
```

**Zonas do layout (Posicionamento):**

| Zona | Proporção | Descrição |
|------|-----------|-----------|
| **Header** | 10% | Marca Way Finder, identidade do agente e indicativo com QR badge. |
| **Spacer/Title** | 10% | Título / Espaço de respiro vertical para manter consistência sem afogar os cards. |
| **Journey** | 60% | Área principal. O conteúdo é acrescentado lado a lado (esquerda-direita), com os cards unidos por um "fio" curvo ou visualmente sequenciados numa progressão temporal. O foco acompanha o item mais recente. |
| **Wave Panel** | 20% | Fixo na base inferior. A onda de voz pulsa na parte de baixo do ecrã com a transcrição atrelada imediatamente acima ou no próprio rodapé. |

---

### 3.2 Passo ① DESCOBRIR — Exemplo com POIs

```mermaid
graph TB
    subgraph ACTIVE_SCREEN["Passo ① DESCOBRIR"]
        direction TB
        
        HEADER["HEADER (10%)<br/>🧭 Way Finder + agente | 📱 QR Badge mini"]
        SPACER["SPACER/TITLE (10%)<br/><b>① Descobrir</b>"]
        
        subgraph FLOW["JOURNEY (60%) - Horizontal Journey"]
            direction LR
            C1["🌤️ Meteorologia"]
            C2["🎴 POI 1: Museu Tavares Proença"]
            C3["🎴 POI 2: Monsanto"]
            
            C1 -.- C2
            C2 -.- C3
        end
        
        subgraph WAVE["WAVE PANEL (20%) - NA BASE"]
            direction TB
            VT["TRANSCRIÇÃO<br/><i>'Aqui estão alguns locais!'</i>"]
            VW["〰️ WAVEFORM<br/><i>Azul = ouvir, Rosa = falar</i>"]
            VT --- VW
        end
        
        HEADER --- SPACER
        SPACER --- FLOW
        FLOW --- WAVE
    end

    style ACTIVE_SCREEN fill:#ffffff,stroke:#1a5276,stroke-width:3px
    style HEADER fill:#f8fafc,stroke:#e2e8f0
    style SPACER fill:#ffffff,stroke:none
    style WAVE fill:#f1f5f9,stroke:#cbd5e1,stroke-width:1px
    style FLOW fill:#ffffff,stroke:none
```

---

### 3.3 Passo ② PLANEAR — Rota + Galeria

```mermaid
graph TB
    subgraph PLANEAR_SCREEN["Passo ② PLANEAR"]
        direction TB
        
        HEADER["HEADER (10%)"]
        SPACER["SPACER/TITLE (10%)<br/><b>② Planear</b>"]
        
        subgraph FLOW["JOURNEY (60%) - Pan para Direita"]
            direction LR
            C2["🎴 Monsanto"]
            C3["🗺️ MAPA ROTA"]
            C4["🖼️ GALERIA"]
            
            C2 -.- C3
            C3 -.- C4
        end
        
        subgraph WAVE["WAVE PANEL (20%) - NA BASE"]
            VT["TRANSCRIÇÃO<br/><i>'Este é o melhor percurso...'</i>"]
            VW["〰️ WAVEFORM ROSA"]
            VT --- VW
        end
        
        HEADER --- SPACER
        SPACER --- FLOW
        FLOW --- WAVE
    end

    style PLANEAR_SCREEN fill:#ffffff,stroke:#1a5276,stroke-width:3px
```

---

### 3.4 Passo ③ FAREWELL — Despedida + QR Code

```mermaid
graph TB
    subgraph FAREWELL_SCREEN["Passo ③ LEVAR (FAREWELL)"]
        direction TB
        
        HEADER["HEADER (10%)"]
        SPACER["SPACER/TITLE (10%)"]
        
        subgraph FLOW["JOURNEY (60%) - Final de Linha"]
            direction LR
            RESUMO["📋 Resumo Consolidado"]
            QR["🔳 QR CODE (Scan Final)"]
            
            RESUMO -.- QR
        end
        
        subgraph WAVE["WAVE PANEL (20%) - NA BASE"]
            CD["⏳ COUNTDOWN 15s"]
            VW["〰️ Onda fluida (Idle state)"]
            CD --- VW
        end
        
        HEADER --- SPACER
        SPACER --- FLOW
        FLOW --- WAVE
    end

    style FAREWELL_SCREEN fill:#ffffff,stroke:#1a5276,stroke-width:3px
```

---

## 4. Fluxo Completo de uma Sessão — Timeline

```mermaid
sequenceDiagram
    actor V as 👤 Visitante
    participant K as 🖥️ Kiosk UI
    participant AI as 🤖 Gemini

    rect rgb(248, 250, 252)
        Note over K: SCREENSAVER — Fundo claro
        K->>K: Cicla cartões decorativos
        K->>K: Wave base "Talk to me"
    end

    V->>K: 🚶 Aproxima-se (sensor presença)
    
    rect rgb(241, 245, 249)
        Note over K: LISTENING
        K->>V: 🔊 "Bem-vindo ao Centro de Portugal!"
        K->>K: Waveform azul acende na base
    end
    
    rect rgb(255, 255, 255)
        Note over K: ACTIVE — Pan horizontal à medida que surge mais UI
        
        Note over K: ① DESCOBRIR
        V->>K: 🎤 "Quero ver monumentos na área"
        AI->>K: 🔊 voz + tool call: get_pois
        K->>K: 🃏 Surge o primeiro nó visual (esquerda)
        
        V->>K: 🎤 "Gostei desse primeiro."
        AI->>K: 🔊 voz + tool call: get_poi_details
        K->>K: 🎴 Cria novo nó à direita conectado por linha. Journey faz pan p/ direita.
        
        Note over K: ② PLANEAR
        V->>K: 🎤 "Mostra uma foto"
        AI->>K: 🔊 voz + tool call: show_gallery
        K->>K: 🖼️ Galeria liga-se na extema direita da Journey

        Note over K: ③ LEVAR
        V->>K: 🎤 "Obrigado"
        AI->>K: 🔊 "Foi um prazer!" + end_session
    end
    
    rect rgb(248, 250, 252)
        Note over K: FAREWELL — Checkout Despedida
        K->>K: 🔳 O 'nó' final da viagem revela o QR de checkout
        K->>K: ⏳ Countdown no Wave Panel inferiror (15s)
        V->>V: 📱 Scan QR → resumo no telemóvel
    end
```

---

## 5. Catálogo de Componentes

```mermaid
graph TB
    subgraph COMPONENTS["CATÁLOGO DE COMPONENTES UI"]
        direction TB
        
        subgraph LAYOUT["📐 LAYOUT"]
            KS["<b>KioskShell</b><br/>Container 100vh Vertical<br/>fundo claro #F8FAFC"]
            SP["<b>JourneyTimeline</b><br/>Container Horizontal com Scroll Automático/Pan da Esq->Dir"]
        end
        
        subgraph VOICE["🎙️ WAVE PANEL (BASE DO ECRÃ)"]
            VW["<b>VoiceWave</b><br/>Centrada inferiormente<br/>azul=ouvir / rosa=falar"]
            TO["<b>Transcrição</b><br/>Ancorada imediatamente por cima do wave"]
        end
        
        subgraph CONTENT["🎴 MODERN UI CARDS — ligados por trilho"]
            direction TB
            PC["<b>POICards</b><br/>(Monumentos, Natureza)"]
            IG["<b>ImageGallery</b><br/>carousel"]
            MV["<b>MapView</b><br/>(Leaflet)"]
        end
        
        subgraph FAREWELL_G["👋 FAREWELL"]
            FC["<b>Checkout</b><br/>QRCode + Resumo"]
        end
    end

    style COMPONENTS fill:#ffffff,stroke:#1a5276,stroke-width:2px
    style LAYOUT fill:#f0f9ff,stroke:#3b82f6,stroke-width:1px
    style VOICE fill:#fef2f2,stroke:#f43f5e,stroke-width:1px
    style CONTENT fill:#f0fdf4,stroke:#22c55e,stroke-width:1px
    style FAREWELL_G fill:#ecfeff,stroke:#06b6d4
```

---

## 6. Detalhe dos Componentes de Conteúdo

*(Estruturas físicas dos cartões focadas numa leitura clara à altura dos olhos, agora encadeados de perfil)*

### Paleta de cores por categoria de POI

| Categoria | Ícone | Cor texto | Cor fundo badge | Cor borda badge |
|-----------|-------|-----------|-----------------|-----------------|
| **Monumento** | 🏛 | `amber-600` | `amber-50` | `amber-200` |
| **Natureza** | 🌿 | `emerald-600` | `emerald-50` | `emerald-200` |
| **Restaurante** | 🍴 | `orange-600` | `orange-50` | `orange-200` |
| **Museu** | 🏛 | `purple-600` | `purple-50` | `purple-200` |
| **Igreja** | ⛪ | `blue-600` | `blue-50` | `blue-200` |
| **Hotel** | 🏨 | `pink-600` | `pink-50` | `pink-200` |

---

## 7. Animações e Estados de Loading

```mermaid
graph TB
    subgraph ANIM["ANIMAÇÕES & ESTADOS DE LOADING"]
        direction LR
        
        LOADING["⏳ <b>Skeleton Shimmer</b><br/>nos Cards gerados no fluxo"]
        FLOWSTAGE["✨ <b>Horizontal Pan</b><br/>Novo item surge na direita<br/>A câmara desliza para focar o novo card ativo"]
        LINE["🧵 <b>Draw Line</b><br/>Fio animado desenha a curva a unir progressivamente os painéis"]
        WAVE_A["〰️ <b>Wave Anchor</b><br/>Fixa na base inferior<br/>Respira em Idle, Pulsa dinamicamente ao falar"]
        
        LOADING --- FLOWSTAGE --- LINE --- WAVE_A
    end

    style ANIM fill:#ffffff,stroke:#1a5276,stroke-width:2px
```

---

## 8. Especificações Tipográficas e de Acessibilidade

| Aspeto | Valor |
|--------|-------|
| **Fonte principal** | Montserrat (sans-serif) |
| **Contraste** | Fundo Claro / Branco (#F8FAFC e #FFFFFF), texto escuro |
| **Cards (Modern UI)** | `rounded-2xl`, sombras elegantes (`shadow-xl`) |
| **Border radius base** | 1rem (16px) a 1.5rem |
| **Transcrição** | Sempre visível **junto à base**, acompanhando o Wave Panel. |
| **Safe margin** | 60px nas laterais, baseada num panning lateral infinito. |

---

## 9. Branding — Agente Way Finder

| Elemento | Valor |
|----------|-------|
| **Logo** | Turismo Centro de Portugal |
| **Cor primária** | `#1a5276` (azul escuro) |
| **Cor do waveform (ouvir)** | `#3B82F6` (blue-500) |
| **Cor do waveform (falar)** | `#F43F5E` (rose-500) |
| **Fundo Absoluto (Shell)** | `#F8FAFC` (Slate 50 / Branco minimalista) |

---

## 10. Notas para o Designer

### Layout Horizontal em Viewport Vertical
- Embora seja um ecrã Mupi marcadamente vertical (1080x1920), a resposta cronológica ("Timeline") de resultados interage deslizando lateralmente (Panning).
- O elemento visual âncora desta jornada na Journey é estético: **linha contínua, curva e orgânica** (estilo "mural / roadmap") que liga os cartões gerados. 
- Durante o fluxo conversacional o Kiosk foca horizontalmente no novo termo mais à direita, empurrando os blocos passados para além do viewport (edge esquerdo do ecrã).

### Boundary de implementação
- A shell do kiosk trata presença, áudio, sessão e mudança de estados.
- A Journey trata layout, cards, trilho, foco e progressão visual.
- O input da Journey deve chegar já normalizado por um adapter; a camada visual não deve receber payloads crus do backend ou do Gemini.

### Wave Panel Afixado à Base
- Para aproximar visualmente do visitante as sensações conversacionais modernas de IA nativa (ex: Novo Siri (iOS) no rebordo, Google Assistant overlay bottom-sheet), a onda e a transcrição habitam o "rodapé" ou a **área de fundo inferior** do Mupi. O ecrã reserva-se visualmente todo do meio para cima para as informações relevantes dos passeios.

### O que o designer pode propor
- **Design da Linha Conetora:** Como a "corda ondulante/trilho" entra, sai de trás de foco, e abraça de forma orgânica cada Cartão.
- **Tratamento das margens visuais:** O corte horizontal progressivo (fade-out / desfoque lateral no espaço 100vh) quando se arrastam os cards antigos para fora do palco visual principal.
- **Integração refinada das Transcrições:** Como a legenda flutua acima com a Wave na Base Inferior num enquadramento natural perante um cenário vazio (idle) ou populado a meio do ecrã (active).