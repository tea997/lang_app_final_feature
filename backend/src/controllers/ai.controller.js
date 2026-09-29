import { StreamChat } from "stream-chat";
import "dotenv/config";

const SCENARIOS = {
  general: "general everyday conversation",
  interview: "a job interview where you are the interviewer",
  restaurant: "a restaurant where you are the waiter/server",
  travel: "a travel situation helping at an airport or hotel front desk",
  shopping: "a shopping scenario where you are the store assistant",
  business: "a professional business meeting",
};

const PROFICIENCY_GUIDELINES = {
  beginner: "Use simple, short sentences. Vocabulary should be basic (A1-A2 level). Speak slowly in text. Use common everyday words only.",
  intermediate: "Use moderate complexity sentences. Mix simple and compound sentences. Vocabulary at B1-B2 level. Occasionally introduce new vocabulary with context.",
  advanced: "Use rich, complex sentences. Use idiomatic expressions, phrasal verbs, and nuanced vocabulary (C1-C2 level). Engage in deeper, more abstract topics.",
};

// Helper function to call Groq API
async function callGrokAPI(messages) {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("GROK_API_KEY, GROQ_API_KEY, or XAI_API_KEY is not defined in the environment variables.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "openai/gpt-oss-120b",
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// POST /api/ai/chat
export async function aiChat(req, res) {
  try {
    const { messages, language, nativeLanguage = "English", proficiency = "intermediate", scenario = "general" } = req.body;

    if (!messages || !language) {
      return res.status(400).json({ message: "messages and language are required" });
    }

    const scenarioDescription = SCENARIOS[scenario] || SCENARIOS.general;
    const proficiencyGuide = PROFICIENCY_GUIDELINES[proficiency] || PROFICIENCY_GUIDELINES.intermediate;

    const systemPrompt = `You are an expert ${language} language tutor and conversation partner.

You are currently role-playing as: ${scenarioDescription}.

Proficiency level of the student: ${proficiency.toUpperCase()}
Your language style rule: ${proficiencyGuide}

Your strict behavioral rules:
- Always continue the conversation naturally. Never end the conversation abruptly.
- Stay fully in the role-playing scenario unless the user asks to change it.
- If the user makes grammar mistakes, FIRST acknowledge their message naturally, THEN at the END of your reply add a gentle correction in this exact format:
  📝 *Small correction:* "[their mistake]" → "[correct version]" — [one-sentence explanation]
- Only correct mistakes that affect communication or are important for learning. Ignore minor typos.
- Always end your reply with a relevant follow-up question to keep the conversation going.
- Be warm, supportive, patient, and encouraging.
- Adapt your vocabulary strictly to the proficiency level.
- Do NOT write long grammar lessons. Keep corrections brief and friendly.
- You must reply in BOTH the target language (${language}) and the user's native language (${nativeLanguage}).
- If the target language uses a non-Latin script (like Cyrillic, Devanagari, Hanzi, Kanji/Kana, Hangul, Arabic script, etc.) and the user's native language uses the Latin script (like English, Spanish, French, etc.), you MUST include a phonetic spelling/pronunciation guide (transliteration) in the Latin alphabet on the line right under the target language response (e.g., "Dobroye utro! Ya rad...").
- Structure your response exactly as follows:
  1. The reply in the target language (${language}) first.
  2. If applicable, the phonetic pronunciation/transliteration guide on the next line.
  3. A horizontal divider line (---).
  4. The translation or equivalent response in the user's native language (${nativeLanguage}).
- If the user writes in a language other than ${language}, gently guide them back to practicing ${language}.`;

    // Map conversation history to OpenAI/Grok format
    const formattedMessages = [
      { role: "system", content: systemPrompt }
    ];

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    const reply = await callGrokAPI(formattedMessages);
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error in aiChat controller:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

// POST /api/ai/summarize
export async function summarizeChat(req, res) {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({ message: "channelId is required" });
    }

    // Fetch messages from Stream Chat using the server-side client
    const apiKey = process.env.STEAM_API_KEY;
    const apiSecret = process.env.STEAM_API_SECRET;
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    const channel = serverClient.channel("messaging", channelId);
    const { messages } = await channel.query({
      messages: { limit: 60 },
    });

    if (!messages || messages.length === 0) {
      return res.status(200).json({ summary: "No messages found in this conversation to summarize." });
    }

    // Format messages
    const formattedMessages = messages
      .filter((m) => m.type === "regular" && m.text)
      .map((m) => `${m.user?.name || "Unknown"}: ${m.text}`)
      .join("\n");

    const summarizationPrompt = `You are an AI conversation analyst for a language learning chat application.

Below are the most recent messages from a conversation. Analyze them and generate a clear, structured summary.

CONVERSATION:
${formattedMessages}

Generate a structured summary with the following sections (only include sections that are relevant based on the conversation content):

## Overall Summary
(2-3 sentence overview of the whole conversation)

## Main Topics Discussed
(Bullet list of key topics)

## Action Items
(Any tasks or commitments mentioned. Omit if none.)

## Unanswered Questions
(Any open questions that were not resolved. Omit if none.)

## Links & Resources Shared
(Any URLs or resources mentioned. Omit if none.)

## New Vocabulary & Useful Expressions
(Any new words, phrases, or expressions used in the language being practiced. Include with brief definitions. Omit if not a language learning conversation.)

## Grammar Corrections
(Notable grammar patterns that could be improved, with examples from the conversation. Omit if not relevant.)

## Key Takeaways
(2-3 bullet points of the most important insights or conclusions)

Rules:
- Do NOT invent information. Base everything only on the provided messages.
- Keep the summary concise and easy to read.
- Use standard markdown formatting without any emojis for section headers.
- If a section has no relevant content, omit it entirely.`;

    const summary = await callGrokAPI([
      { role: "user", content: summarizationPrompt }
    ]);

    res.status(200).json({ summary });
  } catch (error) {
    console.error("Error in summarizeChat controller:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}
