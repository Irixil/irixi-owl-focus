export const GLASSES_KEYS=Object.freeze(['glassesFront','glassesUp','glassesLeft30','glassesLeft60','glassesRight30','glassesRight60']);
const all=(images,keys)=>keys.every(k=>Boolean(images[k]));
export function resolveAppearance(state,images={}){
  // Keep schema2 history: null/red-scarf both mean no glasses, never no scarf.
  const unlocked=state.unlocked||[],desired={accessory:state.equipment?.accessory==='round-glasses'?'round-glasses':null,room:state.equipment?.room||'stool'};
  const missing=[];let accessory=desired.accessory,room=desired.room;
  if(accessory==='round-glasses'&&!unlocked.includes(accessory))accessory=null;
  if(!['stool','reading-chair'].includes(room)||room==='reading-chair'&&!unlocked.includes(room))room='stool';
  if(accessory==='round-glasses'&&!all(images,GLASSES_KEYS)){missing.push('圆眼镜');accessory=null;}
  if(room==='reading-chair'&&!all(images,['chairBack','chairFront'])){missing.push('阅读椅');room='stool';}
  const names={stool:'初始凳子','reading-chair':'阅读椅','round-glasses':'圆眼镜'};
  const visible=[names[room],'红围巾',accessory?names[accessory]:'不戴眼镜'];
  return {desired,accessory,room,missing,key:[accessory,room].join(':'),
    summary:missing.length?'已选择'+missing.join('、')+'，画面暂未更新；当前为'+visible.join(' · '):visible.join(' · '),
    label:'红围巾猫头鹰'+(accessory?'戴着圆眼镜':'')+'坐在'+names[room]+'上，陪伴你'};
}
export function equipmentOptions(state){
  const glasses=(state.unlocked||[]).includes('round-glasses'),chair=(state.unlocked||[]).includes('reading-chair');
  return {glasses:{disabled:!glasses,label:glasses?'圆眼镜 · 可装备':'圆眼镜 · 累计5分钟解锁'},chair:{disabled:!chair,label:chair?'阅读椅 · 可装备':'阅读椅 · 累计10分钟解锁'}};
}
