# Kiosk Gen-UI Frontend

## Runtime WebSocket configuration

The kiosk frontend resolves its WebSocket endpoint in this order:

1. `VITE_WS_URL` for a fully qualified `ws://` or `wss://` endpoint
2. `VITE_BACKEND_URL` for an `http://` or `https://` backend base URL that will be converted to `/ws`
3. local origin only when running on `localhost` or `127.0.0.1`
4. `ws://localhost:8000/ws` as the final development fallback

Examples:

```bash
VITE_BACKEND_URL=https://kiosk-backend-abc123-ew.a.run.app
```

```bash
VITE_WS_URL=wss://kiosk-backend-abc123-ew.a.run.app/ws
```

## Validation

```bash
npm run test
npm run build
```

## Firebase deploy

Create a local `.env` from `.env.example` only if you want a persistent local setup. For CI or one-off deploys, the deploy script injects runtime build vars directly:

```powershell
.\deploy-frontend.ps1 -BackendUrl "https://kiosk-gen-ui-backend-pechm6mdjq-ew.a.run.app"
```

By default, the script deploys to a Firebase Hosting preview channel on the same Firebase project so you get a test URL without touching the live site.

Current preview with sensor toggle enabled:

```text
https://eventuais-app-pt--kiosk-gen-ui-test-ulotkfuu.web.app?sensorToggle=1
```

To choose a specific preview channel:

```powershell
.\deploy-frontend.ps1 -BackendUrl "https://kiosk-gen-ui-backend-pechm6mdjq-ew.a.run.app" -PreviewChannelId "kiosk-gen-ui-march-test"
```

If you need to override the websocket endpoint explicitly:

```powershell
.\deploy-frontend.ps1 -BackendUrl "https://kiosk-gen-ui-backend-pechm6mdjq-ew.a.run.app" -WebSocketUrl "wss://kiosk-gen-ui-backend-pechm6mdjq-ew.a.run.app/ws"
```

Only use a live deploy if you explicitly want to replace the current hosted site:

```powershell
.\deploy-frontend.ps1 -BackendUrl "https://kiosk-gen-ui-backend-pechm6mdjq-ew.a.run.app" -Live
```
