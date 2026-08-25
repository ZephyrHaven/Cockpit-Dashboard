// ai-quick.js — 轻量 AI 文本调用与结构化解析。
// 供「待办智能拆解」等一次性任务使用：不经过 Agent 工具循环，失败静默降级。

// 判断 AI 是否可用（配置了模型，且需要密钥时密钥存在）。带 60s 缓存避免逐行渲染时反复查密钥。
let cockpitAiReadyCache = { at:0, value:false };

async function isCockpitAiReady(plugin, forceCheck = false) {
  const now = Date.now();
  if (!forceCheck && now - cockpitAiReadyCache.at < 60000) return cockpitAiReadyCache.value;
  let value = false;
  try {
    const config = await plugin.ai.getConfig();
    const profile = typeof getActiveAiProfile === 'function' ? getActiveAiProfile(config) : null;
    if (profile?.model) {
      const needsKey = !!(profile.apiKey || profile.apiKeySecret);
      if (!needsKey) value = true;
      else { try { value = !!plugin.ai.getProfileApiKey(profile); } catch (e) { value = false; } }
    }
  } catch (e) { value = false; }
  cockpitAiReadyCache = { at:now, value };
  return value;
}

// 单轮问答：返回纯文本；任何错误抛给调用方自行降级。
// 推理型模型思考时间波动大，超时给足 45s，并对瞬时失败（超时/网络/空回复）自动重试一次。
async function cockpitQuickAiText(plugin, language, question, attempts = 2) {
  const callOnce = () => Promise.race([
    plugin.ai.complete({ question, language }),
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('AI timeout')), 45000))
  ]);
  try {
    const answer = await callOnce();
    const text = String(answer || '').trim();
    if (!text) throw new Error('empty ai response');
    return text;
  } catch (e) {
    if (attempts <= 1) throw e;
    return cockpitQuickAiText(plugin, language, question, attempts - 1);
  }
}

// 走 Agent 管线的一次性问答：与聊天共用流式/降级/超时基础设施（只读工具，不弹确认）。
// 「待办智能拆解」等入口用这条路径，行为与 Agent 对话保持一致。
async function cockpitAgentOneShot(plugin, question, language, timeoutMs = 60000) {
  let streamed = '';
  const result = await Promise.race([
    plugin.ai.completeAgentStream(
      { question, language, noContext:true },
      (event) => { if (event.type === 'content' && event.text) streamed += event.text; },
      null,
      { mode:'readonly' }
    ),
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('AI timeout')), timeoutMs))
  ]);
  const text = String(result?.content || streamed || '').trim();
  if (!text) throw new Error('empty ai response');
  return text;
}

// 把模型输出解析成子任务标题数组：优先 JSON 数组，其次按行切分；
// 去掉序号/列表符号/空行，限制条数与长度，保证能直接落成待办行。
function parseAiSubtaskTitles(raw, maxItems = 6, maxChars = 80) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let titles = [];
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) titles = parsed.map((item) => typeof item === 'string' ? item : String(item?.title ?? item?.text ?? ''));
    } catch (e) {}
  }
  if (!titles.length) {
    titles = text.split('\n').map((line) => line.trim());
  }
  const cleaned = titles
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)、]|[（(]\d+[）)])\s*/, '').replace(/^["'“”]+|["'“”]+$/g, '').trim())
    .filter((line) => line && line.length <= maxChars * 2);
  return Array.from(new Set(cleaned)).slice(0, maxItems);
}
