# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![程式碼：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

以 **PlayCanvas Engine、TypeScript 與 Vite** 打造的街機風格卡丁車遊戲，包含 12 張陸地地圖與 1 張水上地圖。從六位綁定骨架的角色車手中選一位，與其餘五位對手較量，體驗漂移加速、道具與可自由環繞的追蹤鏡頭。

**[瀏覽器穩定版](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [獨立 dev 預覽](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [網頁 / Windows 下載](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 遊戲介面採簡體中文，品牌名稱使用英文。上方語言連結僅切換說明文件。程式碼與原創資產（音樂除外）採 AGPL-3.0-only 授權；六個角色模型另受非商業使用限制。詳見[授權與模型權利](#license-and-model-rights)。

## v0.4.0 統一版本

本文說明 **v0.4.0** 的統一功能：13 張地圖、六名車手，以及包含 55 個主題 / 330 件零件的六槽食物車庫。11 張新增陸地地圖均包含場景豐富化成果。瀏覽器穩定版與下載套件採用相同功能，`/dev/` 保留為後續更新的獨立預覽。已發佈檔案、原始碼提交、校驗值及各版本的實際驗證情況以[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)為準。

自由模式包含動態 3D 封面、旋轉地圖預覽、角色 3D 檢視、車輛選擇、簡單 / 普通 / 困難比賽設定與畫面設定。故事模式仍顯示開發中提示。[實作說明與限制](docs/free-mode.md)。

### 地圖目錄

陸地賽道依 **01–12** 排列，水上地圖 **A01** 放在最後。顯示編號不改變原有地圖 ID、儲存的選擇或直達連結。

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


## 六槽食物車庫

開啟[穩定版車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html)或[dev 車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)。**55 個食物主題 / 330 件零件**包含 000 純白飯，支援整車選擇、六槽自由改裝、真實 3D 預覽、參數比較與方案儲存。瀏覽整車只做預覽，套用才替換六件，並支援替換前儲存與復原。所選裝配可用於全部 12 張陸地賽道，六位角色屬性與水上坐騎維持不變。NPC 使用相同零件公式的預設混搭車，沒有同主題加成。電量消耗、耐久損耗、修理及經濟系統尚未啟用。[實作與驗證範圍](docs/modular-garage.md)。

## 遊戲特色

- **六位可選車手：** WHALE、GEMINI、GPT、CLAUDE、GROK 和 GLM，隨附已綁定骨架的角色模型
- **三圈比賽：** 在陸地與水上地圖和五位 AI 對手競速，包含碰撞、圈數與名次追蹤，以及迷你地圖
- **街機風格駕駛：** 手動油門、煞車、倒車、手煞車漂移與漂移加速
- **三種道具：** 渦輪加速、能量護盾與追蹤脈衝
- **可視道具箱：** 半透明箱內展示原創 3D 道具，25% 為問號隨機箱；拾取後立即消失，比賽運行八秒後刷新。HUD 顯示由同一模型投影產生的道具圖片。[說明](docs/item-pickups.md)
- **道具 NPC：** 對手會爭搶真實道具箱、安全調整路線，並擇機加速、開盾或脈衝攻擊玩家及其他 NPC；頭頂道具與使用特效清晰可見。[說明](docs/npc-tactics.md)
- **兩種追蹤鏡頭**，支援滑鼠環繞、回正與暫時後視
- 暫停／重新開始、音效、鍵盤操作與螢幕觸控按鈕
- 可選用本機 GLB 替換車手，僅限本次遊玩，不會上傳

## 在瀏覽器中遊玩

以已啟用 **WebGL2** 的瀏覽器開啟 **[GitHub Pages 遊戲](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等待角色載入後，選擇車手並開始比賽。

首次比賽角色下載總容量約 **51.6 MB**；選取的站姿肖像和食物車輛零件另依需要下載。最多同時下載／準備兩個角色模型。載入畫面顯示實際位元組進度、解壓縮及準備狀態；暫時性錯誤會有限次重試，也可只重試失敗檔案，保留已載入模型。缺少模型時不使用替身，必要資源全部就緒才開始比賽。比賽載入期間會巡遊賽道上空，再平順返回起點。

不需要登入 ChatGPT、模型服務帳號或執行時 CDN。遊戲與角色資產均由同一套發佈檔案提供。

## 網頁 / HTML 下載套件

從[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)選擇 `AI-Friends-Kart-Web-HTML-v0.4.0-20261012.zip`，並核對隨附的 SHA-256 校驗值。完整解壓縮後，以 HTTP(S) 提供遊戲檔案；不支援以 `file://` 直接開啟 `index.html`。請保留全部資產、授權聲明與對應原始碼檔案。

## Windows 下載套件

**需要 64 位元 Windows 10/11，以及支援 WebGL2 的 GPU。** 請使用 v0.4.0 套件並閱讀對應發行說明。封裝成功及自動化檢查不代表已驗證真實 Windows GPU、效能或輸入裝置相容性。

1. 從[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)下載 `AI-Friends-Kart-Windows-x64-v0.4.0-20261012.zip`，並核對隨附的 SHA-256 校驗值。
2. 將**整個 ZIP** 解壓縮至一個資料夾。
3. 執行 **AI Friends Kart.exe**。請保留旁邊的 DLL 檔案及 `resources`、`locales` 資料夾，勿將它們分開。
4. 按 **F11** 切換全螢幕。

主選單的**退出**按鈕會關閉 Windows 應用程式；從比賽返回主選單仍是遊戲內導覽。瀏覽器中的**退出**會開啟休息頁面，關閉分頁即可離開。保留既有桌面退出修正，不據此宣稱本版本已完成新的原生 Windows GPU 實機試玩。

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

完整複製儲存庫時，會包含 `public/assets/drivers/` 中的六個駕駛模型壓縮檔，以及 `public/assets/portraits/` 中的六個獨立站姿肖像壓縮檔。部署時提供的精簡版 `source.zip` 包含程式碼、測試、兩份校驗清單、建置檔案與原創可編輯資產，但不含這兩組角色壓縮檔。解壓縮後，可用以下方式還原：

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

原始碼套件也不含另行下載的食物車輛資料，請以上述指令還原並驗證。原創可編輯資產原始碼及校驗清單仍包含在套件中。

下載腳本使用獨立 `/dev/` 預覽的固定公開路徑，並驗證[駕駛模型清單](docs/runtime-models.json)及[站姿肖像清單](docs/portrait-models.json)中的壓縮檔與解壓後雜湊值；若本機檔案不符，腳本會拒絕覆寫。程式碼仍可單獨建置；完整畫面需還原兩組模型。

### GitHub Pages

[Build and publish PlayCanvas game 工作流程](.github/workflows/pages.yml)會在發佈前檢查、測試及建置所選原始碼。穩定版位於網站根目錄，獨立預覽位於 `/dev/`。請依目前分支的工作流程觸發條件與發佈選項操作；dev 部署必須保留穩定版根目錄。發行套件必須使用對應版本標籤的相同原始碼。

### 專案結構

- `src/`：PlayCanvas 場景、賽道、比賽邏輯、輸入、鏡頭與角色載入
- `public/assets/`：隨附的執行時資產，包含六個壓縮車手模型
- `models/`：原創卡丁車與場景物件的可編輯原始檔
- `tests/`：邏輯、載入、介面與引擎層級檢查
- `scripts/`：原始碼打包、執行時模型下載與發佈檔案檢查
- `docs/`：模型清單、本機匯入規格與技術驗證說明

## 本機車手替換

選擇車手欄位並匯入相容 GLB，或多選檔名中各含唯一車手欄位名稱標記的檔案。每個檔案上限 **32 MiB**，最多同時處理兩個。匯入內容僅保留於頁面記憶體，不上傳也不永久儲存。失敗或取消時保留原車手；**恢復預設**會還原隨附角色。簡化後的比賽載入頁隱藏舊匯入控制項，角色選擇在主選單進行。

支援的模型與驗證規則詳見[骨架與匯入規格](docs/local-import.md)。

## 驗證

自動化檢查涵蓋不依賴引擎的比賽／輸入邏輯、真實 PlayCanvas CPU／null-device 骨架載入、模擬介面整合，以及靜態發佈檔案檢查。這些檢查無法證實 GPU 畫面效果、原生滑鼠鎖定行為或效能。詳見[測試涵蓋範圍與限制](docs/MIGRATION-PARITY.md)及[海洋著色器回歸測試說明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>

## 授權與模型權利

**程式碼與原創遊戲資產（音樂除外）：** 採 AGPL-3.0-only 授權，包括原創介面、賽道、卡丁車、場景物件及可編輯原始檔。詳見 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 與 fflate 保留各自的 MIT 授權。

**原創音樂（© 2026 JerryZRic）：** 適用[獨立音樂授權](public/assets/music/LICENSE.txt)。三首音樂作品與錄音及其改編可隨本遊戲與 fork 非商業使用、修改及散布，須署名並保留聲明；商用須事先取得 JerryZRic 同意。不因此授權無關專案或脫離遊戲及其 fork 單獨散布、銷售音樂。程式碼的 AGPL 條款不變。

**六個角色的駕駛與獨立站姿肖像模型：** 適用獨立的權利條件。專案擁有者表示，這些模型是 Tripo Free 方案產出，受非商業使用限制；確切的再散布條款尚未經獨立確認。本專案收錄模型不代表授予新的模型授權、Creative Commons 授權或商業使用許可。AGPL 不會為角色模型重新授權。重複使用或再散布之前，請確認適用的權利條件，並取得所有必要許可。詳見 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

本專案包含可供遊戲執行的最終角色檔案，不含角色的 Blender 專案或高多邊形製作原始檔。原創卡丁車／場景物件的可編輯檔案仍作為對應原始碼一併提供。本展示遊戲沒有廣告、付費功能或商業模型銷售。
