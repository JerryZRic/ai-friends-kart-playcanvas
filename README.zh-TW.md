# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![程式碼：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

以 **PlayCanvas Engine、TypeScript 與 Vite** 打造的街機風格卡丁車遊戲，在夕陽海岸賽道上競速。從六位綁定骨架的角色車手中選一位，與其餘五位對手較量，體驗漂移加速、道具，以及可自由環繞的追蹤鏡頭。

**[在瀏覽器中遊玩](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [下載 Windows 試玩版](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> 遊戲介面採簡體中文，品牌名稱使用英文。上方語言連結僅切換說明文件。程式碼與原創資產採 AGPL-3.0-only 授權；六個角色模型另受非商業使用限制。詳見[授權與模型權利](#license-and-model-rights)。

## 遊戲特色

- **六位可選車手：** WHALE、GEMINI、GPT、CLAUDE、GROK 和 GLM，隨附已綁定骨架的角色模型
- 在夕陽海岸賽道上與五位 AI 對手進行**三圈比賽**，包含海景、碰撞、圈數與名次追蹤，以及迷你地圖
- **街機風格駕駛：** 手動油門、煞車、倒車、手煞車漂移與漂移加速
- **三種道具：** 渦輪加速、能量護盾與追蹤脈衝
- **可視道具箱：** 半透明箱內展示原創 3D 道具，25% 為問號隨機箱；拾取後立即消失，比賽運行八秒後刷新。HUD 顯示由同一模型投影產生的道具圖片。[說明](docs/item-pickups.md)
- **道具 NPC：** 對手會爭搶真實道具箱、安全調整路線，並擇機加速、開盾或脈衝攻擊玩家及其他 NPC；頭頂道具與使用特效清晰可見。[說明](docs/npc-tactics.md)
- **兩種追蹤鏡頭**，支援滑鼠環繞、回正與暫時後視
- 暫停／重新開始、音效、鍵盤操作與螢幕觸控按鈕
- 可選用本機 GLB 替換車手，僅限本次遊玩，不會上傳

## 在瀏覽器中遊玩

以已啟用 **WebGL2** 的瀏覽器開啟 **[GitHub Pages 遊戲](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等待角色載入後，選擇車手並開始比賽。

首次下載角色的總容量約為 **51.6 MB**，最多同時下載／準備兩個模型。載入畫面會顯示實際位元組進度、解壓縮與準備狀態；暫時性錯誤會在限定次數內重試，也可重試失敗的檔案，不會失去已載入的模型。缺少模型時，會明確標示改用原創車手作為替代。

不需要登入 ChatGPT、模型服務帳號或執行時 CDN。遊戲與角色資產均由同一套發佈檔案提供。

## Windows 試玩版

**需要 64 位元 Windows 10/11，以及支援 WebGL2 的 GPU。** 這是預先發佈的試玩版本，尚非正式版。

1. 從[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)下載 [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip)。
2. 將**整個 ZIP** 解壓縮至一個資料夾。
3. 執行 **AI Friends Kart.exe**。請保留旁邊的 DLL 檔案及 `resources`、`locales` 資料夾，勿將它們分開。
4. 按 **F11** 切換全螢幕。

六個角色均已隨附，可離線遊玩。不需要 Node.js、安裝程序或系統管理員權限。請勿為了執行遊戲而停用 Windows 安全防護。

壓縮檔包含 `Game-Corresponding-Source.zip`、內含桌面封裝程式與建置說明的 `Desktop-Source`，以及授權聲明。桌面封裝內容由該發行版本提供；本儲存庫的 npm 指令用於建置網頁版遊戲。

## 操作方式

| 輸入 | 動作 |
| --- | --- |
| `W` / `↑` | 油門；放開後滑行 |
| `A` / `←`, `D` / `→` | 向左／向右轉向 |
| `S` / `↓` | 煞車；持續按住則倒車 |
| `Space` | 煞車但不倒車 |
| `Left Shift` + 轉向 | 漂移；放開 Shift 觸發蓄力漂移加速 |
| `E` | 使用取得的道具 |
| `Z` / `C` | 切換追蹤鏡頭 |
| 按住滑鼠右鍵 | 暫時後視 |
| 點擊賽道，再移動滑鼠 | 環繞鏡頭 |
| `Q` | 將鏡頭回正 |
| `Esc` | 暫停並釋放滑鼠游標 |
| `P` / 暫停按鈕 | 暫停／繼續 |

若無法鎖定滑鼠游標，可按住滑鼠左鍵拖曳來環顧四周。觸控按鈕提供油門、轉向、倒車、煞車與漂移；點一下道具面板即可使用道具。選單按鈕支援原生鍵盤操作。

## 開發與建置

需要 **Node.js 22.12 或更新版本**，以及 npm。

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

開啟 Vite 顯示的 HTTP 位址。檢查並建置正式發佈版本：

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

請透過 HTTP(S) 提供完整的 **`dist/`** 目錄，不要以 `file://` 直接開啟 `index.html`。相對路徑同時支援網域根目錄與儲存庫子目錄。請將授權聲明、`source.html` 和 `source.zip` 與遊戲一併保留。

完整複製儲存庫時，會包含 `public/assets/drivers/` 中的六個 `.glb.gz` 檔案。部署時提供的精簡版 `source.zip` 包含程式碼、測試、建置檔案與原創可編輯資產，但不含這六個角色壓縮檔。解壓縮該原始碼套件後，可用以下方式還原角色檔案：

```sh
npm ci
npm run models:fetch
npm run build
```

下載腳本使用固定的公開路徑，並驗證[執行時模型清單](docs/runtime-models.json)中記錄的壓縮檔與解壓後雜湊值；若本機檔案不符，腳本會拒絕覆寫。即使沒有角色檔案，程式碼仍可建置，並使用明確標示的原創車手替代模型。

### GitHub Pages

[Build and publish PlayCanvas game 工作流程](.github/workflows/pages.yml)需要**手動執行**。在儲存庫的 **Settings → Pages** 中選擇 **GitHub Actions**。於 `main` 上執行工作流程，並勾選 **Publish**。工作流程會先檢查、測試及建置所選提交，再進行發佈。一般推送不會部署遊戲。

### 專案結構

- `src/`：PlayCanvas 場景、賽道、比賽邏輯、輸入、鏡頭與角色載入
- `public/assets/`：隨附的執行時資產，包含六個壓縮車手模型
- `models/`：原創卡丁車與場景物件的可編輯原始檔
- `tests/`：邏輯、載入、介面與引擎層級檢查
- `scripts/`：原始碼打包、執行時模型下載與發佈檔案檢查
- `docs/`：模型清單、本機匯入規格與技術驗證說明

## 本機車手替換

選擇一個車手欄位並匯入相容的 GLB，也可多選檔案，但每個檔名必須恰好包含一個車手欄位名稱標記。每個檔案上限為 **32 MiB**，最多同時處理兩個。匯入內容僅保留於頁面記憶體中，不會上傳或永久儲存。匯入失敗或取消時會保留原先的車手；**恢復預設**會還原隨附角色或明確標示的替代模型。

支援的模型與驗證規則詳見[骨架與匯入規格](docs/local-import.md)。

## 驗證

自動化檢查涵蓋不依賴引擎的比賽／輸入邏輯、真實 PlayCanvas CPU／null-device 骨架載入、模擬介面整合，以及靜態發佈檔案檢查。這些檢查無法證實 GPU 畫面效果、原生滑鼠鎖定行為或效能。詳見[測試涵蓋範圍與限制](docs/MIGRATION-PARITY.md)及[海洋著色器回歸測試說明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>

## 授權與模型權利

**程式碼與原創遊戲資產：** 採 AGPL-3.0-only 授權，包括原創介面、賽道、卡丁車、場景物件及可編輯原始檔。詳見 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 與 fflate 保留各自的 MIT 授權。

**六個角色模型：** 適用獨立的權利條件。專案擁有者表示，這些模型是 Tripo Free 方案產出，受非商業使用限制；確切的再散布條款尚未經獨立確認。本專案收錄模型不代表授予新的模型授權、Creative Commons 授權或商業使用許可。AGPL 不會為角色模型重新授權。重複使用或再散布之前，請確認適用的權利條件，並取得所有必要許可。詳見 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

本專案包含可供遊戲執行的最終角色檔案，不含角色的 Blender 專案或高多邊形製作原始檔。原創卡丁車／場景物件的可編輯檔案仍作為對應原始碼一併提供。本展示遊戲沒有廣告、付費功能或商業模型銷售。
