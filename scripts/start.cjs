'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');let binary;
try{binary=require('electron');}catch{console.error('请先在项目目录执行 npm ci，再运行 npm start。');process.exit(1);}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(binary,[root,...process.argv.slice(2)],{cwd:root,env,stdio:'inherit'});
child.on('error',e=>{console.error('启动失败：'+e.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
