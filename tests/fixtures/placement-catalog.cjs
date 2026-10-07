'use strict';
// Explicit development blocks registered to the agreed extensions interface.
const catalog=structuredClone(require('../../config/collection-catalog.json'));
catalog.version+='-development-fixtures';catalog.room.developmentPreview=true;
const specs={
 'wall-art':{size:[512,640],anchor:[256,320],position:[512,380],displaySize:[190,237.5],moveArea:[0,260,1024,270]},
 'floor-light':{size:[512,512],anchor:[256,480],position:[725,1225],displaySize:[100,100],moveArea:[0,1088,1024,168]},
 'foreground-plant':{size:[512,512],anchor:[256,480],position:[160,1220],displaySize:[110,110],moveArea:[0,1088,1024,168]},
 'side-furniture':{size:[512,512],anchor:[256,480],position:[925,1244],displaySize:[164,164],moveArea:[0,1088,1024,168]},
 'tabletop':{size:[512,512],anchor:[256,480],position:[925,1157.515625],displaySize:[78,78]},
 pendant:{size:[512,768],anchor:[256,24],position:[850,280],displaySize:[128,192],moveArea:[0,260,1024,650]}
};
for(const i of catalog.items.filter(i=>i.scene?.placement)){
 i.assetState='ready';i.developmentPlaceholder=true;
 if(i.category==='rug'){const b=[140,1030,745,180];i.scene={size:[1024,1536],layer:'rug',visualBounds:b,sourceVisualBounds:b,collisionBounds:b,contacts:[[512,1082]]};continue;}
 if(!specs[i.category])continue;
 const incomingScene=i.scene;
 const {size,moveArea,...registration}=specs[i.category],scale=registration.displaySize[0]/size[0],origin=registration.position.map((v,n)=>v-registration.anchor[n]*scale),source=[32,32,size[0]-64,size[1]-64],world=[origin[0]+source[0]*scale,origin[1]+source[1]*scale,source[2]*scale,source[3]*scale];
 i.scene={size,layer:i.category,placement:registration,sourceVisualBounds:source,sourceCollisionBounds:source,visualBounds:world,collisionBounds:world,contacts:[],...(moveArea?{moveArea}:{})};
 if(i.category==='pendant'){i.scene.sourceVisualBounds=[32,32,448,704];i.scene.hanging={ceilingY:260,attachment:[850,280]};}
 if(i.supportsTabletop){const a=incomingScene.sourceTabletopArea,point=incomingScene.sourceTabletopAnchor;i.scene.sourceTabletopArea=a;i.scene.sourceTabletopAnchor=point;i.scene.tabletopAnchor=point.map((n,j)=>origin[j]+n*scale);i.scene.tabletopArea=[origin[0]+a[0]*scale,origin[1]+a[1]*scale,a[2]*scale,a[3]*scale];}
}
module.exports=catalog;
