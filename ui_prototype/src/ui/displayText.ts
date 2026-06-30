export function userFacingText(value: string | number | boolean | undefined | null) {
  if (value === undefined || value === null || value === "") {
    return "暂无";
  }

  let text = String(value);
  const protectedPhrases = ["后端完整链路已执行"];
  const protectedTokens = protectedPhrases.map((_, index) => `__DVAS_PROTECTED_${index}__`);
  protectedPhrases.forEach((phrase, index) => {
    text = text.split(phrase).join(protectedTokens[index]);
  });
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  protectedTokens.forEach((token, index) => {
    text = text.split(token).join(protectedPhrases[index]);
  });
  return text;
}

const replacements: Array<[string, string]> = [
  ["后端暂未返回 chart DTO，本阶段不在前端拼接业务图表。", "等待系统返回可直接展示的图表数据。"],
  ["后端暂未提供图表数据", "暂无图表数据"],
  ["后端未提供图表数据", "暂无图表数据"],
  ["后端未提供", "暂无"],
  ["后端未返回", "暂无"],
  ["后端摘要待补", "暂无"],
  ["等待后端", "等待系统"],
  ["来自后端", "来自系统"],
  ["后端返回", "系统返回"],
  ["后端", "系统"],
  ["chart DTO", "图表数据"],
  ["Chart DTO", "图表数据"],
  ["DTO", "数据"],
  ["API Base", "连接地址"],
  ["API", "接口"],
  ["系统 接口 已连接", "系统已连接"],
  ["local_operator", "本地演示用户"],
  ["module_code", "模块"],
  ["route_path", "路径"],
  ["disabled_actions", "不可用操作"],
  ["前端", "页面"],
  ["mock", "样例兜底"],
  ["fallback", "兜底"],
];
