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

  const { gameRule, teams, teamNames } = req.body;
  if (!gameRule || !Array.isArray(teams) || teams.length !== 3) {
    return res.status(400).json({ error: "参数错误" });
  }

  const UP_PROFILES = {
    yuge:    "雨哥到处跑（人称杭州王嘉尔/草莓熊）：军师型暖男，善于分析策略，但关键时刻容易因紧张失误，见到女生会害羞分心。和力元君是黑白双煞黄金搭档。",
    amazong: "啊吗粽（人称瑞哥/神父）：好胜心极强的老大哥，求胜欲爆棚，各种骚操作，沉稳但有时过于自信翻车。和力元君是一生之敌，和三木是冤种兄弟。",
    liyuan:  "力元君（天天喊MVP的非酋）：运气极差总在关键时刻翻车，但有神奇逆袭体质，时常出人意料。和雨哥是黑白双煞，和啊吗粽是死对头，和哲别是AA兄弟。",
    sanmu:   "自来卷三木（人称神，有时被叫渠道）：戏精喜剧人，擅长一人分饰多角扰乱对手，发挥不稳定但创意十足。和啊吗粽是冤种兄弟。",
    zhbie:   "在下哲别（团宠小可爱）：真诚可爱，平时被哥哥们保护，但关键时刻会鼓起勇气爆发令人惊喜。有时叫大虾为虾哥。和力元君是AA兄弟。",
    daxia:   "徐大虾咯（人称虾哥）：看似憨厚实则精明的游戏高玩，吐槽犀利，实力稳定，擅长看穿对手意图。和哲别是虾折腾组合。",
  };

  const NAME_MAP = { yuge:"雨哥", amazong:"啊吗粽", liyuan:"力元君", sanmu:"三木", zhbie:"哲别", daxia:"徐大虾" };

  const teamSections = teams.map((t, i) => {
    const name = (teamNames && teamNames[i]) || `第${i+1}组`;
    const members = t.map(id => NAME_MAP[id] || id).join("、");
    const profiles = t.map(id => UP_PROFILES[id] || id).join("\n");
    return `【${name}】（${members}）：\n${profiles}`;
  }).join("\n\n");

  const allTeamDesc = teams.map((t, i) => {
    const name = (teamNames && teamNames[i]) || `第${i+1}组`;
    return `${name}（${t.map(id => NAME_MAP[id]||id).join("、")}）`;
  }).join("、");

  const systemPrompt = `你是B站综艺《下一个是谁》的专业解说员，风格幽默、充满激情，像在给观众播报一场真实的三方混战比赛。

游戏规则：
${gameRule}

本场参赛三组：
${teamSections}

要求：
1. 三组同时参赛，用解说员的口吻逐步推进，每段80-100字
2. 结合每人真实性格特点、搭档化学反应和跨组人物关系制造戏剧冲突
3. 要有转折、高潮、意外，体现力元君的非酋体质、啊吗粽的骚操作、三木的戏精、哲别的关键时刻爆发等
4. 语言生动，有网络用语，让观众感觉在看视频
5. 共生成6-8段，最后揭晓获胜队伍（一组），给出有趣的总结
6. 如有任意队伍放弃，剩余队伍继续比赛，解说要调侃放弃的一方（尤其是力元君放弃时要重点渲染）
6. 段与段之间必须用两个换行符（空行）分隔，不要加编号或标题
7. 直接开始解说，不要说"好的"或解释自己要做什么`;

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
          { role: "user", content: `开始解说！本场三方对决：${allTeamDesc}` },
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
