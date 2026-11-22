// Branches, moving particles and accessible policy labels share CSS-pixel coordinates.
const sky = document.querySelector('#atlas');
const canvas = document.querySelector('#galaxy-canvas');
const motion = document.querySelector('#galaxy-motion');
const links = [...sky.querySelectorAll('[data-galaxy-policy]')];
const labels = links.map(link => link.querySelector('.orbit-label'));
const dots = labels.map(label => label.querySelector('i'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const gl = canvas.getContext('webgl', {alpha:false, antialias:true, powerPreference:'low-power'});

const vertex = `
attribute vec2 position;
attribute vec4 style;
uniform vec2 viewport;
uniform float density;
varying vec3 tint;
void main(){
  gl_Position=vec4((position/viewport*2.-1.)*vec2(1.,-1.),0.,1.);
  gl_PointSize=style.w*density;
  vec2 uv=position/viewport;
  float quietCorner=(1.-smoothstep(.24,.62,uv.x))*(1.-smoothstep(.16,.33,uv.y));
  float ink=(1.-quietCorner*.85)*(1.-smoothstep(.88,.97,uv.y)*.83);
  tint=mix(vec3(.037,.039,.043),style.rgb,ink);
}`;
const fragment = `
precision mediump float;
uniform bool drawingNodes;
varying vec3 tint;
void main(){
  float alpha=1.;
  if(drawingNodes) alpha=1.-smoothstep(.28,.5,length(gl_PointCoord-.5));
  gl_FragColor=vec4(tint,alpha);
}`;

function buildProgram(){
  const program=gl.createProgram();
  for(const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,code);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  return program;
}

function makeGraph(roots,w,h){
  let seed=941;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const tau=2*Math.PI, nodes=[],edges=[], hubs=[];
  const scale=Math.min(w*.0021,1)*Math.min(h/740,1.18);
  const palette=[[.99,.65,.65],[.97,.79,.50],[.58,.83,.69],[.67,.51,.82],[.81,.50,.54]];
  function node(x,y,size,tint,owner=-1){
    nodes.push({x,y,size,tint,owner,phase:random()*tau});
    return nodes.length-1;
  }
  function child(parent,angle,length,size,tint){
    const p=nodes[parent];
    const id=node(p.x+Math.cos(angle)*length,p.y+Math.sin(angle)*length,size,tint,p.owner);
    edges.push([parent,id]);return id;
  }
  const cx=w*.51,cy=h*.54;
  for(const [i,p] of roots.entries())hubs.push(node(p.x,p.y,6,palette[i%5],i));
  // Uneven, nested clusters give the network its silhouette.
  for(let i=0;i<43;i++){
    const a=random()*tau,r=Math.pow(random(),.72);
    hubs.push(node(cx+Math.cos(a)*r*w*.41,cy+Math.sin(a)*r*h*.39,
      2+4*random(),palette[i%5]));
  }
  for(const [i,id] of hubs.entries()){
    const hub=nodes[id],tint=hub.tint;
    const radius=(i<10?79:24+random()*60)*scale;
    const turns=i<10?23:7+Math.floor(random()*14);
    const slant=random()*tau;
    for(let j=0;j<turns;j++){
      const angle=random()*tau;
      const mid=child(id,angle,radius*(.2+random()*.66),1.6+random(),tint);
      const fan=2+Math.floor(random()*4);
      for(let k=0;k<fan;k++){
        const end=child(mid,angle+(k/(fan-1)-.5)*1.1+Math.sin(slant)*.3,
          radius*(.1+.47*random()),1+random()*2.1,random()<.68?tint:[.42,.41,.41]);
        if(k===0&&random()<.24)child(end,angle,radius*.28,1.4,tint);
      }
    }
    // Local bridges connect nearby clusters without drawing long chords across the type.
    const nearest=hubs.filter(other=>other!==id).sort((a,b)=>
      Math.hypot(nodes[a].x-hub.x,nodes[a].y-hub.y)-Math.hypot(nodes[b].x-hub.x,nodes[b].y-hub.y));
    for(const other of nearest.slice(0,3))if(other>id)edges.push([id,other]);
  }
  // A broad central web binds the smaller trees into one continuous constellation.
  const core=node(cx,cy,6,[.94,.61,.60]);
  const inner=[];
  for(let i=0;i<140;i++){
    const a=random()*tau,r=Math.sqrt(random());
    const id=node(cx+Math.cos(a)*r*w*.22,cy+Math.sin(a)*r*h*.29,
      1.6+random()*2.8,random()<.5?[.93,.57,.58]:palette[i%5]);
    if(i%3===0)edges.push([core,id]);
    const hub=hubs.reduce((best,other)=>{
      const near=nodes[best],candidate=nodes[other],p=nodes[id];
      return Math.hypot(p.x-candidate.x,p.y-candidate.y)<Math.hypot(p.x-near.x,p.y-near.y)?other:best;
    });
    edges.push([hub,id]);
    for(let j=0;j<inner.length;j++){
      const other=inner[j];
      if(Math.hypot(nodes[id].x-nodes[other].x,nodes[id].y-nodes[other].y)<scale*48&&random()<.3)
        edges.push([id,other]);
    }
    inner.push(id);
  }
  // Broken outer filaments extend beyond the dense core.
  for(let i=0;i<23;i++){
    const start=random()*tau,r=.82+.28*random();
    let prev=-1;
    for(let j=0;j<5+Math.floor(random()*11);j++){
      const a=start+j*.029,dr=r+(random()-.5)*.025;
      const id=node(cx+Math.cos(a)*dr*w*.49,cy+Math.sin(a)*dr*h*.46,1+random()*1.5,[.39,.39,.40]);
      if(prev>=0)edges.push([prev,id]);prev=id;
    }
  }
  return {nodes,edges};
}

// Embedded browsers can draw the same anchored network without a GPU context.
function staticNetwork(surface){
  const ctx=surface.getContext('2d');
  if(!ctx)return;
  function paint(){
    const bounds=surface.getBoundingClientRect(),w=bounds.width,h=bounds.height;
    if(!w||!h)return;
    const graph=makeGraph(dots.map(dot=>{
      const rect=dot.getBoundingClientRect();
      return {x:rect.x+rect.width/2-bounds.x,y:rect.y+rect.height/2-bounds.y};
    }),w,h);
    const scale=Math.min(devicePixelRatio,1.75);
    surface.width=Math.round(w*scale);surface.height=Math.round(h*scale);
    ctx.scale(scale,scale);ctx.fillStyle='#090a0b';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#363436';ctx.lineWidth=.65;ctx.beginPath();
    for(const [a,b] of graph.edges){
      const from=graph.nodes[a],to=graph.nodes[b];ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);
    }
    ctx.stroke();
    for(const n of graph.nodes){
      ctx.fillStyle='rgb('+n.tint.map(c=>Math.round(c*215)).join(',')+')';
      ctx.beginPath();ctx.arc(n.x,n.y,n.size*.43,0,2*Math.PI);ctx.fill();
    }
    surface.dataset.still='drawn';
  }
  new ResizeObserver(paint).observe(sky);document.fonts.ready.then(paint);paint();
}

function start(){
  const program=buildProgram(), buffer=gl.createBuffer();
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [key,count,offset] of [['position',2,0],['style',4,8]]){
    const attr=gl.getAttribLocation(program,key);
    gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,count,gl.FLOAT,false,24,offset);
  }
  const viewport=gl.getUniformLocation(program,'viewport'), density=gl.getUniformLocation(program,'density');
  const drawingNodes=gl.getUniformLocation(program,'drawingNodes');
  let graph,lineData,pointData,positions,w,h,frame=0,last=0,t=0,visible=true,active=-1,paused=reduced.matches;
  const flowCount=110,dx=new Float32Array(10),dy=new Float32Array(10);
  function layout(){
    const bounds=canvas.getBoundingClientRect();w=bounds.width;h=bounds.height;
    if(!w||!h)return;
    graph=makeGraph(dots.map((dot,i)=>{
      const b=dot.getBoundingClientRect();
      return {x:b.left+b.width/2-bounds.left-dx[i],y:b.top+b.height/2-bounds.top-dy[i]};
    }),w,h);
    lineData=new Float32Array(graph.edges.length*12);
    pointData=new Float32Array((graph.nodes.length+flowCount)*6);
    positions=new Float32Array(graph.nodes.length*2);
    const dpr=Math.min(devicePixelRatio,1.75);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(viewport,w,h);gl.uniform1f(density,dpr);
    refresh();
  }
  function draw(stamp){
    frame=0;
    if(!graph||!visible||document.hidden||gl.isContextLost())return;
    if(!paused&&last&&stamp-last<32){frame=requestAnimationFrame(draw);return;}
    if(last&&!paused)t+=Math.min(stamp-last,100)/1000;
    last=stamp;
    for(let i=0;i<labels.length;i++){
      dx[i]=Math.sin(t*.32+i*1.7)*2.7;dy[i]=Math.sin(t*.42+i*.9)*3.4;
      labels[i].style.setProperty('--dx',dx[i]+'px');labels[i].style.setProperty('--dy',dy[i]+'px');
    }
    graph.nodes.forEach((n,i)=>{
      const x=n.x+(n.owner>=0?dx[n.owner]:4*Math.sin(t*.18+n.phase));
      const y=n.y+(n.owner>=0?dy[n.owner]:2*Math.sin(t*.23+n.phase));
      positions[i*2]=x;positions[i*2+1]=y;
      const k=i*6, bright=n.owner===active&&active>=0?1.15:.87;
      pointData[k]=x;pointData[k+1]=y;
      for(let c=0;c<3;c++)pointData[k+c+2]=n.tint[c]*bright;
      pointData[k+5]=n.size;
    });
    graph.edges.forEach(([a,b],i)=>{
      const lit=active>=0&&graph.nodes[a].owner===active;
      for(let e=0;e<2;e++){
        const id=e?b:a,k=i*12+e*6;
        lineData[k]=positions[id*2];lineData[k+1]=positions[id*2+1];
        lineData[k+2]=lit?.56:.21;lineData[k+3]=lit?.38:.205;lineData[k+4]=lit?.36:.21;lineData[k+5]=1;
      }
    });
    // Faint points stream right to left at different depths behind the stationary clusters.
    for(let i=0;i<flowCount;i++){
      const k=(graph.nodes.length+i)*6,z=(i%11)/11;
      const phase=i*.6180339-t*(.0025+.003*z);
      pointData[k]=w*(phase-Math.floor(phase));
      pointData[k+1]=h*((i*.732051)%1);
      pointData[k+2]=.28;pointData[k+3]=.27;pointData[k+4]=.30;pointData[k+5]=1+1.1*z;
    }
    gl.clearColor(.037,.039,.043,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(drawingNodes,0);gl.bufferData(gl.ARRAY_BUFFER,lineData,gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,lineData.length/6);
    gl.uniform1i(drawingNodes,1);gl.bufferData(gl.ARRAY_BUFFER,pointData,gl.DYNAMIC_DRAW);gl.drawArrays(gl.POINTS,0,pointData.length/6);
    sky.dataset.renderer='webgl';
    if(!paused)frame=requestAnimationFrame(draw);
  }
  function refresh(){cancelAnimationFrame(frame);last=0;frame=requestAnimationFrame(draw);}
  function setMotion(value){paused=value;sky.dataset.motion=paused?'paused':'running';motion.textContent=paused?'움직임 재생':'움직임 멈추기';motion.setAttribute('aria-pressed',String(paused));refresh();}
  links.forEach((link,i)=>{
    function highlight(){active=i;refresh();}
    function clear(){active=links.findIndex(item=>item.matches(':hover,:focus-visible'));refresh();}
    link.addEventListener('pointerenter',highlight);link.addEventListener('focus',highlight);
    link.addEventListener('pointerleave',clear);link.addEventListener('blur',clear);
  });
  motion.hidden=false;motion.addEventListener('click',()=>setMotion(!paused));reduced.addEventListener('change',()=>setMotion(reduced.matches));
  new ResizeObserver(layout).observe(sky);document.fonts.ready.then(layout);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;refresh();}).observe(sky);
  document.addEventListener('visibilitychange',refresh);
  canvas.addEventListener('webglcontextlost',()=>{
    cancelAnimationFrame(frame);sky.dataset.renderer='fallback';motion.hidden=true;
    const still=canvas.cloneNode(false);canvas.replaceWith(still);staticNetwork(still);
  },{once:true});
  layout();setMotion(paused);
}
if(gl)start();else staticNetwork(canvas);
