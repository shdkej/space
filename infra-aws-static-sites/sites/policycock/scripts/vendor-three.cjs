'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'node_modules/three');
const target=path.join(root,'dist/vendor/three');
fs.mkdirSync(target,{recursive:true});
for(const [from,to] of [
  ['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],
  ['examples/jsm/environments/RoomEnvironment.js','RoomEnvironment.js'],
  ['LICENSE','LICENSE']
]) fs.copyFileSync(path.join(source,from),path.join(target,to));
require('esbuild').buildSync({entryPoints:[path.join(source,'build/three.module.js')],outfile:path.join(target,'three.module.js'),bundle:true,minify:true,format:'esm',target:'es2020',legalComments:'inline'});
fs.rmSync(path.join(target,'three.core.js'),{force:true});
console.log('Vendored Three.js '+JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).version);
