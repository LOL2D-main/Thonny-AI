import React, { useState } from "react";
import { X, Package, Check, Trash2, FolderOpen } from "lucide-react";
import { CloudScriptRecord } from "../firebase";

export type ModalType =
  | null
  | "open"
  | "save_as"
  | "packages"
  | "options"
  | "about"
  | "help"
  | "folder_info";

interface InstalledPackage {
  name: string;
  version: string;
  summary: string;
}

interface ThonnyModalsProps {
  activeModal: ModalType;
  folderInfoPath: string;
  currentFileName: string;
  cloudScripts: CloudScriptRecord[];
  isUserSignedIn: boolean;
  selectedInterpreter: string;
  showLineNumbers: boolean;
  onClose: () => void;
  onOpenSampleOrCloudScript: (title: string, path: string, content: string, id?: string) => void;
  onDeleteCloudScript: (id: string) => void;
  onSaveAsConfirm: (newFileName: string, newFilePath: string) => void;
  onChangeInterpreter: (interp: string) => void;
  onToggleLineNumbers: (show: boolean) => void;
  onSignInGoogle: () => void;
}

const SAMPLE_SCRIPTS = [
  {
    title: "fibonacci_plot.py",
    path: "C:\\Users\\User\\Thonny\\fibonacci_plot.py",
    content: `# Fibonacci sequence & numeric output for Thonny Plotter
def generate_fibonacci(count):
    a, b = 0, 1
    result = []
    for i in range(count):
        result.append(a)
        print(i, a)
        a, b = b, a + b
    return result

fib_numbers = generate_fibonacci(10)
print("Generated sequence:", fib_numbers)`,
  },
  {
    title: "dijkstra_stealth.py",
    path: "C:\\Users\\User\\Thonny\\dijkstra_stealth.py",
    content: `"""
Given a directed weighted graph with N vertices and edges,
compute the shortest path distances from vertex 1 using Dijkstra's algorithm.
"""
# Press Alt+S or click Stealth Solve in Assistant to synthesize pure Python code
edges = [(1, 2, 4), (1, 3, 1), (3, 2, 2), (2, 4, 1), (3, 4, 5)]
print("Edges loaded:", len(edges))`,
  },
  {
    title: "rainbow_brackets.py",
    path: "C:\\Users\\User\\Thonny\\rainbow_brackets.py",
    content: `# Demonstration of Rainbow Bracket Matching (Level 1 Yellow, Level 2 Orchid, Level 3 Cyan)
def compute_matrix_score(n):
    matrix = [[(i * j) + (i + j) for j in range(1, n + 1)] for i in range(1, n + 1)]
    row_sums = [sum(row) for row in matrix]
    print("Matrix:", matrix)
    print("Row sums:", row_sums)
    return sum(row_sums)

total_score = compute_matrix_score(4)
print("Total matrix score:", total_score)`,
  },
];

const INITIAL_PACKAGES: InstalledPackage[] = [
  { name: "pip", version: "23.0.1", summary: "The PyPA recommended tool for installing Python packages." },
  { name: "setuptools", version: "65.5.0", summary: "Easily download, build, install, upgrade, and uninstall Python packages." },
  { name: "wheel", version: "0.40.0", summary: "A built-package format for Python." },
  { name: "numpy", version: "1.26.4", summary: "Fundamental package for array computing in Python." },
];

const AVAILABLE_PYPI_PACKAGES: InstalledPackage[] = [
  { name: "matplotlib", version: "3.8.2", summary: "Python plotting package for 2D graphics." },
  { name: "requests", version: "2.31.0", summary: "Python HTTP for Humans." },
  { name: "scipy", version: "1.12.0", summary: "Fundamental algorithms for scientific computing in Python." },
  { name: "pandas", version: "2.2.0", summary: "Powerful data structures for data analysis and time series." },
  { name: "pytest", version: "8.0.0", summary: "Simple powerful testing with Python." },
];

export const ThonnyModals: React.FC<ThonnyModalsProps> = ({
  activeModal,
  folderInfoPath,
  currentFileName,
  cloudScripts,
  isUserSignedIn,
  selectedInterpreter,
  showLineNumbers,
  onClose,
  onOpenSampleOrCloudScript,
  onDeleteCloudScript,
  onSaveAsConfirm,
  onChangeInterpreter,
  onToggleLineNumbers,
  onSignInGoogle,
}) => {
  const [saveAsName, setSaveAsName] = useState(currentFileName || "script.py");
  const [pkgSearch, setPkgSearch] = useState("");
  const [installedPkgs, setInstalledPkgs] = useState<InstalledPackage[]>(INITIAL_PACKAGES);
  const [selectedPkg, setSelectedPkg] = useState<InstalledPackage>(INITIAL_PACKAGES[0]);
  const [optionsTab, setOptionsTab] = useState<"general" | "interpreter" | "editor">("interpreter");

  if (!activeModal) return null;

  const filteredAvailablePkgs = AVAILABLE_PYPI_PACKAGES.filter(
    (p) =>
      p.name.toLowerCase().includes(pkgSearch.toLowerCase()) ||
      p.summary.toLowerCase().includes(pkgSearch.toLowerCase())
  );

  const isPkgInstalled = (name: string) =>
    installedPkgs.some((p) => p.name === name);

  const handleInstallPkg = (pkg: InstalledPackage) => {
    if (!isPkgInstalled(pkg.name)) {
      setInstalledPkgs((prev) => [...prev, pkg]);
      setSelectedPkg(pkg);
    }
  };

  const handleUninstallPkg = (name: string) => {
    setInstalledPkgs((prev) => prev.filter((p) => p.name !== name));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 select-none"
    >
      <div className="bg-[#F0F0F0] border border-[#707070] shadow-md w-[540px] max-w-[95vw] text-[12px] text-[#000000]">
        {/* Native Windows Dialog Title Bar */}
        <div className="flex items-center justify-between bg-[#FFFFFF] border-b border-[#D0D0D0] px-2.5 h-[28px]">
          <span className="font-normal text-[12px] text-[#000000]">
            {activeModal === "open" && "Open Python File"}
            {activeModal === "save_as" && "Save As"}
            {activeModal === "packages" && "Manage packages for Local Python 3.10"}
            {activeModal === "options" && "Thonny options"}
            {activeModal === "about" && "About Thonny"}
            {activeModal === "help" && "Thonny Help & Stealth Agent Shortcuts"}
            {activeModal === "folder_info" && "Thonny Directory"}
          </span>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="w-6 h-6 inline-flex items-center justify-center text-[#333333] hover:bg-[#E81123] hover:text-[#FFFFFF]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3">
          {activeModal === "open" && (
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-[#222222] mb-1">
                  Built-in Thonny Examples:
                </div>
                <div className="bg-[#FFFFFF] border border-[#C0C0C0] divide-y divide-[#EBEBEB] max-h-[140px] overflow-y-auto">
                  {SAMPLE_SCRIPTS.map((s) => (
                    <div
                      key={s.title}
                      className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#E8F0FE]"
                    >
                      <div>
                        <div className="font-mono text-[12px] text-[#000080]">
                          {s.title}
                        </div>
                        <div className="text-[11px] text-[#666666]">{s.path}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSampleOrCloudScript(s.title, s.path, s.content);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#A0A0A0] text-[11px]"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#222222]">
                    Cloud Workspace Scripts (Firestore):
                  </span>
                  {!isUserSignedIn && (
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="text-[11px] text-[#0000FF] underline"
                    >
                      Sign in with Google to sync
                    </button>
                  )}
                </div>
                <div className="bg-[#FFFFFF] border border-[#C0C0C0] divide-y divide-[#EBEBEB] max-h-[140px] overflow-y-auto">
                  {cloudScripts.length === 0 ? (
                    <div className="p-3 text-[#666666] text-center italic">
                      {isUserSignedIn
                        ? "No cloud scripts saved yet. Press Ctrl+S or click Save on the toolbar."
                        : "Sign in with Google to load your personal cloud scripts."}
                    </div>
                  ) : (
                    cloudScripts.map((cs) => (
                      <div
                        key={cs.id}
                        className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[#E8F0FE]"
                      >
                        <div>
                          <div className="font-mono text-[12px] text-[#000080]">
                            {cs.title}
                          </div>
                          <div className="text-[11px] text-[#666666]">{cs.path}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenSampleOrCloudScript(
                                cs.title,
                                cs.path,
                                cs.content,
                                cs.id
                              );
                              onClose();
                            }}
                            className="px-2.5 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#A0A0A0] text-[11px]"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${cs.title}`}
                            onClick={() => onDeleteCloudScript(cs.id)}
                            className="p-1 text-[#D32F2F] hover:bg-[#FFEBEE] border border-transparent hover:border-[#FFCDD2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeModal === "save_as" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = saveAsName.trim() || "script.py";
                const finalName = clean.endsWith(".py") || clean.endsWith(".cpp") ? clean : `${clean}.py`;
                onSaveAsConfirm(
                  finalName,
                  `C:\\Users\\User\\Thonny\\${finalName}`
                );
                onClose();
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="save-as-input"
                  className="block text-[#222222] mb-1"
                >
                  File name:
                </label>
                <input
                  id="save-as-input"
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#A0A0A0] px-2 py-1 font-mono text-[12px] outline-none focus:border-[#000080]"
                />
              </div>
              <div className="text-[11px] text-[#555555]">
                Target path:{" "}
                <span className="font-mono">
                  C:\Users\User\Thonny\{saveAsName.trim() || "script.py"}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#D0D0D0]">
                <button
                  type="submit"
                  className="px-4 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#888888] font-semibold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#A0A0A0]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {activeModal === "packages" && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Search PyPI packages"
                  placeholder="Filter or search packages on PyPI..."
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  className="flex-1 bg-[#FFFFFF] border border-[#A0A0A0] px-2 py-1 text-[12px] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 h-[210px]">
                {/* Installed & Available List */}
                <div className="bg-[#FFFFFF] border border-[#C0C0C0] overflow-y-auto divide-y divide-[#F0F0F0]">
                  <div className="px-2 py-1 bg-[#F5F5F5] text-[11px] font-semibold text-[#444444]">
                    Installed Packages ({installedPkgs.length})
                  </div>
                  {installedPkgs.map((pkg) => (
                    <button
                      key={pkg.name}
                      type="button"
                      onClick={() => setSelectedPkg(pkg)}
                      className={`w-full text-left px-2 py-1 flex items-center justify-between text-[12px] ${
                        selectedPkg.name === pkg.name
                          ? "bg-[#CCE8FF]"
                          : "hover:bg-[#F5F5F5]"
                      }`}
                    >
                      <span className="font-mono">{pkg.name}</span>
                      <span className="text-[11px] text-[#666666] tabular-nums">
                        {pkg.version}
                      </span>
                    </button>
                  ))}

                  <div className="px-2 py-1 bg-[#F5F5F5] text-[11px] font-semibold text-[#444444]">
                    Available from PyPI
                  </div>
                  {filteredAvailablePkgs.map((pkg) => (
                    <button
                      key={pkg.name}
                      type="button"
                      onClick={() => setSelectedPkg(pkg)}
                      className={`w-full text-left px-2 py-1 flex items-center justify-between text-[12px] ${
                        selectedPkg.name === pkg.name
                          ? "bg-[#CCE8FF]"
                          : "hover:bg-[#F5F5F5]"
                      }`}
                    >
                      <span className="font-mono text-[#000080]">{pkg.name}</span>
                      <span className="text-[11px] text-[#666666] tabular-nums">
                        {pkg.version}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Package Details */}
                <div className="bg-[#FFFFFF] border border-[#C0C0C0] p-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-[13px] text-[#000080] mb-1">
                      <Package className="w-4 h-4" />
                      <span>{selectedPkg.name}</span>
                    </div>
                    <div className="text-[11px] text-[#555555] mb-2 tabular-nums">
                      Latest stable version: <strong>{selectedPkg.version}</strong>
                    </div>
                    <p className="text-[12px] text-[#222222] leading-relaxed">
                      {selectedPkg.summary}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#EBEBEB] flex items-center justify-between">
                    {isPkgInstalled(selectedPkg.name) ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#2E7D32] font-semibold">
                          <Check className="w-3.5 h-3.5" /> Installed
                        </span>
                        {selectedPkg.name !== "pip" && (
                          <button
                            type="button"
                            onClick={() => handleUninstallPkg(selectedPkg.name)}
                            className="px-2.5 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#A0A0A0] text-[11px]"
                          >
                            Uninstall
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallPkg(selectedPkg)}
                        className="w-full py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#888888] font-semibold text-[11px]"
                      >
                        Install {selectedPkg.name}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModal === "options" && (
            <div className="space-y-3">
              <div className="flex border-b border-[#C0C0C0] bg-[#E8E8E8] px-1 pt-1">
                {(["general", "interpreter", "editor"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setOptionsTab(tab)}
                    className={`px-3 py-1 text-[12px] capitalize border-t border-l border-r border-[#C0C0C0] mr-1 ${
                      optionsTab === tab
                        ? "bg-[#F0F0F0] font-semibold -mb-[1px]"
                        : "bg-[#DCDCDC] text-[#444444]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {optionsTab === "interpreter" && (
                <div className="space-y-2.5 p-1">
                  <label
                    htmlFor="options-interp-select"
                    className="block text-[#222222]"
                  >
                    Which interpreter or device should Thonny use for running your code?
                  </label>
                  <select
                    id="options-interp-select"
                    value={selectedInterpreter}
                    onChange={(e) => onChangeInterpreter(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#A0A0A0] px-2 py-1 text-[12px]"
                  >
                    <option value="Local Python 3.10 • Thonny's Python">
                      Local Python 3.10 • Thonny&apos;s Python (Default)
                    </option>
                    <option value="Local Python 3.11 (venv)">
                      Alternative Python 3 interpreter or virtual environment
                    </option>
                    <option value="MicroPython (Raspberry Pi Pico)">
                      MicroPython (Raspberry Pi Pico)
                    </option>
                    <option value="Remote Python 3 (SSH)">
                      Remote Python 3 (SSH)
                    </option>
                  </select>
                  <div className="text-[11px] text-[#555555] bg-[#FFFFFF] border border-[#D0D0D0] p-2 font-mono">
                    Executable: C:\Program Files (x86)\Thonny\python.exe (3.10.11)
                  </div>
                </div>
              )}

              {optionsTab === "editor" && (
                <div className="space-y-2 p-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLineNumbers}
                      onChange={(e) => onToggleLineNumbers(e.target.checked)}
                    />
                    <span>Show line numbers (Left gutter #F5F5F5)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked readOnly />
                    <span>Enable Rainbow Bracket Matching (Yellow / Orchid / Cyan)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked readOnly />
                    <span>Highlight matching names and Python keywords (#0000FF)</span>
                  </label>
                </div>
              )}

              {optionsTab === "general" && (
                <div className="space-y-2 p-1 text-[12px]">
                  <div>UI Mode: Regular Mode (Classic Windows Desktop Layout)</div>
                  <div>Font Scaling: Standard 11px/12px System UI, 13px Consolas Editor</div>
                  <div>Stealth Inline Agent Hotkey: Alt+S / Ctrl+Shift+X</div>
                </div>
              )}
            </div>
          )}

          {activeModal === "about" && (
            <div className="space-y-2.5 text-center py-2">
              <div className="font-bold text-[15px] text-[#000080]">
                Thonny 4.1.4 (Windows Desktop Edition)
              </div>
              <div className="text-[12px] text-[#333333]">
                Python IDE for beginners and competitive programmers
              </div>
              <div className="font-mono text-[11px] bg-[#FFFFFF] border border-[#D0D0D0] p-2 text-left">
                <div>Python 3.10.11 (64-bit) • Tk 8.6.12</div>
                <div>Gemini Intelligence: gemini-4-argon (ThinkingLevel.HIGH)</div>
                <div>Cloud Persistence: Firebase Auth + Firestore Sync</div>
              </div>
            </div>
          )}

          {activeModal === "help" && (
            <div className="space-y-2 text-[12px] leading-relaxed">
              <div className="font-semibold text-[#000080]">
                Keyboard Shortcuts &amp; Stealth Coding Workflow
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[#222222]">
                <li>
                  <strong>F5</strong>: Run current script in the interactive Shell (
                  <code className="font-mono">&gt;&gt;&gt; %Run script.py</code>).
                </li>
                <li>
                  <strong>Ctrl+F5</strong>: Debug current script line-by-line (use{" "}
                  <strong>F6</strong> Step Over, <strong>F7</strong> Step Into,{" "}
                  <strong>F8</strong> Step Out, <strong>F9</strong> Resume).
                </li>
                <li>
                  <strong>Ctrl+F2</strong>: Stop/Restart backend and reset Shell prompt.
                </li>
                <li>
                  <strong>Ctrl+3</strong>: Comment / Uncomment selected editor lines.
                </li>
                <li>
                  <strong>Alt+S</strong> (or <strong>Ctrl+Shift+X</strong>): Trigger{" "}
                  <strong>Stealth Inline Coding Agent</strong>. Extracts the problem statement from{" "}
                  <code className="font-mono"># comments</code> or{" "}
                  <code className="font-mono">&quot;&quot;&quot; docstrings &quot;&quot;&quot;</code> and outputs pure, executable Python 3 code directly into the editor &amp; clipboard.
                </li>
              </ul>
            </div>
          )}

          {activeModal === "folder_info" && (
            <div className="flex items-center gap-2.5 bg-[#FFFFFF] border border-[#C0C0C0] p-3">
              <FolderOpen className="w-5 h-5 text-[#FBC02D] shrink-0" />
              <div>
                <div className="text-[11px] text-[#666666]">Local Directory Path:</div>
                <div className="font-mono text-[12px] text-[#000000]">
                  {folderInfoPath}
                </div>
              </div>
            </div>
          )}

          {/* Footer Close Button for non-save_as modals */}
          {activeModal !== "save_as" && (
            <div className="flex justify-end pt-3 mt-3 border-t border-[#D0D0D0]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1 bg-[#E0E0E0] hover:bg-[#D0D0D0] border border-[#888888] text-[12px]"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
