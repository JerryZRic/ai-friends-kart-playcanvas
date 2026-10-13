# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![程式碼：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

用 **PlayCanvas Engine、TypeScript 同 Vite** 整嘅街機風格高卡車遊戲，有 12 張陸地地圖同 1 張水上地圖。六位綁好骨架嘅角色車手任你揀一位，同另外五位對手較量，仲有飄移加速、道具同可以自由環繞嘅追車鏡頭。

**[瀏覽器穩定版](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [獨立 dev 預覽](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [網頁 / Windows 下載](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 遊戲介面用簡體中文，品牌名就用英文。上面嘅語言連結只會切換說明文件。程式碼同原創資產（音樂除外）採用 AGPL-3.0-only 授權；六個角色模型另外有非商業用途限制。詳情睇[授權同模型權利](#license-and-model-rights)。

## v0.4.0 統一版本

呢份文件介紹 **v0.4.0** 嘅統一功能：13 張地圖、六位車手，同埋有 55 個主題 / 330 件零件嘅六槽食物車庫。11 張新增陸地地圖全部包含場景豐富化成果。瀏覽器穩定版同下載包用同一套功能，`/dev/` 就保留做之後更新嘅獨立預覽。已發佈檔案、原始碼提交、校驗值同各版本實際驗證情況，以[發佈頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)為準。

自由模式有動態 3D 封面、旋轉地圖預覽、角色 3D 檢視、揀車、簡單 / 普通 / 困難比賽設定同畫面設定。故事模式仍然只顯示開發中提示。[實作說明同限制](docs/free-mode.md)。

### 地圖目錄

陸地賽道依 **01–12** 排列，水上地圖 **A01** 放喺最後。顯示編號唔會改動原有地圖 ID、儲存嘅選擇或者直達連結。

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

開[穩定版車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html)或者[dev 車庫](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)。**55 個食物主題 / 330 件零件**包括 000 純白飯，可以揀整車或者六槽自由改裝，有真正 3D 預覽、參數比較同方案儲存。睇整車只係預覽，套用先會換晒六件，亦可以先儲存同復原。揀好嘅裝配用得喺全部 12 張陸地賽道，六位角色屬性同水上坐騎保持不變。NPC 用相同零件公式嘅預設混搭車，冇同主題加成。電量消耗、耐久損耗、修理同經濟系統仲未啟用。[實作同驗證範圍](docs/modular-garage.md)。

## 遊戲特色

- **六位車手任揀：** WHALE、GEMINI、GPT、CLAUDE、GROK 同 GLM，附埋綁好骨架嘅角色模型
- **三圈競速：** 喺陸地同水上地圖同五位 AI 對手鬥快，有碰撞、圈數同排名記錄，仲有迷你地圖
- **街機風格駕駛：** 手動油門、煞車、倒車、手掣飄移同飄移加速
- **三款道具：** 渦輪加速、能量護盾同追蹤脈衝
- **睇得見嘅道具箱：** 半透明箱入面有原創 3D 道具，25% 係問號隨機箱；執到即刻消失，比賽行咗八秒後再出現。HUD 會顯示由同一模型投影出嚟嘅道具圖片。[說明](docs/item-pickups.md)
- **道具 NPC：** 對手會爭搶真正嘅道具箱，安全調整路線，再揀時機加速、開盾或者用脈衝攻擊玩家同其他 NPC；頭頂道具同使用特效都睇得到。[說明](docs/npc-tactics.md)
- **兩款追車鏡頭**，支援滑鼠環繞、回正同暫時望後
- 暫停／重新開始、音效、鍵盤操作同畫面觸控掣
- 可以用本機 GLB 換車手，只喺今次遊玩生效，唔會上傳

## 用瀏覽器玩

用開咗 **WebGL2** 嘅瀏覽器打開 **[GitHub Pages 遊戲](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等角色載入好，揀車手就可以開始比賽。

第一次下載比賽角色合共大約 **51.6 MB**；揀中嘅站姿肖像同食物車零件會按需要另外下載。最多同時下載／準備兩個角色模型。載入畫面會顯示真實位元組進度、解壓縮同準備狀態；暫時性錯誤會有限次重試，亦可以只重試失敗檔案，保留已載入嘅模型。缺少模型唔會用替身，必要資源全部就緒先開始比賽。載入期間會巡遊賽道上空，再平順返到起點。

唔使登入 ChatGPT、唔使模型服務帳戶，執行遊戲亦唔使靠 CDN。遊戲同角色資產都由同一套發佈檔案提供。

## 網頁 / HTML 下載包

喺[發佈頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)揀 `AI-Friends-Kart-Web-HTML-v0.4.0-20261012.zip`，再核對隨附嘅 SHA-256 校驗值。完整解壓縮後，用 HTTP(S) 提供遊戲檔案；唔支援用 `file://` 直接開 `index.html`。全部資產、授權聲明同對應原始碼檔案要一齊保留。

## Windows 下載包

**需要 64 位元 Windows 10/11，同埋支援 WebGL2 嘅 GPU。** 請用 v0.4.0 包，並閱讀對應發佈說明。封裝成功同自動化檢查唔代表已驗證真正 Windows GPU、效能或者輸入裝置相容性。

1. 喺[發佈頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)下載 `AI-Friends-Kart-Windows-x64-v0.4.0-20261012.zip`，再核對隨附嘅 SHA-256 校驗值。
2. 將**成個 ZIP** 解壓縮到同一個資料夾。
3. 開 **AI Friends Kart.exe**。旁邊嘅 DLL 檔案同 `resources`、`locales` 資料夾要留喺一齊，唔好分開。
4. 撳 **F11** 切換全螢幕。

主選單嘅**退出**掣會關閉 Windows 應用程式；由比賽返主選單仍然係遊戲內導覽。瀏覽器入面嘅**退出**會開休息頁面，關閉分頁就可以離開。已有嘅桌面退出修正會保留，但唔代表呢個版本已做過新一輪原生 Windows GPU 實機試玩。

六個角色都已經包埋，可以離線玩。唔使 Node.js、唔使安裝，亦唔使管理員權限。唔好為咗開遊戲而關閉 Windows 安全防護。

壓縮檔入面有 `Game-Corresponding-Source.zip`、包含桌面封裝程式同建置說明嘅 `Desktop-Source`，以及授權聲明。桌面封裝由該發佈版本提供；呢個儲存庫嘅 npm 指令係用嚟建置網頁版遊戲。

## 點樣操作

| 輸入 | 動作 |
| --- | --- |
| `W` / `↑` | 油門；放手就滑行 |
| `A` / `←`, `D` / `→` | 向左／向右轉 |
| `S` / `↓` | 煞車；繼續撳住就倒車 |
| `Space` | 煞車，唔會倒車 |
| `Left Shift` + 轉向 | 飄移；放開 Shift 就觸發蓄力飄移加速 |
| `E` | 用執到嘅道具 |
| `Z` / `C` | 切換追車鏡頭 |
| 撳住滑鼠右鍵 | 暫時望後 |
| 點一下賽道，再郁滑鼠 | 環繞鏡頭 |
| `Q` | 將鏡頭回正 |
| `Esc` | 暫停同釋放滑鼠游標 |
| `P` / 暫停掣 | 暫停／繼續 |

如果鎖唔到滑鼠游標，可以撳住滑鼠左鍵拖曳嚟望四周。觸控掣有油門、轉向、倒車、煞車同飄移；點一下道具面板就用到道具。選單按鈕支援原生鍵盤操作。

## 開發同建置

需要 **Node.js 22.12 或更新版本**，同埋 npm。

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

打開 Vite 顯示嘅 HTTP 網址。要檢查同建置正式發佈版本：

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

用 HTTP(S) 提供完整嘅 **`dist/`** 目錄，唔好用 `file://` 直接打開 `index.html`。相對路徑支援網域根目錄同儲存庫子目錄。授權聲明、`source.html` 同 `source.zip` 要同遊戲一齊保留。

完整複製儲存庫會連埋 `public/assets/drivers/` 入面六個駕駛模型壓縮檔，同 `public/assets/portraits/` 入面六個獨立站姿肖像壓縮檔。部署嘅精簡版 `source.zip` 有程式碼、測試、兩份校驗清單、建置檔案同原創可編輯資產，但冇包呢兩組角色檔案。解壓縮之後，可以咁樣還原：

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

原始碼包亦冇包另外下載嘅食物車資料，請用上面嘅指令還原同驗證。原創可編輯資產原始碼同校驗清單仍然有包埋。

下載腳本會用獨立 `/dev/` 預覽嘅固定公開路徑，核對[駕駛模型清單](docs/runtime-models.json)同[站姿肖像清單](docs/portrait-models.json)入面嘅壓縮檔同解壓後雜湊值；本機檔案唔吻合就拒絕覆寫。程式碼可以單獨建置；完整畫面要還原兩組模型。

### GitHub Pages

[Build and publish PlayCanvas game 工作流程](.github/workflows/pages.yml)會先檢查、測試同建置揀好嘅原始碼，再發佈。穩定版喺網站根目錄，獨立預覽喺 `/dev/`。請跟目前分支嘅工作流程觸發條件同發佈選項操作；dev 部署一定要保留穩定版根目錄。發佈包要用對應版本標籤嘅同一份原始碼。

### 專案結構

- `src/`：PlayCanvas 場景、賽道、比賽邏輯、輸入、鏡頭同角色載入
- `public/assets/`：隨附嘅執行時資產，包括六個壓縮車手模型
- `models/`：原創高卡車同場景物件嘅可編輯原始檔
- `tests/`：邏輯、載入、介面同引擎層級檢查
- `scripts/`：原始碼打包、執行時模型下載同發佈檔案檢查
- `docs/`：模型清單、本機匯入規格同技術驗證說明

## 用本機模型換車手

揀一個車手欄位，再匯入相容 GLB；亦可以多選檔案，但每個檔名要包含唯一嘅車手欄位名稱標記。每個檔案上限 **32 MiB**，最多同時處理兩個。內容只留喺頁面記憶體，唔上傳亦唔永久儲存。失敗或者取消會保留原車手；**恢復預設**會還原隨附角色。簡化後嘅比賽載入頁隱藏咗舊匯入控制項，喺主選單揀角色就得。

支援邊啲模型同驗證規則，可以睇[骨架同匯入規格](docs/local-import.md)。

## 驗證

自動化檢查涵蓋唔依賴引擎嘅比賽／輸入邏輯、真實 PlayCanvas CPU／null-device 骨架載入、模擬介面整合，同埋靜態發佈檔案檢查。呢啲檢查唔能夠證實 GPU 畫面效果、原生滑鼠鎖定行為或者效能。詳情睇[測試涵蓋範圍同限制](docs/MIGRATION-PARITY.md)，以及[海洋著色器回歸測試說明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>

## 授權同模型權利

**程式碼同原創遊戲資產（音樂除外）：** 採用 AGPL-3.0-only 授權，包括原創介面、賽道、高卡車、場景物件同可編輯原始檔。詳情睇 [LICENSE](LICENSE)、[NOTICE](NOTICE) 同 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 同 fflate 保留各自嘅 MIT 授權。

**原創音樂（© 2026 JerryZRic）：** 按[獨立音樂授權](public/assets/music/LICENSE.txt)，三首音樂作品、錄音同改編可以跟本遊戲同 fork 作非商業使用、修改同分發，要署名同保留聲明；商用前要取得 JerryZRic 同意。唔包含無關專案，亦唔授權脫離遊戲同 fork 單獨分發或賣音樂。程式碼嘅 AGPL 條款不變。

**六個角色嘅駕駛同獨立站姿肖像模型：** 另外有獨立嘅權利條件。專案擁有者表示，呢啲模型係 Tripo Free 方案嘅產出，有非商業用途限制；確實嘅再分發條款仲未經獨立確認。模型收錄喺呢個專案，唔代表授予新嘅模型授權、Creative Commons 授權或者商業使用許可。AGPL 唔會幫角色模型重新授權。重用或者再分發之前，要先確認適用嘅權利條件，並取得所需許可。詳情睇 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

呢個專案有供遊戲執行嘅最終角色檔案，冇角色嘅 Blender 專案或者高多邊形製作原始檔。原創高卡車／場景物件嘅可編輯檔案仍然有包埋，作為對應原始碼提供。呢個示範遊戲冇廣告、冇收費，亦冇商業模型銷售。
