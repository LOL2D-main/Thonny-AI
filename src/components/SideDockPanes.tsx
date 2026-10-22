import React, { useState, useRef, useEffect } from "react";
import { X, Copy, Check, SendHorizontal } from "lucide-react";
import { PythonVariableInfo, cleanStudentPythonCode } from "../utils/pythonEngine";

export interface AssistantMessage {
  id: string;
  role: "user" | "model" | "status";
  text: string;
  model?: "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.1-flash-lite";
}

interface SideDockPanesProps {
  showVariables: boolean;
  showAssistant: boolean;
  variables: PythonVariableInfo[];
  assistantMessages: AssistantMessage[];
  onCloseVariables: () => void;
  onCloseAssistant: () => void;
  onSendChatMessage: (text: string) => void;
  onClearChatHistory: () => void;
  onCopyCodeQuick: (code: string) => void;
}

function splitMessageIntoSegments(rawText: string): Array<{
  type: "text" | "code";
  content: string;
}> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Check if message has explicit ``` fences
  if (trimmed.includes("```")) {
    const segments: Array<{ type: "text" | "code"; content: string }> = [];
    const regex = /```(?:[a-zA-Z0-9_+-]+)?\s*\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(trimmed)) !== null) {
      const before = trimmed.slice(lastIndex, match.index).trim();
      if (before) {
        segments.push({ type: "text", content: before });
      }
      const codeInner = cleanStudentPythonCode(match[1]);
      if (codeInner) {
        segments.push({ type: "code", content: codeInner });
      }
      lastIndex = regex.lastIndex;
    }

    const after = trimmed.slice(lastIndex).trim();
    if (after) {
      segments.push({ type: "text", content: after });
    }
    return segments.length > 0 ? segments : [{ type: "text", content: trimmed }];
  }

  // Otherwise check if the entire response is raw Python code
  const looksLikeRawPython =
    /^(import\s+\w+|from\s+\w+|def\s+\w+|for\s+\w+\s+in\s+|while\s+|if\s+|[a-zA-Z_]\w*\s*=\s*|print\s*\()/m.test(
      trimmed
    ) && !/^(xin chào|chào bạn|tôi là|dưới đây|để giải)/i.test(trimmed);

  if (looksLikeRawPython) {
    return [{ type: "code", content: cleanStudentPythonCode(trimmed) }];
  }

  return [{ type: "text", content: trimmed }];
}

export const SideDockPanes: React.FC<SideDockPanesProps> = ({
  showVariables,
  showAssistant,
  variables,
  assistantMessages,
  onCloseVariables,
  onCloseAssistant,
  onSendChatMessage,
  onClearChatHistory,
  onCopyCodeQuick,
}) => {
  const [chatInput, setChatInput] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  useEffect(() => {
    if (showAssistant) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [showAssistant]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput("");
    onSendChatMessage(trimmed);
  };

  const handleQuickCopy = (key: string, codeText: string) => {
    onCopyCodeQuick(codeText);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F0F0] pr-[9px] pt-[2px] pb-[2px] overflow-hidden select-none">
      {/* Top Side Dock: Variables Panel */}
      {showVariables && (
        <div
          className={`flex flex-col ${
            showAssistant ? "h-[40%] pb-1.5" : "h-full"
          } overflow-hidden`}
          data-testid="thonny-variables-panel"
        >
          <div className="flex-1 flex flex-col bg-[#FFFFFF] border border-[#D0D0D0] overflow-hidden">
            <div className="flex items-center justify-between h-[25px] px-2.5 bg-[#F7F7F7] border-b border-[#D8D8D8] text-[12px] text-[#333333] shrink-0">
              <span>Variables</span>
              <button
                type="button"
                aria-label="Close Variables panel"
                onClick={onCloseVariables}
                className="w-4 h-4 inline-flex items-center justify-center text-[#666666] hover:text-[#000000]"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>

            {variables.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-[#FFFFFF]">
                <p className="text-[12px] text-[#777777] leading-[18px] mb-2">
                  No active user variables initialized in execution scope.
                </p>
                <p className="text-[11px] text-[#999999] leading-[16px]">
                  Run or Debug a Python file to populate variables automatically.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-[#FFFFFF]">
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="bg-[#F5F5F5] border-b border-[#D0D0D0] text-[#333333]">
                      <th className="py-1 px-2 font-normal border-r border-[#D0D0D0] w-[42%]">
                        Name
                      </th>
                      <th className="py-1 px-2 font-normal">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[12px] divide-y divide-[#EBEBEB]">
                    {variables.map((v) => (
                      <tr key={v.name} className="hover:bg-[#E8F0FE]">
                        <td className="py-1 px-2 text-[#000080] border-r border-[#EBEBEB] truncate">
                          {v.name}
                        </td>
                        <td className="py-1 px-2 text-[#000000] truncate tabular-nums">
                          {v.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assistant Panel (Matches Variables frame style in image_889bc2fb.png, toggled via Ctrl+L) */}
      {showAssistant && (
        <div
          className={`flex flex-col ${
            showVariables ? "h-[60%]" : "h-full"
          } overflow-hidden`}
          data-testid="thonny-assistant-panel"
        >
          <div className="flex-1 flex flex-col bg-[#FFFFFF] border border-[#D0D0D0] overflow-hidden">
            {/* Full-width Header Bar matching image_889bc2fb.png: "Assistant" on left, "×" on right */}
            <div className="flex items-center justify-between h-[25px] px-2.5 bg-[#F7F7F7] border-b border-[#D8D8D8] text-[12px] text-[#333333] shrink-0">
              <span>Assistant</span>
              <div className="flex items-center gap-2">
                {assistantMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChatHistory}
                    className="text-[11px] text-[#888888] hover:text-[#222222]"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close Assistant panel"
                  onClick={onCloseAssistant}
                  className="w-4 h-4 inline-flex items-center justify-center text-[#666666] hover:text-[#000000]"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Clean Chat & Code Output Area */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-[12px] bg-[#FFFFFF] select-text">
              {assistantMessages.map((msg) => {
                if (msg.role === "status") {
                  return (
                    <div
                      key={msg.id}
                      data-testid={`assistant-status-${msg.text}`}
                      className="text-[10px] leading-[13px] text-[#999999] font-mono select-none"
                    >
                      {msg.text}
                    </div>
                  );
                }

                if (msg.role === "user") {
                  return (
                    <div
                      key={msg.id}
                      className="px-2.5 py-1.5 bg-[#F4F4F4] border border-[#E2E2E2] text-[#222222] text-[12px] leading-[17px] break-words"
                    >
                      {msg.text}
                    </div>
                  );
                }

                const segments = splitMessageIntoSegments(msg.text);

                return (
                  <div key={msg.id} className="space-y-1.5">
                    {segments.map((seg, sIdx) => {
                      const segKey = `${msg.id}_${sIdx}`;
                      if (seg.type === "text") {
                        return (
                          <div
                            key={segKey}
                            data-testid="assistant-text-output"
                            className="px-2.5 py-1.5 bg-[#FFFFFF] border border-[#E5E5E5] text-[#111111] text-[12px] leading-[18px] whitespace-pre-wrap break-words"
                          >
                            {seg.content}
                          </div>
                        );
                      }

                      const isCopied = copiedKey === segKey;
                      return (
                        <div
                          key={segKey}
                          className="border border-[#DCDCDC] bg-[#FAFAFA]"
                        >
                          <div className="flex items-center justify-end px-2 py-1 bg-[#F2F2F2] border-b border-[#E5E5E5]">
                            <button
                              type="button"
                              data-testid="assistant-copy-code-btn"
                              onClick={() => handleQuickCopy(segKey, seg.content)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-[#333333] bg-[#FFFFFF] border border-[#CCCCCC] hover:bg-[#EAEAEA] active:bg-[#DDDDDD]"
                            >
                              {isCopied ? (
                                <>
                                  <Check
                                    className="w-3 h-3 text-[#008000]"
                                    strokeWidth={2}
                                  />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy
                                    className="w-3 h-3 text-[#555555]"
                                    strokeWidth={1.8}
                                  />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre
                            data-testid="assistant-code-output"
                            className="m-0 p-2 whitespace-pre-wrap font-mono text-[12px] leading-[18px] text-[#000000] bg-[#FFFFFF] overflow-x-auto select-all"
                          >
                            {seg.content}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Clean Chat Input Bar at Bottom */}
            <form
              onSubmit={handleSend}
              className="flex items-center border-t border-[#D8D8D8] bg-[#F9F9F9] px-2 py-1.5 shrink-0 gap-1.5"
            >
              <input
                ref={inputRef}
                type="text"
                aria-label="Assistant input"
                data-testid="assistant-chat-input"
                placeholder="Nhập tin nhắn hoặc đề bài..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 min-w-0 bg-[#FFFFFF] border border-[#CCCCCC] px-2 py-1 text-[12px] text-[#000000] outline-none focus:border-[#0078D7]"
              />
              <button
                type="submit"
                aria-label="Send prompt"
                data-testid="assistant-send-btn"
                className="h-[26px] px-2 inline-flex items-center justify-center bg-[#EAEAEA] border border-[#CCCCCC] hover:bg-[#DCDCDC] active:bg-[#CCCCCC] text-[#333333] shrink-0"
              >
                <SendHorizontal className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
