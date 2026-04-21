const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "服务器未配置 API Key" });
  }

  const { system, messages } = req.body;
  if (!system || !Array.isArray(messages)) {
    return res.status(400).json({ error: "参数错误" });
  }

  // 千问兼容 OpenAI 格式，把 system 作为第一条消息
  const qwenMessages = [
    { role: "system", content: system },
    ...messages.slice(-20),
  ];

  try {
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",
        max_tokens: 300,
        messages: qwenMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.message || "千问 API 错误" });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "（无响应）";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: "请求失败: " + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
