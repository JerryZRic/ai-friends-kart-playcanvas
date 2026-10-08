# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![程式碼：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

用 **PlayCanvas Engine、TypeScript 同 Vite** 整嘅街機風格高卡車遊戲，喺日落海岸賽道上鬥快。六位綁好骨架嘅角色車手任你揀一位，同另外五位對手較量，仲有飄移加速、道具同可以自由環繞嘅追車鏡頭。

**[用瀏覽器玩](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [下載 Windows 試玩版](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> 遊戲介面用簡體中文，品牌名就用英文。上面嘅語言連結只會切換說明文件。程式碼同原創資產採用 AGPL-3.0-only 授權；六個角色模型另外有非商業用途限制。詳情睇[授權同模型權利](#license-and-model-rights)。

## 遊戲特色

- **六位車手任揀：** WHALE、GEMINI、GPT、CLAUDE、GROK 同 GLM，附埋綁好骨架嘅角色模型
- 喺日落海岸賽道同五位 AI 對手鬥**三個圈**，有海景、碰撞、圈數同排名記錄，仲有迷你地圖
- **街機風格駕駛：** 手動油門、煞車、倒車、手掣飄移同飄移加速
- **三款道具：** 渦輪加速、能量護盾同追蹤脈衝
- **兩款追車鏡頭**，支援滑鼠環繞、回正同暫時望後
- 暫停／重新開始、音效、鍵盤操作同畫面觸控掣
- 可以用本機 GLB 換車手，只喺今次遊玩生效，唔會上傳

## 用瀏覽器玩

用開咗 **WebGL2** 嘅瀏覽器打開 **[GitHub Pages 遊戲](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等角色載入好，揀車手就可以開始比賽。

第一次下載角色合共大約 **51.6 MB**，最多同時下載／準備兩個模型。載入畫面會顯示實際下載咗幾多位元組，同埋解壓縮、準備嘅進度；遇到暫時性錯誤會喺限定次數內重試。你亦可以再試下載失敗嘅檔案，唔會丟失已經載入好嘅模型。缺少模型嗰陣，會清楚標明改用原創車手做後備。

唔使登入 ChatGPT、唔使模型服務帳戶，執行遊戲亦唔使靠 CDN。遊戲同角色資產都由同一套發佈檔案提供。

## Windows 試玩版

**需要 64 位元 Windows 10/11，同埋支援 WebGL2 嘅 GPU。** 呢個係預先發佈嘅試玩版，仲未係正式版。

1. 喺[發佈頁面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)下載 [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip)。
2. 將**成個 ZIP** 解壓縮到同一個資料夾。
3. 開 **AI Friends Kart.exe**。旁邊嘅 DLL 檔案同 `resources`、`locales` 資料夾要留喺一齊，唔好分開。
4. 撳 **F11** 切換全螢幕。

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

完整複製儲存庫會連埋 `public/assets/drivers/` 入面六個 `.glb.gz` 檔案。部署時提供嘅精簡版 `source.zip` 有程式碼、測試、建置檔案同原創可編輯資產，但冇包呢六個角色壓縮檔。解壓縮嗰份原始碼套件之後，可以咁樣還原角色檔案：

```sh
npm ci
npm run models:fetch
npm run build
```

下載腳本會用固定嘅公開路徑，並核對[執行時模型清單](docs/runtime-models.json)入面嘅壓縮檔同解壓後雜湊值；如果本機檔案唔吻合，就會拒絕覆寫。就算冇角色檔案，程式碼都仲可以建置，並改用清楚標明嘅原創車手後備模型。

### GitHub Pages

[Build and publish PlayCanvas game 工作流程](.github/workflows/pages.yml)要**手動執行**。喺儲存庫嘅 **Settings → Pages** 揀 **GitHub Actions**。喺 `main` 執行工作流程，並剔選 **Publish**。佢會先檢查、測試同建置揀咗嘅提交，再發佈遊戲。一般推送唔會部署遊戲。

### 專案結構

- `src/`：PlayCanvas 場景、賽道、比賽邏輯、輸入、鏡頭同角色載入
- `public/assets/`：隨附嘅執行時資產，包括六個壓縮車手模型
- `models/`：原創高卡車同場景物件嘅可編輯原始檔
- `tests/`：邏輯、載入、介面同引擎層級檢查
- `scripts/`：原始碼打包、執行時模型下載同發佈檔案檢查
- `docs/`：模型清單、本機匯入規格同技術驗證說明

## 用本機模型換車手

揀一個車手欄位，再匯入相容嘅 GLB；亦可以一次揀多個檔案，但每個檔名都要啱啱包含一個車手欄位名稱標記。每個檔案上限係 **32 MiB**，最多同時處理兩個。匯入嘅內容只會留喺頁面記憶體，唔會上傳，亦唔會永久儲存。失敗或者取消都會保留原本嘅車手；**恢復預設**就會還原隨附角色，或者清楚標明嘅後備模型。

支援邊啲模型同驗證規則，可以睇[骨架同匯入規格](docs/local-import.md)。

## 驗證

自動化檢查涵蓋唔依賴引擎嘅比賽／輸入邏輯、真實 PlayCanvas CPU／null-device 骨架載入、模擬介面整合，同埋靜態發佈檔案檢查。呢啲檢查唔能夠證實 GPU 畫面效果、原生滑鼠鎖定行為或者效能。詳情睇[測試涵蓋範圍同限制](docs/MIGRATION-PARITY.md)，以及[海洋著色器回歸測試說明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>

## 授權同模型權利

**程式碼同原創遊戲資產：** 採用 AGPL-3.0-only 授權，包括原創介面、賽道、高卡車、場景物件同可編輯原始檔。詳情睇 [LICENSE](LICENSE)、[NOTICE](NOTICE) 同 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 同 fflate 保留各自嘅 MIT 授權。

**六個角色模型：** 另外有獨立嘅權利條件。專案擁有者表示，呢啲模型係 Tripo Free 方案嘅產出，有非商業用途限制；確實嘅再分發條款仲未經獨立確認。模型收錄喺呢個專案，唔代表授予新嘅模型授權、Creative Commons 授權或者商業使用許可。AGPL 唔會幫角色模型重新授權。重用或者再分發之前，要先確認適用嘅權利條件，並取得所需許可。詳情睇 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

呢個專案有供遊戲執行嘅最終角色檔案，冇角色嘅 Blender 專案或者高多邊形製作原始檔。原創高卡車／場景物件嘅可編輯檔案仍然有包埋，作為對應原始碼提供。呢個示範遊戲冇廣告、冇收費，亦冇商業模型銷售。
