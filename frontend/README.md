# 🏆 SportsMind AI: The Multi-Sport Generative Broadcast Engine

**SportsMind AI** is a next-generation, high-fidelity sports broadcasting platform that transforms raw match data into an immersive, multi-sensory experience. Originally born as **CricMind**, it has evolved into a comprehensive AI powerhouse designed to revolutionize how fans consume live sports.

---

## 🌟 The Vision

While traditional scoreboards are static, SportsMind AI is **dynamic and multi-dimensional**. It doesn't just display numbers; it narrates the drama of the match, analyzes tactical shifts, and speaks to fans in multiple languages. Whether it's the high-stakes "Death Overs" of a T20 match or a tense Test session, SportsMind AI captures the soul of the game using cutting-edge Generative AI.

---

## 🚀 Key Features

### 1. Generative AI Commentary & Analysis
Using **Google Gemini 1.5 Flash**, SportsMind AI generates context-aware, dramatic commentary in real-time.
- **Live Match Narration:** Generates TV-style commentary based on the current match situation.
- **Deep Match Analysis:** Generates multi-paragraph tactical breakdowns, identifying momentum shifts and key pressure points.
- **Highlights Integration:** AI commentary for completed matches leverages actual match highlights to provide a rich summary of the game's most pivotal moments (wickets, boundaries, milestones).

### 2. Neural Audio & HD Voice Synthesis
- **HD Voice Synthesis:** Powered by **ElevenLabs**, delivering human-sounding, professional sports narration.
- **Smart Fallbacks:** Seamlessly switches to the Browser Web Speech API if API limits are reached, ensuring an uninterrupted broadcast.
- **AI Commentator Toggle:** Gives users direct control to turn the automatic AI narration ON or OFF during live matches.

### 3. Polyglot AI (Multi-Language Support)
SportsMind AI breaks language barriers by offering AI-generated commentary in **multiple languages**:
- English, Hindi (हिंदी), Konkani (कोंकणी), Tamil (தமிழ்), Telugu (తెలుగు), Marathi (मराठी), and Kannada (ಕನ್ನಡ).

### 4. Advanced Match Center Dashboard
- **Comprehensive Scorecards:** Detailed batting and bowling figures, fall of wickets, and partnership data.
- **Live Data Visualizations:** Real-time `Chart.js` graphs including:
    - Win Probability
    - Run Rate (Worm & Overs comparison)
    - Partnership contributions
    - Interactive Ball Maps
- **Over Summaries & Full History:** A granular, ball-by-ball view of the match action with visual event indicators.

### 5. Multi-Endpoint Custom Backend Integration
SportsMind AI is powered by a custom backend data scraper that feeds real-time updates directly into the UI:
- `/api/live` - Live and ongoing matches
- `/api/live/upcoming` - Scheduled fixtures
- `/api/live/recent` - Completed matches and results

---

## 🛠️ Technical Architecture

SportsMind AI is built with a high-performance stack optimized for responsive, data-heavy UIs:

- **Frontend:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **AI Intelligence:** [Google Gemini API](https://aistudio.google.com/) (Contextual narration & deep analysis)
- **Voice AI:** [ElevenLabs API](https://elevenlabs.io/) (High-fidelity text-to-speech)
- **Analytics Visuals:** [Chart.js](https://www.chartjs.org/) + [React-Chartjs-2](https://react-chartjs-2.js.org/)
- **Iconography:** [Lucide React](https://lucide.dev/)

---

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd SportsMind
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configuration (Environment Variables)
Create a `.env` file in the root directory and add your API keys:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```
*(Note: The app contains fallback keys for demonstration purposes, but providing your own is highly recommended).*

### 4. Start the Application
First, ensure your custom backend scraper is running (defaulting to port `3001`).

Then, start the Vite development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🧠 System Logic: How it Works

1. **Data Ingestion:** The React frontend fetches real-time match data (Live, Upcoming, Recent), scorecards, and highlights from the custom backend.
2. **Context Assembly:** When the user requests commentary or analysis, raw event data (scores, recent highlights, match status) is packaged into an optimized prompt.
3. **LLM Generation:** The prompt is sent to Google Gemini 1.5 Flash, which is instructed to act as a professional sports commentator or analyst in the user's selected language.
4. **Audio Playback:** The AI's JSON output is parsed. The text is displayed on screen and simultaneously sent to the ElevenLabs API (or browser TTS) for immediate audio playback.
5. **Real-Time Sync:** The dashboard auto-refreshes match data and intelligently narrate new events as they happen if the AI Commentator is toggled ON.

---

## 🛡️ Robustness & Accessibility

- **Zero-Crash Fallbacks:** Includes local fallback commentary strings and generic TTS to handle API rate limits gracefully.
- **Fully Responsive:** Optimized for a seamless experience across mobile, tablet, and desktop displays.
- **Theme Support:** Native Dark and Light mode support for comfortable viewing in any environment.

---

## 👨‍💻 Author
Built as a submission for the GDG Hackathon.
