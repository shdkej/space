// A depth-layered star field and a drifting band of interstellar dust.
const sky=document.querySelector('#atlas');
const canvas=document.querySelector('#galaxy-canvas');
const motion=document.querySelector('#galaxy-motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
let paused=reduced.matches, visible=true, frame=0, time=0, previous=0;
let pointerX=0, pointerY=0, cameraX=0, cameraY=0;

const quadVertex=`
attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}
`;
const cloudFragment=`
precision highp float;
varying vec2 uv;
uniform float t, aspect;
uniform vec2 camera;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p){
 float a=.5,v=0.;
 for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.72,1.04,-1.04,1.72)*p+7.1;a*=.50;}
 return v;
}
void main(){
 vec2 v=uv-.5;
 vec2 p=vec2(v.x*aspect,v.y)+camera*.011;
 float x=p.x+t*.013;
 float center=.19*sin(x*2.0-.4)+.04*sin(x)-.02;
 float y=p.y-center;
 vec2 q=vec2(x,y*2.1);
 float wisps=fbm(q*4.+vec2(3.,9.));
 float grain=fbm(q*14.+wisps*3.);
 float band=exp(-pow((y+(wisps-.5)*.15)/.15,2.));
 float glow=exp(-abs(y)*5.4);
 float dust=fbm(q*8.+vec2(wisps*4.,2.));
 float cloud=band*smoothstep(.21,.76,wisps*.53+grain*.47);
 float rift=smoothstep(.30,.65,dust)*exp(-pow((y-.033*sin(x*9.)+(wisps-.5)*.16)/.049,2.));
 vec3 color=mix(vec3(.014,.022,.059),vec3(.069,.087,.167),glow);
 vec3 gas=mix(vec3(.31,.34,.74),vec3(.88,.64,.55),smoothstep(.19,.79,fbm(q*2.1+6.)));
 color+=vec3(.09,.054,.17)*glow+gas*cloud*(1.-rift*.93);
 color+=vec3(.18,.19,.27)*band*pow(grain,3.)*2.;
 color*=1.-.32*smoothstep(.2,.75,length(v));
 gl_FragColor=vec4(color,1.);
}
`;
const starVertex=`
attribute vec4 star;
uniform float t,aspect,density;
uniform vec2 camera;
varying float light;
void main(){
 float depth=star.z;
 float distanceToEye=mix(2.6,1.,depth);
 float orbitWidth=2.*aspect*distanceToEye;
 float x=(fract(star.x-t*.018/orbitWidth)-.5)*orbitWidth;
 float y=star.y*1.5+.22*sin(x/distanceToEye-.4);
 gl_Position=vec4((x+camera.x*.03)/aspect,y+camera.y*.03,0.,distanceToEye);
 gl_PointSize=density*(.8+star.w*star.w*3.2)*(.55+.65*depth);
 light=.32+star.w*.63;
}`;
const starFragment=`
precision mediump float;
varying float light;
void main(){
 float d=length(gl_PointCoord-.5)*2.;
 gl_FragColor=vec4(mix(vec3(.68,.76,1.),vec3(1.,.91,.76),light),light*exp(-d*d*3.8));
}`;
function program(vs,fs){
 const result=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
   const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
   gl.attachShader(result,shader);gl.deleteShader(shader);
 }
 gl.linkProgram(result);
 if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(result));
 return result;
}
function layer(vs,fs,attribute,values,size){
 const shader=program(vs,fs),buffer=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
 const point=gl.getAttribLocation(shader,attribute);
 const uniforms=Object.fromEntries(['t','aspect','density','camera'].map(k=>[k,gl.getUniformLocation(shader,k)]));
 return function paint(mode){
   gl.useProgram(shader);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,size,gl.FLOAT,false,0,0);
   gl.uniform1f(uniforms.t,time);gl.uniform1f(uniforms.aspect,canvas.clientWidth/canvas.clientHeight);
   gl.uniform1f(uniforms.density,canvas.width/canvas.clientWidth);gl.uniform2f(uniforms.camera,cameraX,cameraY);
   gl.drawArrays(mode,0,values.length/size);gl.disableVertexAttribArray(point);
 };
}
function start(){
 const nebula=layer(quadVertex,cloudFragment,'position',new Float32Array([-1,-1,3,-1,-1,3]),2);
 const stars=new Float32Array(5600*4);
 let seed=713;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<stars.length;i+=4){
   stars[i]=random();
   stars[i+1]=i%12===0?random()*2.3-1.15:(random()+random()+random()-1.5)*.46;
   stars[i+2]=random();stars[i+3]=random();
 }
 const points=layer(starVertex,starFragment,'star',stars,4);
 function draw(stamp){
   frame=0;if(!visible||document.hidden||gl.isContextLost())return;
   if(!paused&&previous&&stamp-previous<32){frame=requestAnimationFrame(draw);return;}
   const delta=previous?Math.min((stamp-previous)/1000,.09):0;
   previous=stamp;if(!paused)time+=delta;
   cameraX+=(pointerX-cameraX)*.09;cameraY+=(pointerY-cameraY)*.09;
   const scale=Math.min(devicePixelRatio,1.35,1450/canvas.clientWidth);
   const width=Math.max(1,Math.round(canvas.clientWidth*scale)),height=Math.max(1,Math.round(canvas.clientHeight*scale));
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   gl.viewport(0,0,width,height);gl.disable(gl.BLEND);nebula(gl.TRIANGLES);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);points(gl.POINTS);
   sky.dataset.renderer='webgl';
   if(!paused)frame=requestAnimationFrame(draw);
 }
 function refresh(){if(frame)cancelAnimationFrame(frame);previous=0;frame=requestAnimationFrame(draw);}
 function setMotion(value){
   paused=value;sky.dataset.motion=paused?'paused':'running';
   motion.textContent=paused?'움직임 재생':'움직임 멈추기';motion.setAttribute('aria-pressed',String(paused));refresh();
 }
 motion.hidden=false;motion.addEventListener('click',()=>setMotion(!paused));reduced.addEventListener('change',()=>setMotion(reduced.matches));
 sky.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||paused)return;const b=sky.getBoundingClientRect();pointerX=2*(e.clientX-b.left)/b.width-1;pointerY=1-2*(e.clientY-b.top)/b.height;});
 sky.addEventListener('pointerleave',()=>{pointerX=0;pointerY=0;});
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();}).observe(sky);
 new ResizeObserver(refresh).observe(sky);document.addEventListener('visibilitychange',refresh);
 canvas.addEventListener('webglcontextlost',()=>{cancelAnimationFrame(frame);sky.dataset.renderer='fallback';sky.dataset.motion='paused';motion.hidden=true;});
 setMotion(paused);
}
if(gl)start();
