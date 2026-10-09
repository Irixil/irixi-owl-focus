# 素材与来源

项目创作者：**IRiXi**（GitHub：[Irixil](https://github.com/Irixil)）。原始仓库：[Irixil/irixi-owl-focus](https://github.com/Irixil/irixi-owl-focus)；[推荐署名与许可入口](../ATTRIBUTION.md)。

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

`ui/assets/paper-fibers.svg` 是本项目自行编写的透明静态纸纹，按实际显示尺寸绘在房间背景与原美术之间及收藏面板；未使用参考图像素。原角色和房间道具PNG保持不变，旧装饰纹理已退役。

当前竖版房间使用 `ui/assets/room-v30/room-base.png` 及同目录原道具层，后续道具注册说明见各素材目录的manifest和本项目房间／配件文档。本轮颜色与纹理修正未重绘或改色这些原PNG；纸纹是独立叠层。

## 房间与配件来源索引

以下路径相对于 `ui/assets/`。已有制作记录中的生成工具辅助、配准和历史构图参照是创作过程说明，项目创作者署名为 IRiXi；第三方字体的作者归属仍分别保留。

| 路径 | 项目制作来源 | 已有记录 |
| --- | --- | --- |
| `concept-v4.png`、`motion-v7/*.png` | 项目猫头鹰角色、姿态部件和备用图；同项目既有素材文档记录为生成工具辅助制作的角色素材。 | [独立 Owl 素材记录](https://github.com/Irixil/irixi-owl-focus/blob/main/docs/assets.md)、[姿态数据](../ui/assets/motion-v7/pitch-landmarks.json) |
| `outfit/glasses-*.png`、`outfit/reading-chair-*.png` | 项目眼镜姿态与阅读椅图层；既有素材文档记录生成后配准，当前 manifest 保留尺寸和校验值。 | [装备 manifest](../ui/assets/outfit/provenance/manifest.json)、[独立 Owl 素材记录](https://github.com/Irixil/irixi-owl-focus/blob/main/docs/assets.md) |
| `room-v30/` | 房间底图、家具、灯、植物、地毯及缩略图；制作记录包含内置图像生成、原图颜色保留及透明层处理。 | [来源](../ui/assets/room-v30/provenance.json)、[v4 manifest](../ui/assets/room-v30/faithful-v4-manifest.json) |
| `extensions-v37/` | 扩展房间物件及猫头鹰挂画；记录使用内置图像生成，挂画含历史构图参照。 | [manifest](../ui/assets/extensions-v37/manifest.json) |
| `tall-table-v42/` | 高边桌及缩略图；记录使用内置图像生成，现有低桌作为项目风格参考。 | [manifest](../ui/assets/tall-table-v42/manifest.json)、[处理记录](../ui/assets/tall-table-v42/side-table-tall.metadata.json) |
| `expansion-v43/` | 家具、风景挂画、灯、植物和桌面摆件；记录使用内置图像生成与比例配准。 | [manifest](../ui/assets/expansion-v43/collection-expansion-manifest.json)、[目录](../ui/assets/expansion-v43/collection-catalog-36.json) |
| `portrait-lamps-v48/` | 灯具与猫头鹰肖像；记录使用内置图像生成，并单列历史肖像构图来源。 | [来源说明](../ui/assets/portrait-lamps-v48/art-source-notes.json)、[manifest](../ui/assets/portrait-lamps-v48/portrait-tall-lamp-manifest.json) |
| `layer-decor-v51/` | 手提灯、藤蔓、花串灯、窗帘及缩略图；记录生成辅助与比例配准，复用项目已有小灯和植物。 | [manifest](../ui/assets/layer-decor-v51/layer-decor-manifest.json)、[复用记录](../ui/assets/layer-decor-v51/reused-assets.json) |
| `paper-fibers.svg`、`room-paper.svg`、`room-window.svg` | 同项目素材文档记录为自行编写的 SVG 纸纹和窗户；未使用参考图像素。 | [独立 Owl 素材记录](https://github.com/Irixil/irixi-owl-focus/blob/main/docs/assets.md) |

## 历史构图参照记录

以下仅转述仓库已有的制作来源，不表示生产图片直接嵌入馆藏照片，也不改变 IRiXi 的项目创作者署名：

- `portrait-lamps-v48/wallart/wall-owl-vangogh.png`：Vincent van Gogh，*Self-Portrait*，1889；馆藏信息及原作链接见[来源说明](../ui/assets/portrait-lamps-v48/art-source-notes.json)。
- `portrait-lamps-v48/wallart/wall-owl-red-chaperon.png`：Jan van Eyck，*Portrait of a Man (Self Portrait?)*，1433；同上。
- `portrait-lamps-v48/wallart/wall-owl-rembrandt.png`：Rembrandt van Rijn，*Self Portrait at the Age of 34*，1640；同上。
- `extensions-v37/wallart/wall-owl-mona.png`、`wall-owl-pearl.png`：项目目录记为“猫头鹰·蒙娜丽莎”和“猫头鹰·珍珠耳环”；具体采用的参考版本、链接及制作说明仍可补充，见[目录记录](../ui/assets/expansion-v43/collection-catalog-36.json)。

## 现有许可与待补记录

本项目自身源码和美术继续保持 [LICENSE](../LICENSE) 中的 UNLICENSED 声明；本次来源整理不新增美术或源码授权，不改变现有第三方字体许可。部分 manifest 中的生成服务条款说明不等于面向下游的新许可。

角色、装备的早期生成批次、具体工具和部分历史构图参考版本尚未完整记录，后续可补充原制作记录；这不改变 IRiXi 的项目创作者署名。概念图的 Noto 字体署名和授权记录继续保留在 [concept-sources.txt](images/concept-sources.txt) 及 [font-notices](images/font-notices/)。
