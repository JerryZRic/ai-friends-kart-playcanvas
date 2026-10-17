# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![程式碼：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

以 **PlayCanvas Engine、TypeScript 與 Vite** 打造的街機風格卡丁車遊戲，包含 12 張陸地地圖與 1 張水上地圖。從六位綁定骨架的角色車手中選一位，與其餘五位對手較量，體驗漂移加速、道具與可自由環繞的追蹤鏡頭。

**[瀏覽器 main 版](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [獨立 dev 預覽](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [Web / HTML 與 Windows 下載](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 遊戲介面採簡體中文，品牌名稱使用英文。上方語言連結僅切換說明文件。程式碼與原創資產（音樂除外）採 AGPL-3.0-only 授權；六個角色模型另受非商業使用限制。詳見[授權與模型權利](#license-and-model-rights)。

## v1.1.1 首頁熱修復（正式穩定版）

**v1.1.1 是 Web / HTML 與 Windows x64 正式穩定熱修復版（`prerelease=false`、`latest=true`）。** 本次修復首頁渲染控制權問題；使用者已在 Firefox 中驗證 dev 提交 `73fbe76ba477b8595006e41998efdf83e5e2da1b` 的修復效果。本次小範圍熱修復的驗證範圍為針對性回歸、建置與封裝檢查及原生 Windows 啟動；具體結果與限制見 [v1.1.1 發行說明](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.1)。v1.1.1 未重新執行完整 2,073 項測試，v1.1.0 的全量測試結果僅作為該舊版本的歷史證據。下方建議的熱修復下載已更新為 v1.1.1；[上一穩定版 v1.1.0 仍可下載](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0)。

## v1.1.0 上一穩定版

**v1.1.0 是 Web / HTML 與 Windows x64 上一正式穩定版。** 保留 13 張地圖、六名車手，以及 55 個主題 / 330 件零件的六槽食物車庫；11 張新增陸地地圖均包含場景豐富化成果。已發佈檔案、原始碼提交、校驗值與驗證說明以[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0)為準。網站根目錄是 main 發佈入口，`/dev/` 是獨立開發預覽。

自由模式包含六角色隨機動態封面、旋轉地圖預覽、角色 3D 檢視、車輛選擇、簡單 / 普通 / 困難比賽設定與畫面設定。封面使用自訂 PlayCanvas 2D 網格動畫，並非 Cubism；大肥魚（WHALE）的出現機率為 35%，其餘五位均分 65%。故事模式仍顯示開發中提示。[實作說明與限制](docs/free-mode.md)。

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

開啟[main 版車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html)或[dev 車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)。**55 個食物主題 / 330 件零件**包含 000 純白飯，支援整車選擇、六槽自由改裝、真實 3D 預覽、參數比較與方案儲存。瀏覽整車只做預覽，套用才替換六件，並支援替換前儲存與復原。所選裝配可用於全部 12 張陸地賽道，六位角色屬性與水上坐騎維持不變。NPC 使用相同零件公式的預設混搭車，沒有同主題加成。電量消耗、耐久損耗、修理及經濟系統尚未啟用。[實作與驗證範圍](docs/modular-garage.md)。

## 遊戲特色

- **六位可選車手：** WHALE、GEMINI、GPT、CLAUDE、GROK 和 GLM，隨附已綁定骨架的角色模型
- **三圈比賽：** 在陸地與水上地圖和五位 AI 對手競速，包含碰撞、圈數與名次追蹤，以及迷你地圖
- **街機風格駕駛：** 手動油門、煞車、倒車、手煞車漂移與漂移加速
- **固定 E/R 雙槽與三同類升級：** 正式版與 dev 預設啟用堆疊。同槽兩個普通同類道具每次使用消耗一個，第三枚變成一次 super；已有 super 後，同類箱會被消耗，但不強化、不填另一槽、不產生 Token。有空槽時神秘箱照常抽取，雙槽滿時不接收。E/R 共用 1.2 秒冷卻。暫停設定中切換後須套用並重新開始；`itemStacking=0` 恢復普通雙槽。玩家與 NPC 使用相同規則，槽位固定不移位。
- **音樂：** 所有陸地與水上比賽共用 17 首隨機曲池；選單播放 THEME，Love 保留且不進入比賽曲池。保留原音質 MP3，不轉碼；音樂適用獨立非商業授權。
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

從[發行頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)選擇 [`ai-friends-kart-playcanvas-v1.1.1-html.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-html.zip)，並核對隨附的 SHA-256 校驗值。完整解壓縮後，透過 nginx 或其他 HTTP(S) 靜態伺服器部署；不支援以 `file://` 直接開啟 `index.html`。保留全部資產、授權聲明與對應原始碼檔案。根目錄與子目錄部署的驗證結果以發行說明為準，相對路徑設計不能取代對實際發行套件的驗證。

正式 GitHub Pages 網站提供執行時檔案；對應原始碼請從 [v1.1.1 發佈頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.1)下載獨立的 [`source.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/source.zip)。完整 HTML ZIP 仍包含 `source.zip` 與全部執行時資源。歷史離線平衡報告及資料保留於 `/dev/`。v1.1.1 從最終合併後的 `main` 提交建立 tag，不直接從 `dev` 發佈。

GitHub Pages 根目錄與 Timewish 託管執行版不包含離線平衡診斷資料集；診斷入口連結至固定版本的 [v1.1.1 完整 HTML 套件](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-html.zip)，不會跳轉至隨 dev 更新的診斷頁。完整 HTML ZIP 保留資料集與可用的離線診斷。

## Windows x64 套件

下載 [`ai-friends-kart-playcanvas-v1.1.1-windows-x64.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-windows-x64.zip) · [SHA256SUMS](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/SHA256SUMS)

需要 64 位元 Windows 10/11 與支援 WebGL2 的 GPU。完整解壓縮 ZIP，將 DLL、`resources` 和 `locales` 資料夾保留在一起，執行 **AI Friends Kart.exe**；按 **F11** 切換全螢幕。請勿停用 Windows 安全防護。自動封裝、安全及協定檢查不能證實原生 Windows GPU、效能或輸入相容性。

## 操作方式

| 輸入 | 動作 |
| --- | --- |
| `W` / `↑` | 油門；放開後滑行 |
| `A` / `←`, `D` / `→` | 向左／向右轉向 |
| `S` / `↓` | 煞車；持續按住則倒車 |
| `Space` | 煞車但不倒車 |
| `Left Shift` + 轉向 | 漂移；放開 Shift 觸發蓄力漂移加速 |
| `E` / `R` | 使用對應固定槽位中的道具 |
| `Z` / `C` | 切換追蹤鏡頭 |
| 按住滑鼠右鍵 | 暫時後視 |
| 點擊賽道，再移動滑鼠 | 環繞鏡頭 |
| `Q` | 將鏡頭回正 |
| `Esc` | 暫停並釋放滑鼠游標 |
| `P` / 暫停按鈕 | 暫停／繼續 |

若無法鎖定滑鼠游標，可按住左鍵拖曳來環顧四周。觸控按鈕提供油門、轉向、倒車、煞車與漂移，並有獨立的 `E`、`R` 道具按鈕。選單按鈕支援原生鍵盤操作。手機遊戲區域抑制誤選文字、拖曳圖片、右鍵選單與干擾手勢，同時保留必要的輸入欄位操作與捲動。無法保證攔截所有系統輔助縮放；這些改動尚未經過實際手機 QA。

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

請透過 HTTP(S) 提供完整的 **`dist/`** 目錄，不要以 `file://` 直接開啟 `index.html`。相對路徑在網域根目錄與子目錄下的部署，需依實際發行套件與發行驗證說明確認。請將授權聲明、`source.html` 和 `source.zip` 與遊戲一併保留。

完整複製儲存庫時，會包含 `public/assets/drivers/` 中的六個駕駛模型壓縮檔，以及 `public/assets/portraits/` 中的六個獨立站姿肖像壓縮檔。Release 提供的精簡版 `source.zip` 包含程式碼、測試、兩份校驗清單、建置檔案與原創可編輯資產，但不含這兩組角色壓縮檔。解壓縮後，可用以下方式還原：

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

版本標記：正式穩定熱修復版 `v1.1.1`，dev 使用實際建置提交 `v1.1.1-dev.<sha6>`，未提供提交的本機建置為 `v1.1.1-dev.local`。

開發版版本號附加實際 commit 雜湊值的前六碼。發行版本從 `main` 建立 tag，套件必須使用該標籤對應的原始碼；dev 部署必須保留 main 網站根目錄。

[Build and publish PlayCanvas game 工作流程](.github/workflows/pages.yml)會在發佈前檢查、測試及建置所選原始碼。main 版位於網站根目錄，獨立預覽位於 `/dev/`。請依目前分支的工作流程觸發條件與發佈選項操作；dev 部署必須保留main 根目錄。發行套件必須使用對應版本標籤的相同原始碼。

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

歷史 CPU 候選 21 的結果僅適用於單道具槽 baseline，不能視為新雙槽玩法平衡或公平性的認證。尚未進行實際手機 QA。

自動化檢查涵蓋不依賴引擎的比賽／輸入邏輯、真實 PlayCanvas CPU／null-device 骨架載入、模擬介面整合，以及靜態發佈檔案檢查。這些檢查無法證實 GPU 畫面效果、原生滑鼠鎖定行為或效能。詳見[測試涵蓋範圍與限制](docs/MIGRATION-PARITY.md)及[海洋著色器回歸測試說明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>

## 授權與模型權利

**程式碼與原創遊戲資產（音樂除外）：** 採 AGPL-3.0-only 授權，包括原創介面、賽道、卡丁車、場景物件及可編輯原始檔。詳見 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 與 fflate 保留各自的 MIT 授權。

**原創音樂（© 2026 JerryZRic）：** 適用[獨立音樂授權](public/assets/music/LICENSE.txt)。音樂作品與錄音及其改編可隨本遊戲與 fork 非商業使用、修改及散布，須署名並保留聲明；商用須事先取得 JerryZRic 同意。不因此授權無關專案或脫離遊戲及其 fork 單獨散布、銷售音樂。程式碼的 AGPL 條款不變。

**六個角色的駕駛與獨立站姿肖像模型：** 適用獨立的權利條件。專案擁有者表示，這些模型是 Tripo Free 方案產出，受非商業使用限制；確切的再散布條款尚未經獨立確認。本專案收錄模型不代表授予新的模型授權、Creative Commons 授權或商業使用許可。AGPL 不會為角色模型重新授權。重複使用或再散布之前，請確認適用的權利條件，並取得所有必要許可。詳見 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

本專案包含可供遊戲執行的最終角色檔案，不含角色的 Blender 專案或高多邊形製作原始檔。原創卡丁車／場景物件的可編輯檔案仍作為對應原始碼一併提供。本展示遊戲沒有廣告、付費功能或商業模型銷售。

