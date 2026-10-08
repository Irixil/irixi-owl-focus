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
| `ui/assets/room-paper.svg`、`room-window.svg` | 历史兼容的静态纸纹及正视窗，项目自行编写的 SVG，不含参考图像素 |

角色和装备的发布使用当前项目自身已获准使用的生成素材。本仓库没有附带竞品图片或后续背景参考图。

字体 `LXGWWenKai-Light.ttf` 来自 [霞鹜文楷项目](https://github.com/lxgw/LxgwWenKai)，未经修改。[原 SIL OFL 1.1 许可](../ui/assets/fonts/OFL.txt) 随文件保留。SHA-256：`526ec70cbb0118e871d481f8179e03ff045f0e4d72d080dcca87950c4ab27cca`。系统字体名称只是显示备选，没有复制系统字体文件。

Electron 和 npm 依赖通过锁文件安装，许可证随其分发内容提供。本项目自身源码和美术目前标为 `UNLICENSED`，没有擅自新增 MIT 或其他开放源码许可。

本模块UI新增站酷快乐体 ZCOOLKuaiLe-Regular.ttf，来自 [Google Fonts 官方目录](https://github.com/google/fonts/tree/main/ofl/zcoolkuaile)，未经修改，SHA-256 812a6fc1fe54b6d73a419245c32dfeba8aa33104d5be90d1cf6af082007cb71d，随附 ZCOOLKuaiLe-OFL.txt（SIL OFL 1.1）。它用于粗粝、微歪手写界面；罕见汉字回退本地霞鹜文楷。计时数字固定字框保留原文本读屏与清晰显示，不安装系统字体。

README 概念主图与小物副图沿用本项目生成艺术素材排版合成，明确标注概念示意。Noto 字体只以栅格文字进入图片，不分发字体本体，原版权与授权文本见 images/font-notices；来源说明见 images/concept-sources.txt。实际 UI GIF 使用隔离测试数据，与静态概念图分开标注。

`ui/assets/cream-grain.png` 为本项目自行生成的透明静态纸纹，仅用于番茄钟背景和收藏面板，未使用参考图像素。原角色与房间艺术 PNG 保持不变。

当前竖版房间使用 `ui/assets/room-v30/room-base.png` 及同目录原道具层，后续道具注册说明见各素材目录的manifest和本项目房间／配件文档。本轮颜色与纹理修正未重绘或改色这些原PNG；纸纹是独立叠层。
