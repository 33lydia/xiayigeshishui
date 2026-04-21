export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "服务器未配置 API Key" });
  }

  const { system, messages } = req.body;
  if (!system || !Array.isArray(messages)) {
    return res.status(400).json({ error: "参数错误" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 300,
        system,
        messages: messages.slice(-20),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "Claude API 错误" });
    }

    const data = await response.json();
    res.json({ text: data.content?.[0]?.text || "（无响应）" });
  } catch (e) {
    res.status(500).json({ error: "请求失败: " + e.message });
  }
}
