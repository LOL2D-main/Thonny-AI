import React, { useState, useRef, useEffect, useCallback } from "react";
import { Menu } from "lucide-react";
import {
  NewFileIcon,
  OpenFolderIcon,
  SaveDiskIcon,
  RunScriptIcon,
  DebugScriptIcon,
  StepOverIcon,
  StepIntoIcon,
  StepOutIcon,
  ResumeIcon,
  StopRestartIcon,
  UkraineFlagIcon,
} from "./components/ThonnyIcons";
import { CodeEditorPane, EditorTab } from "./components/CodeEditorPane";
import { ShellAndPlotterPane, ShellEntry } from "./components/ShellAndPlotterPane";
import { SideDockPanes, AssistantMessage } from "./components/SideDockPanes";
import { ThonnyModals, ModalType } from "./components/ThonnyModals";
import {
  formatThonnyTitleBar,
  togglePythonComment,
  extractStealthPromptFromPython,
  cleanStudentPythonCode,
  executePythonScript,
  evaluatePythonReplLine,
  PythonVariableInfo,
  PythonDebugStep,
} from "./utils/pythonEngine";
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
  signInWithGoogle,
  saveCloudScript,
  deleteCloudScript,
  saveCloudChatMessage,
  deleteCloudChatMessage,
  handleFirestoreError,
  OperationType,
  CloudScriptRecord,
  User,
} from "./firebase";

const INITIAL_SHELL_HEADER: ShellEntry = {
  id: "shell-init-header",
  type: "header",
  text: "Python 3.14.4 (C:\\Users\\WIN 10 PRO\\AppData\\Local\\Programs\\Thonny\\python.exe)",
};

const ENVIRONMENT_PROFILES = [
  "Local Python 3 • Thonny's Python",
  "Local Python 3.11 (venv)",
  "MicroPython (Raspberry Pi Pico)",
  "Remote Python 3 (SSH)",
];

type OpenMenuName =
  | null
  | "File"
  | "Edit"
  | "View"
  | "Run"
  | "Tools"
  | "Help";

export default function App() {
  // 1. Editor Tabs State (Matches reference screenshot: nghichngu.py and <untitled>, both blank with zero comments)
  const [tabs, setTabs] = useState<EditorTab[]>([
    {
      id: "tab_nghichngu",
      title: "nghichngu.py",
      path: "C:\\Users\\WIN 10 PRO\\Desktop\\nghichngu.py",
      content: "",
      savedContent: "",
      isUntitled: false,
    },
    {
      id: "tab_untitled",
      title: "<untitled>",
      path: "<untitled>",
      content: "",
      savedContent: "",
      isUntitled: true,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab_untitled");

  // 2. View Visibility Checkboxes State (Assistant & Variables hidden by default; toggled via shortcut or View menu)
  const [showToolbar, setShowToolbar] = useState<boolean>(true);
  const [showShell, setShowShell] = useState<boolean>(true);
  const [showVariables, setShowVariables] = useState<boolean>(false);
  const [showAssistant, setShowAssistant] = useState<boolean>(false);
  const [showPlotter, setShowPlotter] = useState<boolean>(false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // 3. Split-Pane Height Ratio (Top Editor 68% default, Bottom Shell 32% default)
  const [editorHeightPct, setEditorHeightPct] = useState<number>(68);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSplitterRef = useRef<boolean>(false);

  // 4. Shell & Real Python Runtime State
  const [shellEntries, setShellEntries] = useState<ShellEntry[]>([
    INITIAL_SHELL_HEADER,
  ]);
  const [replScope, setReplScope] = useState<Record<string, any>>({});
  const [replCommandCount, setReplCommandCount] = useState<number>(0);
  const [variables, setVariables] = useState<PythonVariableInfo[]>([]);
  const [plotterSeries, setPlotterSeries] = useState<number[][]>([]);

  // Interactive input() state for running scripts
  const [waitingForInput, setWaitingForInput] = useState<boolean>(false);
  const [runningCodeBuffer, setRunningCodeBuffer] = useState<string>("");
  const [runningFileName, setRunningFileName] = useState<string>("nghichngu.py");
  const [pendingStdinLines, setPendingStdinLines] = useState<string[]>([]);
  const [printedStdoutLen, setPrintedStdoutLen] = useState<number>(0);

  // 5. Debugger State Machine
  const [debugSteps, setDebugSteps] = useState<PythonDebugStep[]>([]);
  const [debugStepIndex, setDebugStepIndex] = useState<number>(-1);

  // 6. Status Bar & Menu State
  const [, setCursorCoords] = useState<{
    line: number;
    col: number;
    formatted: string;
  }>({ line: 1, col: 1, formatted: "Line 1 : Col 1" });
  const [selectedInterpreter, setSelectedInterpreter] = useState<string>(
    "Local Python 3 • Thonny's Python"
  );
  const [showEnvDropdown, setShowEnvDropdown] = useState<boolean>(false);
  const [openMenu, setOpenMenu] = useState<OpenMenuName>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [folderInfoPath, setFolderInfoPath] = useState<string>(
    "C:\\Users\\WIN 10 PRO\\AppData\\Local\\Programs\\Thonny"
  );

  // 7. Firebase Auth & Cloud Persistence State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [cloudScripts, setCloudScripts] = useState<CloudScriptRecord[]>([]);

  // 8. Hidden Clean Assistant & Stealth Inline Coding Agent State
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState<
    "gemini-4-argon" | "gemini-3.8-flash" | "gemini-3.1-flash-lite"
  >("gemini-3.8-flash");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shellInputRef = useRef<HTMLInputElement | null>(null);
  const internalClipboardRef = useRef<string>("");

  // Guaranteed non-interrupting clipboard copy (Navigator Clipboard API + hidden textarea execCommand + internal fallback)
  const copyToClipboardGuaranteed = useCallback(async (codeText: string) => {
    if (!codeText) return;
    internalClipboardRef.current = codeText;
    (window as any).__THONNY_CLIPBOARD__ = codeText;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeText);
      }
    } catch {
      // Fallback below
    }

    try {
      const prevFocused = document.activeElement as HTMLElement | null;
      const selStart =
        prevFocused instanceof HTMLTextAreaElement ||
        prevFocused instanceof HTMLInputElement
          ? prevFocused.selectionStart
          : null;
      const selEnd =
        prevFocused instanceof HTMLTextAreaElement ||
        prevFocused instanceof HTMLInputElement
          ? prevFocused.selectionEnd
          : null;

      const ghost = document.createElement("textarea");
      ghost.value = codeText;
      ghost.setAttribute("readonly", "");
      ghost.style.position = "fixed";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.opacity = "0";
      document.body.appendChild(ghost);
      ghost.select();
      document.execCommand("copy");
      document.body.removeChild(ghost);

      if (prevFocused && typeof prevFocused.focus === "function") {
        prevFocused.focus({ preventScroll: true });
        if (
          (prevFocused instanceof HTMLTextAreaElement ||
            prevFocused instanceof HTMLInputElement) &&
          selStart !== null &&
          selEnd !== null
        ) {
          prevFocused.setSelectionRange(selStart, selEnd);
        }
      }
    } catch {
      // Ignore DOM copy restrictions
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isDirty =
    activeTab && !activeTab.isUntitled
      ? activeTab.content !== activeTab.savedContent
      : false;
  const titleBarString = formatThonnyTitleBar(
    activeTab?.title || "<untitled>",
    activeTab?.path || "<untitled>",
    isDirty
  );

  useEffect(() => {
    document.title = titleBarString;
  }, [titleBarString]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !currentUser) {
      setCloudScripts([]);
      return;
    }

    const scriptsQuery = query(
      collection(db, "scripts"),
      where("ownerId", "==", currentUser.uid)
    );
    const unsubScripts = onSnapshot(
      scriptsQuery,
      (snap) => {
        const list: CloudScriptRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CloudScriptRecord, "id">),
        }));
        setCloudScripts(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "scripts");
      }
    );

    const chatQuery = query(
      collection(db, "chat_messages"),
      where("ownerId", "==", currentUser.uid)
    );
    const unsubChats = onSnapshot(
      chatQuery,
      (snap) => {
        const loaded: AssistantMessage[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              role: (data.role === "model" ? "model" : "user") as "user" | "model",
              text: String(data.text || ""),
              model: (data.model || "gemini-3.8-flash") as
                | "gemini-4-argon"
                | "gemini-3.8-flash"
                | "gemini-3.1-flash-lite",
              createdAtMs: data.createdAt?.toMillis?.() || 0,
            };
          })
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map(({ id, role, text, model }) => ({ id, role, text, model }));
        if (loaded.length > 0) {
          setAssistantMessages(loaded);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "chat_messages");
      }
    );

    return () => {
      unsubScripts();
      unsubChats();
    };
  }, [authReady, currentUser]);

  // Draggable Horizontal Splitter Bar between Editor and Shell
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitterRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const pct = Math.max(20, Math.min(85, (relY / rect.height) * 100));
      setEditorHeightPct(Math.round(pct * 10) / 10);
    };

    const handleMouseUp = () => {
      if (isDraggingSplitterRef.current) {
        isDraggingSplitterRef.current = false;
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const closeAllPopups = () => {
      setOpenMenu(null);
      setShowEnvDropdown(false);
    };
    window.addEventListener("click", closeAllPopups);
    return () => window.removeEventListener("click", closeAllPopups);
  }, []);

  // Editor Tab Operations (Blank <untitled> without any comments)
  const handleNewTab = useCallback(() => {
    const newId = `tab_${Date.now()}`;
    const newTab: EditorTab = {
      id: newId,
      title: "<untitled>",
      path: "<untitled>",
      content: "",
      savedContent: "",
      isUntitled: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (tabs.length <= 1) {
        const resetTab: EditorTab = {
          id: "tab_untitled",
          title: "<untitled>",
          path: "<untitled>",
          content: "",
          savedContent: "",
          isUntitled: true,
        };
        setTabs([resetTab]);
        setActiveTabId("tab_untitled");
        return;
      }
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(nextTabs);
      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[nextTabs.length - 1].id);
      }
    },
    [tabs, activeTabId]
  );

  const handleChangeEditorContent = useCallback(
    (newContent: string) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: newContent } : t))
      );
    },
    [activeTabId]
  );

  const handleSaveCurrentTab = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.isUntitled) {
      setActiveModal("save_as");
      return;
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, savedContent: t.content } : t
      )
    );

    if (currentUser) {
      await saveCloudScript({
        id: activeTab.id,
        title: activeTab.title,
        path: activeTab.path,
        content: activeTab.content,
        isExisting: Boolean(activeTab.isCloudSynced),
      });
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id ? { ...t, isCloudSynced: true } : t
        )
      );
    }
  }, [activeTab, currentUser]);

  const handleSaveAsConfirm = useCallback(
    async (newFileName: string, newFilePath: string) => {
      if (!activeTab) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                title: newFileName,
                path: newFilePath,
                savedContent: t.content,
                isUntitled: false,
              }
            : t
        )
      );
      if (currentUser) {
        await saveCloudScript({
          id: activeTab.id,
          title: newFileName,
          path: newFilePath,
          content: activeTab.content,
          isExisting: Boolean(activeTab.isCloudSynced),
        });
      }
    },
    [activeTab, currentUser]
  );

  const runRequestIdRef = useRef<number>(0);

  // Execute Python Code on real Python 3 backend (with interactive input() support) + local fallback
  const executeOnBackendWithInput = useCallback(
    async (codeStr: string, fileNameStr: string, stdinLines: string[], prevStdoutLen: number) => {
      const reqId = ++runRequestIdRef.current;
      try {
        const res = await fetch("/api/python/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeStr,
            fileName: fileNameStr,
            stdinLines,
          }),
        });
        const data = await res.json();
        if (reqId !== runRequestIdRef.current) return;

        const fullStdout = String(data.stdout || "");
        const newStdoutDelta = fullStdout.slice(prevStdoutLen);

        if (newStdoutDelta) {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `out-${Date.now()}-${Math.random()}`,
              type: "stdout",
              text: newStdoutDelta.replace(/\n$/, ""),
            },
          ]);
        }

        if (data.needsInput) {
          setWaitingForInput(true);
          setRunningCodeBuffer(codeStr);
          setRunningFileName(fileNameStr);
          setPendingStdinLines(stdinLines);
          setPrintedStdoutLen(fullStdout.length);
          requestAnimationFrame(() => {
            shellInputRef.current?.focus();
          });
          return;
        }

        setWaitingForInput(false);
        setRunningCodeBuffer("");
        setPendingStdinLines([]);
        setPrintedStdoutLen(0);

        if (data.stderr) {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}-${Math.random()}`,
              type: "stderr",
              text: String(data.stderr).replace(/\n$/, ""),
            },
          ]);
        }

        // Also update local variables & plotter if possible
        const localExec = executePythonScript(codeStr, fileNameStr, {});
        setVariables(localExec.variables);
        if (localExec.plotterSeries.length > 0) {
          setPlotterSeries(localExec.plotterSeries);
        }
      } catch {
        if (reqId !== runRequestIdRef.current) return;
        // Offline / local fallback
        setWaitingForInput(false);
        const execResult = executePythonScript(codeStr, fileNameStr, {});
        if (execResult.stdout.length > 0) {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `out-${Date.now()}`,
              type: "stdout",
              text: execResult.stdout.join("\n"),
            },
          ]);
        }
        if (execResult.stderr) {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              type: "stderr",
              text: execResult.stderr,
            },
          ]);
        }
        setVariables(execResult.variables);
      }
    },
    []
  );

  // Background Stealth Runner (gemini-3.8-flash):
  // Immediately shows tiny "start" in Shell, solves in background without interrupting user,
  // automatically copies clean student Python code to clipboard, and prints tiny "finish" in Shell.
  const runBackgroundStealth = useCallback(
    (promptPayload: string, rawCodeContext: string) => {
      const trimmedPrompt = promptPayload.trim();
      if (!trimmedPrompt) return;

      setShowShell(true);
      setShellEntries((prev) => [
        ...prev,
        {
          id: `stealth-start-${Date.now()}-${Math.random()}`,
          type: "stealth_status",
          text: "start",
        },
      ]);

      // Fire-and-forget async promise so 100% uninterruptible & non-blocking
      (async () => {
        try {
          const response = await fetch("/api/gemini/stealth-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              extractedPrompt: trimmedPrompt,
              rawCode: rawCodeContext,
              model: "gemini-3.8-flash",
              highThinking: false,
            }),
          });
          const data = await response.json();
          const studentCode = cleanStudentPythonCode(String(data.code || ""));
          if (studentCode) {
            await copyToClipboardGuaranteed(studentCode);
          }
        } catch {
          // Even on network hiccup, do not interrupt user
        } finally {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `stealth-finish-${Date.now()}-${Math.random()}`,
              type: "stealth_status",
              text: "finish",
            },
          ]);
        }
      })();
    },
    [copyToClipboardGuaranteed]
  );

  // 4. Functional Simulation: Run Current Script (F5)
  // If """ đề bài """ is present in the editor, triggers background stealth AI (start -> clipboard copy -> finish)
  const handleRunCurrentScript = useCallback(() => {
    if (!activeTab) return;
    setShowShell(true);
    setDebugSteps([]);
    setDebugStepIndex(-1);
    setPendingStdinLines([]);
    setPrintedStdoutLen(0);

    const rawContent = activeTab.content;
    const { extractedPrompt, hasDocstringPrompt } =
      extractStealthPromptFromPython(rawContent);

    // Strip docstrings & comments to check if there is also normal executable Python code
    const codeWithoutDocstrings = rawContent
      .replace(/"""[\s\S]*?"""/g, "")
      .replace(/'''[\s\S]*?'''/g, "")
      .replace(/^"""[\s\S]*$/g, "")
      .replace(/^'''[\s\S]*$/g, "")
      .split("\n")
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean)
      .join("\n");

    // If user entered """ đề bài """ (or only comment prompt), run stealth AI in background!
    if (
      extractedPrompt &&
      (hasDocstringPrompt || codeWithoutDocstrings.length === 0)
    ) {
      runBackgroundStealth(extractedPrompt, rawContent);
      // If there are no other executable statements outside """ đề bài """, we are done!
      if (codeWithoutDocstrings.length === 0) {
        setWaitingForInput(false);
        return;
      }
    }

    const runLabel = activeTab.isUntitled
      ? `%Run -c $EDITOR_CONTENT`
      : `%Run ${activeTab.title}`;

    const runCmdEntry: ShellEntry = {
      id: `cmd-${Date.now()}`,
      type: "command",
      text: runLabel,
    };

    setShellEntries((prev) => [...prev, runCmdEntry]);

    if (!rawContent.trim()) {
      setWaitingForInput(false);
      return;
    }

    if (/\binput\s*\(/.test(codeWithoutDocstrings)) {
      setWaitingForInput(true);
      setRunningCodeBuffer(rawContent);
      setRunningFileName(activeTab.title);
    } else {
      setWaitingForInput(false);
    }

    executeOnBackendWithInput(rawContent, activeTab.title, [], 0);
  }, [activeTab, executeOnBackendWithInput, runBackgroundStealth]);

  // Handle user entering a line in Shell while a Python script is waiting on input()
  const handleSubmitProgramStdin = useCallback(
    (line: string) => {
      const nextStdin = [...pendingStdinLines, line];
      setShellEntries((prev) => [
        ...prev,
        {
          id: `stdin-${Date.now()}`,
          type: "stdin",
          text: line,
        },
      ]);
      executeOnBackendWithInput(
        runningCodeBuffer,
        runningFileName,
        nextStdin,
        printedStdoutLen
      );
    },
    [
      pendingStdinLines,
      runningCodeBuffer,
      runningFileName,
      printedStdoutLen,
      executeOnBackendWithInput,
    ]
  );

  // Debug Current Script (Ctrl+F5) & Step Controls (F6, F7, F8, F9)
  const handleDebugCurrentScript = useCallback(() => {
    if (!activeTab) return;
    setShowShell(true);

    const execResult = executePythonScript(
      activeTab.content,
      activeTab.path,
      {}
    );

    const debugCmdEntry: ShellEntry = {
      id: `dbg-${Date.now()}`,
      type: "command",
      text: `%Debug ${activeTab.isUntitled ? "-c $EDITOR_CONTENT" : activeTab.title}`,
    };
    setShellEntries((prev) => [...prev, debugCmdEntry]);

    if (execResult.debugSteps.length === 0) {
      return;
    }

    setDebugSteps(execResult.debugSteps);
    setDebugStepIndex(0);
    const firstStep = execResult.debugSteps[0];
    setVariables(firstStep.variables);
  }, [activeTab]);

  const advanceDebugger = useCallback(
    (delta: number) => {
      if (debugStepIndex === -1 || debugSteps.length === 0) return;
      const nextIdx = debugStepIndex + delta;
      if (nextIdx >= debugSteps.length) {
        const lastStep = debugSteps[debugSteps.length - 1];
        if (lastStep.stdoutDelta) {
          setShellEntries((prev) => [
            ...prev,
            {
              id: `dbg-out-${Date.now()}`,
              type: "stdout",
              text: lastStep.stdoutDelta,
            },
          ]);
        }
        setVariables(lastStep.variables);
        setDebugSteps([]);
        setDebugStepIndex(-1);
      } else {
        const clamped = Math.max(0, nextIdx);
        setDebugStepIndex(clamped);
        const step = debugSteps[clamped];
        setVariables(step.variables);
      }
    },
    [debugStepIndex, debugSteps]
  );

  const handleStepOver = useCallback(() => advanceDebugger(1), [advanceDebugger]);
  const handleStepInto = useCallback(() => advanceDebugger(1), [advanceDebugger]);
  const handleStepOut = useCallback(() => advanceDebugger(2), [advanceDebugger]);
  const handleResumeDebug = useCallback(() => {
    if (debugSteps.length > 0) {
      advanceDebugger(debugSteps.length);
    }
  }, [advanceDebugger, debugSteps.length]);

  // Stop / Restart Command Hook (Ctrl+F2)
  const handleStopRestart = useCallback(() => {
    setDebugSteps([]);
    setDebugStepIndex(-1);
    setWaitingForInput(false);
    setRunningCodeBuffer("");
    setPendingStdinLines([]);
    setPrintedStdoutLen(0);
    setReplScope({});
    setVariables([]);
    setShellEntries((prev) => [
      ...prev,
      {
        id: `stop-${Date.now()}`,
        type: "header",
        text: "\nPython 3.14.4 (C:\\Users\\WIN 10 PRO\\AppData\\Local\\Programs\\Thonny\\python.exe)",
      },
    ]);
    requestAnimationFrame(() => {
      shellInputRef.current?.focus();
    });
  }, []);

  // Interactive REPL Command Evaluation
  const handleExecuteReplCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (trimmed === "clear" || trimmed === "cls") {
        setShellEntries([INITIAL_SHELL_HEADER]);
        return;
      }

      const cmdEntry: ShellEntry = {
        id: `repl-cmd-${Date.now()}`,
        type: "command",
        text: cmd,
      };

      if (!trimmed) {
        setShellEntries((prev) => [...prev, cmdEntry]);
        return;
      }

      const evalRes = evaluatePythonReplLine(cmd, replScope, replCommandCount);
      setReplCommandCount((c) => c + 1);
      setReplScope(evalRes.updatedScope);
      if (evalRes.variables.length > 0) {
        setVariables(evalRes.variables);
      }
      if (evalRes.plotterSeries.length > 0) {
        setPlotterSeries((prev) => [...prev, ...evalRes.plotterSeries]);
      }

      const outputEntries: ShellEntry[] = evalRes.outputLines.map((line, i) => ({
        id: `repl-out-${Date.now()}-${i}`,
        type: line.isError ? "stderr" : "stdout",
        text: line.text,
      }));

      setShellEntries((prev) => [...prev, cmdEntry, ...outputEntries]);
    },
    [replScope, replCommandCount]
  );

  // STEALTH INLINE CODING AGENT / RUN WITH AI (Alt+S / F4 / Ctrl+Shift+X / Run -> Run with AI)
  // Runs in background using gemini-3.8-flash, prints tiny "start" in Shell, copies student code to clipboard, prints tiny "finish"
  const handleTriggerStealthAgent = useCallback(() => {
    if (!activeTab) return;
    const { extractedPrompt } = extractStealthPromptFromPython(activeTab.content);
    const promptPayload = extractedPrompt || activeTab.content.trim();
    if (!promptPayload) return;
    runBackgroundStealth(promptPayload, activeTab.content);
  }, [activeTab, runBackgroundStealth]);

  // Global keyboard shortcuts so Ctrl+L / Alt+A (toggle Assistant) and Alt+S / F4 (Run with AI) work anywhere
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "l") ||
        (e.altKey && e.key.toLowerCase() === "a") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShowAssistant((prev) => !prev);
        return;
      }
      if (
        (e.altKey && e.key.toLowerCase() === "s") ||
        e.key === "F4" ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x")
      ) {
        e.preventDefault();
        handleTriggerStealthAgent();
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", onGlobalKeyDown, true);
  }, [handleTriggerStealthAgent]);

  // Clean Assistant Chat Handler (Same background flow: start -> gemini-3.8-flash -> auto-copy to clipboard -> finish)
  const handleSendChatMessage = useCallback(
    (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed) return;

      const userMsg: AssistantMessage = {
        id: `msg_${Date.now()}_u`,
        role: "user",
        text: trimmed,
        model: "gemini-3.8-flash",
      };
      const startStatusMsg: AssistantMessage = {
        id: `msg_${Date.now()}_start_${Math.random()}`,
        role: "status",
        text: "start",
      };

      const threadForApi = [
        ...assistantMessages.filter((m) => m.role !== "status"),
        userMsg,
      ];

      setAssistantMessages((prev) => [...prev, userMsg, startStatusMsg]);
      setShellEntries((prev) => [
        ...prev,
        {
          id: `ast-start-${Date.now()}-${Math.random()}`,
          type: "stealth_status",
          text: "start",
        },
      ]);

      if (currentUser) {
        saveCloudChatMessage(userMsg).catch(() => {});
      }

      const lastStderr =
        [...shellEntries].reverse().find((e) => e.type === "stderr")?.text || "";

      // Non-blocking background execution using gemini-3.8-flash
      (async () => {
        try {
          const res = await fetch("/api/gemini/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: threadForApi,
              model: "gemini-3.8-flash",
              highThinking: false,
              activeFileName: activeTab?.title || "<untitled>",
              activeCode: activeTab?.content || "",
              lastShellError: lastStderr,
            }),
          });
          const data = await res.json();
          const replyText = String(data.reply || data.error || "").trim();
          const extractedCode = String(data.code || "").trim();

          if (extractedCode) {
            await copyToClipboardGuaranteed(extractedCode);
          }

          const modelMsg: AssistantMessage = {
            id: `msg_${Date.now()}_m_${Math.random()}`,
            role: "model",
            text: replyText,
            model: "gemini-3.8-flash",
          };
          const finishStatusMsg: AssistantMessage = {
            id: `msg_${Date.now()}_finish_${Math.random()}`,
            role: "status",
            text: "finish",
          };

          setAssistantMessages((prev) => [...prev, modelMsg, finishStatusMsg]);
          setShellEntries((prev) => [
            ...prev,
            {
              id: `ast-finish-${Date.now()}-${Math.random()}`,
              type: "stealth_status",
              text: "finish",
            },
          ]);

          if (currentUser && replyText) {
            saveCloudChatMessage(modelMsg).catch(() => {});
          }
        } catch {
          setAssistantMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}_finish_err`,
              role: "status",
              text: "finish",
            },
          ]);
          setShellEntries((prev) => [
            ...prev,
            {
              id: `ast-finish-${Date.now()}-${Math.random()}`,
              type: "stealth_status",
              text: "finish",
            },
          ]);
        }
      })();
    },
    [assistantMessages, currentUser, shellEntries, activeTab, copyToClipboardGuaranteed]
  );

  const handleClearChatHistory = useCallback(async () => {
    const oldMessages = [...assistantMessages];
    setAssistantMessages([]);
    if (currentUser) {
      for (const m of oldMessages) {
        deleteCloudChatMessage(m.id).catch(() => {});
      }
    }
  }, [assistantMessages, currentUser]);

  const debugActiveLine =
    debugStepIndex >= 0 && debugSteps[debugStepIndex]
      ? debugSteps[debugStepIndex].line
      : null;

  const hasSideDock = showVariables || showAssistant;
  const hasBottomDock = showShell || showPlotter;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F0F0F0] text-[#000000] select-none overflow-hidden">
      {/* Native Menu Bar (Matches reference screenshot: File Edit View Run Tools Help on #FFFFFF) */}
      <nav
        aria-label="Main Menu Bar"
        onClick={(e) => e.stopPropagation()}
        className="relative flex items-center h-[24px] bg-[#FFFFFF] px-1 text-[12px] font-normal shrink-0 z-30"
      >
        {/* FILE MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "File" ? null : "File")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "File" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            File
          </button>
          {openMenu === "File" && (
            <div className="absolute left-0 top-full w-[210px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  handleNewTab();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>New</span>
                <span className="text-[#555555]">Ctrl+N</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal("open");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Open...</span>
                <span className="text-[#555555]">Ctrl+O</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCloseTab(activeTab.id);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Close</span>
                <span className="text-[#555555]">Ctrl+W</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  handleSaveCurrentTab();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Save</span>
                <span className="text-[#555555]">Ctrl+S</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal("save_as");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Save as...</span>
                <span className="text-[#555555]">Ctrl+Shift+S</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  handleStopRestart();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>

        {/* EDIT MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "Edit" ? null : "Edit")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "Edit" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            Edit
          </button>
          {openMenu === "Edit" && (
            <div className="absolute left-0 top-full w-[245px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand("undo");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Undo</span>
                <span className="text-[#555555]">Ctrl+Z</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand("redo");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Redo</span>
                <span className="text-[#555555]">Ctrl+Y</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand("cut");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Cut</span>
                <span className="text-[#555555]">Ctrl+X</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand("copy");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Copy</span>
                <span className="text-[#555555]">Ctrl+C</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  let clip = "";
                  try {
                    clip = await navigator.clipboard.readText();
                  } catch {
                    // fallback to internalClipboardRef
                  }
                  if (!clip && internalClipboardRef.current) {
                    clip = internalClipboardRef.current;
                  }
                  if (clip && activeTab) {
                    handleChangeEditorContent(activeTab.content + clip);
                  }
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Paste</span>
                <span className="text-[#555555]">Ctrl+V</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  textareaRef.current?.select();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Select all</span>
                <span className="text-[#555555]">Ctrl+A</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  if (activeTab) {
                    const el = textareaRef.current;
                    const res = togglePythonComment(
                      activeTab.content,
                      el?.selectionStart || 0,
                      el?.selectionEnd || 0
                    );
                    handleChangeEditorContent(res.newCode);
                  }
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Comment/Uncomment Out</span>
                <span className="text-[#555555]">Ctrl+3</span>
              </button>
            </div>
          )}
        </div>

        {/* VIEW MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "View" ? null : "View")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "View" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            View
          </button>
          {openMenu === "View" && (
            <div className="absolute left-0 top-full w-[195px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setShowToolbar((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-[#90C8F6]"
              >
                <span className="font-mono w-5">{showToolbar ? "[x]" : "[ ]"}</span>
                <span>Toolbar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShell((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-[#90C8F6]"
              >
                <span className="font-mono w-5">{showShell ? "[x]" : "[ ]"}</span>
                <span>Shell</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVariables((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-[#90C8F6]"
              >
                <span className="font-mono w-5">{showVariables ? "[x]" : "[ ]"}</span>
                <span>Variables</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAssistant((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center justify-between hover:bg-[#90C8F6]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono w-5">{showAssistant ? "[x]" : "[ ]"}</span>
                  <span>Assistant</span>
                </div>
                <span className="text-[#666666] text-[11px]">Ctrl+L</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPlotter((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-[#90C8F6]"
              >
                <span className="font-mono w-5">{showPlotter ? "[x]" : "[ ]"}</span>
                <span>Plotter</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  setShowLineNumbers((v) => !v);
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex items-center gap-2 hover:bg-[#90C8F6]"
              >
                <span className="font-mono w-5">{showLineNumbers ? "[x]" : "[ ]"}</span>
                <span>Line Numbers</span>
              </button>
            </div>
          )}
        </div>

        {/* RUN MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "Run" ? null : "Run")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "Run" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            Run
          </button>
          {openMenu === "Run" && (
            <div className="absolute left-0 top-full w-[225px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  handleRunCurrentScript();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Run current script</span>
                <span className="text-[#555555]">F5</span>
              </button>
              <button
                type="button"
                data-testid="menu-run-with-ai"
                onClick={() => {
                  handleTriggerStealthAgent();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Run with AI</span>
                <span className="text-[#555555]">Alt+S</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDebugCurrentScript();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Debug current script</span>
                <span className="text-[#555555]">Ctrl+F5</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  handleStepOver();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Step over</span>
                <span className="text-[#555555]">F6</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStepInto();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Step into</span>
                <span className="text-[#555555]">F7</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStepOut();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Step out</span>
                <span className="text-[#555555]">F8</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResumeDebug();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Resume</span>
                <span className="text-[#555555]">F9</span>
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  handleStopRestart();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left flex justify-between hover:bg-[#90C8F6]"
              >
                <span>Stop/Restart</span>
                <span className="text-[#555555]">Ctrl+F2</span>
              </button>
            </div>
          )}
        </div>

        {/* TOOLS MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "Tools" ? null : "Tools")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "Tools" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            Tools
          </button>
          {openMenu === "Tools" && (
            <div className="absolute left-0 top-full w-[225px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setActiveModal("packages");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Manage packages...
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  setFolderInfoPath("C:\\Users\\WIN 10 PRO\\AppData\\Local\\Programs\\Thonny");
                  setActiveModal("folder_info");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Open Thonny program folder...
              </button>
              <button
                type="button"
                onClick={() => {
                  setFolderInfoPath("C:\\Users\\WIN 10 PRO\\AppData\\Roaming\\Thonny");
                  setActiveModal("folder_info");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Open Thonny data folder...
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  setActiveModal("options");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Options...
              </button>
            </div>
          )}
        </div>

        {/* HELP MENU */}
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === "Help" ? null : "Help")}
            className={`h-full px-[8px] hover:bg-[#E5F3FF] ${
              openMenu === "Help" ? "bg-[#CCE8FF]" : ""
            }`}
          >
            Help
          </button>
          {openMenu === "Help" && (
            <div className="absolute left-0 top-full w-[170px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setActiveModal("help");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Help contents
              </button>
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  setActiveModal("about");
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                About Thonny
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Action Toolbar (Matches reference screenshot: #F0F0F0, 11 icons on left, zero extra buttons on right) */}
      {showToolbar && (
        <div
          role="toolbar"
          aria-label="Thonny Action Toolbar"
          className="flex items-center h-[34px] bg-[#F0F0F0] px-[9px] shrink-0"
        >
          <div className="flex items-center gap-[4px]">
            {/* 1. New */}
            <button
              type="button"
              aria-label="New (Ctrl+N)"
              title="New (Ctrl+N)"
              onClick={handleNewTab}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <NewFileIcon />
            </button>

            {/* 2. Open */}
            <button
              type="button"
              aria-label="Open... (Ctrl+O)"
              title="Open... (Ctrl+O)"
              onClick={() => setActiveModal("open")}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <OpenFolderIcon />
            </button>

            {/* 3. Save */}
            <button
              type="button"
              aria-label="Save (Ctrl+S)"
              title="Save (Ctrl+S)"
              onClick={handleSaveCurrentTab}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <SaveDiskIcon />
            </button>

            <div className="w-[10px]" />

            {/* 4. Run current script (F5) */}
            <button
              type="button"
              aria-label="Run current script (F5)"
              title="Run current script (F5)"
              onClick={handleRunCurrentScript}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <RunScriptIcon />
            </button>

            {/* 5. Debug current script (Ctrl+F5) */}
            <button
              type="button"
              aria-label="Debug current script (Ctrl+F5)"
              title="Debug current script (Ctrl+F5)"
              onClick={handleDebugCurrentScript}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <DebugScriptIcon />
            </button>

            <div className="w-[6px]" />

            {/* 6. Step over (F6) */}
            <button
              type="button"
              aria-label="Step over (F6)"
              title="Step over (F6)"
              onClick={handleStepOver}
              disabled={debugStepIndex === -1}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0] disabled:opacity-60"
            >
              <StepOverIcon />
            </button>

            {/* 7. Step into (F7) */}
            <button
              type="button"
              aria-label="Step into (F7)"
              title="Step into (F7)"
              onClick={handleStepInto}
              disabled={debugStepIndex === -1}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0] disabled:opacity-60"
            >
              <StepIntoIcon />
            </button>

            {/* 8. Step out (F8) */}
            <button
              type="button"
              aria-label="Step out (F8)"
              title="Step out (F8)"
              onClick={handleStepOut}
              disabled={debugStepIndex === -1}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0] disabled:opacity-60"
            >
              <StepOutIcon />
            </button>

            {/* 9. Resume (F9) */}
            <button
              type="button"
              aria-label="Resume (F9)"
              title="Resume (F9)"
              onClick={handleResumeDebug}
              disabled={debugStepIndex === -1}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0] disabled:opacity-60"
            >
              <ResumeIcon />
            </button>

            <div className="w-[8px]" />

            {/* 10. Stop/Restart (Ctrl+F2) */}
            <button
              type="button"
              aria-label="Stop/Restart backend (Ctrl+F2)"
              title="Stop/Restart backend (Ctrl+F2)"
              onClick={handleStopRestart}
              className="w-[26px] h-[26px] inline-flex items-center justify-center hover:bg-[#E0E0E0] active:bg-[#D0D0D0]"
            >
              <StopRestartIcon />
            </button>

            <div className="w-[10px]" />

            {/* 11. Thonny Flag Icon */}
            <span className="w-[26px] h-[26px] inline-flex items-center justify-center">
              <UkraineFlagIcon />
            </span>
          </div>
        </div>
      )}

      {/* Split-Pane Workspace */}
      <main
        ref={workspaceRef}
        className="flex flex-col md:flex-row flex-1 min-h-0 w-full bg-[#F0F0F0] overflow-hidden"
      >
        <div
          className={`flex flex-col min-w-0 ${
            hasSideDock
              ? "w-full h-[60%] md:h-full md:w-[70%]"
              : "w-full h-full"
          }`}
        >
          {/* Top Panel: Code Editor */}
          <div
            style={{
              height:
                hasBottomDock && !isZoomed ? `${editorHeightPct}%` : "100%",
            }}
            className="w-full min-h-[100px] overflow-hidden"
          >
            <CodeEditorPane
              tabs={tabs}
              activeTabId={activeTab.id}
              showLineNumbers={showLineNumbers}
              debugActiveLine={debugActiveLine}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              onChangeContent={handleChangeEditorContent}
              onCursorChange={setCursorCoords}
              onRunScript={handleRunCurrentScript}
              onDebugScript={handleDebugCurrentScript}
              onStepOver={handleStepOver}
              onStepInto={handleStepInto}
              onStepOut={handleStepOut}
              onResume={handleResumeDebug}
              onStopScript={handleStopRestart}
              onSaveScript={handleSaveCurrentTab}
              onTriggerStealthAgent={handleTriggerStealthAgent}
              onToggleAssistant={() => setShowAssistant((a) => !a)}
              textareaRef={textareaRef}
              internalClipboardRef={internalClipboardRef}
            />
          </div>

          {/* Draggable Horizontal Splitter Bar */}
          {hasBottomDock && !isZoomed && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize Editor and Shell panels"
              onMouseDown={() => {
                isDraggingSplitterRef.current = true;
                document.body.style.cursor = "row-resize";
              }}
              className="h-[6px] z-20 flex items-center justify-center cursor-row-resize shrink-0"
            />
          )}

          {/* Bottom Panel: Shell Component */}
          {hasBottomDock && !isZoomed && (
            <div
              style={{ height: `${100 - editorHeightPct}%` }}
              className="w-full min-h-[80px] overflow-hidden"
            >
              <ShellAndPlotterPane
                entries={shellEntries}
                showShell={showShell}
                showPlotter={showPlotter}
                waitingForInput={waitingForInput}
                plotterSeries={plotterSeries}
                onCloseShell={() => setShowShell(false)}
                onClosePlotter={() => setShowPlotter(false)}
                onExecuteReplCommand={handleExecuteReplCommand}
                onSubmitProgramStdin={handleSubmitProgramStdin}
                onClearShell={() => setShellEntries([INITIAL_SHELL_HEADER])}
                shellInputRef={shellInputRef}
              />
            </div>
          )}
        </div>

        {/* Right Dock Column (Only visible when Variables or Assistant is toggled via Ctrl+L / View menu) */}
        {hasSideDock && (
          <div className="w-full h-[40%] md:h-full md:w-[30%] md:min-w-[240px] overflow-hidden">
            <SideDockPanes
              showVariables={showVariables}
              showAssistant={showAssistant}
              variables={variables}
              assistantMessages={assistantMessages}
              onCloseVariables={() => setShowVariables(false)}
              onCloseAssistant={() => setShowAssistant(false)}
              onSendChatMessage={handleSendChatMessage}
              onClearChatHistory={handleClearChatHistory}
              onCopyCodeQuick={(code) => {
                copyToClipboardGuaranteed(code);
              }}
            />
          </div>
        )}
      </main>

      {/* Bottom Status Bar (Matches reference screenshot: clean #F0F0F0 bar with Local Python 3 • Thonny's Python ≡ on the right) */}
      <footer
        aria-label="Status Bar"
        onClick={(e) => e.stopPropagation()}
        className="relative flex items-center justify-end h-[22px] bg-[#F0F0F0] px-2 text-[12px] text-[#000000] shrink-0 select-none"
      >
        <div className="relative h-full flex items-center">
          <button
            type="button"
            aria-label="Switch Python Interpreter Environment"
            data-testid="status-env-dropdown-btn"
            onClick={() => setShowEnvDropdown((v) => !v)}
            className="h-full px-1.5 inline-flex items-center gap-1.5 hover:bg-[#E0E0E0] text-[#000000] whitespace-nowrap"
          >
            <span>{selectedInterpreter}</span>
            <Menu className="w-3.5 h-3.5 text-[#555555]" strokeWidth={1.8} />
          </button>

          {showEnvDropdown && (
            <div className="absolute right-0 bottom-full mb-[1px] w-[265px] bg-[#F0F0F0] border border-[#A0A0A0] shadow-md py-1 z-50">
              {ENVIRONMENT_PROFILES.map((profile) => (
                <button
                  key={profile}
                  type="button"
                  onClick={() => {
                    setSelectedInterpreter(profile);
                    setShowEnvDropdown(false);
                  }}
                  className={`w-full px-3 py-1 text-left flex items-center justify-between hover:bg-[#90C8F6] ${
                    selectedInterpreter === profile ? "font-semibold" : ""
                  }`}
                >
                  <span>{profile}</span>
                  {selectedInterpreter === profile && <span>•</span>}
                </button>
              ))}
              <div className="my-1 border-t border-[#D0D0D0]" />
              <button
                type="button"
                onClick={() => {
                  setShowEnvDropdown(false);
                  setActiveModal("options");
                }}
                className="w-full px-3 py-1 text-left hover:bg-[#90C8F6]"
              >
                Configure interpreter...
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Native Thonny Dialog Modals */}
      <ThonnyModals
        activeModal={activeModal}
        folderInfoPath={folderInfoPath}
        currentFileName={
          activeTab?.isUntitled ? "nghichngu.py" : activeTab?.title || "nghichngu.py"
        }
        cloudScripts={cloudScripts}
        isUserSignedIn={Boolean(currentUser)}
        selectedInterpreter={selectedInterpreter}
        showLineNumbers={showLineNumbers}
        onClose={() => setActiveModal(null)}
        onOpenSampleOrCloudScript={(title, filePath, content, cloudId) => {
          const cleaned = cleanStudentPythonCode(content);
          const existing = tabs.find(
            (t) => t.title === title || (cloudId && t.id === cloudId)
          );
          if (existing) {
            setActiveTabId(existing.id);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === existing.id
                  ? { ...t, content: cleaned, savedContent: cleaned, isUntitled: false }
                  : t
              )
            );
          } else {
            const newId = cloudId || `tab_${Date.now()}`;
            setTabs((prev) => [
              ...prev,
              {
                id: newId,
                title,
                path: filePath,
                content: cleaned,
                savedContent: cleaned,
                isUntitled: false,
                isCloudSynced: Boolean(cloudId),
              },
            ]);
            setActiveTabId(newId);
          }
        }}
        onDeleteCloudScript={(id) => {
          deleteCloudScript(id).catch(() => {});
        }}
        onSaveAsConfirm={handleSaveAsConfirm}
        onChangeInterpreter={(interp) => {
          setSelectedInterpreter(interp);
          if (interp.includes("argon")) setSelectedModel("gemini-4-argon");
        }}
        onToggleLineNumbers={setShowLineNumbers}
        onSignInGoogle={() => signInWithGoogle().catch(() => {})}
      />
    </div>
  );
}
