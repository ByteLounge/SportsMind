export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ""; // Replace with real Groq key if available
export const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || "";
export const VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"; // Roger (Premade)

const SYSTEM_PROMPT = `You are SportsMind AI, a real-time multi-sport AI commentary engine.

Convert structured live cricket match updates into short, accurate, exciting broadcast-style commentary.

Rules:
- Use only the provided data.
- Never invent player names, bowlers, batters, shots, or dismissals unless explicitly present.
- If the update is unclear, produce safe generic commentary.
- If no meaningful change happened, return a neutral update.
- Avoid repeating recent commentary.
- Return valid JSON only.

JSON schema:
{
  "eventType": "dot|single|double|three|four|six|wicket|over_end|milestone|status|unknown",
  "commentary": "string",
  "shortHeadline": "string",
  "momentum": "low|medium|high|explosive",
  "emotion": 1,
  "isMajorMoment": false,
  "needsAudioEmphasis": false,
  "colorHint": "neutral|gold|red|green|blue|orange"
}

Interpretation:
- wicketsDelta > 0 => wicket
- runsDelta 6 => six
- runsDelta 4 => four
- runsDelta 3 => three
- runsDelta 2 => double
- runsDelta 1 => single
- runsDelta 0 with oversDelta > 0 => dot or over_end
- over completion => over_end
- major momentum swing or milestone => milestone or status

Style:
- 1 to 3 sentences
- professional live commentary
- casual/expert/neutral persona must be respected
- mention pressure or momentum only when supported by input

Never infer batsman identity, bowler identity, shot direction, dismissal type, or field placement from score changes alone.
Only mention named entities if they appear in the provided input.`;

const fetchFromGroq = async (payload) => {
  if (!GROQ_API_KEY || GROQ_API_KEY.startsWith("gsk_...")) throw new Error("Groq API Key missing");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-8b-8192", // Fast model for commentary
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    })
  });
  if (!res.ok) throw new Error("Groq request failed");
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
};

const fetchFromGemini = async (payload) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + payload }] }]
    })
  });
  if (!res.ok) throw new Error("Gemini request failed");
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
};

export const generateAICommentary = async (payload, fallbackData) => {
  try {
    // 1. Try Groq for low latency
    return await fetchFromGroq(payload);
  } catch (groqError) {
    console.warn("Groq failed, falling back to Gemini:", groqError.message);
    try {
      // 2. Fallback to Gemini
      return await fetchFromGemini(payload);
    } catch (geminiError) {
      console.error("Both Groq and Gemini failed:", geminiError);
      return fallbackData;
    }
  }
};

export const speak = async (text, isMuted, voiceMode) => {
  if (isMuted) return;

  if (voiceMode === 'hd') {
    try {
      const res = await fetch(`/elevenlabs/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
        body: JSON.stringify({ 
          text, 
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (!res.ok) {
        const errorJson = await res.json();
        console.error('ElevenLabs API Error:', errorJson);
        throw new Error(errorJson.detail?.message || 'TTS Failed');
      }

      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return;
    } catch (e) { 
      console.error('ElevenLabs playback failed, falling back to browser speech:', e); 
    }
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
};
