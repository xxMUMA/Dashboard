export const sentimentModels = [
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai" },
  { id: "gpt-6-sol", label: "GPT-6 Sol", provider: "openai" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "openai" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "gemini" },
  { id: "deepseek-flash", label: "DeepSeek V4.1 Flash", provider: "deepseek" },
  { id: "jev-latest", label: "Jev", provider: "jev" },
] as const;

export type SentimentModel = (typeof sentimentModels)[number]["id"];

export function modelInfo(id: string) {
  return sentimentModels.find(model => model.id === id);
}
