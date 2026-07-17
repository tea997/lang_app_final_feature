import { useState, useRef, useEffect } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { sendAiMessage } from "../lib/api";
import {
  BotIcon,
  SendIcon,
  RefreshCwIcon,
  MessageSquareIcon,
  BriefcaseIcon,
  UtensilsIcon,
  PlaneIcon,
  ShoppingBagIcon,
  HandshakeIcon,
  SproutIcon,
  BookOpenIcon,
  GraduationCapIcon,
  SparklesIcon,
} from "lucide-react";
import { capitialize } from "../lib/utils";

const SCENARIOS = [
  { value: "general", label: "General Conversation", icon: MessageSquareIcon },
  { value: "interview", label: "Job Interview", icon: BriefcaseIcon },
  { value: "restaurant", label: "Restaurant", icon: UtensilsIcon },
  { value: "travel", label: "Travel", icon: PlaneIcon },
  { value: "shopping", label: "Shopping", icon: ShoppingBagIcon },
  { value: "business", label: "Business Meeting", icon: HandshakeIcon },
];

const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner", desc: "Simple sentences, basic vocabulary", icon: SproutIcon },
  { value: "intermediate", label: "Intermediate", desc: "Moderate complexity, everyday expressions", icon: BookOpenIcon },
  { value: "advanced", label: "Advanced", desc: "Idioms, complex grammar, nuanced discussion", icon: GraduationCapIcon },
];

const WELCOME_MESSAGES = {
  general: (lang) => `Hello! I'm your ${lang} practice partner. Let's have a natural conversation. What would you like to talk about today?`,
  interview: (lang) => `Good morning! Please, have a seat. I'll be conducting your interview today. Let's begin — could you start by telling me a little about yourself?`,
  restaurant: (lang) => `Welcome! My name is Alex and I'll be your server today. Can I start you off with something to drink?`,
  travel: (lang) => `Good day! Welcome to International Arrivals. How can I assist you today?`,
  shopping: (lang) => `Hi there, welcome to our store! Are you looking for something specific today, or would you like me to show you what's new?`,
  business: (lang) => `Good morning, everyone. Thank you all for joining today's meeting. Shall we get started? Could you please introduce yourself first?`,
};

const AIPracticePage = () => {
  const { authUser } = useAuthUser();
  const language = capitialize(authUser?.learningLanguage || "english");
  const nativeLanguage = capitialize(authUser?.nativeLanguage || "english");

  const [scenario, setScenario] = useState("general");
  const [proficiency, setProficiency] = useState("intermediate");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [inputRows, setInputRows] = useState(1);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = () => {
    const welcomeText = WELCOME_MESSAGES[scenario]?.(language) ||
      WELCOME_MESSAGES.general(language);

    setMessages([{ role: "assistant", content: welcomeText, id: Date.now() }]);
    setSessionStarted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const resetSession = () => {
    setMessages([]);
    setSessionStarted(false);
    setInput("");
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input.trim(), id: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setInputRows(1);
    setIsLoading(true);

    try {
      const { reply } = await sendAiMessage({
        messages: newMessages,
        language,
        nativeLanguage,
        proficiency,
        scenario,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: reply, id: Date.now() + 1 }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again.",
          id: Date.now() + 1,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const lines = e.target.value.split("\n").length;
    setInputRows(Math.min(lines, 4));
  };

  // Parse message to split out grammar corrections and translation divider
  const parseMessage = (content) => {
    const correctionMatch = content.match(/(📝 \*Small correction:[\s\S]*)/);
    let messageText = content;
    let correction = null;

    if (correctionMatch) {
      messageText = content.slice(0, correctionMatch.index).trim();
      correction = correctionMatch[0].replace("📝", "").trim();
    }

    // Split target language and native language by '---'
    const parts = messageText.split("---");
    const targetText = parts[0].trim();
    const nativeText = parts.length > 1 ? parts[1].trim() : null;

    return { targetText, nativeText, correction };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full text-base-content">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <BotIcon className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Language Practice</h1>
          <p className="text-sm opacity-70 mt-1">
            Practicing: <span className="font-semibold text-primary">{language}</span>
          </p>
        </div>
        {sessionStarted && (
          <button
            onClick={resetSession}
            className="btn btn-outline btn-sm ml-auto gap-2"
            title="Start a new session"
          >
            <RefreshCwIcon className="size-4" />
            New Session
          </button>
        )}
      </div>

      {!sessionStarted ? (
        /* Setup Screen */
        <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto w-full">
          <div className="text-center space-y-3">
            <div className="p-4 bg-primary/10 rounded-full inline-block mb-2">
              <BotIcon className="size-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Set Up Your Practice Session</h2>
            <p className="text-base-content opacity-70 text-sm max-w-md mx-auto">
              Choose a scenario and your proficiency level to start practicing your conversation skills.
            </p>
          </div>

          {/* Scenario Selector */}
          <div className="w-full space-y-3">
            <label className="label py-0">
              <span className="label-text font-semibold text-base-content opacity-90">Choose a Scenario</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SCENARIOS.map((s) => {
                const IconComponent = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => setScenario(s.value)}
                    className={`btn justify-start px-4 gap-3 py-3 h-auto normal-case font-medium transition-all ${
                      scenario === s.value
                        ? "btn-primary shadow-md"
                        : "btn-ghost border border-base-300 bg-base-200 hover:bg-base-300"
                    }`}
                  >
                    <IconComponent className="size-5 flex-shrink-0" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proficiency Selector */}
          <div className="w-full space-y-3">
            <label className="label py-0">
              <span className="label-text font-semibold text-base-content opacity-90">Your Proficiency Level</span>
            </label>
            <div className="flex flex-col gap-2">
              {PROFICIENCY_LEVELS.map((p) => {
                const IconComponent = p.icon;
                return (
                  <button
                    key={p.value}
                    onClick={() => setProficiency(p.value)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left ${
                      proficiency === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-base-300 bg-base-200 hover:bg-base-300"
                    }`}
                  >
                    <IconComponent className="size-5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={startSession}
            className="btn btn-primary w-full gap-2 text-base py-3 h-auto mt-2"
          >
            <BotIcon className="size-5" />
            Start Practice Session
          </button>
        </div>
      ) : (
        /* Chat Screen */
        <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-base-300 bg-base-100 overflow-hidden shadow-sm">
          {/* Session Info Bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-base-300 bg-base-200 text-xs flex-wrap font-medium">
            <span className="badge badge-primary badge-sm gap-1 px-2.5 py-2">
              {SCENARIOS.find((s) => s.value === scenario)?.label}
            </span>
            <span className="badge badge-outline badge-sm gap-1 px-2.5 py-2">
              {PROFICIENCY_LEVELS.find((p) => p.value === proficiency)?.label}
            </span>
            <span className="opacity-60 ml-auto">{messages.length} messages</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const { targetText, nativeText, correction } = parseMessage(msg.content);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className="avatar placeholder flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? "bg-primary text-primary-content"
                        : "bg-secondary text-secondary-content"
                    }`}>
                      {isUser ? (
                        authUser?.profilePic ? (
                          <img src={authUser.profilePic} alt="User Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{authUser?.fullName?.[0] || "U"}</span>
                        )
                      ) : (
                        <BotIcon className="size-4" />
                      )}
                    </div>
                  </div>

                  <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
                    {/* Main message bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? "bg-primary text-primary-content rounded-tr-sm"
                          : msg.isError
                          ? "bg-error/10 text-error border border-error/30 rounded-tl-sm"
                          : "bg-base-200 text-base-content rounded-tl-sm"
                      }`}
                    >
                      {targetText}
                    </div>

                    {/* Native Translation bubble */}
                    {!isUser && nativeText && (
                      <div className="text-xs opacity-75 bg-base-200 rounded-xl px-4 py-2 border border-base-300 italic mt-0.5 max-w-full">
                        {nativeText}
                      </div>
                    )}

                    {/* Grammar correction bubble */}
                    {correction && (
                      <div className="bg-warning/10 border border-warning/30 text-warning rounded-xl px-4 py-2.5 text-xs max-w-full flex items-start gap-2 mt-1">
                        <SparklesIcon className="size-4 text-warning flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-warning">Correction:</span> {correction}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3 items-start">
                <div className="avatar placeholder flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-content flex items-center justify-center">
                    <BotIcon className="size-4" />
                  </div>
                </div>
                <div className="bg-base-200 rounded-2xl rounded-tl-sm px-4 py-3">
                  <span className="loading loading-dots loading-sm text-primary" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-base-300 p-4 bg-base-100">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={inputRows}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Write in ${language}... (Enter to send, Shift+Enter for new line)`}
                className="textarea textarea-bordered flex-1 resize-none text-sm leading-relaxed py-2.5 min-h-[42px] max-h-[120px]"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="btn btn-primary btn-sm h-[42px] w-[42px] p-0 flex-shrink-0"
              >
                <SendIcon className="size-4" />
              </button>
            </div>
            <p className="text-xs opacity-50 mt-2.5 text-center flex items-center justify-center gap-1">
              <SparklesIcon className="size-3.5 text-primary" />
              Grammar mistakes will be highlighted and corrected
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPracticePage;
