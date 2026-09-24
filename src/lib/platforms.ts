// A platform appears in the result dock when a search returns posts with its id.
// Enable selection only after its server-side search integration is ready.
export const platformRegistry = [
  { id: "bluesky", label: "Bluesky", icon: "🦋", background: "linear-gradient(145deg, #2675e8, #1643a9)", searchable: true },
  { id: "x", label: "X", icon: "𝕏", background: "linear-gradient(145deg, #333545, #090a10)", searchable: true },
  { id: "reddit", label: "Reddit", icon: "●", background: "linear-gradient(145deg, #ff6a2b, #d83400)", searchable: false },
  { id: "linkedin", label: "LinkedIn", icon: "in", background: "linear-gradient(145deg, #2989c9, #075886)", searchable: false },
  { id: "instagram", label: "Instagram", icon: "◎", background: "linear-gradient(145deg, #f65a69, #9a3be9)", searchable: false },
  { id: "tiktok", label: "TikTok", icon: "♪", background: "linear-gradient(145deg, #222939, #070a10)", searchable: false },
  { id: "youtube", label: "YouTube", icon: "▶", background: "linear-gradient(145deg, #ff4d4d, #bb1010)", searchable: false },
  { id: "facebook", label: "Facebook", icon: "f", background: "linear-gradient(145deg, #3986f5, #164baf)", searchable: false },
] as const;

export type Platform = (typeof platformRegistry)[number]["id"];
export type SearchablePlatform = Extract<(typeof platformRegistry)[number], { searchable: true }>["id"];

export function platformName(id: Platform) {
  return platformRegistry.find(platform => platform.id === id)?.label ?? id;
}
