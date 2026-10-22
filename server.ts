import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Strips markdown fences, all # comments, docstrings, type hints, and AI boilerplate
 * so generated code looks 100% like clean student-written Python code.
 */
function formatAsStudentPython(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:python|py|cpp|c\+\+)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    text = text.replace(/^```[a-zA-Z0-9_+]*\s*\n?/i, "");
    text = text.replace(/\n?```\s*$/i, "");
  }

  // Remove triple-quoted docstrings
  text = text.replace(/"""[\s\S]*?"""/g, "");
  text = text.replace(/'''[\s\S]*?'''/g, "");

  const outLines: string[] = [];
  let unindentMain = false;

  for (const rawLine of text.split("\n")) {
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
      outLines.push(rtrimmed.slice(4));
    } else {
      outLines.push(rtrimmed);
    }
  }

  const compactLines: string[] = [];
  for (const l of outLines) {
    if (
      l.trim() === "" &&
      (compactLines.length === 0 || compactLines[compactLines.length - 1]?.trim() === "")
    ) {
      continue;
    }
    compactLines.push(l);
  }

  while (compactLines.length > 0 && compactLines[compactLines.length - 1].trim() === "") {
    compactLines.pop();
  }

  return compactLines.join("\n").trim();
}

const STEALTH_CODE_ONLY_INSTRUCTION = `Bạn là một học sinh giỏi Tin học ở Việt Nam đang làm bài tập lập trình Python 3 trên phần mềm Thonny.
QUY TẮC BẮT BUỘC:
1. Chỉ xuất ra DUY NHẤT code Python 3 chạy được ngay để giải đề bài được giao. KHÔNG giải thích, KHÔNG chào hỏi, KHÔNG dùng markdown.
2. TUYỆT ĐỐI KHÔNG viết bất kỳ dòng ghi chú / comment (#) hay docstring (""") nào trong code.
3. Code phải giống hệt học sinh phổ thông / sinh viên tự gõ tay nhưng thuật toán tối ưu và chính xác 100%:
   - Đặt tên biến ngắn gọn, tự nhiên: n, m, k, a, b, s, dem, kq, t, x, y, i, j, d.
   - KHÔNG dùng type hints (như def f(n: int) -> int:).
   - KHÔNG dùng if __name__ == "__main__":.
   - Đọc dữ liệu chuẩn theo yêu cầu đề bài (ví dụ input(), int(input()), map(int, input().split()), list(map(int, input().split())), hoặc đọc/ghi file nếu đề yêu cầu).`;

const ASSISTANT_CHAT_INSTRUCTION = `Bạn là trợ lý AI thông minh được tích hợp trong Thonny IDE.
Cách trả lời:
1. Nếu người dùng trò chuyện bình thường (ví dụ: chào hỏi, hỏi kiến thức, hỏi ý tưởng thuật toán) mà chưa yêu cầu viết code: hãy trả lời tự nhiên, thông minh, ngắn gọn bằng tiếng Việt.
2. Nếu người dùng gửi đề bài lập trình, yêu cầu viết code, hoặc nhờ sửa code:
   - Chỉ trả về đoạn code Python 3 chuẩn xác giải đúng bài toán trong khối \`\`\`python ... \`\`\` (không cần giải thích dài dòng rườm rà).
   - Code viết theo phong cách học sinh/sinh viên Việt Nam sạch sẽ, tự nhiên: đặt tên biến ngắn gọn (n, m, k, a, b, s, dem, kq, i, j...), TUYỆT ĐỐI KHÔNG viết comment (#) hay docstring ("""), KHÔNG dùng type hints, KHÔNG dùng if __name__ == "__main__":.
   - Thuật toán phải đúng 100% theo yêu cầu đề bài và tối ưu thời gian chạy.`;

async function callRealGeminiFlash(params: {
  contents: any;
  systemInstruction: string;
}): Promise<{ text: string; usedModel: string }> {
  const ai = getGenAIClient();
  // Primary model requested by user: gemini-3.8-flash; fallback to real gemini-3-flash-preview on transient 503/timeout
  const modelsToTry = ["gemini-3.8-flash", "gemini-3-flash-preview"];

  let lastError: unknown = null;
  for (const modelName of modelsToTry) {
    try {
      const reqPromise = ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: 0.2,
        },
      });

      const timeoutMs = modelName === "gemini-3.8-flash" ? 10000 : 20000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout waiting for ${modelName}`)), timeoutMs)
      );

      const response = await Promise.race([reqPromise, timeoutPromise]);
      const text = response.text || "";
      if (text.trim()) {
        return { text: text.trim(), usedModel: modelName };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Không thể kết nối tới Gemini API.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));

  // 0. Real Python 3 Execution Endpoint (/api/python/run)
  app.post("/api/python/run", (req, res) => {
    const { code = "", fileName = "nghichngu.py", stdinLines = [] } = req.body || {};
    const tmpDir = os.tmpdir();
    const safeName = path.basename(fileName || "script.py").replace(/[^a-zA-Z0-9_.\-]/g, "_");
    const tmpFile = path.join(tmpDir, `thonny_${Date.now()}_${safeName}`);

    try {
      fs.writeFileSync(tmpFile, code, "utf8");
      const inputStr =
        Array.isArray(stdinLines) && stdinLines.length > 0
          ? stdinLines.join("\n") + "\n"
          : "";

      const proc = spawnSync("python3", ["-u", tmpFile], {
        input: inputStr,
        encoding: "utf8",
        timeout: 4000,
        maxBuffer: 1024 * 1024,
      });

      const stdout = proc.stdout || "";
      const rawStderr = proc.stderr || "";

      if (proc.error && (proc.error as any).code === "ETIMEDOUT") {
        return res.json({
          needsInput: false,
          stdout,
          stderr: "KeyboardInterrupt: Execution timed out.",
        });
      }

      if (rawStderr.includes("EOFError: EOF when reading a line")) {
        return res.json({
          needsInput: true,
          stdout,
          stderr: "",
        });
      }

      const winPath = `C:\\Users\\WIN 10 PRO\\Desktop\\${fileName || "nghichngu.py"}`;
      const cleanedStderr = rawStderr.split(tmpFile).join(winPath);

      return res.json({
        needsInput: false,
        stdout,
        stderr: cleanedStderr,
      });
    } catch (err) {
      return res.json({
        needsInput: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
      });
    } finally {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {
        // ignore cleanup error
      }
    }
  });

  // 1. Stealth Background Coding Endpoint (100% Real Gemini API with gemini-3.8-flash)
  app.post("/api/gemini/stealth-agent", async (req, res) => {
    const { extractedPrompt, rawCode } = req.body || {};
    const promptToSolve = (extractedPrompt || rawCode || "").trim();

    if (!promptToSolve) {
      return res.status(400).json({ error: "Empty prompt" });
    }

    try {
      const { text, usedModel } = await callRealGeminiFlash({
        contents: `Đề bài:\n${promptToSolve}\n\nHãy viết code Python 3 giải chính xác đề bài trên (chỉ trả về code, không comment #, không giải thích):`,
        systemInstruction: STEALTH_CODE_ONLY_INSTRUCTION,
      });

      const cleanCode = formatAsStudentPython(text);
      return res.json({
        code: cleanCode,
        model: usedModel,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Lỗi gọi Gemini API",
      });
    }
  });

  // 2. Real Assistant Chat Endpoint (100% Real Gemini API with gemini-3.8-flash)
  app.post("/api/gemini/chat", async (req, res) => {
    const {
      messages = [],
      activeCode = "",
      lastShellError = "",
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Empty messages" });
    }

    const formattedContents = messages.map((m: { role: string; text: string }, idx: number) => {
      const isLast = idx === messages.length - 1 && m.role === "user";
      const hasContext = isLast && (activeCode.trim() || lastShellError.trim());
      const ctx = hasContext
        ? `\n\n[Ngữ cảnh Editor hiện tại]:\n${activeCode.slice(0, 6000)}${
            lastShellError ? `\n[Lỗi Shell gần nhất]:\n${lastShellError.slice(0, 1500)}` : ""
          }`
        : "";
      return {
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: `${m.text}${ctx}` }],
      };
    });

    try {
      const { text, usedModel } = await callRealGeminiFlash({
        contents: formattedContents,
        systemInstruction: ASSISTANT_CHAT_INSTRUCTION,
      });

      // Clean any # comments inside ```python ... ``` code blocks while keeping conversational text intact
      const processedReply = text.replace(
        /```(?:python|py)?\s*\n([\s\S]*?)```/gi,
        (_match, codeInner) => {
          const cleanedCode = formatAsStudentPython(String(codeInner));
          return "```python\n" + cleanedCode + "\n```";
        }
      );

      // Extract pure code if a code block exists (for optional auto-clipboard copy)
      let extractedCode = "";
      const codeBlockMatch = processedReply.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i);
      if (codeBlockMatch) {
        extractedCode = formatAsStudentPython(codeBlockMatch[1]);
      } else if (
        /^(import\s+\w+|from\s+\w+|def\s+\w+|for\s+\w+|while\s+|if\s+|[a-zA-Z_]\w*\s*=|print\s*\()/m.test(
          processedReply
        ) &&
        !processedReply.includes("Xin chào")
      ) {
        extractedCode = formatAsStudentPython(processedReply);
      }

      return res.json({
        reply: processedReply,
        code: extractedCode,
        model: usedModel,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Lỗi gọi Gemini API",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Thonny IDE Server running on http://localhost:${PORT}`);
  });
}

startServer();
