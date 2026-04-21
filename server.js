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

app.post("/api/game", async (req, res) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "服务器未配置 API Key" });
  }

  const { gameRule, teamA, teamB } = req.body;
  if (!gameRule || !Array.isArray(teamA) || !Array.isArray(teamB)) {
    return res.status(400).json({ error: "参数错误" });
  }

  const UP_PROFILES = {
    yuge: "雨哥到处跑：军师型，善于分析策略，遇事冷静，但关键时刻容易因紧张而失误，尤其在女生面前会害羞分心。和力元君默契十足。",
    amazong: "啊吗粽：好胜心极强的老大哥，求胜欲爆棚，会用各种骚操作，沉稳但有时过于自信翻车。和力元君是一生之敌，和三木是冤种兄弟。",
    liyuan: "力元君：天天喊MVP的非酋，运气极差总在关键时刻翻车，但有神奇逆袭体质，关键时刻常出人意料。和雨哥是黑白双煞，和啊吗粽是死对头。",
    sanmu: "自来卷三木：戏精喜剧人，擅长一人分饰多角扰乱对手，发挥不稳定，但创意十足。和啊吗粽是冤种兄弟，关键时刻总掉链子又总出奇招。",
    zhbie: "在下哲别：团队小天使，真诚可爱，平时被保护，但关键时刻会鼓起勇气爆发，出人意料地发挥出色。和力元君是内乱组搭档。",
    daxia: "徐大虾咯：看似憨厚实则精明的游戏高玩，吐槽犀利，实力稳定，擅长看穿对手意图，但有时因为嘴太毒被对手激怒。",
  };

  const teamAProfiles = teamA.map(id => UP_PROFILES[id] || id).join("\n");
  const teamBProfiles = teamB.map(id => UP_PROFILES[id] || id).join("\n");
  const teamANames = teamA.map(id => ({ yuge:"雨哥", amazong:"啊吗粽", liyuan:"力元君", sanmu:"三木", zhbie:"哲别", daxia:"徐大虾" }[id] || id)).join("、");
  const teamBNames = teamB.map(id => ({ yuge:"雨哥", amazong:"啊吗粽", liyuan:"力元君", sanmu:"三木", zhbie:"哲别", daxia:"徐大虾" }[id] || id)).join("、");

  const systemPrompt = `你是B站综艺《下一个是谁》的专业解说员，风格幽默、充满激情，像在给观众播报一场真实的比赛视频。

游戏规则：
${gameRule}

队伍A（${teamANames}）：
${teamAProfiles}

队伍B（${teamBNames}）：
${teamBProfiles}

要求：
1. 用解说员的口吻，分段落逐步推进比赛，每段100字左右
2. 结合每个人的真实性格特点、优势劣势和人物关系制造戏剧冲突
3. 要有转折、高潮、意外，体现力元君的非酋体质、啊吗粽的骚操作、三木的戏精等
4. 语言生动，有网络用语，让观众有在看视频的感觉
5. 共生成6-8段，最后揭晓获胜队伍，给出有趣的总结
6. 直接开始解说，不要说"好的"或解释自己要做什么`;

  try {
    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",
        max_tokens: 2000,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `开始解说这场比赛！队伍A是${teamANames}，队伍B是${teamBNames}。` },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.message || "千问 API 错误" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            break;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content || "";
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch {}
        }
      }
    }
    res.end();
  } catch (e) {
    res.status(500).json({ error: "请求失败: " + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
