# Kiosk Gen-UI — Architecture & Build Plan

> Rebuild do sistema de quiosque interativo de turismo com voz, a partir dos repos `eventuais-backend` e `eventuais-frontend`.

## 1. Contexto

### O que o sistema faz

Um quiosque interativo de turismo com voz, desenhado para stands de turismo (ex: BTL). Concretamente:

1. Ecrã vertical (1080×1920) mostra um screensaver com regiões turísticas
2. Sensor de presença detecta visitante → toca áudio de boas-vindas → liga-se ao Gemini
3. Visitante fala por microfone (PCM 16kHz) → áudio vai via WebSocket → Gemini Live API
4. Gemini responde com voz sintetizada (PCM 24kHz) + invoca tool calls que geram cards de POIs, eventos, imagens, mapas no ecrã
5. Ao despedir-se, gera resumo da conversa (Gemini 2.5 Flash) → pode ser enviado por email (Resend) ou levado via QR code
6. Suporta múltiplos agentes (ex: "CIM", "PROVERE") com prompts, vozes e dados distintos
7. Dados de POIs: OpenStreetMap (fallback Google Places), imagens: Google Places/Unsplash/Pexels, eventos: Firestore + web search
8. Contexto adicional via Vertex AI RAG Engine + Google Search Grounding (híbrido)

### Porquê rebuild

O sistema atual (~7700 linhas) funciona, mas:

- **~40% do código é defensivo/workaround** contra comportamento errático do proxy WebSocket manual (650 linhas de proxy em Node.js que o SDK Python faz em ~20)
- **Zero testes frontend**, testes backend desatualizados
- **Zero CI/CD** — deploy manual
- **Rotas Express registadas 2x** (bug real)
- **Deduplicação tripla** de mensagens (proxy + frontend + debounce)
- **4 useEffect** para um único estado (farewell)
- **System prompt de 5000 palavras** hardcoded em TypeScript
- **Dead code**: server.py Python legado, groq-sdk não usado, endpoints 501
- **Acoplamento forte**: URL remapping de 130 linhas, CORS hardcoded
- **Dados presos ao RAG**: eventos e info dinâmica pré-indexados manualmente em vez de consultados em tempo real
- **Mapa limitado**: apenas marcador estático, sem rotas nem itinerários
- **Sem features básicas de turismo**: meteorologia, QR code, galeria de fotos

### Objectivo do sistema

O quiosque não é um chatbot genérico — é um **concierge de turismo com voz** que deve:

1. **Acolher** — detectar presença, cumprimentar na língua certa, criar confiança
2. **Descobrir** — entender o que o visitante procura (natureza? comida? história? eventos?)
3. **Mostrar** — apresentar destinos, POIs, rotas, meteorologia, eventos com UI rica
4. **Planear** — gerar itinerários com rotas visuais, tempos e distâncias
5. **Entregar** — o visitante leva a informação consigo (QR, email, resumo)

Cada interação deve durar **2-5 minutos** e o visitante deve sair com informação útil **no telemóvel**.

---

## 2. Decisões Arquiteturais

### Modelo único vs dual-modelo

**Decisão: modelo único com tool calls.**

O dual-modelo (voz + UI planner separado) foi considerado e **rejeitado** porque:

- Adiciona 1-3s de latência por atualização de UI (chamada extra)
- Cria problemas de sincronização voz↔UI ("aqui tens os restaurantes" mas UI ainda a calcular)
- Duplica custos de API por turno
- Ponto de falha extra sem ganho funcional

O dual-modelo faz sentido para sistemas com UI significativamente mais complexa que a conversa (IDEs, dashboards analíticos). Para um quiosque com cards, mapas e imagens, é over-engineering.

### Backend Python vs Node.js

**Decisão: Python com FastAPI.**

- O SDK `google-genai` é first-class em Python (`client.aio.live.connect()` trata toda a complexidade WS)
- asyncio nativo para WebSocket + streaming
- Pydantic para tipos e validação (integração natural com FastAPI)
- Elimina as ~650 linhas de proxy manual que existem em Node.js

### Monolito vs microserviços

**Decisão: monolito FastAPI bem estruturado.**

Para a escala deste sistema (1-3 sessões simultâneas por quiosque), microserviços são overhead desnecessário.

### O que NÃO usar

| Rejeitado | Razão |
|-----------|-------|
| LangGraph / LangChain | Abstração desnecessária para fluxo linear com tool calls |
| SSE para UI updates | WS já aberto para áudio, usar mesmo canal |
| Session resumption (MVP) | Sessões duram 2-5 min, bem dentro do limite de 15 min |
| Microserviços separados | Escala não justifica |

---

## 3. Estratégia de Dados (RAG + Search Grounding)

### Problema do sistema atual

O sistema está **demasiado preso ao RAG**. Informação de eventos, horários e dados que mudam frequentemente estão pré-indexados num corpus estático. Isto significa:

- Eventos desatualizados (corpus re-indexado manualmente)
- Incapacidade de responder a perguntas factuais em tempo real ("que eventos há esta semana?")
- Manutenção manual contínua do corpus

### Abordagem híbrida (3 camadas)

| Camada | Fonte | Tipo de dados | Atualização |
|--------|-------|---------------|-------------|
| **Estática** | Vertex AI RAG (`vertex_rag_store`) | Descrições de POIs, história, patr mónio, horários fixos, dicas locais | Re-indexação periódica |
| **Dinâmica** | Google Search Grounding (Live API) | Eventos atuais, meteorologia, notícias, horários de transportes | Tempo real |
| **Curada** | Firestore | Eventos patrocinados, destaques editoriais, campanhas | CMS/manual |

### Implementação

A Live API suporta combinar `google_search` + `function_declarations` na mesma sessão:

```python
tools = [
    {"google_search": {}},                           # Gemini pesquisa na web quando precisa
    {"function_declarations": [...tool_defs...]},     # Tools locais (POIs, mapa, etc.)
]
```

O modelo decide automaticamente quando usar search (dados dinâmicos) vs tools (dados estruturados/UI). Isto elimina a dependência de ter **tudo** no RAG e permite que o RAG foque apenas em **conhecimento curado** que a web não tem (ex: descrições específicas do turismo regional, informação privilegiada dos parceiros).

### O que sai do RAG (→ search grounding)

- Eventos e agenda cultural (dinâmicos por natureza)
- Horários de transportes
- Meteorologia (substituído por Open-Meteo API)
- Notícias e novidades locais

### O que fica no RAG

- Descrições detalhadas de POIs e regiões
- Informação turística curada (trilhos, percursos, gastronomia)
- Dados dos parceiros/patrocinadores
- FAQ e informação institucional

---

## 4. Arquitetura Alvo

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Kiosk)                     │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Audio    │  │ WS Client │  │ UI Renderer          │  │
│  │ Capture  │──│ (typed)   │──│ (declarative from    │  │
│  │ Worklet  │  │           │  │  UISnapshot)         │  │
│  │ 16kHz    │  │           │  │                      │  │
│  └──────────┘  └─────┬─────┘  │ ┌────┐┌────┐┌─────┐ │  │
│  ┌──────────┐        │        │ │POIs││Map ││Image│ │  │
│  │ Audio    │        │        │ │    ││+Rts││+Glry│ │  │
│  │ Playback │◄───────┤        │ └────┘└────┘└─────┘ │  │
│  │ Worklet  │        │        │ ┌────┐┌────┐┌─────┐ │  │
│  │ 24kHz    │        │        │ │Evts││Wthr││QR   │ │  │
│  └──────────┘        │        │ └────┘└────┘└─────┘ │  │
│                      │        └──────────────────────┘  │
└──────────────────────┼──────────────────────────────────┘
                       │ WebSocket (audio + events)
                       │
┌──────────────────────┼──────────────────────────────────┐
│              BACKEND (FastAPI + uvicorn)                 │
│                      │                                  │
│  ┌───────────────────▼───────────────────┐              │
│  │         Session Manager               │              │
│  │  - WS handler (browser ↔ backend)     │              │
│  │  - Gemini Live session (SDK)          │              │
│  │  - Tool call dispatch                 │              │
│  │  - UIEvent emission                   │              │
│  └──────────┬────────────────┬───────────┘              │
│             │                │                          │
│  ┌──────────▼──────┐  ┌─────▼──────────┐               │
│  │  Tool Handlers  │  │  Data Services │               │
│  │  (pure async)   │  │                │               │
│  │                 │  │  - POI (OSM)   │               │
│  │  get_pois()     │  │  - Images      │               │
│  │  get_events()   │  │  - Events      │               │
│  │  show_dest()    │  │  - Weather     │               │
│  │  show_map()     │  │  - Routing     │               │
│  │  show_route()   │  │  - Summary     │               │
│  │  get_weather()  │  │  - QR          │               │
│  │  show_gallery() │  │  - RAG         │               │
│  │  end_session()  │  │                │               │
│  └─────────────────┘  └────────────────┘               │
│                                                         │
│  ┌──────────────────────────┐ ┌────────────────────┐    │
│  │  Google Search Grounding │ │ Config (YAML + .md)│    │
│  │  (dados dinâmicos)       │ │ per agent          │    │
│  └──────────────────────────┘ └────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                       │
     ┌─────────┬───────┼───────┬──────────┐
     ▼         ▼       ▼       ▼          ▼
┌────────┐┌────────┐┌──────┐┌───────┐┌────────┐
│ Gemini ││Firestor││ OSM/ ││ Open- ││OpenRte │
│ Live   ││e       ││Unsp/ ││ Meteo ││Service │
│ API    ││        ││Pexel ││(meteo)││(routes)│
│(Vertex)││        ││/Goog ││       ││        │
└────────┘└────────┘└──────┘└───────┘└────────┘
```

---

## 5. Protocolo de Eventos (Backend → Frontend)

Todos os eventos partilham campos base:

```python
class BaseEvent(BaseModel):
    session_id: str
    turn_id: str | None = None
    timestamp: datetime
    type: str
```

### Eventos definidos

| Tipo | Direcção | Payload | Descrição |
|------|----------|---------|-----------|
| `audio_chunk` | BE→FE | `data: bytes (base64), sample_rate: 24000` | Áudio de resposta do Gemini |
| `audio_input` | FE→BE | `data: bytes (base64), mime_type: "audio/pcm;rate=16000"` | Áudio do microfone |
| `transcript_input` | BE→FE | `text: str, is_final: bool` | Transcrição da fala do utilizador |
| `transcript_output` | BE→FE | `text: str` | Transcrição da resposta do modelo |
| `ui_snapshot` | BE→FE | `step: 1\|2\|3, pois: [], events: [], images: [], map: {}, weather: {}, route: {}` | Estado completo da UI |
| `ui_patch` | BE→FE | `op: "add"\|"remove"\|"replace", path: str, value: any` | Delta de UI (JSON Patch) |
| `turn_complete` | BE→FE | — | Fim do turno do modelo |
| `interrupted` | BE→FE | — | Modelo foi interrompido pelo utilizador |
| `session_start` | BE→FE | `agent_id: str, greeting_audio: str` | Sessão iniciada |
| `session_end` | BE→FE | `summary_url: str \| None, qr_data: str \| None` | Sessão terminada |
| `error` | BE→FE | `code: str, message: str, recoverable: bool` | Erro |

---

## 6. Tool Calls (Gemini → Backend)

### Tools existentes (portadas do sistema atual)

| Tool | Backend Handler | Dados | UI Result |
|------|----------------|-------|-----------|
| `get_pois` | `handlers/pois.py` | OSM → Google Places → Nominatim, scoring por importância. Máx 4 cards por resposta. | `ui_patch` com cards de POIs |
| `get_events` | `handlers/events.py` | Firestore curated + (Google Search Grounding para dados dinâmicos) | `ui_patch` com lista de eventos |
| `show_destination` | `handlers/images.py` | Unsplash → Pexels (query genérica) | `ui_patch` com imagem hero |
| `show_poi_image` | `handlers/images.py` | Google Places Photos (New API) → Unsplash → Pexels | `ui_patch` com imagem de POI |
| `show_map` | `handlers/map.py` | Coords de lookup table / geocode. Marcador central. | `ui_patch` com centro + marcador |
| `end_session` | `handlers/session.py` | Dispara farewell, sem enviar tool_response ao Gemini | `session_end` event |

### Tools novas

| Tool | Backend Handler | Dados | UI Result | Esforço |
|------|----------------|-------|-----------|---------|
| `get_weather` | `handlers/weather.py` | Open-Meteo API (grátis, sem API key). Temp atual + previsão 3 dias. | `ui_patch` com card meteorologia | Muito baixo (meio dia) |
| `show_route` | `handlers/route.py` | OpenRouteService API (grátis, 2000 req/dia). Rota entre N waypoints com tempos/distâncias. | `ui_patch` com rota no mapa (polyline + marcadores numerados) | Médio (2-3 dias) |
| `show_gallery` | `handlers/images.py` | Google Places Photos + Unsplash. Array de 3-6 fotos de um destino. | `ui_patch` com carousel/slideshow | Baixo (1-2 dias) |

### Google Search Grounding (implícito)

Não é uma tool declarada — é configurada no setup da sessão. O Gemini usa-a automaticamente para:

- Eventos atuais ("que eventos há esta semana em Viseu?")
- Horários de transportes ("comboios de Coimbra para Lisboa amanhã")
- Notícias e novidades locais
- Qualquer pergunta factual que o RAG não cubra

### QR Code (não é tool call)

O QR é gerado no `end_session` handler, não como tool separada. Fluxo:

1. Gemini invoca `end_session`
2. Backend gera resumo da conversa
3. Backend cria URL para página de resumo
4. Backend gera QR code (lib `segno` em Python)
5. QR + resumo enviados ao frontend no evento `session_end`
6. Frontend mostra QR no ecrã farewell — visitante aponta o telemóvel e leva tudo

RAG: via `vertex_rag_store` automático no setup do Gemini (não como tool call separada).

---

## 7. Estrutura de Pastas

```
kiosk-gen-ui/
├── ARCHITECTURE.md              ← este documento
├── backend/
│   ├── pyproject.toml           ← deps (fastapi, uvicorn, google-genai, pydantic, etc.)
│   ├── Dockerfile
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              ← FastAPI app, CORS, lifespan
│   │   ├── config.py            ← Settings (pydantic-settings, env vars)
│   │   ├── session.py           ← SessionManager: WS handler + Gemini Live + dispatch
│   │   ├── events.py            ← Pydantic models para todos os eventos
│   │   ├── handlers/
│   │   │   ├── __init__.py
│   │   │   ├── pois.py          ← get_pois handler
│   │   │   ├── events.py        ← get_events handler
│   │   │   ├── images.py        ← show_destination + show_poi_image + show_gallery
│   │   │   ├── map.py           ← show_map handler
│   │   │   ├── route.py         ← show_route handler (OpenRouteService)
│   │   │   ├── weather.py       ← get_weather handler (Open-Meteo)
│   │   │   └── session.py       ← end_session handler (summary + QR)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── osm.py           ← OpenStreetMap client (com circuit breaker)
│   │   │   ├── places.py        ← Google Places (New API)
│   │   │   ├── images.py        ← Unsplash + Pexels client
│   │   │   ├── firestore.py     ← Firestore client (events, sessions, monitoring)
│   │   │   ├── summary.py       ← Gemini summarization + email (Resend)
│   │   │   ├── weather.py       ← Open-Meteo client
│   │   │   ├── routing.py       ← OpenRouteService client (directions + matrix)
│   │   │   ├── qr.py            ← QR code generation (segno)
│   │   │   └── cache.py         ← In-memory cache (TTL-based)
│   │   └── agents/
│   │       ├── cim/
│   │       │   ├── config.yaml  ← voice, model, RAG corpus, branding, tools enabled
│   │       │   └── system_prompt.md
│   │       └── provere/
│   │           ├── config.yaml
│   │           └── system_prompt.md
│   └── tests/
│       ├── conftest.py
│       ├── test_session.py
│       ├── test_handlers.py
│       ├── test_services.py
│       └── test_events.py
├── frontend/
│   ├── package.json             ← react, vite, tailwind, tanstack-router, xstate
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   ├── audio-processors/
│   │   │   ├── capture.worklet.js
│   │   │   └── playback.worklet.js
│   │   └── assets/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   ├── config/
│   │   │   └── env.ts           ← 1 env var: VITE_WS_URL
│   │   ├── lib/
│   │   │   ├── ws-client.ts     ← WebSocket client tipado (send AudioInput, receive UIEvent)
│   │   │   └── audio.ts         ← AudioManager (capture + playback, clean interface)
│   │   ├── machines/
│   │   │   └── kiosk.ts         ← XState machine: IDLE → LISTENING → ACTIVE → FAREWELL
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── KioskShell.tsx       ← layout horizontal branco, 3 passos
│   │   │   │   ├── StepIndicator.tsx    ← indicador de passo ativo
│   │   │   │   └── StepPanel.tsx        ← container de cada passo
│   │   │   ├── screensaver/
│   │   │   │   └── Screensaver.tsx
│   │   │   ├── chat/
│   │   │   │   ├── TranscriptOverlay.tsx
│   │   │   │   └── VoiceWave.tsx
│   │   │   ├── content/
│   │   │   │   ├── POICards.tsx         ← cards com skeleton loading
│   │   │   │   ├── EventList.tsx
│   │   │   │   ├── HeroImage.tsx        ← blur placeholder → fade in
│   │   │   │   ├── ImageGallery.tsx     ← carousel/swiper (3-6 fotos)
│   │   │   │   ├── MapView.tsx          ← marcadores + rotas (LRM)
│   │   │   │   ├── WeatherCard.tsx      ← temp atual + previsão 3 dias
│   │   │   │   └── RouteInfo.tsx        ← lista de etapas com tempos
│   │   │   └── farewell/
│   │   │       ├── FarewellScreen.tsx
│   │   │       └── QRCode.tsx           ← QR com link do resumo
│   │   ├── hooks/
│   │   │   ├── useKiosk.ts      ← orquestra machine + ws + audio
│   │   │   └── useUIState.ts    ← mantém UISnapshot local a partir de patches
│   │   ├── types/
│   │   │   └── events.ts        ← tipos TS mirror dos Pydantic models
│   │   └── routes/
│   │       ├── __root.tsx
│   │       └── kiosk/
│   │           └── index.tsx    ← rota principal do quiosque
│   └── tests/
│       ├── components/
│       └── hooks/
├── .github/
│   └── workflows/
│       ├── ci.yml               ← lint → type-check → test → build
│       └── deploy.yml           ← deploy backend (Cloud Run) + frontend (Firebase)
└── docker-compose.yml           ← dev local: backend + firestore emulator
```

---

## 8. Stack Técnica

### Backend

| Componente | Tecnologia | Versão | Razão |
|-----------|------------|--------|-------|
| Framework | FastAPI | ≥0.115 | WS nativo, Pydantic integrado, async |
| Runtime | uvicorn | ≥0.34 | ASGI, HTTP/WS |
| Gemini SDK | google-genai | latest | `client.aio.live.connect()` elimina proxy manual |
| Tipos/Validação | Pydantic v2 | ≥2.10 | Eventos tipados, config, serialização |
| Config | pydantic-settings | ≥2.0 | Env vars tipadas |
| Firestore | google-cloud-firestore | ≥8.0 | Dados de eventos, sessões |
| Email | resend | ≥2.0 | Envio de resumos |
| Cache | cachetools | ≥5.0 | TTL cache in-memory |
| HTTP client | httpx | ≥0.27 | Async, para OSM/Unsplash/Pexels/Places/Open-Meteo/ORS |
| QR codes | segno | ≥1.6 | QR generation (lightweight, sem deps) |
| Testes | pytest + pytest-asyncio + httpx | — | TestClient FastAPI, mocks |
| Linting | ruff | ≥0.8 | Fast, all-in-one |
| Types | mypy | ≥1.13 | Type checking |
| Python | ≥3.12 | — | asyncio.TaskGroup, tomllib |

### Frontend

| Componente | Tecnologia | Versão | Razão |
|-----------|------------|--------|-------|
| Framework | React | 19 | Manter (funciona, equipa conhece) |
| Build | Vite | ≥6 | Fast, HMR |
| Routing | TanStack Router | latest | Type-safe, file-based |
| State machine | XState | v5 | Farewell em 1 máquina vs 4 useEffect |
| Styling | Tailwind CSS 4 | ≥4.0 | Manter (funciona) |
| Components | shadcn/ui | latest | Primitivas acessíveis |
| Animações | Framer Motion | ≥12 | Manter (transições, screensaver) |
| Mapas | Leaflet + react-leaflet | ≥5 | Manter |
| Routing (mapas) | leaflet-routing-machine | ≥3.2 | Rotas multi-waypoint no mapa |
| QR (frontend) | qrcode.react | latest | QR component React |
| Testes | Vitest + Testing Library | — | Unit + integration |
| Linting | ESLint + Prettier | — | Manter padrão |
| TypeScript | ≥5.7 | — | Strict mode |

### APIs Externas (novas)

| API | Custo | Limites | Uso |
|-----|-------|---------|-----|
| Open-Meteo | **Grátis** | <10k req/dia | Meteorologia atual + previsão |
| OpenRouteService | **Grátis** | 2000 req/dia | Directions + matrix de distâncias |
| Google Search Grounding | Pay-per-query (Gemini billing) | Incluído na sessão Live | Dados dinâmicos (eventos, horários, notícias) |

---

## 9. Áudio — Especificações Técnicas

| Aspecto | Input (mic) | Output (speaker) |
|---------|-------------|-----------------|
| Sample rate | 16000 Hz | 24000 Hz |
| Formato | PCM16 LE → base64 | base64 → PCM16 LE → Float32 |
| AudioContext | Dedicado (capture) | Dedicado (playback) |
| Worklet | `capture.worklet.js` (buffer 4096) | `playback.worklet.js` (queue-based) |
| Echo cancel | Browser-native | N/A |
| Noise suppress | Browser-native | N/A |
| VAD | Gemini-side (automático) | N/A |

### Mudanças vs sistema atual

- **Eliminar deduplicação no frontend**: o SDK trata mensagens duplicadas internamente
- **Eliminar deduplicação no proxy**: não há proxy manual
- **Manter AudioWorklet** (não ScriptProcessorNode): approach correto
- **Simplificar interrupt**: callback do worklet, sem debounce multi-camada

---

## 10. Multi-Agente

```yaml
# agents/cim/config.yaml
agent_id: cim
display_name: "Turismo Centro de Portugal"
model: gemini-2.5-flash-native-audio-preview
voice: Aoede
rag_corpus: "projects/{project}/locations/eu/ragCorpora/{corpus_id}"
greeting_audio: "audio/greetings/cim_greeting.wav"
search_grounding: true  # habilita Google Search Grounding para dados dinâmicos
tools:
  - get_pois
  - get_events
  - show_destination
  - show_poi_image
  - show_map
  - show_route
  - show_gallery
  - get_weather
  - end_session
branding:
  primary_color: "#1a5276"
  logo: "assets/cim_logo.svg"
```

System prompt em `agents/cim/system_prompt.md` — carregado em runtime, não hardcoded em código.

---

## 11. Experiência do Utilizador (UX)

### Princípios

1. **Sem scroll** — todo o conteúdo deve caber no ecrã (1080×1920) sem scroll
2. **Máximo 4 cards** por resposta — progressive disclosure, não information dump
3. **Voice-first** — a voz é a interação primária; UI é complemento visual
4. **Levar a informação** — cada sessão termina com algo tangível (QR, email)
5. **Multilíngua nativo** — Gemini Live fala 70 línguas; o visitante fala na sua língua e o sistema adapta-se automaticamente

### Layout horizontal com 3 passos

```
┌─────────────────────────────────────────────────┐
│ ① Descobrir      ② Planear        ③ Levar       │  ← step indicator
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌────────────────────────────┐│
│  │             │  │                            ││
│  │  Transcript │  │    Conteúdo dinâmico       ││
│  │  + Voice    │  │   (cards / mapa / galeria /││
│  │  Wave       │  │     meteo / rota)          ││
│  │             │  │                            ││
│  └─────────────┘  └────────────────────────────┘│
│                                                 │
└─────────────────────────────────────────────────┘
```

- **Passo 1 — Descobrir**: Escutar o visitante, mostrar destinos, POIs e meteorologia
- **Passo 2 — Planear**: Rotas, itinerários, comparação de distâncias, galeria de fotos
- **Passo 3 — Levar**: QR code, resumo, email — o visitante sai com informação no telemóvel

A transição entre passos é suave (animada) e guiada pelo fluxo natural da conversa, não por cliques.

### Visual feedback por estado

| Estado | Feedback Visual | Feedback Áudio |
|--------|----------------|----------------|
| **A ouvir** | Waveform animado (VoiceWave) | — |
| **A processar** | Skeleton/shimmer nos cards, pulsing no mapa | "Um momento..." (Gemini diz naturalmente) |
| **A carregar imagem** | Blur placeholder → fade in | — |
| **Erro recuperável** | Toast com mensagem friendly | Gemini explica por voz |
| **Erro fatal** | Tela de recuperação com countdown | Beep + restart automático |

### Acessibilidade

| Aspecto | Solução |
|---------|---------|
| **Idiomas** | Suportado nativamente (70 línguas Live API) — zero configuração |
| **Surdos** | Transcrição sempre visível (`TranscriptOverlay`) |
| **Cegos** | Voz do Gemini é interação primária |
| **Contraste** | Fundo branco, texto escuro, cores de alto contraste |
| **Texto** | Mínimo 18px body, 24px headings |
| **Volume** | Controlo de volume visual no UI (opcional) |
| **Indicador de língua** | Badge no header mostrando língua detectada |

### "Levar a informação"

| Método | Prioridade | Esforço |
|--------|-----------|---------|
| **QR code no farewell** (→ página de resumo mobile-friendly) | **P0** | Muito baixo |
| **Email com resumo** (Resend) | **P0** | Já planeado |
| **QR por POI** (→ Google Maps directions) | **P1** | Baixo |
| NFC tap | P3 | Depende de hardware |

---

## 12. Fluxo de Sessão (Estado)

```
                    ┌──────────────────┐
                    │                  │
              ┌─────►     IDLE         │
              │     │  (screensaver)   │
              │     └────────┬─────────┘
              │              │ presença detectada
              │     ┌────────▼─────────┐
              │     │                  │
              │     │   LISTENING      │    ← Passo 1: Descobrir
              │     │  (greeting +     │
              │     │   mic active)    │
              │     └────────┬─────────┘
              │              │ primeiro turno completo
              │     ┌────────▼─────────┐
              │     │                  │
              │     │    ACTIVE        │◄──┐ ← Passo 1→2: Descobrir → Planear
              │     │  (conversa +     │   │   (transição guiada pela conversa)
              │     │   UI updates)    │───┘
              │     └────────┬─────────┘
              │              │ end_session tool call
              │     ┌────────▼─────────┐
              │     │                  │
              │     │   FAREWELL       │    ← Passo 3: Levar
              │     │  (resumo + QR +  │
              │     │   despedida)     │
              │     └────────┬─────────┘
              │              │ áudio terminou + timeout
              └──────────────┘
```

**XState** gere isto numa única máquina com guards explícitos — elimina os 4 `useEffect` do sistema atual.

---

## 13. Estratégia de Validação e QA (Quality Assurance)

Para assegurar uma base robusta num ambiente de equipa de desenvolvimento profissional, adotamos práticas de Quality Assurance (QA), definindo "Definition of Done" (DoD) claros em diferentes níveis da stack e para cada módulo.

### 13.1. Validação por Nível de Módulo

**A) Backend (Python / FastAPI)**
- **Testes Unitários (`pytest`)**:
  - **Handlers puros**: Testar a lógica de conversão (`Pydantic` models) e regras de validação falhando em payloads corrompidos.
  - **Serviços Externos**: Mocking obrigatório no acesso a APIs terceiras (Open-Meteo, OpenRouteService), testando cenários de retry agendados, rate-limit e *circuit breakers*.
- **Testes de Integração (`pytest-asyncio` + `TestClient`)**:
  - **WebSocket Lifecycle**: Estabelecer conexão simulada pelo `TestClient`, enviar frames de áudio PCM mockados e confirmar que o evento nativo do `google-genai` despoleta a resposta esperada no pipeline.
  - Segurança de tipagem em todas as respostas trocadas (sem erros 500 para payload incorreto).

**B) Frontend (React / TypeScript)**
- **Testes Unitários e Máquina de Estado (`Vitest`)**:
  - Máquina `XState` testada independentemente do DOM: forçar timeouts, garantir que o modo `LISTENING` salta para `IDLE` na falta de resposta, sem dependências colaterais de contexto global.
  - Funções de formatadores (parsers de Markdown, conversores de timestamps).
- **Testes de Componentes**:
  - Testar estados de erro e de *loading* (Skeletons/Shimmers) para blocos pesados visualmente (ex: carregamento da UI do MapView).

**C) Integração Sistémica (End-to-End)**
- **Audio Loop Resilience**: 
  - Cortar subitamente a ligação WebSocket para verificar se os AudioWorklets fazem "teardown" gracioso (sem loop infinito de zumbido no áudio).
- **Timeout & Recovery**: 
  - Simular desabamento temporário de rede, validando se o fallback local consegue retornar a mensagem padronizada em vez da UI estacar congelada.

---

## 14. Milestones e Critérios de Aceitação (DoD)

### M1 — Skeleton funcional (voice loop)
- [ ] Scaffold backend: FastAPI + WS endpoint + Gemini Live SDK
- [ ] Scaffold frontend: Vite + React + WS client + AudioWorklet
- [ ] Áudio bidireccional: falar → ouvir resposta (sem tool calls)
- [ ] Transcrições input/output
- [ ] XState machine (IDLE → LISTENING → ACTIVE → IDLE)
- [ ] Testes: WS connection, audio relay, event types
> **Critério de Validação (DoD):**
> Conexão flúi localmente. Consigo ditar no microfone do browser, o servidor recebe, encaminha ao Gemini Live, o backend devolve pacotes PCM fragmentados que o frontend processa e reproduz as ondas pelo worklet em tempo real. Latência inferior a 1.5s; Xstate reverte corretamente a IDLE ao expirar timer sem voz.

### M2 — Tool calls + UI core
- [ ] Implementar handlers: get_pois, get_events, show_destination, show_poi_image, show_map
- [ ] Serviços de dados: OSM, Google Places, Unsplash/Pexels, Firestore
- [ ] UISnapshot/UIPatch protocol
- [ ] Componentes UI: POICards, EventList, HeroImage, MapView (com skeleton loading)
- [ ] Layout horizontal branco com 3 passos
- [ ] Step indicator sincronizado com estado
- [ ] Google Search Grounding configurado no setup da sessão
> **Critério de Validação (DoD):**
> Handlers backend unitariamente testados. Ao fazer pedido factual local, a framework UI propaga `Object.assign` via diff/patches sem perder o estado de componentes não focados no momento. Validação visual com Skeletons funcionando enquanto as tools não têm o dado pronto da API.

### M3 — Features novas + sessão completa
- [ ] `get_weather` + WeatherCard (Open-Meteo, meio dia)
- [ ] `show_route` + rotas no mapa (OpenRouteService + Leaflet Routing Machine, 2-3 dias)
- [ ] `show_gallery` + ImageGallery carousel (1-2 dias)
- [ ] end_session + farewell flow
- [ ] QR code no farewell (segno + qrcode.react)
- [ ] Summary service (Gemini 2.5 Flash)
- [ ] Email service (Resend)
> **Critério de Validação (DoD):**
> Tool fallback funcionando. Ao esgotar limite na free-tier da OpenRouteService, a aplicação não crasha e emite log monitorizável sem congelar a UI. Fim do turno termina fechadamente providenciando scan por telemóvel capaz de ler o QR gerado sem defeitos e transitar os resumos (email trigger).

### M4 — Multi-agente + polish
- [ ] Multi-agente (CIM + PROVERE configs YAML)
- [ ] RAG via vertex_rag_store (conhecimento curado)
- [ ] Screensaver com transição
- [ ] Visual feedback completo (skeleton, shimmer, blur→fade)
- [ ] Indicador de língua no header
- [ ] Inactivity timeout (30s → screensaver)
> **Critério de Validação (DoD):**
> Alternância dinâmica sem mix entre lógicas e contextos (a memória da cache apaga o contexto A ao saltar para agente B). Animações não causam drop-frames. Acessibilidade nativa não colide com cores.

### M5 — Produção
- [ ] CI/CD (GitHub Actions) unit + lint test obrigatórios antes de deploy
- [ ] Dockerfile + deploy Cloud Run
- [ ] Frontend deploy (Firebase Hosting)
- [ ] Monitoring/logging estruturado
- [ ] Load test (3 sessões simultâneas)
- [ ] Security review (CORS, auth, secrets)
> **Critério de Validação (DoD):**
> Commit bloqueado em ramo master se Unit tests falham no CI. Sistema tolerante à simulação de testes de carga simulando 5 users com tráfego de voz WebSocket concorrente sem degradar latências de backend.

---

## 15. Estimativas

| Componente | Linhas estimadas | vs Atual |
|-----------|-----------------|----------|
| Backend Python | ~2500 | ~4000 (TS) → **-38%** |
| Frontend TS | ~3000 | ~3700 → **-19%** |
| Testes | ~1000 | ~350 (obsoletos) → **+186%** |
| Config/Prompts | ~300 | inline TS → ficheiros separados |
| **Total** | **~6800** | **~7700 → -12%** |

Nota: o total é mais próximo do original porque **estamos a adicionar funcionalidades** (weather, routing, gallery, QR, search grounding) que não existiam. A redução real por funcionalidade equivalente seria ~35%.

---

## 16. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| SDK Python `google-genai` não suporta feature necessária | Alto | Baixa | Manter fallback para WS manual (código existente como referência) |
| Latência de áudio aumenta com backend Python | Médio | Baixa | Benchmark no M1; se necessário, usar ephemeral tokens para client-to-server direto |
| Gemini Live API muda comportamento (breaking) | Alto | Média | Testes de contrato, pin de versão do modelo |
| Complexidade de migração dos serviços de dados | Médio | Média | Portar um serviço de cada vez, com testes de paridade |
| AudioWorklet cross-browser issues | Baixo | Baixa | Quiosque é Chrome kiosk mode (browser controlado) |
| OpenRouteService quota (2000/dia) insuficiente | Baixo | Baixa | Cache agressivo de rotas; fallback para OSRM self-hosted |
| Open-Meteo downtime | Baixo | Baixa | Cache de 30 min; weather é complementar, não crítico |
| Google Search Grounding retorna dados irrelevantes | Médio | Média | System prompt instrui quando usar search vs tools; fallback para dados curados |

---

## 17. Referências

- [Gemini Live API — Get Started](https://ai.google.dev/gemini-api/docs/live)
- [Gemini Live API — Capabilities Guide](https://ai.google.dev/gemini-api/docs/live-guide)
- [Gemini Live API — Tool Use](https://ai.google.dev/gemini-api/docs/live-tools)
- [Gemini Live API — Session Management](https://ai.google.dev/gemini-api/docs/live-session)
- [FastAPI — WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [Pydantic v2 — Models](https://docs.pydantic.dev/latest/concepts/models/)
- [XState v5](https://stately.ai/docs/xstate-v5)
- [Open-Meteo API](https://open-meteo.com/en/docs)
- [OpenRouteService API](https://openrouteservice.org/dev/#/api-docs)
- [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/)
```

---

**Resumo das alterações vs versão anterior:**

1. **Nova secção 3 — Estratégia de Dados**: abordagem híbrida em 3 camadas (RAG estático + Search Grounding dinâmico + Firestore curado), com definição clara do que sai do RAG e o que fica
2. **3 novas tools**: `get_weather` (Open-Meteo, grátis), `show_route` (OpenRouteService + Leaflet Routing Machine para rotas multi-waypoint), `show_gallery` (carousel de fotos)
3. **QR code no farewell**: visitante aponta o telemóvel e leva o resumo da conversa
4. **Nova secção 11 — UX**: layout horizontal com 3 passos (Descobrir→Planear→Levar), princípios de design, feedback visual por estado, acessibilidade, estratégia de "levar informação"
5. **Objectivo do sistema explícito**: concierge de turismo, não chatbot genérico
6. **Milestones expandidos** para 5 fases (M3 absorve features novas, M4 foca em polish)
7. **Novas APIs externas** no stack (Open-Meteo, OpenRouteService)
8. **Novos componentes frontend**: `WeatherCard`, `ImageGallery`, `RouteInfo`, `QRCode`
9. **Riscos atualizados** para cobrir novas dependências

Podes copiar o conteúdo acima para o ficheiro, ou se preferires que eu ative ferramentas de edição, diz-me.---

**Resumo das alterações vs versão anterior:**

1. **Nova secção 3 — Estratégia de Dados**: abordagem híbrida em 3 camadas (RAG estático + Search Grounding dinâmico + Firestore curado), com definição clara do que sai do RAG e o que fica
2. **3 novas tools**: `get_weather` (Open-Meteo, grátis), `show_route` (OpenRouteService + Leaflet Routing Machine para rotas multi-waypoint), `show_gallery` (carousel de fotos)
3. **QR code no farewell**: visitante aponta o telemóvel e leva o resumo da conversa
4. **Nova secção 11 — UX**: layout horizontal com 3 passos (Descobrir→Planear→Levar), princípios de design, feedback visual por estado, acessibilidade, estratégia de "levar informação"
5. **Objectivo do sistema explícito**: concierge de turismo, não chatbot genérico
6. **Milestones expandidos** para 5 fases (M3 absorve features novas, M4 foca em polish)
7. **Novas APIs externas** no stack (Open-Meteo, OpenRouteService)
8. **Novos componentes frontend**: `WeatherCard`, `ImageGallery`, `RouteInfo`, `QRCode`
9. **Riscos atualizados** para cobrir novas dependências
