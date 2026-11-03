import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { FONT } from "./theme";

let loaded: Promise<unknown> | null = null;

/** Loads bundled OFL fonts once; Remotion waits for them before rendering frames. */
export function ensureFonts(): Promise<unknown> {
  loaded ??= Promise.all([
    loadFont({ family: FONT.sans, url: staticFile("fonts/PretendardVariable.woff2"), weight: "100 900" }),
    loadFont({ family: FONT.display, url: staticFile("fonts/BlackHanSans-Regular.ttf"), weight: "400" }),
    loadFont({ family: FONT.serif, url: staticFile("fonts/NanumMyeongjo-ExtraBold.ttf"), weight: "800" }),
  ]);
  return loaded;
}
