# 素材与来源

本目录只包含运行猫头鹰房间需要的最终素材。用户提供的后续参考图、原工具箱其他模块和私人工作记录不在发布范围内。

| 文件 | 用途与来源 |
| --- | --- |
| `ui/assets/concept-v4.png` | 项目确认的生成角色概念，作为加载失败时的静态备用图 |
| `ui/assets/motion-v7/body-parts.png`、`head-poses.png` | 已确认的生成角色部件，保留源图字节 |
| `ui/assets/motion-v7/head-up-sip.png` | 参照项目自身角色生成的小角度抬头姿态 |
| 同目录 `owl-renderer.mjs`、`pitch-landmarks.json`、`yaw-landmarks.json` | 项目渲染代码和姿态配准数据 |
| `ui/assets/outfit/glasses-*.png` | 六种眼镜姿态，生成后按角色比例配准 |
| `ui/assets/outfit/reading-chair-back.png`、`reading-chair-front.png` | 生成的阅读椅前后层 |
| `ui/assets/outfit/provenance/manifest.json` | 最终装备尺寸和文件校验值，已去除私人交接标识 |
| `docs/images/room-widget.png` | 本项目隔离应用中直接捕获的原生组件画面，新存档，无实际任务或 APP 记录 |

角色和装备的发布使用当前项目自身已获准使用的生成素材。本仓库没有附带竞品图片或后续背景参考图。

字体 `LXGWWenKai-Light.ttf` 来自 [霞鹜文楷项目](https://github.com/lxgw/LxgwWenKai)，未经修改。[原 SIL OFL 1.1 许可](../ui/assets/fonts/OFL.txt) 随文件保留。SHA-256：`526ec70cbb0118e871d481f8179e03ff045f0e4d72d080dcca87950c4ab27cca`。系统字体名称只是显示备选，没有复制系统字体文件。

Electron 和 npm 依赖通过锁文件安装，许可证随其分发内容提供。本项目自身源码和美术目前标为 `UNLICENSED`，没有擅自新增 MIT 或其他开放源码许可。
