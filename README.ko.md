# Neon Kart 3D · Sunset Coast

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/platform-Web-orange.svg)](https://cici-neon-kart.shtw.chatgpt.site)

Three.js로 만든 오리지널 WebGL 아케이드 카트 레이싱 게임입니다. 에셋은 Blender 4.3.2에서 모델링하고 내보냈으며, 편집 가능한 소스도 포함합니다.

**[브라우저에서 플레이](https://cici-neon-kart.shtw.chatgpt.site)**

## 기능

- 노을 지는 해안 서킷, 바다 셰이더, 방향성 조명의 그림자와 원근 추적 카메라
- 레이서 6명, 수동 가속, 제동과 후진, 핸드브레이크 드리프트와 드리프트 부스트
- 아이템 3종, 랩과 순위 추적, 일시 정지와 재시작
- 추적 카메라 2종, 마우스 시점 회전, 일시적인 후방 보기와 터치 조작
- 편집 가능한 오리지널 Blender 모델과 자체 완결형 정적 웹 빌드

## 안정 버전

`v1.0.0`은 GitHub의 첫 안정 버전 기준선입니다. 공개된 Sites v5의 소스 커밋 `27e465a74e2248bc2584b77e3987ea2bb88d39dd`를 기준으로 합니다. Sites 게시 번호와 GitHub 릴리스 태그는 별도로 매깁니다. [릴리스 출처와 검증](docs/releases/v1.0.0.md)을 참고하세요.

이 릴리스는 원래 게임과 에셋을 유지하며, 이후의 캐릭터 및 모델 실험은 포함하지 않습니다. 게임 인터페이스는 여전히 중국어입니다. 위의 언어 링크는 README의 언어만 바꿉니다.

## 요구 사항

- WebGL이 활성화된 브라우저
- 빌드나 검사 실행에는 Node.js와 npm이 필요합니다. 이 릴리스는 Node.js 24.19.0과 npm 11.9.0으로 검증했습니다
- 안내된 로컬 HTTP 서버 명령에는 Python 3이 필요합니다
- 모델 편집이나 재생성에는 Blender 4.3.2가 필요합니다. 게임 플레이에는 필요하지 않습니다

## 빠른 시작

```bash
git clone https://github.com/JerryZRic/neon-kart.git
cd neon-kart
npm ci
npm run check
npm test
npm run build
npm run test:dist
npm run serve
```

[http://localhost:4173](http://localhost:4173)을 엽니다.

`dist/` 폴더만으로 실행할 수 있습니다. 번들된 Three.js 렌더러, GLB 에셋 4개 전체, 라이선스 및 소스 코드 고지를 포함하며 CDN 요청은 필요하지 않습니다. `index.html`을 `file:` URL로 직접 열지 말고 HTTP로 제공하세요. 포함된 사전 빌드 `dist/`를 다시 빌드하지 않고 바로 제공할 수도 있습니다.

## GitHub Pages 및 독립 호스팅

**`dist/` 안의 모든 파일**을 정적 사이트로 배포할 수 있습니다. 상대 경로를 사용하므로 도메인 루트, `/neon-kart/` 또는 다른 하위 경로에서 동작합니다. ChatGPT 계정, Sites 서비스, CDN, 백엔드가 필요하지 않습니다. `.nojekyll`, `source.html`, `source.zip` 및 모든 라이선스 고지를 함께 배포하세요. 게임의 **Source / License · 源码与许可证** 링크에서 편집 가능한 Blender 파일을 포함한 전체 프로젝트 소스를 같은 사이트에서 다운로드할 수 있습니다.

준비된 [Pages 워크플로](.github/workflows/pages.yml)는 `dist/`를 직접 업로드합니다. **수동 실행만** 지원하며 공개 확인란을 명시적으로 선택해야 합니다. 코드 푸시로는 배포되지 않습니다. 검토 후 공개 호스팅을 승인하면 **Settings → Pages → GitHub Actions**를 선택한 뒤 Actions에서 **Publish static game to GitHub Pages**를 실행하세요. 현재는 파일만 준비했으며 Pages를 활성화하거나 새 사이트를 공개하지 않았습니다. 비공개 저장소라고 Pages 사이트도 비공개인 것은 아니며, 배포하면 `source.zip`도 공개됩니다.

브랜치 기반 Pages 게시에서는 `/(root)` 또는 `/docs`만 선택할 수 있고 `/dist`는 직접 선택할 수 없습니다. 위 워크플로를 권장하며, 전체 배포 파일을 지원되는 위치에 복사하는 방법도 있습니다. `npm run test:dist`로 루트와 중첩 경로의 HTTP 접근을 검사할 수 있습니다. 구성, 대안 및 검증 범위는 [독립 배포 가이드](docs/github-pages.md)를 참고하세요.

## 조작

| 입력 | 동작 |
| --- | --- |
| `W` / `↑` | 가속합니다. 놓으면 관성으로 주행하며, 가속은 수동입니다. |
| `A` / `←`, `D` / `→` | 차량을 기준으로 왼쪽 또는 오른쪽으로 조향합니다. |
| `S` / `↓` | 전진 중에는 제동하고, 계속 누르면 멈춘 뒤 후진합니다. |
| `Space` | 후진하지 않고 완전히 멈출 때까지 제동합니다. |
| `Left Shift` + 조향 | 핸드브레이크 드리프트. Shift를 놓으면 드리프트 부스트가 발동합니다. |
| `E` | 획득한 아이템을 사용합니다. |
| `Z` | 추적 카메라 2종을 전환하고 시점을 중앙으로 되돌립니다. `C`도 같은 동작을 합니다. |
| 마우스 오른쪽 버튼 누르기 | 누르는 동안 뒤를 봅니다. 놓으면 이전 시점 각도로 돌아갑니다. |
| 트랙을 클릭한 뒤 마우스 이동 | 포인터를 잠그고 카메라를 수평으로 360° 회전합니다. 수직 시점 이동은 부드럽게 처리되며 각도에 제한이 있습니다. |
| `Q` | 시점을 부드럽게 중앙으로 되돌립니다. |
| `Esc` | 일시 정지하고 포인터 잠금을 해제합니다. |
| `P` / 일시 정지 버튼 | 일시 정지와 재개를 전환합니다. |

일시 정지 후 트랙을 클릭하면 게임을 재개하고 포인터를 다시 잠급니다. `P` / 일시 정지 버튼으로는 포인터를 잠그지 않고 재개할 수 있습니다. 포인터 잠금을 사용할 수 없으면 마우스 왼쪽 버튼을 누른 채 드래그해 시점을 움직일 수 있습니다.

터치 조작은 좌우 조향, 드리프트, 제동, 후진과 가속을 제공합니다. 아이템 패널을 탭하면 아이템을 사용합니다.

해당 운전 키 배치는 문서화된 NTE의 PC 조작을 따릅니다. [조작 참고 자료](https://gamewith.net/nte/75764)와 [게임 내 HUD 이미지](https://img.gamewith.net/img/original_c5318b60d191081761bb0516dadb5cd4.png)에는 Space가 제동, Left Shift가 핸드브레이크, Z가 카메라 전환, 마우스 오른쪽 버튼이 후방 보기로 표시되어 있습니다. 아이템에 사용하는 `E`는 Neon Kart 고유의 배치입니다. 이 게임은 차선을 따라 달리는 아케이드 레이싱 게임이며, NTE의 차량 물리나 다른 차량 기능을 재현하지 않습니다.

## 편집 가능한 모델

Blender에서 `models/kart.blend`와 `models/props.blend`를 여세요. 원래 부품과 재질을 편집할 수 있습니다. 에셋을 다시 생성하려면 다음 명령을 실행합니다.

```bash
blender -b --python models/build_models.py
blender -b --python models/create_props.py
```

스크립트는 `models/`로 내보냅니다. 다시 빌드하기 전에 생성된 `kart.glb`, `palm.glb`, `rock.glb`, `arch.glb`를 `dist/assets/`에 복사하세요. GLB는 Y축이 위인 좌표계를 사용하며, 카트는 +Z 방향을 향합니다. `Body`와 `Helmet` 재질의 색상을 바꿀 수 있습니다.

모든 Blender 에셋은 이 게임을 위해 만든 오리지널 작업물이며 프로젝트 라이선스의 적용을 받습니다. Blender 자체는 외부 제작 도구이며 포함하지 않습니다.

## 저장소 구조

- `src/vehicle-controls.js`: 물리 키 매핑, 수동 가속, 제동과 후진, 양수·음수 방향을 반영한 조향
- `src/mouse-look.js`: 부드러운 시점 회전, 수직 각도 제한, 포인터 잠금 수명 주기와 드래그 대체 조작
- `src/game.js`: Three.js 장면, 카메라, 트랙, 레이서, 드리프트 부스트, 아이템, 랩과 순위
- `src/index.html`: 반응형 중국어 인터페이스와 조작 UI
- `models/`: 편집 가능한 Blender 소스, 절차적 모델링 스크립트와 모델 메타데이터
- `tests/`: 마우스 시점, 차량 조작과 게임플레이 시뮬레이션 검사
- `build.mjs`: esbuild 번들 및 라이선스·소스 코드 고지 복사. 로컬 GLB 에셋을 유지합니다
- `dist/`: 배포 가능한 정적 게임, GLB 4개와 필수 고지
- `docs/releases/`: 릴리스 출처와 검증

## 검증

JavaScript 구문 검사, **조작·카메라·게임플레이 시뮬레이션 검사 34개 전체**, 빌드를 통과했습니다. 게임 JavaScript와 GLB는 공개된 안정 버전과 바이트 단위까지 동일합니다. 소스 HTML은 변경하지 않으며, 배포 HTML에 눈에 보이는 소스·라이선스 링크만 추가합니다. GLB 4개 모두 외부 버퍼나 이미지 참조가 없으며, 편집 가능한 Blender 파일 2개에도 외부 라이브러리, 이미지, 글꼴 또는 스크립트 링크가 없습니다. [릴리스 검증](docs/releases/v1.0.0.md)을 참고하세요.

원래 빌드는 Blender 내보내기, 다시 가져오기, 스튜디오 렌더 검사와 Three.js GLB 파싱 및 재질 배칭 검증도 통과했습니다. 시뮬레이션은 360개 방향에서의 조향과 요 회전, 두 추적 카메라의 서킷 내 32개 지점 투영, 부드러운 마우스 시점 이동, 수직 각도 제한, 무제한 수평 회전과 중앙 복귀, 반복 클릭을 통한 포인터 잠금과 여러 마우스 버튼을 함께 누른 뒤 놓는 동작, 예기치 않은 잠금 해제와 의도적인 잠금 해제, 일시 정지 후 늦게 성공하는 잠금, 잠금 실패와 드래그 대체 조작, 후방 보기에서의 복귀, 제동과 후진, 아이템, 일시 정지 시 입력 해제, 터치 조작, 레이스와 재시작 로직을 검사합니다.

공개 Site는 로그인 없이 열었지만, 클라우드 테스트 브라우저가 `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled`를 보고해 WebGL 컨텍스트를 만들 수 없었습니다. 따라서 렌더링된 게임플레이와 네이티브 포인터 잠금의 조작감은 **해당 브라우저에서 검증하지 못했습니다**. 시뮬레이션 테스트는 실제 Three.js 카메라·지오메트리와 게임 로직을 모의 렌더러 및 DOM으로 실행합니다. 브라우저에서 렌더링된 게임을 직접 보며 플레이한 검증은 아닙니다.

## 라이선스

오리지널 게임 코드, UI, 빌드·모델링 스크립트, 테스트, 문서, 편집 가능한 Blender 소스와 내보낸 GLB 모델에는 **GNU AGPL 버전 3만**(`AGPL-3.0-only`) 적용합니다. [LICENSE](LICENSE)와 [NOTICE](NOTICE)를 참고하세요.

서드파티 소프트웨어는 원래 라이선스를 유지합니다. Three.js와 esbuild는 MIT 라이선스이며, 해당 고지를 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)에 보존합니다.

AGPL은 상업적 이용을 허용합니다. 적용 대상 작업물을 배포한다면 라이선스와 대응 소스 코드 제공 요건을 따라야 합니다. 이 프로그램을 수정한 뒤 사용자가 네트워크를 통해 수정 버전과 상호작용할 수 있도록 제공한다면, 제13조에 따라 해당 사용자에게 대응 소스 코드를 받을 수 있는 방법을 눈에 잘 띄게 안내해야 합니다. 비공개로 사용하는 것만으로 공개 의무가 생기지는 않으며, 변경 사항을 원본 프로젝트에 보낼 의무도 없습니다. 최종 조건은 라이선스 전문을 따릅니다.

이 릴리스의 완전한 대응 소스 코드: [JerryZRic/neon-kart at v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0).
