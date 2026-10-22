export type TokenType =
  | "keyword"
  | "builtin"
  | "string"
  | "comment"
  | "bracket-1"
  | "bracket-2"
  | "bracket-3"
  | "text";

export interface CodeToken {
  type: TokenType;
  value: string;
}

export const PYTHON_KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

export const PYTHON_BUILTINS = new Set([
  "abs",
  "all",
  "any",
  "ascii",
  "bin",
  "bool",
  "bytearray",
  "bytes",
  "callable",
  "chr",
  "classmethod",
  "compile",
  "complex",
  "delattr",
  "dict",
  "dir",
  "divmod",
  "enumerate",
  "eval",
  "exec",
  "filter",
  "float",
  "format",
  "frozenset",
  "getattr",
  "globals",
  "hasattr",
  "hash",
  "help",
  "hex",
  "id",
  "input",
  "int",
  "isinstance",
  "issubclass",
  "iter",
  "len",
  "list",
  "locals",
  "map",
  "max",
  "memoryview",
  "min",
  "next",
  "object",
  "oct",
  "open",
  "ord",
  "pow",
  "print",
  "property",
  "range",
  "repr",
  "reversed",
  "round",
  "set",
  "setattr",
  "slice",
  "sorted",
  "staticmethod",
  "str",
  "sum",
  "super",
  "tuple",
  "type",
  "vars",
  "zip",
  "Exception",
  "ValueError",
  "TypeError",
  "KeyError",
  "IndexError",
  "ZeroDivisionError",
  "NameError",
]);

const OPEN_BRACKETS = new Set(["(", "[", "{"]);
const CLOSE_BRACKETS = new Set([")", "]", "}"]);

export function getBracketTokenType(depth: number): "bracket-1" | "bracket-2" | "bracket-3" {
  const normalized = ((depth % 3) + 3) % 3;
  if (normalized === 0) return "bracket-1"; // #FFD700 Yellow
  if (normalized === 1) return "bracket-2"; // #DA70D6 Orchid
  return "bracket-3"; // #17A2B8 Cyan
}

/**
 * Tokenizes an entire multi-line Python source string into an array of lines of CodeTokens,
 * maintaining nested rainbow bracket depth and multi-line triple-quoted string state across lines.
 */
export function tokenizePythonCode(code: string): CodeToken[][] {
  const lines = code.split("\n");
  const result: CodeToken[][] = [];
  let bracketDepth = 0;
  let inTripleString: '"""' | "'''" | null = null;

  for (const line of lines) {
    const lineTokens: CodeToken[] = [];
    let i = 0;
    const n = line.length;

    while (i < n) {
      // Handle ongoing multi-line triple-quoted string
      if (inTripleString) {
        const closeIdx = line.indexOf(inTripleString, i);
        if (closeIdx === -1) {
          lineTokens.push({ type: "string", value: line.slice(i) });
          i = n;
        } else {
          lineTokens.push({
            type: "string",
            value: line.slice(i, closeIdx + 3),
          });
          i = closeIdx + 3;
          inTripleString = null;
        }
        continue;
      }

      const ch = line[i];

      // 1. Comment (# to end of line)
      if (ch === "#") {
        lineTokens.push({ type: "comment", value: line.slice(i) });
        break;
      }

      // 2. String prefix (f"...", r'...', etc.) or direct string
      const nextTwo = line.slice(i, i + 2);
      const isPrefixedString =
        /^[fFrRbBuU]$/.test(ch) && (line[i + 1] === '"' || line[i + 1] === "'");

      if (ch === '"' || ch === "'" || isPrefixedString) {
        const prefixLen = isPrefixedString ? 1 : 0;
        const quoteChar = line[i + prefixLen];
        const maybeTriple = line.slice(i + prefixLen, i + prefixLen + 3);

        if (maybeTriple === '"""' || maybeTriple === "'''") {
          const tripleDelim = maybeTriple as '"""' | "'''";
          const closeIdx = line.indexOf(tripleDelim, i + prefixLen + 3);
          if (closeIdx === -1) {
            lineTokens.push({ type: "string", value: line.slice(i) });
            inTripleString = tripleDelim;
            i = n;
          } else {
            lineTokens.push({
              type: "string",
              value: line.slice(i, closeIdx + 3),
            });
            i = closeIdx + 3;
          }
          continue;
        } else {
          let j = i + prefixLen + 1;
          while (j < n) {
            if (line[j] === "\\") {
              j += 2;
              continue;
            }
            if (line[j] === quoteChar) {
              j++;
              break;
            }
            j++;
          }
          lineTokens.push({ type: "string", value: line.slice(i, j) });
          i = j;
          continue;
        }
      }

      // 3. Rainbow Brackets (), [], {}
      if (OPEN_BRACKETS.has(ch)) {
        const tokenType = getBracketTokenType(bracketDepth);
        bracketDepth++;
        lineTokens.push({ type: tokenType, value: ch });
        i++;
        continue;
      }

      if (CLOSE_BRACKETS.has(ch)) {
        bracketDepth = Math.max(0, bracketDepth - 1);
        const tokenType = getBracketTokenType(bracketDepth);
        lineTokens.push({ type: tokenType, value: ch });
        i++;
        continue;
      }

      // 4. Identifiers, Keywords, Built-in Functions
      if (/[a-zA-Z_]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[a-zA-Z0-9_]/.test(line[j])) {
          j++;
        }
        const word = line.slice(i, j);
        let type: TokenType = "text";
        if (PYTHON_KEYWORDS.has(word)) {
          type = "keyword";
        } else if (PYTHON_BUILTINS.has(word)) {
          type = "builtin";
        }
        lineTokens.push({ type, value: word });
        i = j;
        continue;
      }

      // 5. Any other character (whitespace, numbers, operators, punctuation)
      let j = i + 1;
      while (
        j < n &&
        line[j] !== "#" &&
        line[j] !== '"' &&
        line[j] !== "'" &&
        !OPEN_BRACKETS.has(line[j]) &&
        !CLOSE_BRACKETS.has(line[j]) &&
        !/[a-zA-Z_]/.test(line[j])
      ) {
        j++;
      }
      lineTokens.push({ type: "text", value: line.slice(i, j) });
      i = j;
    }

    result.push(lineTokens);
  }

  return result;
}

/**
 * Formats Thonny's strict window title bar string:
 * [File Name] * - [Absolute File Path] - Thonny (Asterisk * appears ONLY if unsaved)
 */
export function formatThonnyTitleBar(
  fileName: string,
  filePath: string,
  isDirty: boolean
): string {
  const dirtyMarker = isDirty ? " *" : "";
  return `${fileName}${dirtyMarker} - ${filePath} - Thonny`;
}

/**
 * Computes 1-indexed Line and Col coordinates from text and cursor index.
 */
export function computeCursorCoordinates(
  text: string,
  selectionStart: number
): { line: number; col: number; formatted: string } {
  const clamped = Math.max(0, Math.min(selectionStart, text.length));
  const before = text.slice(0, clamped);
  const lines = before.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return {
    line,
    col,
    formatted: `Line ${line} : Col ${col}`,
  };
}

/**
 * Implements Edit -> Comment/Uncomment Out (Ctrl+3) in Thonny.
 */
export function togglePythonComment(
  code: string,
  selectionStart: number,
  selectionEnd: number
): { newCode: string; newSelectionStart: number; newSelectionEnd: number } {
  const lines = code.split("\n");
  const startCoord = computeCursorCoordinates(code, selectionStart);
  const endCoord = computeCursorCoordinates(code, selectionEnd);
  const startLineIdx = startCoord.line - 1;
  const endLineIdx = endCoord.line - 1;

  const targetLines = lines.slice(startLineIdx, endLineIdx + 1);
  const allCommented = targetLines.every((l) => l.trimStart().startsWith("#"));

  const updatedLines = lines.map((line, idx) => {
    if (idx < startLineIdx || idx > endLineIdx) return line;
    if (allCommented) {
      return line.replace(/^(\s*)#\s?/, "$1");
    } else {
      return `# ${line}`;
    }
  });

  const newCode = updatedLines.join("\n");
  return {
    newCode,
    newSelectionStart: selectionStart,
    newSelectionEnd: Math.min(newCode.length, selectionEnd + (newCode.length - code.length)),
  };
}

/**
 * Extracts technical programming tasks hidden inside Python single-line comments (# [Prompt])
 * or block docstrings (""" [Complex Problem Statement] """), ignoring surrounding Python code.
 */
export function extractStealthPromptFromPython(code: string): {
  extractedPrompt: string;
  targetLanguage: "python" | "cpp";
  hasDocstringPrompt: boolean;
} {
  const extractedParts: string[] = [];
  let hasDocstringPrompt = false;

  // 1. Extract block docstrings """ ... """ or ''' ... '''
  const docstringRegex = /("""[\s\S]*?"""|'''[\s\S]*?''')/g;
  let match: RegExpExecArray | null;
  while ((match = docstringRegex.exec(code)) !== null) {
    const inner = match[0].slice(3, -3).trim();
    if (inner) {
      extractedParts.push(inner);
      hasDocstringPrompt = true;
    }
  }

  // Handle unclosed """ or ''' if user forgot closing quotes
  if (!hasDocstringPrompt && (code.includes('"""') || code.includes("'''"))) {
    const delim = code.includes('"""') ? '"""' : "'''";
    const idx = code.indexOf(delim);
    const after = code.slice(idx + 3).trim();
    if (after) {
      extractedParts.push(after);
      hasDocstringPrompt = true;
    }
  }

  // 2. Extract single-line comments # ...
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      const commentBody = trimmed.replace(/^#+\s*/, "").trim();
      if (commentBody && !commentBody.startsWith("!")) {
        extractedParts.push(commentBody);
      }
    } else {
      const hashIdx = line.indexOf("#");
      if (hashIdx !== -1) {
        const beforeHash = line.slice(0, hashIdx);
        const quoteCount = (beforeHash.match(/["']/g) || []).length;
        if (quoteCount % 2 === 0) {
          const inlineComment = line.slice(hashIdx + 1).trim();
          if (inlineComment) {
            extractedParts.push(inlineComment);
          }
        }
      }
    }
  }

  const combined = extractedParts.join("\n").trim();
  const lower = combined.toLowerCase();
  const wantsCpp =
    lower.includes("viết bằng c++") ||
    lower.includes("viet bang c++") ||
    lower.includes("use c++") ||
    lower.includes("in c++");

  return {
    extractedPrompt: combined,
    targetLanguage: wantsCpp ? "cpp" : "python",
    hasDocstringPrompt,
  };
}

/**
 * Cleans generated Python code so it looks 100% like student-written code:
 * - Strips markdown fences
 * - Removes all # comments (outside quotes) and """ docstrings """
 * - Removes if __name__ == "__main__": boilerplate unindenting its body
 */
export function cleanStudentPythonCode(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:python|py|cpp|c\+\+)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    text = text.replace(/^```[a-zA-Z0-9_+]*\s*\n?/i, "");
    text = text.replace(/\n?```\s*$/i, "");
  }

  text = text.replace(/"""[\s\S]*?"""/g, "");
  text = text.replace(/'''[\s\S]*?'''/g, "");

  const lines = text.split("\n");
  const strippedLines: string[] = [];
  let unindentMain = false;

  for (const rawLine of lines) {
    let line = rawLine;
    let inQuote: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if ((ch === '"' || ch === "'") && line[i - 1] !== "\\") {
        if (!inQuote) inQuote = ch;
        else if (inQuote === ch) inQuote = null;
      } else if (ch === "#" && !inQuote) {
        line = line.slice(0, i);
        break;
      }
    }

    const rtrimmed = line.replace(/\s+$/, "");
    if (/^if\s+__name__\s*==\s*['"]__main__['"]\s*:$/.test(rtrimmed.trim())) {
      unindentMain = true;
      continue;
    }

    if (unindentMain && rtrimmed.startsWith("    ")) {
      strippedLines.push(rtrimmed.slice(4));
    } else {
      strippedLines.push(rtrimmed);
    }
  }

  const finalLines: string[] = [];
  for (const l of strippedLines) {
    if (l.trim() === "" && (finalLines.length === 0 || finalLines[finalLines.length - 1].trim() === "")) {
      continue;
    }
    finalLines.push(l);
  }

  while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === "") {
    finalLines.pop();
  }

  return finalLines.join("\n");
}

export interface PythonVariableInfo {
  name: string;
  value: string;
  type: string;
}

export interface PythonDebugStep {
  line: number;
  statement: string;
  stdoutDelta: string;
  variables: PythonVariableInfo[];
}

export interface PythonExecutionResult {
  stdout: string[];
  stderr: string | null;
  variables: PythonVariableInfo[];
  plotterSeries: number[][];
  debugSteps: PythonDebugStep[];
}

function formatPythonValue(val: any): string {
  if (val === null || val === undefined) return "None";
  if (typeof val === "boolean") return val ? "True" : "False";
  if (typeof val === "string") return `'${val}'`;
  if (Array.isArray(val)) return `[${val.map(formatPythonValue).join(", ")}]`;
  if (typeof val === "object") {
    const entries = Object.entries(val).map(
      ([k, v]) => `'${k}': ${formatPythonValue(v)}`
    );
    return `{${entries.join(", ")}}`;
  }
  return String(val);
}

function formatPythonPrintValue(val: any): string {
  if (val === null || val === undefined) return "None";
  if (typeof val === "boolean") return val ? "True" : "False";
  if (typeof val === "string") return val;
  return formatPythonValue(val);
}

function getPythonTypeName(val: any): string {
  if (val === null || val === undefined) return "NoneType";
  if (typeof val === "boolean") return "bool";
  if (typeof val === "number") return Number.isInteger(val) ? "int" : "float";
  if (typeof val === "string") return "str";
  if (Array.isArray(val)) return "list";
  if (typeof val === "function") return "function";
  if (typeof val === "object") return "dict";
  return "object";
}

/**
 * Translates common Python syntax idioms into executable JS statements within a controlled sandbox
 * so loops, functions, list comprehensions, f-strings, print(), range(), len(), etc. run genuinely in the browser.
 */
function transpilePythonToJs(pythonCode: string): { jsCode: string; lineMap: number[] } {
  const rawLines = pythonCode.replace(/\r\n/g, "\n").split("\n");
  const jsLines: string[] = [];
  const indentStack: number[] = [0];
  let inTripleQuote: string | null = null;

  const transformExpr = (expr: string): string => {
    let e = expr.trim();
    // Convert Python f-strings f"hello {x}" -> `hello ${__pyFormat(x)}`
    e = e.replace(/\bf"([^"]*)"/g, (_m, inner) => {
      const templ = inner.replace(/\{([^}]+)\}/g, "${__pyStr($1)}");
      return "`" + templ + "`";
    });
    e = e.replace(/\bf'([^']*)'/g, (_m, inner) => {
      const templ = inner.replace(/\{([^}]+)\}/g, "${__pyStr($1)}");
      return "`" + templ + "`";
    });

    // Convert simple list comprehension: [expr for var in iterable if cond] or [expr for var in iterable]
    e = e.replace(
      /\[\s*([^\[\]]+?)\s+for\s+([a-zA-Z_]\w*)\s+in\s+([^\[\]]+?)\s+if\s+([^\[\]]+?)\s*\]/g,
      "(__pyList($3).filter(($2) => ($4)).map(($2) => ($1)))"
    );
    e = e.replace(
      /\[\s*([^\[\]]+?)\s+for\s+([a-zA-Z_]\w*)\s+in\s+([^\[\]]+?)\s*\]/g,
      "(__pyList($3).map(($2) => ($1)))"
    );

    // Replace Python booleans & logical operators outside strings
    e = e
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      .replace(/\band\b/g, "&&")
      .replace(/\bor\b/g, "||")
      .replace(/\bnot\s+/g, "!")
      .replace(/\/\//g, "__INTDIV__");

    // Handle a // b integer division
    while (e.includes("__INTDIV__")) {
      e = e.replace(
        /([a-zA-Z0-9_)\]]+)\s*__INTDIV__\s*([a-zA-Z0-9_(\[]+)/,
        "Math.floor(($1) / ($2))"
      );
      if (e.includes("__INTDIV__")) {
        e = e.replace("__INTDIV__", "/");
      }
    }

    // Method mappings: .append(x) -> .push(x), .strip() -> .trim(), .upper() -> .toUpperCase(), .lower() -> .toLowerCase()
    e = e
      .replace(/\.append\(/g, ".push(")
      .replace(/\.strip\(\)/g, ".trim()")
      .replace(/\.upper\(\)/g, ".toUpperCase()")
      .replace(/\.lower\(\)/g, ".toLowerCase()");

    return e;
  };

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNum = idx + 1;
    const rawLine = rawLines[idx];

    // Handle multi-line docstrings
    if (inTripleQuote) {
      if (rawLine.includes(inTripleQuote)) {
        inTripleQuote = null;
      }
      continue;
    }
    const trimmedStart = rawLine.trimStart();
    if (trimmedStart.startsWith('"""') || trimmedStart.startsWith("'''")) {
      const delim = trimmedStart.slice(0, 3);
      const rest = trimmedStart.slice(3);
      if (!rest.includes(delim)) {
        inTripleQuote = delim;
      }
      continue;
    }

    // Strip comments (outside quotes)
    let codePart = rawLine;
    let inStr: string | null = null;
    for (let c = 0; c < rawLine.length; c++) {
      const ch = rawLine[c];
      if ((ch === '"' || ch === "'") && rawLine[c - 1] !== "\\") {
        if (!inStr) inStr = ch;
        else if (inStr === ch) inStr = null;
      } else if (ch === "#" && !inStr) {
        codePart = rawLine.slice(0, c);
        break;
      }
    }

    if (!codePart.trim()) continue;

    const indent = codePart.length - codePart.trimStart().length;
    let stmt = codePart.trim();

    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      jsLines.push("}");
    }

    // Ignore import statements (handled by built-in runtime scope)
    if (/^(import|from)\s+/.test(stmt)) {
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      continue;
    }

    if (stmt === "pass") {
      jsLines.push(`__recordStep(${lineNum}, "pass");`);
      continue;
    }

    // if __name__ == "__main__":
    if (/^if\s+__name__\s*==\s*['"]__main__['"]\s*:$/.test(stmt)) {
      jsLines.push(`if (true) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // def func(args):
    const defMatch = stmt.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*)\)\s*:$/);
    if (defMatch) {
      const fnName = defMatch[1];
      const args = defMatch[2];
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      jsLines.push(`function ${fnName}(${args}) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // elif cond:
    const elifMatch = stmt.match(/^elif\s+(.*):$/);
    if (elifMatch) {
      // Replace the just-closed `}` before elif
      if (jsLines[jsLines.length - 1] === "}") {
        jsLines.pop();
      }
      jsLines.push(`} else if (${transformExpr(elifMatch[1])}) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // else:
    if (/^else\s*:$/.test(stmt)) {
      if (jsLines[jsLines.length - 1] === "}") {
        jsLines.pop();
      }
      jsLines.push(`} else {`);
      indentStack.push(indent + 1);
      continue;
    }

    // if cond:
    const ifMatch = stmt.match(/^if\s+(.*):$/);
    if (ifMatch) {
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      jsLines.push(`if (${transformExpr(ifMatch[1])}) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // for x, y in iterable: or for x in iterable:
    const forMatch = stmt.match(/^for\s+([a-zA-Z0-9_,\s]+)\s+in\s+(.*):$/);
    if (forMatch) {
      const loopVars = forMatch[1].trim();
      const iterExpr = transformExpr(forMatch[2]);
      const varPattern = loopVars.includes(",") ? `[${loopVars}]` : loopVars;
      jsLines.push(`for (let ${varPattern} of __pyList(${iterExpr})) {`);
      jsLines.push(`__checkLoopGuard(${lineNum});`);
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      indentStack.push(indent + 1);
      continue;
    }

    // while cond:
    const whileMatch = stmt.match(/^while\s+(.*):$/);
    if (whileMatch) {
      jsLines.push(`while (${transformExpr(whileMatch[1])}) {`);
      jsLines.push(`__checkLoopGuard(${lineNum});`);
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      indentStack.push(indent + 1);
      continue;
    }

    // return expr
    const returnMatch = stmt.match(/^return(?:\s+(.*))?$/);
    if (returnMatch) {
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      const retExpr = returnMatch[1] ? transformExpr(returnMatch[1]) : "null";
      jsLines.push(`return (${retExpr});`);
      continue;
    }

    // Tuple unpacking assignment: a, b = expr1, expr2
    const tupleAssign = stmt.match(/^([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*=\s*(.+)$/);
    if (tupleAssign && !stmt.includes("==")) {
      const lhs = tupleAssign[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const rhs = transformExpr(tupleAssign[2]);
      if (indent === 0) {
        for (const v of lhs) {
          jsLines.push(`__trackVar(${JSON.stringify(v)}, () => typeof ${v} !== 'undefined' ? ${v} : undefined);`);
        }
      }
      jsLines.push(`[${lhs.join(", ")}] = [${rhs}];`);
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      continue;
    }

    // Single variable assignment: x = expr
    const singleAssign = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (singleAssign && !stmt.includes("==") && !stmt.includes("!=") && !stmt.includes("<=") && !stmt.includes(">=")) {
      const varName = singleAssign[1];
      const rhs = transformExpr(singleAssign[2]);
      if (indent === 0) {
        jsLines.push(`__trackVar(${JSON.stringify(varName)}, () => typeof ${varName} !== 'undefined' ? ${varName} : undefined);`);
      }
      jsLines.push(`${varName} = (${rhs});`);
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      continue;
    }

    // Augmented assignment: x += expr
    const augAssign = stmt.match(/^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
    if (augAssign) {
      const varName = augAssign[1];
      const op = augAssign[2];
      const rhs = transformExpr(augAssign[3]);
      jsLines.push(`${varName} ${op} (${rhs});`);
      jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
      continue;
    }

    // General statement / function call
    jsLines.push(`${transformExpr(stmt)};`);
    jsLines.push(`__recordStep(${lineNum}, ${JSON.stringify(stmt)});`);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    jsLines.push("}");
  }

  return { jsCode: jsLines.join("\n"), lineMap: [] };
}

/**
 * Executes a Python script or multi-line snippet and returns stdout, authentic Python stderr tracebacks,
 * global variables for the Variables panel, numeric series for the Plotter panel, and line-by-line Debug steps.
 */
export function executePythonScript(
  code: string,
  filePath = "<string>",
  existingScope: Record<string, any> = {}
): PythonExecutionResult & { updatedScope: Record<string, any> } {
  const stdout: string[] = [];
  const plotterSeries: number[][] = [];
  const debugSteps: PythonDebugStep[] = [];
  const trackedGetters = new Map<string, () => any>();
  const updatedScope: Record<string, any> = { ...existingScope };

  for (const k of Object.keys(existingScope)) {
    trackedGetters.set(k, () => updatedScope[k]);
  }

  let loopCounter = 0;
  let lastStderrLine = 1;

  const collectVariables = (): PythonVariableInfo[] => {
    const vars: PythonVariableInfo[] = [];
    for (const [name, getter] of trackedGetters.entries()) {
      try {
        const val = getter();
        if (val !== undefined && typeof val !== "function") {
          updatedScope[name] = val;
          vars.push({
            name,
            value: formatPythonValue(val),
            type: getPythonTypeName(val),
          });
        }
      } catch {
        // Variable not initialized yet
      }
    }
    return vars;
  };

  const runtimeHelpers = {
    __pyStr: (v: any) => formatPythonPrintValue(v),
    __pyList: (iterable: any) => {
      if (Array.isArray(iterable)) return iterable;
      if (typeof iterable === "string") return iterable.split("");
      if (iterable && typeof iterable[Symbol.iterator] === "function") {
        return Array.from(iterable);
      }
      return [];
    },
    __checkLoopGuard: (line: number) => {
      lastStderrLine = line;
      loopCounter++;
      if (loopCounter > 10000) {
        throw new Error("RecursionError: maximum loop iteration limit (10000) exceeded");
      }
    },
    __trackVar: (name: string, getter: () => any) => {
      trackedGetters.set(name, getter);
    },
    __recordStep: (line: number, statement: string) => {
      lastStderrLine = line;
      if (debugSteps.length < 250) {
        debugSteps.push({
          line,
          statement,
          stdoutDelta: stdout.join("\n"),
          variables: collectVariables(),
        });
      }
    },
    print: (...args: any[]) => {
      const rendered = args.map(formatPythonPrintValue).join(" ");
      stdout.push(rendered);

      // Extract numbers for Thonny Plotter if the line contains numeric values
      const nums = args
        .flatMap((a) => (Array.isArray(a) ? a : [a]))
        .filter((x) => typeof x === "number" && Number.isFinite(x));
      if (nums.length > 0) {
        plotterSeries.push(nums);
      } else {
        const parsedNums = rendered
          .split(/[\s,]+/)
          .map((s) => Number(s))
          .filter((n) => !Number.isNaN(n) && Number.isFinite(n));
        if (parsedNums.length > 0 && rendered.trim() !== "") {
          plotterSeries.push(parsedNums);
        }
      }
    },
    range: (a: number, b?: number, step = 1) => {
      const res: number[] = [];
      const start = b === undefined ? 0 : a;
      const stop = b === undefined ? a : b;
      if (step === 0) throw new Error("ValueError: range() arg 3 must not be zero");
      if (step > 0) {
        for (let i = start; i < stop; i += step) res.push(i);
      } else {
        for (let i = start; i > stop; i += step) res.push(i);
      }
      return res;
    },
    len: (x: any) => {
      if (x && typeof x.length === "number") return x.length;
      if (x && typeof x === "object") return Object.keys(x).length;
      throw new Error(`TypeError: object of type '${getPythonTypeName(x)}' has no len()`);
    },
    sum: (arr: any[], initial = 0) =>
      Array.isArray(arr) ? arr.reduce((acc, v) => acc + v, initial) : initial,
    min: (...args: any[]) => {
      const list = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return Math.min(...list);
    },
    max: (...args: any[]) => {
      const list = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return Math.max(...list);
    },
    abs: (x: number) => Math.abs(x),
    round: (x: number, digits = 0) => {
      const factor = 10 ** digits;
      return Math.round(x * factor) / factor;
    },
    int: (x: any, base = 10) => {
      const parsed = typeof x === "number" ? Math.trunc(x) : parseInt(String(x), base);
      if (Number.isNaN(parsed)) {
        throw new Error(`ValueError: invalid literal for int() with base ${base}: '${x}'`);
      }
      return parsed;
    },
    float: (x: any) => {
      const parsed = parseFloat(String(x));
      if (Number.isNaN(parsed)) {
        throw new Error(`ValueError: could not convert string to float: '${x}'`);
      }
      return parsed;
    },
    str: (x: any) => formatPythonPrintValue(x),
    list: (x: any) => (x === undefined ? [] : runtimeHelpers.__pyList(x)),
    sorted: (arr: any[]) => [...runtimeHelpers.__pyList(arr)].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0)),
    reversed: (arr: any[]) => [...runtimeHelpers.__pyList(arr)].reverse(),
    enumerate: (arr: any[], start = 0) =>
      runtimeHelpers.__pyList(arr).map((v: any, idx: number) => [start + idx, v]),
    zip: (...arrays: any[][]) => {
      if (arrays.length === 0) return [];
      const minLen = Math.min(...arrays.map((a) => (Array.isArray(a) ? a.length : 0)));
      const out: any[][] = [];
      for (let i = 0; i < minLen; i++) {
        out.push(arrays.map((a) => a[i]));
      }
      return out;
    },
    type: (x: any) => `<class '${getPythonTypeName(x)}'>`,
    ord: (s: string) => String(s).charCodeAt(0),
    chr: (codePoint: number) => String.fromCharCode(codePoint),
    bin: (n: number) => "0b" + Math.trunc(n).toString(2),
    hex: (n: number) => "0x" + Math.trunc(n).toString(16),
    pow: (a: number, b: number, mod?: number) =>
      mod !== undefined ? (a ** b) % mod : a ** b,
    divmod: (a: number, b: number) => [Math.floor(a / b), a % b],
    all: (arr: any[]) => runtimeHelpers.__pyList(arr).every(Boolean),
    any: (arr: any[]) => runtimeHelpers.__pyList(arr).some(Boolean),
    input: (promptText = "") => {
      if (promptText) stdout.push(String(promptText));
      return "10";
    },
    math: {
      pi: Math.PI,
      e: Math.E,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      floor: Math.floor,
      ceil: Math.ceil,
      log: Math.log,
      log10: Math.log10,
      log2: Math.log2,
      gcd: (a: number, b: number): number => {
        let x = Math.abs(Math.trunc(a));
        let y = Math.abs(Math.trunc(b));
        while (y) {
          const t = y;
          y = x % y;
          x = t;
        }
        return x;
      },
      factorial: (n: number): number => {
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
      },
    },
    random: {
      random: () => Math.random(),
      randint: (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a,
      choice: (arr: any[]) => arr[Math.floor(Math.random() * arr.length)],
    },
    sys: {
      version: "3.10.11 (tags/v3.10.11:7d4cc5a, Apr 5 2023, 00:38:17)",
      platform: "win32",
      setrecursionlimit: () => null,
      stdin: {
        readline: () => "5\n",
      },
    },
  };

  try {
    // Check for explicit division by zero in code
    if (/\/\s*0(?![.0-9])/.test(code)) {
      const zeroLineIdx = code.split("\n").findIndex((l) => /\/\s*0(?![.0-9])/.test(l));
      lastStderrLine = zeroLineIdx >= 0 ? zeroLineIdx + 1 : 1;
      throw new Error("ZeroDivisionError: division by zero");
    }

    const { jsCode } = transpilePythonToJs(code);

    // Pre-declare scope variables so assignments work without strict-mode ReferenceError
    const varDeclarations: string[] = [];
    const assignMatches = code.matchAll(/^\s*([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*=/gm);
    const declaredSet = new Set<string>(Object.keys(existingScope));
    for (const m of assignMatches) {
      const names = m[1].split(",").map((s) => s.trim());
      for (const name of names) {
        if (name && !PYTHON_KEYWORDS.has(name) && !declaredSet.has(name)) {
          declaredSet.add(name);
          varDeclarations.push(`let ${name} = undefined;`);
        }
      }
    }
    for (const k of Object.keys(existingScope)) {
      varDeclarations.push(`let ${k} = __existingScope[${JSON.stringify(k)}];`);
    }

    const fullBody = `
      const {
        __pyStr, __pyList, __checkLoopGuard, __trackVar, __recordStep,
        print, range, len, sum, min, max, abs, round, int, float, str, list,
        sorted, reversed, enumerate, zip, type, ord, chr, bin, hex, pow, divmod,
        all, any, input, math, random, sys
      } = __helpers;
      ${varDeclarations.join("\n")}
      ${jsCode}
    `;

    const fn = new Function("__helpers", "__existingScope", fullBody);
    fn(runtimeHelpers, existingScope);

    return {
      stdout,
      stderr: null,
      variables: collectVariables(),
      plotterSeries,
      debugSteps,
      updatedScope,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let pyErrorLine = rawMsg;
    if (rawMsg.includes("is not defined")) {
      const varMatch = rawMsg.match(/([a-zA-Z_]\w*)\s+is not defined/);
      const missingName = varMatch ? varMatch[1] : "identifier";
      pyErrorLine = `NameError: name '${missingName}' is not defined`;
    } else if (
      !rawMsg.startsWith("ZeroDivisionError:") &&
      !rawMsg.startsWith("ValueError:") &&
      !rawMsg.startsWith("TypeError:") &&
      !rawMsg.startsWith("RecursionError:") &&
      !rawMsg.startsWith("NameError:")
    ) {
      pyErrorLine = `SyntaxError: invalid syntax (${rawMsg})`;
    }

    const traceback = [
      "Traceback (most recent call last):",
      `  File "${filePath}", line ${lastStderrLine}, in <module>`,
      pyErrorLine,
    ].join("\n");

    return {
      stdout,
      stderr: traceback,
      variables: collectVariables(),
      plotterSeries,
      debugSteps,
      updatedScope,
    };
  }
}

/**
 * Evaluates a single interactive REPL line entered after >>> in Thonny's Shell.
 * If the user enters a bare expression (like `2 + 2` or `x * 3`), it evaluates and prints the representation.
 */
export function evaluatePythonReplLine(
  inputLine: string,
  scope: Record<string, any> = {},
  shellCommandIndex = 0
): {
  outputLines: { text: string; isError: boolean }[];
  updatedScope: Record<string, any>;
  variables: PythonVariableInfo[];
  plotterSeries: number[][];
} {
  const trimmed = inputLine.trim();
  if (!trimmed) {
    return {
      outputLines: [],
      updatedScope: scope,
      variables: [],
      plotterSeries: [],
    };
  }

  const isStatement =
    /^(print\s*\(|def\s+|for\s+|while\s+|if\s+|import\s+|from\s+|pass\b|return\b)/.test(trimmed) ||
    (/^[a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*\s*(\+=|-=|\*=|\/=|=)/.test(trimmed) &&
      !trimmed.includes("=="));

  const codeToRun = isStatement ? trimmed : `__repl_val = (${trimmed})\nif __repl_val != None:\n    print(repr_val(__repl_val))`;

  // Inject repr_val helper if bare expression
  const scopeWithRepr = { ...scope };
  const result = executePythonScript(
    isStatement ? trimmed : `print(${trimmed})`,
    `<pyshell#${shellCommandIndex}>`,
    scopeWithRepr
  );

  const outputLines: { text: string; isError: boolean }[] = [];
  for (const line of result.stdout) {
    outputLines.push({ text: line, isError: false });
  }
  if (result.stderr) {
    outputLines.push({ text: result.stderr, isError: true });
  }

  return {
    outputLines,
    updatedScope: result.updatedScope,
    variables: result.variables,
    plotterSeries: result.plotterSeries,
  };
}
