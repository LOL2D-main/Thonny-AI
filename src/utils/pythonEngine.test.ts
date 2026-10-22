import test from "node:test";
import assert from "node:assert/strict";
import {
  tokenizePythonCode,
  formatThonnyTitleBar,
  computeCursorCoordinates,
  togglePythonComment,
  extractStealthPromptFromPython,
  executePythonScript,
  evaluatePythonReplLine,
} from "./pythonEngine";

test("formatThonnyTitleBar displays asterisk only when dirty", () => {
  assert.equal(
    formatThonnyTitleBar("script.py", "C:\\Users\\User\\Thonny\\script.py", false),
    "script.py - C:\\Users\\User\\Thonny\\script.py - Thonny"
  );
  assert.equal(
    formatThonnyTitleBar("script.py", "C:\\Users\\User\\Thonny\\script.py", true),
    "script.py * - C:\\Users\\User\\Thonny\\script.py - Thonny"
  );
});

test("computeCursorCoordinates calculates 1-indexed Line and Col accurately", () => {
  const sample = "def hello():\n    print('world')";
  const start = computeCursorCoordinates(sample, 0);
  assert.equal(start.formatted, "Line 1 : Col 1");

  const secondLineCol5 = computeCursorCoordinates(sample, 17); // after 4 spaces on line 2
  assert.equal(secondLineCol5.line, 2);
  assert.equal(secondLineCol5.col, 5);
  assert.equal(secondLineCol5.formatted, "Line 2 : Col 5");
});

test("tokenizePythonCode assigns keywords, builtins, strings, comments, and 3-level rainbow brackets", () => {
  const code = `def calc(x):\n    # compute nested (((1)))\n    return print("ans", [({x})])`;
  const tokensByLine = tokenizePythonCode(code);
  assert.equal(tokensByLine.length, 3);

  // Line 1: def is keyword, ( and ) are bracket-1
  const line1 = tokensByLine[0];
  assert.equal(line1[0].type, "keyword");
  assert.equal(line1[0].value, "def");
  const openParen1 = line1.find((t) => t.value === "(");
  assert.equal(openParen1?.type, "bracket-1");

  // Line 2: comment
  const line2 = tokensByLine[1];
  const commentTok = line2.find((t) => t.type === "comment");
  assert.ok(commentTok?.value.startsWith("# compute"));

  // Line 3: return (keyword), print (builtin), "ans" (string), nested [ ( { -> bracket-1, bracket-2, bracket-3
  const line3 = tokensByLine[2];
  assert.ok(line3.some((t) => t.type === "keyword" && t.value === "return"));
  assert.ok(line3.some((t) => t.type === "builtin" && t.value === "print"));
  assert.ok(line3.some((t) => t.type === "string" && t.value === '"ans"'));
  const sqOpen = line3.find((t) => t.value === "[");
  const curlyOpen = line3.find((t) => t.value === "{");
  assert.equal(sqOpen?.type, "bracket-2"); // inside print( ... ) so [ is depth 1 -> bracket-2
  assert.equal(curlyOpen?.type, "bracket-1"); // print( [ ( { -> depth 3 -> 3 % 3 === 0 -> bracket-1
});

test("extractStealthPromptFromPython extracts comments and docstrings while ignoring surrounding code", () => {
  const code = `"""
Find the shortest path using Dijkstra algorithm for N <= 10^5
"""
x = 10
# Output 1-indexed distances
print(x)`;

  const res = extractStealthPromptFromPython(code);
  assert.ok(res.extractedPrompt.includes("Find the shortest path using Dijkstra algorithm"));
  assert.ok(res.extractedPrompt.includes("Output 1-indexed distances"));
  assert.ok(!res.extractedPrompt.includes("print(x)"));
  assert.equal(res.targetLanguage, "python");
});

test("togglePythonComment comments and uncomments selected lines", () => {
  const code = "x = 1\ny = 2";
  const commented = togglePythonComment(code, 0, code.length);
  assert.equal(commented.newCode, "# x = 1\n# y = 2");

  const uncommented = togglePythonComment(
    commented.newCode,
    0,
    commented.newCode.length
  );
  assert.equal(uncommented.newCode, "x = 1\ny = 2");
});

test("executePythonScript evaluates loops, functions, variables, and tracebacks accurately", () => {
  const script = `def square(n):
    return n * n

total = 0
for i in range(1, 5):
    total += square(i)
print("Total:", total)`;

  const result = executePythonScript(script, "C:\\Users\\User\\Thonny\\script.py");
  assert.equal(result.stderr, null);
  assert.deepEqual(result.stdout, ["Total: 30"]);
  const totalVar = result.variables.find((v) => v.name === "total");
  assert.equal(totalVar?.value, "30");
  assert.equal(totalVar?.type, "int");
  assert.ok(result.debugSteps.length > 0);
});

test("evaluatePythonReplLine persists variables across REPL commands and reports standard tracebacks", () => {
  const step1 = evaluatePythonReplLine("x = 21", {}, 0);
  assert.equal(step1.outputLines.length, 0);

  const step2 = evaluatePythonReplLine("x * 2", step1.updatedScope, 1);
  assert.equal(step2.outputLines[0]?.text, "42");
  assert.equal(step2.outputLines[0]?.isError, false);

  const step3 = evaluatePythonReplLine("unknown_var + 1", step2.updatedScope, 2);
  assert.equal(step3.outputLines[0]?.isError, true);
  assert.ok(step3.outputLines[0]?.text.includes("NameError: name 'unknown_var' is not defined"));
});

test("cleanStudentPythonCode removes comments, docstrings, and main boilerplate", async () => {
  const { cleanStudentPythonCode } = await import("./pythonEngine");
  const aiLike = `\`\`\`python
"""Calculate sum"""
# Read input from user
n = int(input()) # number of items
if __name__ == "__main__":
    s = n * (n + 1) // 2
    print(s)
\`\`\``;
  const cleaned = cleanStudentPythonCode(aiLike);
  assert.ok(!cleaned.includes("#"));
  assert.ok(!cleaned.includes('"""'));
  assert.ok(!cleaned.includes("__main__"));
  assert.equal(cleaned, "n = int(input())\ns = n * (n + 1) // 2\nprint(s)");
});
