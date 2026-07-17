import { useState } from "react";
import { summarizeChat } from "../lib/api";
import { SparklesIcon, XIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";

// Render Groq markdown output as clean, app-native UI elements
const SummaryContent = ({ text }) => {
  if (!text) return null;

  const sections = [];
  let currentSection = null;

  text.split("\n").forEach((line) => {
    if (line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: line.replace("## ", "").trim(), items: [] };
    } else if (currentSection) {
      if (line.trim()) {
        currentSection.items.push(line.trim());
      }
    }
  });
  if (currentSection) sections.push(currentSection);

  if (sections.length === 0) {
    return <p className="text-sm opacity-70">{text}</p>;
  }

  return (
    <div className="space-y-5">
      {sections.map((section, i) => (
        <div key={i}>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-2 text-primary uppercase tracking-wide">
            {section.heading}
          </h3>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-4 space-y-2">
              {section.items.map((item, j) => {
                // Bullet point (starts with - or *)
                if (item.startsWith("- ") || item.startsWith("* ")) {
                  const content = item.replace(/^[-*]\s+/, "");
                  return (
                    <div key={j} className="flex items-start gap-2 text-sm text-base-content">
                      <span className="mt-1.5 size-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="opacity-85 leading-relaxed">{formatInline(content)}</span>
                    </div>
                  );
                }
                // Numbered list
                if (/^\d+\. /.test(item)) {
                  const num = item.match(/^(\d+)\. /)[1];
                  const content = item.replace(/^\d+\. /, "");
                  return (
                    <div key={j} className="flex items-start gap-3 text-sm">
                      <span className="badge badge-primary badge-sm flex-shrink-0 mt-0.5">{num}</span>
                      <span className="opacity-85 leading-relaxed">{formatInline(content)}</span>
                    </div>
                  );
                }
                // Regular paragraph
                return (
                  <p key={j} className="text-sm opacity-85 leading-relaxed text-base-content">
                    {formatInline(item)}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Render **bold** inline
const formatInline = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
};

const ChatSummaryModal = ({ channelId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    try {
      const { summary: text } = await summarizeChat(channelId);
      setSummary(text);
    } catch (err) {
      setError("Failed to generate summary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    if (!summary) await fetchSummary();
  };

  const handleClose = () => setIsOpen(false);
  const handleRefresh = () => fetchSummary();

  return (
    <>
      {/* Trigger Button — matches CallButton style */}
      <button
        onClick={handleOpen}
        className="btn btn-ghost btn-sm gap-2"
        title="Summarize this conversation with AI"
      >
        <SparklesIcon className="size-4 text-primary" />
        <span className="hidden sm:inline text-sm font-medium">Summarize</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-base-100 text-base-content rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-base-300">
            {/* Header — matches NotificationsPage section headers */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 text-base-content">
              <div className="flex items-center gap-2 text-base-content">
                <SparklesIcon className="size-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-base-content">Chat Summary</h2>
              </div>
              <div className="flex items-center gap-1">
                {summary && !isLoading && (
                  <button
                    onClick={handleRefresh}
                    className="btn btn-ghost btn-sm gap-2"
                    title="Regenerate summary"
                  >
                    <RefreshCwIcon className="size-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Loading state */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <span className="loading loading-spinner loading-lg text-primary" />
                  <p className="font-semibold">Analyzing your conversation...</p>
                  <p className="text-sm opacity-50">Retrieving messages and generating summary</p>
                </div>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <div className="card bg-base-200 shadow-sm">
                  <div className="card-body p-6 flex flex-col items-center gap-4 text-center">
                    <AlertCircleIcon className="size-10 text-error" />
                    <div>
                      <p className="font-semibold">Something went wrong</p>
                      <p className="text-sm opacity-70 mt-1">{error}</p>
                    </div>
                    <button onClick={handleRefresh} className="btn btn-primary btn-sm">
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Summary content */}
              {summary && !isLoading && <SummaryContent text={summary} />}
            </div>

            {/* Footer */}
            {summary && !isLoading && (
              <div className="px-5 py-3 border-t border-base-300 bg-base-200 rounded-b-2xl">
                <p className="text-xs opacity-50 text-center">
                  Generated by AI · Based on the last 60 messages
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSummaryModal;
