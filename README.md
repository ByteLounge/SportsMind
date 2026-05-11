# SportsMind

This repository combines the SportsMind AI frontend and the CricketScrap backend into a single unified project.

## Project Structure

- `frontend/`: React + Vite application (SportsMind AI).
- `backend/`: Node.js + Express + TypeScript scraper (CricketScrap).

## Getting Started

### Prerequisites

- Node.js (>= 18.0.0)
- npm

### Installation

Install all dependencies for the root, frontend, and backend:

```bash
npm run install-all
```

### Configuration

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required API keys in the `.env` file (e.g., Gemini, Groq, ElevenLabs).

### Development

Start both the frontend and backend concurrently:

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

### Other Commands

- `npm run build`: Build both projects.
- `npm run lint`: Lint both projects.
- `npm run start`: Start the backend (production mode).

## Deployment

The project is designed to be deployable on platforms like Vercel (frontend) and Railway/Render (backend). Ensure you update the `VITE_BACKEND_URL` in your production environment to point to your deployed backend.
