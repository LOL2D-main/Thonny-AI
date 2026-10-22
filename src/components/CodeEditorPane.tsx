import React, { useRef, useMemo } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import {
  tokenizePythonCode,
  computeCursorCoordinates,
  togglePythonComment,
  CodeToken,
} from "../utils/pythonEngine";

export interface EditorTab {
  id: string;
  title: string;
  path: string;
  content: string;
  savedContent: string;
  isUntitled?: boolean;
  isCloudSynced?: boolean;
}

interface CodeEditorPaneProps {
  tabs: EditorTab[];
  activeTabId: string;
  showLineNumbers: boolean;
  debugActiveLine: number | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onChangeContent: (newContent: string) => void;
  onCursorChange: (coords: { line: number; col: number; formatted: string }) => void;
  onRunScript: () => void;
  onDebugScript: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onResume: () => void;
  onStopScript: () => void;
  onSaveScript: () => void;
  onTriggerStealthAgent: () => void;
  onToggleAssistant: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  internalClipboardRef?: React.RefObject<string>;
}

function renderTokenSpan(token: CodeToken, key: number) {
  switch (token.type) {
    case "keyword":
      return (
        <span key={key} className="text-[#0000FF] font-bold">
          {token.value}
        </span>
      );
    case "builtin":
      return (
        <span key={key} className="text-[#800080]">
          {token.value}
        </span>
      );
    case "string":
      return (
        <span key={key} className="text-[#008000]">
          {token.value}
        </span>
      );
    case "comment":
      return (
        <span key={key} className="text-[#808080] italic">
          {token.value}
        </span>
      );
    default:
      return (
        <span key={key} className="text-[#000000]">
          {token.value}
        </span>
      );
  }
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  tabs,
  activeTabId,
  showLineNumbers,
  debugActiveLine,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onCursorChange,
  onRunScript,
  onDebugScript,
  onStepOver,
  onStepInto,
  onStepOut,
  onResume,
  onStopScript,
  onSaveScript,
  onTriggerStealthAgent,
  onToggleAssistant,
  textareaRef,
  internalClipboardRef,
}) => {
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const code = activeTab?.content || "";

  const tokenizedLines = useMemo(() => tokenizePythonCode(code), [code]);
  const lineCount = Math.max(1, tokenizedLines.length);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = top;
      highlightRef.current.scrollLeft = left;
    }
  };

  const updateCursorFromTarget = (el: HTMLTextAreaElement) => {
    const coords = computeCursorCoordinates(el.value, el.selectionStart || 0);
    onCursorChange(coords);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    // F5: Run current script
    if (e.key === "F5" && !e.ctrlKey) {
      e.preventDefault();
      onRunScript();
      return;
    }
    // Ctrl+F5: Debug current script
    if (e.key === "F5" && e.ctrlKey) {
      e.preventDefault();
      onDebugScript();
      return;
    }
    // F6: Step over
    if (e.key === "F6") {
      e.preventDefault();
      onStepOver();
      return;
    }
    // F7: Step into
    if (e.key === "F7") {
      e.preventDefault();
      onStepInto();
      return;
    }
    // F8: Step out
    if (e.key === "F8") {
      e.preventDefault();
      onStepOut();
      return;
    }
    // F9: Resume
    if (e.key === "F9") {
      e.preventDefault();
      onResume();
      return;
    }
    // Ctrl+F2: Stop/Restart
    if (e.key === "F2" && e.ctrlKey) {
      e.preventDefault();
      onStopScript();
      return;
    }
    // Ctrl+S: Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !e.shiftKey) {
      e.preventDefault();
      onSaveScript();
      return;
    }
    // Ctrl+3: Comment/Uncomment Out
    if ((e.ctrlKey || e.metaKey) && e.key === "3") {
      e.preventDefault();
      const res = togglePythonComment(
        code,
        el.selectionStart || 0,
        el.selectionEnd || 0
      );
      onChangeContent(res.newCode);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(
            res.newSelectionStart,
            res.newSelectionEnd
          );
          updateCursorFromTarget(textareaRef.current);
        }
      });
      return;
    }
    // Alt+S, F4, or Ctrl+Shift+X: Stealth Inline Solve (pure student Python code, zero comments)
    if (
      (e.altKey && e.key.toLowerCase() === "s") ||
      e.key === "F4" ||
      (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x")
    ) {
      e.preventDefault();
      onTriggerStealthAgent();
      return;
    }
    // Ctrl+L, Alt+A, or Ctrl+Shift+A: Toggle hidden clean Assistant panel
    if (
      ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "l") ||
      (e.altKey && e.key.toLowerCase() === "a") ||
      (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a")
    ) {
      e.preventDefault();
      onToggleAssistant();
      return;
    }

    // Tab key inserts 4 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const nextCode = code.slice(0, start) + "    " + code.slice(end);
      onChangeContent(nextCode);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(start + 4, start + 4);
          updateCursorFromTarget(textareaRef.current);
        }
      });
      return;
    }

    // Enter key auto-indents matching current line + 4 spaces after ':'
    if (e.key === "Enter") {
      e.preventDefault();
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const before = code.slice(0, start);
      const currentLine = before.split("\n").pop() || "";
      const indentMatch = currentLine.match(/^\s*/);
      const currentIndent = indentMatch ? indentMatch[0] : "";
      const extraIndent = currentLine.trimEnd().endsWith(":") ? "    " : "";
      const insertStr = "\n" + currentIndent + extraIndent;
      const nextCode = code.slice(0, start) + insertStr + code.slice(end);
      onChangeContent(nextCode);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const nextPos = start + insertStr.length;
          textareaRef.current.setSelectionRange(nextPos, nextPos);
          updateCursorFromTarget(textareaRef.current);
        }
      });
      return;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F0F0F0] px-[9px] pt-[2px] select-none overflow-hidden">
      {/* Thonny Square Tabs Bar (Matches reference screenshot: nghichngu.py x | <untitled> x) */}
      <div
        role="tablist"
        aria-label="Editor file tabs"
        className="flex items-end bg-[#F0F0F0] h-[25px] shrink-0 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;
          const isDirty = !tab.isUntitled && tab.content !== tab.savedContent;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center h-[24px] px-2.5 text-[12px] border-t border-l border-r border-[#C8C8C8] cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-[#FFFFFF] text-[#000000] font-normal z-10 -mb-[1px] pb-[1px]"
                  : "bg-[#EBEBEB] text-[#222222] hover:bg-[#F2F2F2]"
              }`}
            >
              <span className="mr-2 select-none">
                {tab.title}
                {isDirty ? " *" : ""}
              </span>
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => onCloseTab(tab.id, e)}
                className="w-3.5 h-3.5 inline-flex items-center justify-center text-[#888888] hover:text-[#000000]"
              >
                <X className="w-2.5 h-2.5" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main Editor Box with 1px solid #C8C8C8 border + Line Numbers Gutter + Classic Right Scrollbar */}
      <div className="relative flex flex-1 min-h-0 w-full bg-[#FFFFFF] border border-[#C8C8C8] overflow-hidden">
        {showLineNumbers && (
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="w-[38px] bg-[#E5E5E5] text-[#767676] font-mono text-[14px] leading-[20px] pt-1.5 pr-2 text-right select-none overflow-hidden shrink-0 tabular-nums"
          >
            {Array.from({ length: lineCount }, (_, idx) => {
              const ln = idx + 1;
              const isDebugLine = debugActiveLine === ln;
              return (
                <div
                  key={ln}
                  className={`h-[20px] ${
                    isDebugLine ? "bg-[#FBC02D] text-[#000000] font-bold pr-1" : ""
                  }`}
                >
                  {ln}
                </div>
              );
            })}
          </div>
        )}

        {/* Synchronized Highlight Overlay + Editable Textarea */}
        <div className="relative flex-1 h-full min-w-0 bg-[#FFFFFF] overflow-hidden">
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 pt-1.5 px-2.5 font-mono text-[14px] leading-[20px] whitespace-pre overflow-hidden select-none"
          >
            {tokenizedLines.map((lineTokens, idx) => {
              const ln = idx + 1;
              const isDebugLine = debugActiveLine === ln;
              return (
                <div
                  key={ln}
                  className={`min-h-[20px] ${
                    isDebugLine ? "bg-[#FFF59D] -mx-2.5 px-2.5" : ""
                  }`}
                >
                  {lineTokens.length === 0 ? (
                    "\n"
                  ) : (
                    lineTokens.map((tok, tIdx) => renderTokenSpan(tok, tIdx))
                  )}
                </div>
              );
            })}
          </pre>

          <textarea
            ref={textareaRef}
            aria-label={`Code editor for ${activeTab?.title || "<untitled>"}`}
            data-testid="thonny-code-editor"
            value={code}
            onChange={(e) => {
              onChangeContent(e.target.value);
              updateCursorFromTarget(e.target);
            }}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData("text/plain") || "";
              if (!pasted && internalClipboardRef?.current) {
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart || 0;
                const end = el.selectionEnd || 0;
                const clip = internalClipboardRef.current;
                const nextCode = code.slice(0, start) + clip + code.slice(end);
                onChangeContent(nextCode);
                requestAnimationFrame(() => {
                  if (textareaRef.current) {
                    const pos = start + clip.length;
                    textareaRef.current.setSelectionRange(pos, pos);
                    updateCursorFromTarget(textareaRef.current);
                  }
                });
              }
            }}
            onClick={(e) => updateCursorFromTarget(e.currentTarget)}
            onKeyUp={(e) => updateCursorFromTarget(e.currentTarget)}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="absolute inset-0 w-full h-full m-0 pt-1.5 px-2.5 font-mono text-[14px] leading-[20px] bg-transparent text-transparent caret-[#000000] resize-none border-0 outline-none whitespace-pre overflow-auto selection:bg-[#ADD6FF]/60"
          />
        </div>

        {/* Classic Windows Right Vertical Scrollbar Track */}
        <div
          aria-hidden="true"
          className="w-[17px] h-full bg-[#F8F8F8] border-l border-[#ECECEC] flex flex-col justify-between items-center py-0.5 text-[#777777] shrink-0 select-none"
        >
          <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.8} />
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
};
