# Medical Assistant Note

This note is just to help teammates quickly understand the medical part I am working on.

## What I am building

The `/medical` page is the main medical assistant flow right now.

It can handle:

- drug interaction checks
- side-effect lookup
- health risk prediction
- simple medical concept help like `RR`, `SpO2`, `SBP`, and `HR`
- small talk and help messages

## How it works

- The UI is in `src/ui`
- Medical chat requests go through `src/ui/src/app/api/medical`
- Those routes call a persistent Python backend in `scripts/run_medical_backend.py`
- The backend routes requests through `src/router/medical_chat_graph.py`
- Core workflow logic is in `src/services/`
- Request/response models are in `src/schemas/`

## Current behavior

- Drug interactions and side effects use structured dataset lookups.
- Health risk uses the trained model.
- Medical concept help uses the local glossary first.
- Gemini is used only when concept help needs a fallback or when a response needs rewriting.

## How to run

Install dependencies:

```bash
poetry install
cd src/ui
npm install
```

Set up `src/ui/.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
MEDICAL_BACKEND_URL="http://127.0.0.1:8010"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini/gemini-flash-latest"
```

Start the backend:

```bash
poetry run python scripts/run_medical_backend.py
```

Start the UI:

```bash
cd src/ui
npm run dev
```

If Turbopack causes trouble on Windows:

```bash
npx next dev --webpack
```

Open:

- `http://localhost:3000/medical`

## Quick notes

- The local glossary answers common concept questions first.
- Gemini is only used when the glossary does not have an answer and a key is configured.
