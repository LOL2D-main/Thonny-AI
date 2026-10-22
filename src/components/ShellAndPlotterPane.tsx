import React, { useState, useRef, useEffect } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";

export interface ShellEntry {
  id: string;
  type: "header" | "command" | "stdin" | "stdout" | "stderr" | "stealth_status";
  text: string;
}

interface ShellAndPlotterPaneProps {
  entries: ShellEntry[];
  showShell: boolean;
  showPlotter: boolean;
  waitingForInput: boolean;
  plotterSeries: number[][];
  onCloseShell: () => void;
  onClosePlotter: () => void;
  onExecuteReplCommand: (cmd: string) => void;
  onSubmitProgramStdin: (line: string) => void;
  onClearShell: () => void;
  shellInputRef: React.RefObject<HTMLInputElement | null>;
}

const PLOT_COLORS = ["#1976D2", "#D32F2F", "#2E7D32", "#7B1FA2", "#F57C00"];

export const ShellAndPlotterPane: React.FC<ShellAndPlotterPaneProps> = ({
  entries,
  showShell,
  showPlotter,
  waitingForInput,
  plotterSeries,
  onCloseShell,
  onClosePlotter,
  onExecuteReplCommand,
  onSubmitProgramStdin,
  onClearShell,
  shellInputRef,
}) => {
  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, waitingForInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = inputVal;
      setInputVal("");

      if (waitingForInput) {
        onSubmitProgramStdin(cmd);
        return;
      }

      if (cmd.trim()) {
        setHistory((prev) => [...prev, cmd]);
      }
      setHistoryIdx(-1);
      onExecuteReplCommand(cmd);
      return;
    }

    if (!waitingForInput && e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx =
        historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx] || "");
      return;
    }

    if (!waitingForInput && e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal("");
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx] || "");
      }
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      onClearShell();
    }
  };

  const renderPlotterSvg = () => {
    const data =
      plotterSeries.length > 0
        ? plotterSeries
        : [
            [0, 0],
            [1, 1],
            [2, 4],
            [3, 9],
            [4, 16],
          ];
    const maxCols = Math.max(1, ...data.map((r) => r.length));
    const allValues = data.flat();
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(10, ...allValues);
    const range = maxVal - minVal || 1;

    const width = 360;
    const height = 160;
    const padLeft = 36;
    const padRight = 14;
    const padTop = 12;
    const padBottom = 22;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full bg-[#FFFFFF]"
        aria-label="Thonny Plotter chart"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padTop + plotH * (1 - ratio);
          const val = Math.round((minVal + range * ratio) * 10) / 10;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#E5E5E5"
                strokeWidth="1"
              />
              <text
                x={padLeft - 4}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="Consolas, monospace"
                fill="#666666"
              >
                {val}
              </text>
            </g>
          );
        })}

        {Array.from({ length: maxCols }, (_, colIdx) => {
          const points = data
            .map((row, rowIdx) => {
              const v = row[colIdx];
              if (typeof v !== "number") return null;
              const x =
                padLeft +
                (data.length <= 1
                  ? plotW / 2
                  : (rowIdx / (data.length - 1)) * plotW);
              const y = padTop + plotH * (1 - (v - minVal) / range);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .filter(Boolean)
            .join(" ");

          return (
            <polyline
              key={colIdx}
              fill="none"
              stroke={PLOT_COLORS[colIdx % PLOT_COLORS.length]}
              strokeWidth="1.8"
              points={points}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex h-full w-full bg-[#F0F0F0] px-[9px] pb-[2px] overflow-hidden">
      {/* Shell Panel */}
      {showShell && (
        <div
          className={`flex flex-col h-full ${
            showPlotter ? "w-[62%] pr-1" : "w-full"
          }`}
        >
          {/* Shell Tab Header */}
          <div className="flex items-end bg-[#F0F0F0] h-[25px] shrink-0 select-none">
            <div className="flex items-center h-[24px] px-2.5 bg-[#FFFFFF] border-t border-l border-r border-[#C8C8C8] -mb-[1px] pb-[1px] z-10 text-[12px] text-[#000000]">
              <span className="mr-2">Shell</span>
              <button
                type="button"
                aria-label="Close Shell panel"
                onClick={onCloseShell}
                className="w-3.5 h-3.5 inline-flex items-center justify-center text-[#888888] hover:text-[#000000]"
              >
                <X className="w-2.5 h-2.5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Interactive REPL Scrollable Output & Prompt + Classic Right Scrollbar */}
          <div className="flex flex-1 min-h-0 w-full bg-[#FFFFFF] border border-[#C8C8C8] overflow-hidden">
            <div
              ref={scrollContainerRef}
              onClick={() => shellInputRef.current?.focus()}
              data-testid="thonny-shell-output"
              className="flex-1 pt-1.5 px-2.5 font-mono text-[14px] leading-[21px] bg-[#FFFFFF] text-[#000000] overflow-y-auto cursor-text"
            >
              {entries.map((entry) => {
                if (entry.type === "header") {
                  return (
                    <div
                      key={entry.id}
                      className="text-[#888888] whitespace-pre-wrap select-text"
                    >
                      {entry.text}
                    </div>
                  );
                }
                if (entry.type === "stealth_status") {
                  return (
                    <div
                      key={entry.id}
                      data-testid={`stealth-status-${entry.text}`}
                      className="text-[10px] leading-[14px] text-[#999999] font-mono select-none"
                    >
                      {entry.text}
                    </div>
                  );
                }
                if (entry.type === "command") {
                  return (
                    <div key={entry.id} className="whitespace-pre-wrap select-text">
                      <span className="text-[#880088] font-bold select-none">
                        {">>> "}
                      </span>
                      <span className="text-[#000000]">{entry.text}</span>
                    </div>
                  );
                }
                if (entry.type === "stdin") {
                  return (
                    <div
                      key={entry.id}
                      className="text-[#006600] italic whitespace-pre-wrap select-text"
                    >
                      {entry.text}
                    </div>
                  );
                }
                if (entry.type === "stderr") {
                  return (
                    <div
                      key={entry.id}
                      className="text-[#D32F2F] whitespace-pre-wrap select-text"
                    >
                      {entry.text}
                    </div>
                  );
                }
                return (
                  <div
                    key={entry.id}
                    className="text-[#000000] whitespace-pre-wrap select-text"
                  >
                    {entry.text}
                  </div>
                );
              })}

              {/* Active Input Line (either >>> REPL prompt or program input() stdin line) */}
              <div className="flex items-center min-h-[21px]">
                {!waitingForInput && (
                  <span
                    className="text-[#880088] font-bold whitespace-pre select-none shrink-0"
                    data-testid="shell-prompt-symbol"
                  >
                    {">>> "}
                  </span>
                )}
                <input
                  ref={shellInputRef}
                  type="text"
                  aria-label="Python Shell REPL input"
                  data-testid="thonny-shell-input"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className={`flex-1 font-mono text-[14px] leading-[21px] bg-transparent border-0 outline-none p-0 m-0 ${
                    waitingForInput ? "text-[#006600] italic" : "text-[#000000]"
                  }`}
                />
              </div>
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
      )}

      {/* Plotter Panel */}
      {showPlotter && (
        <div
          className={`flex flex-col h-full ${
            showShell ? "w-[38%]" : "w-full"
          }`}
        >
          <div className="flex items-end bg-[#F0F0F0] h-[25px] shrink-0 select-none">
            <div className="flex items-center h-[24px] px-2.5 bg-[#FFFFFF] border-t border-l border-r border-[#C8C8C8] -mb-[1px] pb-[1px] z-10 text-[12px] text-[#000000]">
              <span className="mr-2">Plotter</span>
              <button
                type="button"
                aria-label="Close Plotter panel"
                onClick={onClosePlotter}
                className="w-3.5 h-3.5 inline-flex items-center justify-center text-[#888888] hover:text-[#000000]"
              >
                <X className="w-2.5 h-2.5" strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-[#FFFFFF] border border-[#C8C8C8] p-1 overflow-hidden">
            {renderPlotterSvg()}
          </div>
        </div>
      )}
    </div>
  );
};
