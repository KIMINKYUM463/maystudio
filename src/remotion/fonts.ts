import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { FONT_CHOICES } from "./font-choices";
import { FONT } from "./theme";

let loaded: Promise<unknown> | null = null;
const extra = new Map<string, Promise<unknown>>();

/** Loads the bundled fonts once, plus the picked subtitle/cover fonts (each is several MB, so only those). */
export function ensureFonts(...choices: string[]): Promise<unknown> {
  const picks = FONT_CHOICES.filter((f) => choices.includes(f.id) && f.family !== FONT.sans);
  for (const pick of picks) {
    if (!extra.has(pick.id)) extra.set(pick.id, loadFont({ family: pick.family, url: staticFile(pick.file), weight: "400" }));
  }
  loaded ??= Promise.all([
    loadFont({ family: FONT.sans, url: staticFile("fonts/PretendardVariable.woff2"), weight: "100 900" }),
    loadFont({ family: FONT.display, url: staticFile("fonts/BlackHanSans-Regular.ttf"), weight: "400" }),
    loadFont({ family: FONT.serif, url: staticFile("fonts/NanumMyeongjo-ExtraBold.ttf"), weight: "800" }),
  ]);
  return Promise.all([loaded, ...picks.map((p) => extra.get(p.id))]);
}
