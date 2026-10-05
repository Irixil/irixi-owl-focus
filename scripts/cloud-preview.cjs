'use strict';
// Test adapter only. Same canonical UI/core, no Electron/OS provider or real APP data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {FileStore}=require('../src/store.cjs'),{FocusService}=require('../src/service.cjs'),{ActivityService,ActivityFileStore}=require('../src/activity.cjs');
const root=path.resolve(__dirname,'..'),ui=path.join(root,'ui');
const dir=path.resolve(process.env.OWL_CLOUD_TEST_DIR||path.join(root,'.runtime/cloud-test-data'));
let offset=0,synthetic={name:'合成示例 · 编辑器',bundleId:'synthetic.editor'},closing=false;
const base=Number(process.hrtime.bigint()/1000000n),clock=()=>({mono:Number(process.hrtime.bigint()/1000000n)-base+offset,wall:Date.now()+offset});
const focus=new FocusService(new FileStore(path.join(dir,'focus')),{clock});
const activity=new ActivityService({store:new ActivityFileStore(path.join(dir,'activity')),foreground:async()=>synthetic,now:()=>clock().mono,wall:()=>clock().wall});
const clients=new Set();
function publish(kind,value){for(const res of clients)res.write(`event: ${kind}\ndata: ${JSON.stringify(value)}\n\n`);}
focus.on('change',v=>publish('focus',v));activity.on('change',v=>publish('activity',v));
const tick=setInterval(()=>focus.tick(),200),json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{
 try{
  const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);
  if(req.method==='POST'){
   if(req.headers.origin!==origin)return json(res,403,{error:'Same-origin test requests only'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)return json(res,413,{error:'Body too large'});}const value=JSON.parse(body||'{}');
   if(url.pathname==='/test/command'){try{return json(res,200,{ok:true,state:focus.dispatch(value)});}catch(error){return json(res,200,{ok:false,error:error.message,state:focus.snapshot()});}}
   if(url.pathname==='/test/activity-command'){
    if(value.type==='start')return json(res,200,activity.start());if(value.type==='stop')return json(res,200,activity.stop());if(value.type==='classify')return json(res,200,activity.classify(value.id,value.category));throw Error('Unsupported synthetic command');
   }
   if(url.pathname==='/test/advance'){
    if(!Number.isInteger(value.ms)||value.ms<0||value.ms>660000)throw Error('Synthetic advance 0..660000 ms only');
    for(let n=value.ms;n>0;){const step=Math.min(n,1000);offset+=step;n-=step;focus.tick();if(activity.enabled)activity.observe(synthetic);}
    return json(res,200,{focus:focus.snapshot(),activity:activity.snapshot()});
   }
   if(url.pathname==='/test/synthetic-app'){
    if(!['editor','browser'].includes(value.app))throw Error('Only fixed synthetic APP names');
    if(activity.enabled)activity.observe(synthetic);synthetic=value.app==='editor'?{name:'合成示例 · 编辑器',bundleId:'synthetic.editor'}:{name:'合成示例 · 浏览器',bundleId:'synthetic.browser'};
    if(activity.enabled)activity.observe(synthetic);return json(res,200,activity.snapshot());
   }
   return json(res,404,{error:'Unknown test route'});
  }
  if(req.method!=='GET')return json(res,405,{error:'GET/POST only'});
  if(url.pathname==='/test/snapshot')return json(res,200,focus.snapshot());
  if(url.pathname==='/test/activity-snapshot')return json(res,200,activity.snapshot());
  if(url.pathname==='/test/events'){
   res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive'});clients.add(res);res.write(': synthetic test adapter\n\n');req.on('close',()=>clients.delete(res));return;
  }
  if(url.pathname==='/cloud-bridge.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(fs.readFileSync(path.join(root,'scripts/cloud-bridge.js')));}
  const filename=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const resolved=path.resolve(ui,filename);
  if(!resolved.startsWith(ui+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())return json(res,404,{error:'File not found'});
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};res.writeHead(200,{'content-type':types[path.extname(resolved)]||'application/octet-stream','cache-control':'no-store'});
  if(filename==='index.html')return res.end(fs.readFileSync(resolved,'utf8').replace("connect-src 'none'","connect-src 'self'").replace('<script src="app.js"','<script src="cloud-bridge.js"></script><script src="app.js"').replace('<title>猫头鹰专注</title>','<title>合成云端测试 · 猫头鹰专注</title>'));
  fs.createReadStream(resolved).pipe(res);
 }catch(error){json(res,400,{error:error.message});}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(JSON.stringify({kind:'synthetic-cloud-test',url:`http://127.0.0.1:${server.address().port}/?mode=widget`,dataDir:dir,realAppQueries:0,nativeMacVerification:false})));
function close(){if(closing)return;closing=true;clearInterval(tick);activity.close();focus.close();for(const res of clients)res.end();server.close(()=>process.exit(0));}
process.on('SIGTERM',close);process.on('SIGINT',close);
