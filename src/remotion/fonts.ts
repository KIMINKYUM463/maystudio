import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { FONT_CHOICES } from "./font-choices";
import { FONT } from "./theme";

let loaded: Promise<unknown> | null = null;
const extra = new Map<string, Promise<unknown>>();

/** Loads the bundled fonts once, plus the picked subtitle font (each is several MB, so only that one). */
export function ensureFonts(choice = "auto"): Promise<unknown> {
  const pick = FONT_CHOICES.find((f) => f.id === choice);
  if (pick && !extra.has(pick.id)) {
    extra.set(pick.id, loadFont({ family: pick.family, url: staticFile(pick.file), weight: "400" }));
  }
  loaded ??= Promise.all([
    loadFont({ family: FONT.sans, url: staticFile("fonts/PretendardVariable.woff2"), weight: "100 900" }),
    loadFont({ family: FONT.display, url: staticFile("fonts/BlackHanSans-Regular.ttf"), weight: "400" }),
    loadFont({ family: FONT.serif, url: staticFile("fonts/NanumMyeongjo-ExtraBold.ttf"), weight: "800" }),
  ]);
  return pick ? Promise.all([loaded, extra.get(pick.id)]) : loaded;
}
