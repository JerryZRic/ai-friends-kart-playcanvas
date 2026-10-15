# 六角色 CPU 平衡实验室（dev）

当前是未完成平衡验证的实验预览：提供真实 CPU 测试工具和候选共享弯道规则，尚未把正在搜索的角色参数推广为正式调参结果。最终结论以独立验证报告为准。

打开 `/dev/balance-lab.html` 可选择 01–12 陆上地图、种子、轮换编号、难度、统一/混合赛车配置及标准道具，观看同一套真实 NPC 逻辑驱动六位角色，并下载单场 JSON / CSV。页面中的二维路线图只是诊断视图，不是 GPU 画面测试。A01 水上玩法不参与本轮调整。

## 本地复现

安装锁定依赖后：

```sh
npm run balance -- --blocks=32 --workers=6 --domain=land-balance-training-v1 --out=balance-results/training
npm run balance:analyze -- --input=balance-results/training
```

每个地图/种子块有六场比赛，角色轮换遍历全部座位。默认开启真实静态/动态道具、碰撞、三圈检查点及分路；固定 60 Hz，所有人完成或 600 秒超时才结束。默认 normal 难度、统一默认赛车。`--equipment=mixed` 使用五种预设及一套混合弯道车并轮换；`--items=off` / `--difficulty=easy|hard` 是另行标注的诊断条件，不属于标准平衡结论。

可以用 `--maps=coast,town --blocks=1 --rotation=0`缩小试验；CLI 的种子来自 `--domain`、地图和块编号，单个实际种子写在结果中。要精确重播一场，在网页输入该种子、地图和 rotation。单场 CLI 重播也可使用 `--maps=town --blocks=1 --rotation=0 --seed=123`；显式种子只允许一个地图和一个块，不能冒充独立的批量样本。

输出：`.manifest.json` 保存配置、完整源码哈希及计划样本量；`.jsonl` 保存逐场真实结果；`.csv` 保存逐角色结果；`.complete.json` 只在整批完成后生成。现有输出默认不会覆盖；重跑请换 `--out`。分析也支持 `.jsonl.gz`。

分析时对完整的六场轮换块进行重采样，不把同一块内的比赛当作独立样本。完整的样本量、联合不确定性区间、判定标准和已知限制见 [实验协议](cpu-balance-protocol.md)。训练结果只能用于开发，不能冒充独立验证。

## 适用范围

所有角色接受相同难度的 CPU 控制。座位身份控制起跑位置、处理顺序、AI 相位和分路随机性，角色身份只用于其真实加速、极速和转向属性。正常玩家比赛保留原有输入及玩家碰撞规则；CPU 的胜率不等同于真人操作胜率。
