# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![엔진: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![플랫폼: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![코드: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

**PlayCanvas Engine, TypeScript, Vite**로 만든 아케이드 카트 레이싱 게임으로, 육상 코스 12개와 수상 코스 1개를 제공합니다. 리깅된 캐릭터 드라이버 6명 중 한 명을 골라 나머지 5명과 경주하세요. 드리프트 부스트, 아이템, 자유롭게 회전하는 추적 카메라를 지원합니다.

**[브라우저 main 버전](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [독립 dev 미리 보기](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [Web / HTML 및 Windows 다운로드](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 게임 UI는 중국어 간체이며 브랜드명은 영어로 표시됩니다. 위의 언어 링크는 문서 언어만 전환합니다. 코드와 자체 제작 에셋(음악 제외)에는 AGPL-3.0-only가 적용되며, 캐릭터 모델 6종에는 별도의 비상업적 이용 제한이 있습니다. [라이선스 및 모델 권리](#license-and-model-rights)를 확인하세요.

## v1.1.0 안정 버전

**v1.1.0은 Web / HTML 및 Windows x64용 정식 안정 버전입니다.** 맵 13개, 드라이버 6명, 55개 테마 / 330개 부품의 6슬롯 음식 카트 차고를 유지하며 추가 육상 코스 11개에는 장면 보강 작업이 반영되어 있습니다. 공개 파일, 소스 리비전, 체크섬, 검증 결과는 [릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)를 확인하세요. 사이트 루트는 main 게시 위치이고 `/dev/`는 독립 개발 미리 보기입니다.

자유 모드에는 캐릭터 6명 중 무작위로 선택되는 애니메이션 타이틀 화면, 회전하는 맵 미리 보기, 캐릭터 3D 보기, 차량 선택, 쉬움 / 보통 / 어려움 경주 설정과 화면 설정이 있습니다. 타이틀 화면은 Cubism이 아닌 자체 PlayCanvas 2D 메시 애니메이션을 사용합니다. 大肥鱼(WHALE)의 선택 확률은 35%이며 나머지 5명이 65%를 균등하게 나눕니다. 스토리 모드는 개발 중 안내만 표시합니다. [구현 설명 및 제한](docs/free-mode.md).

### 맵 목록

육상 코스를 **01–12** 순서로 표시하고 수상 코스 **A01**을 마지막에 둡니다. 표시 번호가 바뀌어도 기존 맵 ID, 저장된 선택과 바로가기 링크는 유지됩니다.

- **01** [Sunset Coast](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=coast) · `coast`
- **02** [Cloudridge Pass](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain) · `mountain`
- **03** [Lantern Terrace Rally](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town) · `town`
- **04** [Redstrata Quarry](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry) · `quarry`
- **05** [CedarLight Observatory](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest) · `forest`
- **06** [Clockwind Workshop](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop) · `workshop`
- **07** [Amberwind Harvest](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest) · `harvest`
- **08** [Sunweave Caravan](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert) · `desert`
- **09** [Frostloop Depot](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow) · `snow`
- **10** [Basalt Crown](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera) · `caldera`
- **11** [Verdant Canopy](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden) · `garden`
- **12** [Copperwing Airfield](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield) · `airfield`
- **A01** [Sky Waterpark](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=waterpark) · `waterpark`


## 6슬롯 음식 카트 차고

[main 버전 차고](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html) 또는 [dev 차고](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)를 여세요. 000 흰쌀밥을 포함한 **55개 테마 / 330개 부품**으로 완성 차량 선택, 6슬롯 자유 조립, 실제 3D 미리 보기, 성능 비교와 구성 저장을 지원합니다. 완성 차량을 둘러볼 때는 미리 보기만 표시하며, 적용해야 6개 부품이 교체됩니다. 교체 전 저장과 실행 취소도 가능합니다. 선택한 구성은 육상 코스 12개 모두에서 사용하고, 캐릭터 6명의 특성과 수상 탈것은 유지합니다. NPC도 같은 부품 계산식을 사용하는 혼합 구성을 사용하며, 동일 테마 추가 보너스는 없습니다. 배터리 소모, 내구도 손실, 수리와 경제 시스템은 아직 활성화되지 않았습니다. [구현 및 검증 범위](docs/modular-garage.md).

## 주요 기능

- **선택 가능한 드라이버 6명:** WHALE, GEMINI, GPT, CLAUDE, GROK, GLM. 리깅된 캐릭터 모델 포함
- 육상·수상 코스에서 AI 상대 5명과 펼치는 **3바퀴 경주**. 충돌, 랩·순위 추적, 미니맵 지원
- **아케이드 주행:** 수동 가속, 제동, 후진, 핸드브레이크 드리프트, 드리프트 부스트
- **고정 E/R 슬롯과 같은 종류 3개 강화:** 정식 버전과 dev에서 중첩이 기본 활성화됩니다. 한 슬롯에 같은 일반 아이템 2개를 쌓으면 한 번에 하나씩 사용하며, 세 번째는 1회용 super로 바뀝니다. super를 보유한 뒤 같은 종류의 상자를 얻으면 상자만 소모하며 추가 강화, 다른 슬롯 채우기, Token 생성은 하지 않습니다. 빈 슬롯이 있으면 미스터리 상자는 정상 추첨하고, 두 슬롯이 가득 차면 받지 않습니다. E/R은 1.2초 재사용 대기시간을 공유합니다. 일시 정지 설정에서 변경 후 적용하여 경주를 다시 시작해야 반영됩니다. `itemStacking=0`으로 일반 2슬롯 모드로 돌아갑니다. 플레이어와 NPC는 같은 규칙을 따르며 슬롯 위치는 고정됩니다.
- **음악:** 모든 육상·수상 경주는 공통 17곡에서 무작위로 선택합니다. 메뉴에서는 THEME를 재생하고 Love는 예약곡으로 경주 목록에서 제외합니다. 원음질 MP3를 재인코딩 없이 유지하며 음악에는 별도 비상업적 라이선스가 적용됩니다.
- **아이템 3종:** 터보 부스트, 에너지 실드, 추적 펄스
- **내용물이 보이는 아이템 상자:** 반투명 상자에 직접 제작한 3D 아이템을 표시하며, 25%는 물음표 무작위 상자입니다. 획득 즉시 사라지고 실제 경주 진행 시간 8초 후 다시 나타납니다. HUD 이미지도 동일한 모델을 투영해 만듭니다. [자세히](docs/item-pickups.md)
- **아이템을 쓰는 NPC:** 상대도 실제 상자를 획득하고 안전한 경로를 고르며 상황에 맞게 가속·보호막·펄스를 사용합니다. 보유 아이템과 사용 효과가 3D로 표시됩니다. [규칙](docs/npc-tactics.md)
- **추적 카메라 2종**, 마우스 회전, 시점 복귀, 일시적인 후방 보기
- 일시 정지·재시작, 효과음, 키보드 조작, 화면 터치 조작
- 업로드 없이 현재 세션에서만 유지되는 로컬 GLB 드라이버 교체 기능

## 브라우저에서 플레이

**WebGL2**가 활성화된 브라우저에서 **[GitHub Pages 게임](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**을 여세요. 캐릭터 로딩이 끝나면 드라이버를 선택하고 경주를 시작하세요.

첫 경주용 캐릭터 다운로드 용량은 총 약 **51.6 MB**입니다. 선택한 서 있는 포트레이트와 음식 카트 부품은 필요할 때 별도로 다운로드합니다. 캐릭터 모델은 최대 2개까지 동시에 다운로드·준비합니다. 실제 바이트 진행률과 압축 해제·준비 단계를 표시하며 일시적인 오류는 제한된 횟수로 재시도합니다. 이미 불러온 모델을 유지한 채 실패한 파일만 재시도할 수 있습니다. 누락된 모델은 대체하지 않으며 필요한 에셋이 모두 준비되어야 경주를 시작합니다. 로딩 중에는 코스 상공을 둘러본 뒤 부드럽게 출발선으로 돌아옵니다.

ChatGPT 로그인, 모델 서비스 계정, 런타임 CDN은 필요하지 않습니다. 게임과 캐릭터 에셋은 동일한 배포본에서 제공됩니다.

## 웹 / HTML 패키지

[릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)에서 [`ai-friends-kart-playcanvas-v1.1.0-html.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-html.zip)을 선택하고 함께 제공되는 SHA-256 체크섬과 대조하세요. 전체 압축을 푼 뒤 nginx 또는 다른 HTTP(S) 정적 서버로 배포하세요. `file://`로 `index.html`을 직접 여는 방법은 지원하지 않습니다. 모든 에셋, 라이선스 고지와 대응 소스 파일을 함께 유지하세요. 루트 및 하위 디렉터리 배포 검증 결과는 릴리스 설명을 확인하세요. 상대 경로 설계가 실제 배포 압축 파일 검증을 대신하지는 않습니다.

정식 GitHub Pages 사이트는 실행 파일을 제공하며 대응 소스는 [v1.1.0 릴리스](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0)의 별도 [`source.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/source.zip)에서 다운로드하세요. 전체 HTML ZIP에는 여전히 `source.zip`과 모든 런타임 에셋이 포함됩니다. 이전 오프라인 밸런스 보고서와 데이터는 `/dev/`에 유지합니다. v1.1.0 태그는 최종 병합된 `main` 커밋에서 만들며 `dev`에서 직접 게시하지 않습니다.

GitHub Pages 루트와 Timewish 호스팅 버전에는 오프라인 밸런스 진단 데이터셋이 포함되지 않습니다. 진단 진입점은 고정 버전인 [v1.1.0 전체 HTML 패키지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-html.zip)로 연결되며, 계속 변경되는 dev 진단 페이지로 이동하지 않습니다. 전체 HTML ZIP에는 데이터셋과 작동하는 오프라인 진단이 유지됩니다.

## Windows x64 패키지

다운로드 [`ai-friends-kart-playcanvas-v1.1.0-windows-x64.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/ai-friends-kart-playcanvas-v1.1.0-windows-x64.zip) · [SHA256SUMS](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.0/SHA256SUMS)

64비트 Windows 10/11과 WebGL2 지원 GPU가 필요합니다. ZIP 전체를 압축 해제하고 DLL, `resources`, `locales` 폴더를 함께 유지한 채 **AI Friends Kart.exe**를 실행하세요. **F11**로 전체 화면을 전환합니다. Windows 보안 기능을 끄지 마세요. 자동 패키징, 보안 및 프로토콜 검사가 실제 Windows GPU, 성능 또는 입력 호환성 검증을 의미하지는 않습니다.

## 조작법

| 입력 | 동작 |
| --- | --- |
| `W` / `↑` | 가속. 놓으면 관성 주행 |
| `A` / `←`, `D` / `→` | 좌우 조향 |
| `S` / `↓` | 제동 후 계속 누르면 후진 |
| `Space` | 후진 없이 제동 |
| `Left Shift` + 조향 | 드리프트. Shift를 놓으면 충전된 드리프트 부스트 발동 |
| `E` / `R` | 해당 고정 슬롯의 아이템 사용 |
| `Z` / `C` | 추적 카메라 전환 |
| 마우스 오른쪽 버튼 길게 누르기 | 일시적으로 후방 보기 |
| 트랙을 클릭한 뒤 마우스 움직이기 | 카메라 회전 |
| `Q` | 카메라 시점 복귀 |
| `Esc` | 일시 정지 및 포인터 해제 |
| `P` / 일시 정지 버튼 | 일시 정지·재개 |

포인터 캡처를 사용할 수 없으면 왼쪽 마우스 버튼을 누른 채 드래그해 주변을 보세요. 터치 버튼은 가속, 조향, 후진, 제동, 드리프트와 각각 독립된 `E`, `R` 아이템 버튼을 제공합니다. 메뉴 버튼은 기본 키보드 조작도 지원합니다. 모바일 게임 영역에서는 실수로 텍스트를 선택하거나 이미지를 끄는 동작, 컨텍스트 메뉴와 방해되는 제스처를 억제하면서 필요한 입력 필드 조작과 스크롤은 유지합니다. OS 접근성 확대 기능을 모두 차단한다고 보장할 수 없습니다. 실제 휴대전화 QA는 아직 수행하지 않았습니다.

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

**`dist/` 전체**를 HTTP(S)로 제공하세요. `index.html`을 `file://`로 열지 마세요. 도메인 루트 또는 하위 디렉터리의 상대 경로 배포는 실제 릴리스 압축 파일과 검증 기록을 기준으로 확인해야 합니다. 라이선스 고지, `source.html`, `source.zip`을 게임과 함께 유지하세요.

저장소를 전체 복제하면 `public/assets/drivers/`의 운전 모델 6개와 `public/assets/portraits/`의 별도 서 있는 포트레이트 모델 6개가 포함됩니다. 소용량 `source.zip`에는 코드, 테스트, 두 체크섬 매니페스트, 빌드 파일과 자체 제작 원본 편집용 에셋이 포함되지만 두 종류의 캐릭터 압축 파일은 제외됩니다. 압축을 푼 뒤 다음과 같이 복원할 수 있습니다.

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

소스 압축 파일에는 별도로 다운로드하는 음식 카트 데이터도 포함되지 않습니다. 위 명령으로 복원하고 검증하세요. 자체 제작 에셋의 편집 가능한 소스와 매니페스트는 포함됩니다.

가져오기 스크립트는 독립된 `/dev/` 미리보기의 고정 공개 경로를 사용하며 [운전 모델 매니페스트](docs/runtime-models.json)와 [포트레이트 매니페스트](docs/portrait-models.json)의 압축 및 디코딩 해시를 검증합니다. 일치하지 않는 로컬 파일은 덮어쓰지 않습니다. 코드만 빌드할 수 있지만 전체 화면 표현에는 두 모델 세트의 복원이 필요합니다.

### GitHub Pages

버전 표시는 정식 버전 `v1.1.0`, 실제 빌드 커밋을 사용하는 dev `v1.1.0-dev.<sha6>`, 커밋을 지정하지 않은 로컬 빌드 `v1.1.0-dev.local`입니다.

개발 버전 번호에는 실제 commit 해시의 앞 6자리를 붙입니다. 릴리스 태그는 `main`에서 만들며 패키지는 해당 태그의 소스로 생성해야 합니다. dev 배포는 main 사이트 루트를 보존해야 합니다.

[Build and publish PlayCanvas game 워크플로](.github/workflows/pages.yml)는 게시 전에 선택한 소스를 점검, 테스트하고 빌드합니다. main 버전은 사이트 루트에, 독립 미리 보기는 `/dev/`에 있습니다. 체크아웃한 브랜치의 실행 조건과 게시 옵션을 따르세요. dev 배포는 main 버전 루트를 보존해야 하며, 배포 패키지는 해당 릴리스 태그와 같은 소스를 사용해야 합니다.

### 프로젝트 구조

- `src/`: PlayCanvas 씬, 트랙, 경주 로직, 입력, 카메라, 캐릭터 로딩
- `public/assets/`: 압축된 드라이버 6종을 포함한 런타임 에셋
- `models/`: 자체 제작 카트와 소품의 편집 가능한 원본
- `tests/`: 로직, 로딩, UI, 엔진 수준 점검
- `scripts/`: 소스 패키징, 런타임 모델 가져오기, 배포본 점검
- `docs/`: 모델 매니페스트, 로컬 가져오기 규약, 기술 검증 문서

## 로컬 드라이버 교체

드라이버 슬롯을 선택해 호환 GLB를 가져오거나 파일 이름마다 슬롯 이름 토큰이 하나씩 포함된 파일을 여러 개 선택하세요. 파일당 최대 **32 MiB**, 동시 처리 최대 2개입니다. 데이터는 페이지 메모리에만 유지되며 업로드하거나 영구 저장하지 않습니다. 실패하거나 취소하면 기존 드라이버를 유지하고, **Restore default**로 기본 캐릭터를 복원합니다. 간소화된 경주 로딩 화면에서는 이전 가져오기 컨트롤을 숨기며, 캐릭터는 메인 메뉴에서 선택합니다.

허용되는 모델과 검증 규칙은 [리그 및 가져오기 규약](docs/local-import.md)을 확인하세요.

## 검증

이전 CPU 후보 21 결과는 단일 아이템 슬롯 기준선에만 적용됩니다. 새 2슬롯 게임의 밸런스나 공정성을 인증하는 결과가 아닙니다. 실제 휴대전화 QA는 아직 수행하지 않았습니다.

자동 점검은 엔진 독립적인 경주·입력 로직, 실제 PlayCanvas의 CPU/null-device 리그 로딩, 모킹된 UI 통합, 정적 배포본 검사를 다룹니다. GPU 렌더링 결과, 네이티브 포인터 잠금 동작, 성능을 보증하지는 않습니다. [테스트 범위와 한계](docs/MIGRATION-PARITY.md), [바다 셰이더 회귀 테스트 기록](docs/WATER-REGRESSION.md)을 확인하세요.

<a id="license-and-model-rights"></a>

## 라이선스 및 모델 권리

**코드와 자체 제작 게임 에셋(음악 제외):** AGPL-3.0-only가 적용되며, 자체 제작 UI, 서킷, 카트, 소품, 편집 가능한 원본이 포함됩니다. [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)를 확인하세요. PlayCanvas와 fflate에는 기존 MIT 라이선스가 유지됩니다.

**자체 제작 음악(© 2026 JerryZRic):** [별도 음악 라이선스](public/assets/music/LICENSE.txt)가 적용됩니다. 음악 저작물과 녹음 및 개작물은 이 게임과 fork의 일부로서 출처와 고지를 유지하는 비상업적 사용·수정·배포가 허용됩니다. 상업적 사용에는 JerryZRic의 사전 동의가 필요합니다. 관련 없는 프로젝트나 게임 및 fork와 별개인 음악 배포·판매는 허용되지 않습니다. 코드의 AGPL 조건은 변경되지 않습니다.

**캐릭터 6종의 운전 모델과 별도 포트레이트:** 별도의 권리가 적용됩니다. 프로젝트 소유자는 이 모델들이 비상업적 이용 제한이 있는 Tripo Free 출력물이라고 밝히고 있으나, 정확한 재배포 조건은 독립적으로 확인되지 않았습니다. 이 저장소에 포함되었다고 해서 새로운 모델 라이선스, Creative Commons 라이선스 또는 상업적 이용 허가가 부여되는 것은 아닙니다. AGPL은 캐릭터의 라이선스를 변경하지 않습니다. 재사용하거나 재배포하기 전에 적용되는 권리를 확인하고 필요한 허가를 받으세요. [MODEL-NOTICE.txt](MODEL-NOTICE.txt)를 확인하세요.

프로젝트에 포함된 것은 최종 캐릭터 런타임 파일이며, 캐릭터 Blender 프로젝트나 하이폴리 제작 원본은 포함되지 않습니다. 자체 제작 카트·소품의 편집 가능한 파일은 대응 소스로 계속 포함됩니다. 데모에는 광고, 결제, 상업적 모델 판매가 없습니다.

