# NPC racing and items / NPC 竞速与道具

NPCs now steer toward reachable nearby boxes and use the **same inventory and pickup system** as the player. They never receive items on a timer. Every kart has one slot; occupying it leaves another box untouched. Swept contact times decide contested pickups, so a fast kart cannot skip a box and the player does not automatically win every same-frame collision. Exact ties use stable driver IDs.

- **Boost:** waits for a reasonably straight forward path, no close car in its lane, and no current boost or slowdown. Same 3.3-second duration and 1.34× multiplier as the player.
- **Shield:** saves protection for nearby collision traffic or an opponent holding a pulse behind it. Six seconds of protection, including against the player's pulse.
- **Pulse:** chooses the nearest forward kart within 120 track metres, whether that is the player or another NPC. Track wrapping handles the start line and lapped cars. An active shield blocks the hit; it does not redirect to the next car. The same three-second, 0.55× slowdown rule applies to player and NPC. NPCs keep a pulse when no useful unshielded target is available. Manual player use retains the existing no-target 1.9-second boost conversion.

NPC decisions occur every 0.22–0.34 racing seconds, with a 0.65–0.97-second delay after collecting an item and a 1.2-second use cooldown. Lane planning sees at most 48 metres ahead, rejects unreachable boxes, respects nearby traffic, and clamps lane changes to 4 metres/second within ±5.2 metres. It does not read future random rewards or replenish inventory. Mystery rewards still resolve only when actually collected.

An original 3D item floats above an NPC while held. Turbo exhaust, shield bubbles, an expanding pulse model and impact sparks make usage visible. Expensive model geometry and materials are reused. Pause freezes item/decision clocks and NPC effect animation; finishing clears transient effects. Race resets and character changes dispose the old NPC effect entities.

## 中文

NPC 会驶向前方附近、能够安全到达的道具箱，并与玩家公平争抢同一批道具。每辆车只有一个道具槽，不会凭空生成道具。加速要等路线较直、前方没有近距离堵车；护盾留给近车碰撞或后方携带脉冲的威胁；脉冲会攻击前方最近的玩家或其他 NPC，护盾能够挡住攻击。

拾取后有反应时间，使用后有冷却；暂停不消耗这些计时。NPC 头顶显示持有的 3D 道具，实际使用时可看到尾焰、护盾或脉冲特效。重新比赛、结束比赛及更换角色会清理相关状态。

## Verification

The deterministic unit simulation and real PlayCanvas NullGraphicsDevice integration cover inventory conservation, competing pickups, item tactics, both directions of player/NPC attacks, shield blocking, lane/speed bounds, pause/reset/finish and resource cleanup. These CPU tests do not establish browser GPU appearance or visual quality.
