# MayStudio · 여행 숏폼 팩토리

숙소·여행상품 링크와 사진으로 인스타그램 릴스용 숏폼(MP4 + 캡션·DM 문구)을 만드는 로컬 웹앱입니다.

- **배경 영상**: Replicate(또는 Flow mp4 업로드)로 사진 → 클립
- **모션그래픽**: Remotion 자막·로고·(광고)·장면 전환
- **대본**: 내장 훅 라이브러리 / 선택적 LLM
- **데이터**: `data/`에만 저장 (API 키·프로젝트·렌더 결과). Git에 올리지 않습니다.

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 편집합니다.

설정에서 Replicate 토큰 등을 넣으면 사진→영상을 프로그램 안에서 만들 수 있습니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | Vitest |
| `npm run typecheck` | TypeScript 검사 |
| `npm run remotion:studio` | Remotion 스튜디오 |

## 주의

- `data/settings.json`에 API 키가 들어가므로 **커밋하지 마세요** (`.gitignore`에 `/data/` 포함).
- 제휴 콘텐츠는 캡션·영상 속 광고 표시를 유지하세요.
