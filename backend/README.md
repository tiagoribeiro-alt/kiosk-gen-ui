# Kiosk Gen-UI Backend

## Required environment

- `GEMINI_API_KEY` for Gemini Live
- `MODEL_NAME` optional, defaults to `gemini-2.5-flash-native-audio-preview-12-2025`
- `EVENTUAIS_BACKEND_URL` for event retrieval and related backend integrations
- `GCP_PROJECT_ID` for Cloud Run and Artifact Registry deployment
- `AGENT_ID` optional, defaults to `cim`
- `GREETING_AUDIO_PATH` optional path to a bundled greeting WAV file
- `CORS_ORIGINS` optional JSON array for explicit frontend origins

If no greeting file is available, the backend now generates a short WAV fallback so `session_start` remains valid in containerized deployments.

## Local validation

```bash
c:/projectos/kiosk-gen-ui/.venv/Scripts/python.exe -m unittest test_session.py test_ui_snapshot_event.py
```

## Container build

The backend ships with [backend/Dockerfile](Dockerfile) and listens on `PORT`, defaulting to `8080` for Cloud Run.

Example build:

```bash
docker build -t kiosk-gen-ui-backend .
```

## Cloud Run deploy

Copy `.env.example` to `.env`, fill the values locally, then run:

```powershell
.\deploy-cloudrun.ps1
```

The script reads `.env`, builds through Cloud Build, creates the Artifact Registry repository if needed, and deploys to Cloud Run using a temporary `--env-vars-file` so secrets do not need to be written into the command line.