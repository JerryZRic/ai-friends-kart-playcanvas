# Neon Kart 3D · Sunset Coast

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/platform-Web-orange.svg)](https://cici-neon-kart.shtw.chatgpt.site)

一款以 Three.js 建構的原創 WebGL 街機卡丁車遊戲，包含使用 Blender 4.3.2 製作及匯出的可編輯模型。

**[在瀏覽器中遊玩](https://cici-neon-kart.shtw.chatgpt.site)**

## 功能

- 落日海岸賽道、海面著色器、平行光陰影與透視追逐鏡頭
- 六名車手、手動油門、煞車與倒車、手煞車甩尾與甩尾加速
- 三種道具、圈數與排名統計、暫停及重新開始
- 兩種追逐鏡頭、滑鼠環繞視角、暫時後視與觸控操作
- 原創可編輯 Blender 模型，以及可獨立部署的靜態網頁建置版本

## 穩定版本

`v1.0.0` 是首個 GitHub 穩定版基準，來自已發布的 Sites v5 原始碼提交 `27e465a74e2248bc2584b77e3987ea2bb88d39dd`。Sites 發布編號與 GitHub 版本標籤分別計數。詳見[版本來源與驗證紀錄](docs/releases/v1.0.0.md)。

本版本保留原有遊戲與素材，不包含後續角色及模型實驗。遊戲介面仍為中文；上方語言連結只切換 README。

## 執行需求

- 已啟用 WebGL 的瀏覽器
- 建置或執行檢查需要 Node.js 與 npm；本版本使用 Node.js 24.19.0 和 npm 11.9.0 驗證
- 隨附的本機 HTTP 伺服器指令需要 Python 3
- 編輯或重新產生模型需要 Blender 4.3.2；遊玩不需要安裝 Blender

## 快速開始

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

開啟 [http://localhost:4173](http://localhost:4173)。

`dist/` 可獨立部署，包含打包後的 Three.js 渲染器、全部四個 GLB 素材，以及授權條款與原始碼說明，無需向 CDN 發送請求。請透過 HTTP 伺服器存取，不要以 `file:` 位址直接開啟 `index.html`。也可以直接託管隨附的預先建置 `dist/`，無需重新建置。

## GitHub Pages 與獨立託管

將 **`dist/` 內的全部內容**部署為靜態網站即可。相對路徑支援網域根目錄、`/neon-kart/` 或其他子目錄，不依賴 ChatGPT 帳號、Sites 服務、CDN 或後端。請保留 `.nojekyll`、`source.html`、`source.zip` 及所有授權聲明。遊戲中的 **Source / License · 源码与许可证**連結可從同一網站下載完整專案原始碼，包括可編輯的 Blender 檔案。

已準備的 [Pages 工作流程](.github/workflows/pages.yml)直接上傳 `dist/`，**僅限手動執行**，且必須明確勾選發布；推送程式碼不會自動部署。審閱並同意公開託管後，可在 **Settings → Pages → GitHub Actions** 中設定，再從 Actions 手動執行 **Publish static game to GitHub Pages**。目前只準備了檔案，未啟用 Pages 或發布新網站。私有儲存庫通常不代表 Pages 網站也為私有，發布也會公開 `source.zip`。

Pages 的分支發布選項只接受 `/(root)` 或 `/docs`，不能直接選擇 `/dist`。建議使用上述工作流程，也可將完整分發目錄複製到這兩個位置之一。執行 `npm run test:dist` 可檢查根目錄和巢狀路徑的 HTTP 存取。目錄結構、替代方案及驗證範圍見[獨立部署指南](docs/github-pages.md)。

## 操作

| 輸入 | 功能 |
| --- | --- |
| `W` / `↑` | 油門。放開後滑行，需要手動加速。 |
| `A` / `←`、`D` / `→` | 相對於車輛向左或向右轉向。 |
| `S` / `↓` | 前進時煞車，繼續按住則倒車。 |
| `Space` | 煞車至完全停止，不會倒車。 |
| `Left Shift` + 轉向 | 手煞車甩尾，放開 Shift 觸發甩尾加速。 |
| `E` | 使用已獲得的道具。 |
| `Z` | 切換兩種追逐鏡頭並將視角置中；`C` 也可執行此操作。 |
| 按住滑鼠右鍵 | 暫時向後看，放開後恢復先前的環繞視角。 |
| 點擊賽道後移動滑鼠 | 擷取滑鼠游標，水平 360° 環繞視角，垂直視角平滑變化並限制範圍。 |
| `Q` | 平滑地將鏡頭置中。 |
| `Esc` | 暫停並釋放滑鼠游標。 |
| `P` / 暫停按鈕 | 切換暫停狀態。 |

暫停後，點擊賽道會恢復遊戲並重新擷取滑鼠；按 `P` 或點擊暫停按鈕則恢復遊戲而不擷取滑鼠。如果無法擷取滑鼠，可按住滑鼠左鍵拖曳視角。

觸控提供左轉、右轉、甩尾、煞車、倒車與油門按鈕。點擊道具面板即可使用道具。

相關駕駛鍵位參考了 NTE 公布的 PC 操作。[操作參考](https://gamewith.net/nte/75764)及其[遊戲內 HUD 圖片](https://img.gamewith.net/img/original_c5318b60d191081761bb0516dadb5cd4.png)顯示：Space 煞車、Left Shift 手煞車、Z 切換視角、滑鼠右鍵後視。`E` 使用道具是 Neon Kart 自身的鍵位。本作仍是沿賽道行進的街機賽車，不重現 NTE 的車輛物理或其他車輛功能。

## 可編輯模型

以 Blender 開啟 `models/kart.blend` 和 `models/props.blend`，原始零件與材質均可編輯。重新產生素材：

```bash
blender -b --python models/build_models.py
blender -b --python models/create_props.py
```

腳本將檔案匯出至 `models/`。重新建置前，將產生的 `kart.glb`、`palm.glb`、`rock.glb` 和 `arch.glb` 複製到 `dist/assets/`。GLB 使用 Y 軸向上的座標系，卡丁車朝向 +Z。`Body` 和 `Helmet` 材質可重新著色。

全部 Blender 素材均為本遊戲製作的原創作品，適用專案授權條款。Blender 本身是外部創作工具，不包含在儲存庫內。

## 儲存庫結構

- `src/vehicle-controls.js`：實體按鍵對應、手動油門、煞車／倒車與帶方向的轉向控制
- `src/mouse-look.js`：平滑環繞視角、俯仰範圍限制、游標鎖定生命週期與拖曳替代操作
- `src/game.js`：Three.js 場景、鏡頭、賽道、車手、甩尾加速、道具、圈數與排名
- `src/index.html`：響應式中文介面與操作控制項
- `models/`：可編輯 Blender 原始檔、程序化建模腳本與模型中繼資料
- `tests/`：滑鼠視角、車輛控制與遊戲邏輯模擬檢查
- `build.mjs`：esbuild 打包及授權／原始碼說明複製，保留本機 GLB 素材
- `dist/`：可部署的靜態遊戲、四個 GLB 與必要聲明
- `docs/releases/`：版本來源與驗證紀錄

## 驗證情況

JavaScript 語法檢查、全部 **34 項控制／鏡頭／遊戲邏輯模擬檢查**及建置均已通過。遊戲 JavaScript 與 GLB 和已發布穩定版逐位元組一致。原始碼 HTML 不變；分發打包僅在產生的 HTML 中加入可見的原始碼／授權連結。四個 GLB 均未參照外部緩衝區或圖片，兩個可編輯 Blender 檔案均未連結外部函式庫、圖片、字型或腳本。詳見[版本驗證紀錄](docs/releases/v1.0.0.md)。

原始建置也通過了 Blender 匯出、重新匯入與攝影棚渲染檢查，以及 Three.js GLB 解析與材質批次合併驗證。模擬涵蓋：360 個朝向下的轉向／偏航；兩種追逐鏡頭在賽道 32 個位置的投影；平滑滑鼠方向、俯仰限制、無限水平旋轉與置中；重複擷取點擊與組合滑鼠按鍵釋放；意外及主動釋放游標鎖定；暫停後延遲成功的游標鎖定；擷取失敗與拖曳替代操作；後視恢復；煞車／倒車；道具；暫停／輸入釋放；觸控操作；比賽／重新開始邏輯。

公開 Site 已在無需登入的情況下開啟，但雲端測試瀏覽器回報 `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled`，無法建立 WebGL 上下文。因此，**尚未在該瀏覽器中驗證實際渲染的遊戲畫面與原生游標鎖定手感**。模擬套件使用真實的 Three.js 鏡頭／幾何體與遊戲邏輯，搭配模擬渲染器及 DOM，不等同於瀏覽器視覺化遊玩測試通過。

## 授權條款

原創遊戲程式碼、介面、建置／建模腳本、測試、文件、可編輯 Blender 原始檔及匯出的 GLB 模型均採用 **GNU AGPL 第 3 版，僅此版本**（`AGPL-3.0-only`）。詳見 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

第三方軟體保留各自原有授權條款。Three.js 和 esbuild 採用 MIT 授權，相關聲明保留於 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。

AGPL 允許商業使用。散布受該授權涵蓋的作品時，須遵守授權條款及對應原始碼提供要求。如果修改本程式並透過網路提供修改後的版本供使用者互動，須依照第 13 條，向這些使用者顯著提供取得對應原始碼的機會。僅供私人使用本身不要求公開發布，也不要求將修改提交給上游。具體以完整授權條款為準。

本版本的完整對應原始碼：[JerryZRic/neon-kart v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0)。
