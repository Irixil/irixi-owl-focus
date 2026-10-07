# 四款新增装饰最小接口（美术生产可开始）

1024×1536 原房间坐标保持；编辑的可见房间为 [0,260,1024,1000]。所有交付 PNG 为 RGBA8，透明背景，不烘焙猫头鹰/墙/地面、文字或UI；沿当前认可双线轻淡涂鸦水粉方向，不改原图。每款一张主图+256×256透明实物缩略图，缩略图留适度边距。

| 实际缺图 | 主图尺寸 | source anchor | 默认 world anchor / displaySize | 独立槽位、前后层 |
|---|---|---|---|---|
| 手提小灯 portable-light-handheld | 512×512 | [256,480] 底部实际落地中心 | [215,1180] / [200,200] | 新 portable-light 独立于旧 floor-light；房间地面，角色后，小盆栽前 |
| 上角垂藤 corner-vine | 512×768 | [32,32] 顶部真实固定点 | 左[40,285]、右[984,285] / [235,352.5] | 新 corner-vine-left / corner-vine-right，彼此独立；墙后景 |
| 花形串灯 string-light-flower | 1024×384 | [512,48] 主锚，两端[32,48]/[992,48] | [512,295] / [600,225] | 新 string-lights 独立于 pendant，墙上层、角色后；一条可移动 |
| 上角帘饰 corner-curtain | 512×768 | [32,32] 顶部真实固定点 | 左[30,280]、右[994,280] / [250,375] | 新 corner-curtain-left / corner-curtain-right，彼此独立且与藤蔓不互斥；藤蔓前、挂画/角色后 |

藤蔓和帘饰各只需交付左款；右款使用同一PNG水平镜像，禁止由美术另画两张不一致图。工程为右侧独立ID、独立保存位置，scene.mirrorX=true；镜像围绕固定点，原alpha/hardware矩形须同样变换。主图 source anchor 不变，镜像后 effective anchor=[sourceWidth-sourceAnchorX,sourceAnchorY]，flip visual/collision rectangle=[sourceWidth-(x+w),y,w,h]，渲染做相同镜像。各项仍能自行上下左右摆放。可同时有左/右藤蔓、左/右帘饰、串灯、小吊灯、小球灯和手提灯，不默认同时全装备。

实际库存复用：floor-light-small 圆纸罩短座灯、floor-light-tripod 旧小三脚灯（保留）、foreground-plant-small / foreground-plant-trailing、pendant-small。portable-light 新槽位使手提灯能与小球灯同时出现。小盆栽与原大盆栽分别属于 foreground-plant / plant，已有独立槽位。

manifest 最小字段：id、category、name、size、main/thumb相对文件路径、sourceAlphaBounds（所有alpha>0真实矩形）、sourceVisualBounds（alpha>4真实矩形）、sourceCollisionBounds（实际物件hardware，非整张透明画布）、sourceAnchor；可选 hanging attachment 用于串灯/帘饰，不需要额外动画或灯光程序。坐标须来自实际PNG，不能使用以上尺寸推测实物边界。

本文件是交付接口。未到图时不伪造新道具；新槽位接入时应做原字节备份与兼容升级，旧ID/装备/位置保留，新槽位默认null，不制造永久解锁门槛。当前先交付移动与字体，旧素材均可继续使用。父级美术可按此直接产出4+4共8文件及真实metadata；素材到后工程做注册、镜像命中与实际并用验收。

最终美术接口已确认：4主图文件 portable-light-handheld.png、corner-vine.png、corner-curtain.png、string-light-flower.png；各256×256缩略图。藤蔓/帘饰右侧镜像有效锚[480,32]，source相同，工程独立ID与位置。各新槽位允许同时选择，不复用互斥的单pendant槽或wall-art槽。
