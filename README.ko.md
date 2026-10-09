# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![엔진: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![플랫폼: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![코드: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

**PlayCanvas Engine, TypeScript, Vite**로 만든 석양의 해안 아케이드 카트 레이싱 게임입니다. 리깅된 캐릭터 드라이버 6명 중 한 명을 골라 나머지 5명과 경주하세요. 드리프트 부스트, 아이템, 자유롭게 회전하는 추적 카메라를 지원합니다.

**[브라우저에서 플레이](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [Windows 플레이테스트 다운로드](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> 게임 UI는 중국어 간체이며 브랜드명은 영어로 표시됩니다. 위의 언어 링크는 문서 언어만 전환합니다. 코드와 자체 제작 에셋에는 AGPL-3.0-only가 적용되며, 캐릭터 모델 6종에는 별도의 비상업적 이용 제한이 있습니다. [라이선스 및 모델 권리](#license-and-model-rights)를 확인하세요.

## 주요 기능

- **선택 가능한 드라이버 6명:** WHALE, GEMINI, GPT, CLAUDE, GROK, GLM. 리깅된 캐릭터 모델 포함
- 석양의 해안 서킷에서 AI 상대 5명과 펼치는 **3바퀴 경주**. 바다 풍경, 충돌, 랩·순위 추적, 미니맵 지원
- **아케이드 주행:** 수동 가속, 제동, 후진, 핸드브레이크 드리프트, 드리프트 부스트
- **아이템 3종:** 터보 부스트, 에너지 실드, 추적 펄스
- **내용물이 보이는 아이템 상자:** 반투명 상자에 직접 제작한 3D 아이템을 표시하며, 25%는 물음표 무작위 상자입니다. 획득 즉시 사라지고 실제 경주 진행 시간 8초 후 다시 나타납니다. HUD 이미지도 동일한 모델을 투영해 만듭니다. [자세히](docs/item-pickups.md)
- **아이템을 쓰는 NPC:** 상대도 실제 상자를 획득하고 안전한 경로를 고르며 상황에 맞게 가속·보호막·펄스를 사용합니다. 보유 아이템과 사용 효과가 3D로 표시됩니다. [규칙](docs/npc-tactics.md)
- **추적 카메라 2종**, 마우스 회전, 시점 복귀, 일시적인 후방 보기
- 일시 정지·재시작, 효과음, 키보드 조작, 화면 터치 조작
- 업로드 없이 현재 세션에서만 유지되는 로컬 GLB 드라이버 교체 기능

## 브라우저에서 플레이

**WebGL2**가 활성화된 브라우저에서 **[GitHub Pages 게임](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**을 여세요. 캐릭터 로딩이 끝나면 드라이버를 선택하고 경주를 시작하세요.

첫 캐릭터 다운로드 용량은 총 약 **51.6 MB**입니다. 모델은 최대 2개까지 동시에 다운로드·준비됩니다. 로딩 화면에 실제 바이트 기준 진행률과 압축 해제·준비 단계가 표시됩니다. 일시적인 오류는 정해진 한도 내에서 재시도하며, 이미 불러온 모델을 유지한 채 실패한 파일만 다시 시도할 수 있습니다. 모델이 없으면 자체 제작 기본 드라이버로 대체되었다고 명확히 표시됩니다.

ChatGPT 로그인, 모델 서비스 계정, 런타임 CDN은 필요하지 않습니다. 게임과 캐릭터 에셋은 동일한 배포본에서 제공됩니다.

## Windows 플레이테스트

**64비트 Windows 10/11과 WebGL2 지원 GPU가 필요합니다.** 정식 출시 버전이 아닌 사전 공개 플레이테스트입니다.

1. [릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)에서 [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip)을 다운로드하세요.
2. **ZIP 전체**를 한 폴더에 압축 해제하세요.
3. **AI Friends Kart.exe**를 실행하세요. 함께 있는 DLL과 `resources`, `locales` 폴더는 같은 위치에 유지하세요.
4. **F11**을 눌러 전체 화면을 전환하세요.

캐릭터 6종이 모두 포함되어 있어 오프라인으로 플레이할 수 있습니다. Node.js, 설치 과정, 관리자 권한은 필요하지 않습니다. 게임 실행을 위해 Windows 보안 보호 기능을 끄지 마세요.

압축 파일에는 `Game-Corresponding-Source.zip`, 데스크톱 래퍼 및 빌드 안내가 담긴 `Desktop-Source`, 라이선스 고지가 포함됩니다. 데스크톱 패키지는 해당 릴리스에서 제공되며, 이 저장소의 npm 스크립트는 웹 게임을 빌드합니다.

## 조작법

| 입력 | 동작 |
| --- | --- |
| `W` / `↑` | 가속. 놓으면 관성 주행 |
| `A` / `←`, `D` / `→` | 좌우 조향 |
| `S` / `↓` | 제동 후 계속 누르면 후진 |
| `Space` | 후진 없이 제동 |
| `Left Shift` + 조향 | 드리프트. Shift를 놓으면 충전된 드리프트 부스트 발동 |
| `E` | 획득한 아이템 사용 |
| `Z` / `C` | 추적 카메라 전환 |
| 마우스 오른쪽 버튼 길게 누르기 | 일시적으로 후방 보기 |
| 트랙을 클릭한 뒤 마우스 움직이기 | 카메라 회전 |
| `Q` | 카메라 시점 복귀 |
| `Esc` | 일시 정지 및 포인터 해제 |
| `P` / 일시 정지 버튼 | 일시 정지·재개 |

포인터 캡처를 사용할 수 없으면 마우스 왼쪽 버튼을 누른 채 드래그하여 주변을 둘러볼 수 있습니다. 터치 버튼으로 가속, 조향, 후진, 제동, 드리프트를 조작하고, 아이템 패널을 탭하여 아이템을 사용하세요. 메뉴 버튼은 기본 키보드 조작도 지원합니다.

## 개발 및 빌드

**Node.js 22.12 이상**과 npm이 필요합니다.

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

Vite가 출력하는 HTTP 주소를 여세요. 점검 및 프로덕션 배포본 빌드는 다음과 같이 실행합니다.

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

**`dist/` 전체**를 HTTP(S)로 제공하세요. `index.html`을 `file://`로 열지 마세요. 상대 경로를 사용하므로 도메인 루트와 저장소 하위 디렉터리에 모두 배포할 수 있습니다. 라이선스 고지, `source.html`, `source.zip`을 게임과 함께 유지하세요.

저장소를 전체 복제하면 `public/assets/drivers/`의 운전 모델 6개와 `public/assets/portraits/`의 별도 서 있는 포트레이트 모델 6개가 포함됩니다. 소용량 `source.zip`에는 코드, 테스트, 두 체크섬 매니페스트, 빌드 파일과 자체 제작 원본 편집용 에셋이 포함되지만 두 종류의 캐릭터 압축 파일은 제외됩니다. 압축을 푼 뒤 다음과 같이 복원할 수 있습니다.

```sh
npm ci
npm run models:fetch
npm run build
```

가져오기 스크립트는 독립된 `/dev/` 미리보기의 고정 공개 경로를 사용하며 [운전 모델 매니페스트](docs/runtime-models.json)와 [포트레이트 매니페스트](docs/portrait-models.json)의 압축 및 디코딩 해시를 검증합니다. 일치하지 않는 로컬 파일은 덮어쓰지 않습니다. 코드만 빌드할 수 있지만 전체 화면 표현에는 두 모델 세트의 복원이 필요합니다.

### GitHub Pages

[Build and publish PlayCanvas game 워크플로](.github/workflows/pages.yml)는 **수동 실행** 방식입니다. 저장소의 **Settings → Pages**에서 **GitHub Actions**를 선택하세요. **Publish**에 체크한 상태로 `main`에서 워크플로를 실행하면 선택한 커밋을 점검·테스트·빌드한 뒤 게시합니다. 일반적인 push만으로는 게임이 배포되지 않습니다.

### 프로젝트 구조

- `src/`: PlayCanvas 씬, 트랙, 경주 로직, 입력, 카메라, 캐릭터 로딩
- `public/assets/`: 압축된 드라이버 6종을 포함한 런타임 에셋
- `models/`: 자체 제작 카트와 소품의 편집 가능한 원본
- `tests/`: 로직, 로딩, UI, 엔진 수준 점검
- `scripts/`: 소스 패키징, 런타임 모델 가져오기, 배포본 점검
- `docs/`: 모델 매니페스트, 로컬 가져오기 규약, 기술 검증 문서

## 로컬 드라이버 교체

드라이버 슬롯을 선택한 뒤 호환되는 GLB를 가져오거나, 파일명마다 슬롯 이름 토큰이 정확히 하나씩 들어 있는 파일들을 다중 선택하세요. 파일 크기는 **개당 32 MiB**로 제한되며 최대 2개까지 동시에 처리됩니다. 가져온 데이터는 페이지 메모리에만 유지되며 업로드되거나 영구 저장되지 않습니다. 실패하거나 취소하면 이전 드라이버가 유지됩니다. **Restore default**를 선택하면 포함된 캐릭터 또는 대체 사용을 명시한 기본 드라이버로 돌아갑니다.

허용되는 모델과 검증 규칙은 [리그 및 가져오기 규약](docs/local-import.md)을 확인하세요.

## 검증

자동 점검은 엔진 독립적인 경주·입력 로직, 실제 PlayCanvas의 CPU/null-device 리그 로딩, 모킹된 UI 통합, 정적 배포본 검사를 다룹니다. GPU 렌더링 결과, 네이티브 포인터 잠금 동작, 성능을 보증하지는 않습니다. [테스트 범위와 한계](docs/MIGRATION-PARITY.md), [바다 셰이더 회귀 테스트 기록](docs/WATER-REGRESSION.md)을 확인하세요.

<a id="license-and-model-rights"></a>

## 라이선스 및 모델 권리

**코드와 자체 제작 게임 에셋:** AGPL-3.0-only가 적용되며, 자체 제작 UI, 서킷, 카트, 소품, 편집 가능한 원본이 포함됩니다. [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)를 확인하세요. PlayCanvas와 fflate에는 기존 MIT 라이선스가 유지됩니다.

**캐릭터 6종의 운전 모델과 별도 포트레이트:** 별도의 권리가 적용됩니다. 프로젝트 소유자는 이 모델들이 비상업적 이용 제한이 있는 Tripo Free 출력물이라고 밝히고 있으나, 정확한 재배포 조건은 독립적으로 확인되지 않았습니다. 이 저장소에 포함되었다고 해서 새로운 모델 라이선스, Creative Commons 라이선스 또는 상업적 이용 허가가 부여되는 것은 아닙니다. AGPL은 캐릭터의 라이선스를 변경하지 않습니다. 재사용하거나 재배포하기 전에 적용되는 권리를 확인하고 필요한 허가를 받으세요. [MODEL-NOTICE.txt](MODEL-NOTICE.txt)를 확인하세요.

프로젝트에 포함된 것은 최종 캐릭터 런타임 파일이며, 캐릭터 Blender 프로젝트나 하이폴리 제작 원본은 포함되지 않습니다. 자체 제작 카트·소품의 편집 가능한 파일은 대응 소스로 계속 포함됩니다. 데모에는 광고, 결제, 상업적 모델 판매가 없습니다.
