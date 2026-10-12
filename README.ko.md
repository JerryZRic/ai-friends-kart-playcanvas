# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![엔진: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![플랫폼: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![코드: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

**PlayCanvas Engine, TypeScript, Vite**로 만든 아케이드 카트 레이싱 게임으로, 육상 코스 12개와 수상 코스 1개를 제공합니다. 리깅된 캐릭터 드라이버 6명 중 한 명을 골라 나머지 5명과 경주하세요. 드리프트 부스트, 아이템, 자유롭게 회전하는 추적 카메라를 지원합니다.

**[브라우저 안정 버전](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [독립 dev 미리 보기](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [웹 / Windows 다운로드](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 게임 UI는 중국어 간체이며 브랜드명은 영어로 표시됩니다. 위의 언어 링크는 문서 언어만 전환합니다. 코드와 자체 제작 에셋에는 AGPL-3.0-only가 적용되며, 캐릭터 모델 6종에는 별도의 비상업적 이용 제한이 있습니다. [라이선스 및 모델 권리](#license-and-model-rights)를 확인하세요.

## v0.4.0 통합 릴리스

이 README는 **v0.4.0**의 공통 기능을 설명합니다. 맵 13개, 드라이버 6명, 55개 테마 / 330개 부품을 갖춘 6슬롯 음식 카트 차고가 포함됩니다. 추가 육상 코스 11개에는 각 장면의 보강 작업이 반영되어 있습니다. 브라우저 안정 버전과 배포 패키지는 같은 기능을 제공하며, `/dev/`는 이후 업데이트를 위한 독립 미리 보기로 유지됩니다. 공개된 파일, 소스 리비전, 체크섬과 버전별 검증 결과는 [릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)에서 확인하세요.

자유 모드에는 움직이는 3D 타이틀 화면, 회전하는 맵 미리 보기, 캐릭터 3D 보기, 차량 선택, 쉬움 / 보통 / 어려움 경주 설정과 화면 설정이 있습니다. 스토리 모드는 개발 중 안내만 표시합니다. [구현 설명 및 제한](docs/free-mode.md).

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

[안정 버전 차고](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html) 또는 [dev 차고](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)를 여세요. 000 흰쌀밥을 포함한 **55개 테마 / 330개 부품**으로 완성 차량 선택, 6슬롯 자유 조립, 실제 3D 미리 보기, 성능 비교와 구성 저장을 지원합니다. 완성 차량을 둘러볼 때는 미리 보기만 표시하며, 적용해야 6개 부품이 교체됩니다. 교체 전 저장과 실행 취소도 가능합니다. 선택한 구성은 육상 코스 12개 모두에서 사용하고, 캐릭터 6명의 특성과 수상 탈것은 유지합니다. NPC도 같은 부품 계산식을 사용하는 혼합 구성을 사용하며, 동일 테마 추가 보너스는 없습니다. 배터리 소모, 내구도 손실, 수리와 경제 시스템은 아직 활성화되지 않았습니다. [구현 및 검증 범위](docs/modular-garage.md).

## 주요 기능

- **선택 가능한 드라이버 6명:** WHALE, GEMINI, GPT, CLAUDE, GROK, GLM. 리깅된 캐릭터 모델 포함
- 육상·수상 코스에서 AI 상대 5명과 펼치는 **3바퀴 경주**. 충돌, 랩·순위 추적, 미니맵 지원
- **아케이드 주행:** 수동 가속, 제동, 후진, 핸드브레이크 드리프트, 드리프트 부스트
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

[릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)에서 `AI-Friends-Kart-Web-HTML-v0.4.0-20261012.zip`을 선택하고 함께 제공되는 SHA-256 체크섬과 대조하세요. 전체 압축을 푼 뒤 게임 파일을 HTTP(S)로 제공하세요. `file://`로 `index.html`을 직접 여는 방법은 지원하지 않습니다. 모든 에셋, 라이선스 고지와 대응 소스 파일을 함께 유지하세요.

## Windows 패키지

**64비트 Windows 10/11과 WebGL2 지원 GPU가 필요합니다.** v0.4.0 패키지와 해당 릴리스 설명을 확인하세요. 패키징이나 자동 점검의 성공이 실제 Windows GPU, 성능 또는 입력 장치 호환성 검증을 의미하지는 않습니다.

1. [릴리스 페이지](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)에서 `AI-Friends-Kart-Windows-x64-v0.4.0-20261012.zip`을 다운로드하고 함께 제공되는 SHA-256 체크섬과 대조하세요.
2. **ZIP 전체**를 한 폴더에 압축 해제하세요.
3. **AI Friends Kart.exe**를 실행하세요. 함께 있는 DLL과 `resources`, `locales` 폴더는 같은 위치에 유지하세요.
4. **F11**을 눌러 전체 화면을 전환하세요.

메인 메뉴의 **退出(Exit)** 버튼은 Windows 앱을 종료합니다. 경주에서 메인 메뉴로 돌아갈 때는 게임 안에서 이동합니다. 브라우저의 **Exit**는 휴식 페이지를 열며, 나가려면 탭을 닫으세요. 기존 데스크톱 종료 수정은 유지하지만, 이번 버전의 새로운 네이티브 Windows GPU 실기기 플레이테스트를 보장하지는 않습니다.

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
npm run food:fetch
npm run food:verify
npm run build
```

소스 압축 파일에는 별도로 다운로드하는 음식 카트 데이터도 포함되지 않습니다. 위 명령으로 복원하고 검증하세요. 자체 제작 에셋의 편집 가능한 소스와 매니페스트는 포함됩니다.

가져오기 스크립트는 독립된 `/dev/` 미리보기의 고정 공개 경로를 사용하며 [운전 모델 매니페스트](docs/runtime-models.json)와 [포트레이트 매니페스트](docs/portrait-models.json)의 압축 및 디코딩 해시를 검증합니다. 일치하지 않는 로컬 파일은 덮어쓰지 않습니다. 코드만 빌드할 수 있지만 전체 화면 표현에는 두 모델 세트의 복원이 필요합니다.

### GitHub Pages

[Build and publish PlayCanvas game 워크플로](.github/workflows/pages.yml)는 게시 전에 선택한 소스를 점검, 테스트하고 빌드합니다. 안정 버전은 사이트 루트에, 독립 미리 보기는 `/dev/`에 있습니다. 체크아웃한 브랜치의 실행 조건과 게시 옵션을 따르세요. dev 배포는 안정 버전 루트를 보존해야 하며, 배포 패키지는 해당 릴리스 태그와 같은 소스를 사용해야 합니다.

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

자동 점검은 엔진 독립적인 경주·입력 로직, 실제 PlayCanvas의 CPU/null-device 리그 로딩, 모킹된 UI 통합, 정적 배포본 검사를 다룹니다. GPU 렌더링 결과, 네이티브 포인터 잠금 동작, 성능을 보증하지는 않습니다. [테스트 범위와 한계](docs/MIGRATION-PARITY.md), [바다 셰이더 회귀 테스트 기록](docs/WATER-REGRESSION.md)을 확인하세요.

<a id="license-and-model-rights"></a>

## 라이선스 및 모델 권리

**코드와 자체 제작 게임 에셋:** AGPL-3.0-only가 적용되며, 자체 제작 UI, 서킷, 카트, 소품, 편집 가능한 원본이 포함됩니다. [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)를 확인하세요. PlayCanvas와 fflate에는 기존 MIT 라이선스가 유지됩니다.

**캐릭터 6종의 운전 모델과 별도 포트레이트:** 별도의 권리가 적용됩니다. 프로젝트 소유자는 이 모델들이 비상업적 이용 제한이 있는 Tripo Free 출력물이라고 밝히고 있으나, 정확한 재배포 조건은 독립적으로 확인되지 않았습니다. 이 저장소에 포함되었다고 해서 새로운 모델 라이선스, Creative Commons 라이선스 또는 상업적 이용 허가가 부여되는 것은 아닙니다. AGPL은 캐릭터의 라이선스를 변경하지 않습니다. 재사용하거나 재배포하기 전에 적용되는 권리를 확인하고 필요한 허가를 받으세요. [MODEL-NOTICE.txt](MODEL-NOTICE.txt)를 확인하세요.

프로젝트에 포함된 것은 최종 캐릭터 런타임 파일이며, 캐릭터 Blender 프로젝트나 하이폴리 제작 원본은 포함되지 않습니다. 자체 제작 카트·소품의 편집 가능한 파일은 대응 소스로 계속 포함됩니다. 데모에는 광고, 결제, 상업적 모델 판매가 없습니다.
