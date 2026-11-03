/**
 * Korean particles that change with the final consonant (받침) of the word before them.
 * Key = form written in templates (after a consonant), value = [after consonant, after vowel].
 */
const PAIRS: Record<string, [string, string]> = {
  은: ["은", "는"],
  이: ["이", "가"],
  을: ["을", "를"],
  과: ["과", "와"],
  이랑: ["이랑", "랑"],
  으로: ["으로", "로"],
  이에요: ["이에요", "예요"],
  이면: ["이면", "면"],
};

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const RIEUL = 8;

/** Final consonant index of the last Hangul syllable (0 = none), or null for non-Hangul endings. */
function finalConsonant(word: string): number | null {
  const last = word.trim().replace(/[\s)\]'"!?.,~]+$/, "").at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28;
  // Digits are read aloud: 1(일)·7(칠)·8(팔) end in ㄹ, 0(영)·3(삼)·6(육) in another consonant.
  if (/[178]/.test(last)) return RIEUL;
  if (/[036]/.test(last)) return 1;
  if (/\d/.test(last)) return 0;
  return null;
}

/** Attaches a particle in the right form: josa("아이", "이랑") → "아이랑", josa("부모님", "이랑") → "부모님이랑". */
export function josa(word: string, particle: string): string {
  const pair = PAIRS[particle];
  if (!pair) return `${word}${particle}`;
  const jong = finalConsonant(word);
  if (jong === null) return `${word}${pair[0]}`;
  // "으로" drops 으 after ㄹ too: 서울로, 호텔로.
  if (particle === "으로" && jong === RIEUL) return `${word}${pair[1]}`;
  return `${word}${jong > 0 ? pair[0] : pair[1]}`;
}
