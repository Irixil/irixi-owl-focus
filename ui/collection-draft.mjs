import {SLOTS} from './room-slots.mjs';
import '../src/room-layout.js';
import './room-geometry.js';
import './layer-order.js';
import './placement-rules.js';
export {SLOTS};
export const outfit=state=>Object.fromEntries(SLOTS.map(slot=>[slot,(state.testAccess?.enabled?state.testAccess.equipment:state.equipment)[slot]]));
export const positions=state=>globalThis.owlRoomLayout.effectivePositions(state);
export class CollectionDraft {
  begin(state){this.base=outfit(state);this.equipment={...this.base};this.basePositions=positions(state);this.positions=structuredClone(this.basePositions);this.baseLayerOrder=globalThis.owlLayerOrder.effectiveOrder(state);this.layerOrder=[...this.baseLayerOrder];this.testEnabled=Boolean(state.testAccess?.enabled);this.catalog=state.collectionCatalog;}
  choose(slot,id){
    if(!this.equipment||!SLOTS.includes(slot))throw Error('请先打开收藏箱。');
    const item=this.catalog?.items.find(i=>i.id===id&&i.category===slot),previous=this.equipment[slot];
    if(item?.inheritSlotTransform&&!Object.hasOwn(this.positions,id)&&previous&&Object.hasOwn(this.positions,previous)){const value=structuredClone(this.positions[previous]);if(value.size){const prior=this.catalog.items.find(i=>i.id===previous),a=globalThis.owlPlacementRules.baseDisplaySize(prior),b=globalThis.owlPlacementRules.baseDisplaySize(item);if(a&&b)value.size=b.map(n=>n*value.size[0]/a[0]);}this.positions[id]=value;}
    this.equipment[slot]=id;
  }
  get changed(){return Boolean(this.equipment&&(SLOTS.some(slot=>this.equipment[slot]!==this.base[slot])||!globalThis.owlPlacementRules.equalPositions(this.positions,this.basePositions)||JSON.stringify(this.layerOrder)!==JSON.stringify(this.baseLayerOrder)));}
  get changedSlots(){return this.equipment?SLOTS.filter(slot=>this.equipment[slot]!==this.base[slot]):[];}
  stale(state){return Boolean(this.equipment&&(this.testEnabled!==Boolean(state.testAccess?.enabled)||SLOTS.some(slot=>outfit(state)[slot]!==this.base[slot])||!globalThis.owlPlacementRules.equalPositions(positions(state),this.basePositions)||JSON.stringify(globalThis.owlLayerOrder.effectiveOrder(state))!==JSON.stringify(this.baseLayerOrder)));}
  move(id,next){const row=globalThis.owlPlacementRules.bindings(this.catalog,this.equipment,this.positions).find(r=>r.id===id),{key,position}=globalThis.owlPlacementRules.constrainItem(this.catalog,this.equipment,this.positions,id,next),value=row.scene?.placement||this.positions[key]?.size?{...position,size:[...globalThis.owlPlacementRules.sizeInfo(this.catalog,this.equipment,this.positions,id).size]}:position,candidate={...this.positions,[key]:value};globalThis.owlPlacementRules.validateArrangement(this.catalog,this.equipment,candidate);this.positions=candidate;}
  resize(id,factor){this.positions=globalThis.owlPlacementRules.resizeItem(this.catalog,this.equipment,this.positions,id,factor);}
  resetSize(id){this.resize(id,1);}
  reset(id){const item=this.catalog.items.find(i=>i.id===id);if(!item)return;const candidate={...this.positions};delete candidate[globalThis.owlPlacementRules.positionKey(item,this.equipment)];globalThis.owlPlacementRules.validateArrangement(this.catalog,this.equipment,candidate);this.positions=candidate;}
  moveLayer(id,delta){const item=this.catalog.items.find(i=>i.id===id);if(!item)throw Error('请先选中道具。');this.layerOrder=globalThis.owlLayerOrder.moveLayer(this.layerOrder,item.category,delta,this.equipment);}
  resetAll(){this.positions=globalThis.owlPlacementRules.defaultPositions(this.catalog,this.equipment);this.layerOrder=[...globalThis.owlLayerOrder.DEFAULT_ORDER];}
  command(){return{equipment:{...this.equipment},expectedEquipment:{...this.base},positions:structuredClone(this.positions),expectedPositions:structuredClone(this.basePositions),layerOrder:[...this.layerOrder],expectedLayerOrder:[...this.baseLayerOrder],expectedTestEnabled:this.testEnabled};}
  clear(){this.base=null;this.equipment=null;this.positions=this.basePositions=this.layerOrder=this.baseLayerOrder=null;}
}
