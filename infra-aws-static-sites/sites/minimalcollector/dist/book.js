// Each sheet is tessellated from its bound edge to its free edge. The printed
// artwork, its reverse side and its projected shadow use the same curved mesh.
class CollectionBook {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:true});
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const vertex = `
      precision mediump float;
      attribute vec2 paper;
      uniform float side, turn, lift, shadow, margin;
      varying vec2 uv; varying float facing, slope, height;
      void main(){
        float r=paper.x, v=paper.y;
        float wave=sin(turn*3.14159265);
        float bend=-1.52*wave;
        float a=turn*3.14159265-bend*.5+wave*(v-.5)*.23;
        float b=a+bend*r;
        float dx=r*cos(a), z=r*sin(a);
        if(abs(bend)>.001){dx=(sin(b)-sin(a))/bend;z=(cos(a)-cos(b))/bend;}
        float arch=.026*sin(r*3.14159265);
        z+=arch+lift;
        float x=side*dx, y=.5-v;
        if(shadow>.5){x+=.145*z+.009;y-=.12*z+.010;z=0.;}
        float w=1.-z*.12-y*.06;
        gl_Position=vec4(x*.90, y*1.47+z*.29-.08-margin,0.,w);
        uv=paper; facing=cos(b);slope=sin(b)*side; height=z;
      }`;
    const fragment = `
      precision mediump float;
      uniform sampler2D frontInk, backInk;
      uniform float side, shadow, solid;
      uniform vec3 color;
      varying vec2 uv; varying float facing, slope, height;
      void main(){
        if(shadow>.5){gl_FragColor=vec4(.034,.026,.02,.22+.16*min(height,1.));return;}
        if(solid>.5){gl_FragColor=vec4(color,1.);return;}
        float u=side>0.?uv.x:1.-uv.x;
        vec3 ink=facing>=0.?texture2D(frontInk,vec2(u,uv.y)).rgb:texture2D(backInk,vec2(1.-u,uv.y)).rgb;
        float ridge=(uv.x-.105)*12.;
        float binding=1.-.19*exp(-uv.x*22.)+.035*exp(-ridge*ridge);
        float light=binding*(.95+.055*uv.y-.18*abs(slope)+.10*slope);
        gl_FragColor=vec4(ink*light,1.);
      }`;
    const shaders = [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]].map(([type,source]) => {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    this.program=gl.createProgram();
    shaders.forEach(shader=>gl.attachShader(this.program,shader));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) || 'Book shader link failed');
    gl.useProgram(this.program);
    shaders.forEach(shader=>gl.deleteShader(shader));
    const points=[];
    for(let y=0;y<12;y++){
      for(let x=0;x<64;x++){
        const a=x/64,b=(x+1)/64,c=y/12,d=(y+1)/12;
        points.push(a,c,b,c,a,d,a,d,b,c,b,d);
      }
    }
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(this.program,'paper');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    this.count=points.length/2;
    this.uniform={};
    for(const name of ['frontInk','backInk','side','turn','lift','shadow','solid','color','margin']){
      this.uniform[name]=gl.getUniformLocation(this.program,name);
    }
    gl.uniform1i(this.uniform.frontInk,0); gl.uniform1i(this.uniform.backInk,1);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    this.cover=this.texture(this.coverArt());
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.resize=new ResizeObserver(()=>this.draw());
    this.resize.observe(canvas);
  }
  sheet() {
    const canvas=document.createElement('canvas');
    canvas.width=864; canvas.height=832;
    return canvas;
  }
  coverArt(photo){
    const c=this.sheet(), ctx=c.getContext('2d');
    const grad=ctx.createLinearGradient(0,0,c.width,0);
    grad.addColorStop(0,'#131712');grad.addColorStop(.055,'#42473c');grad.addColorStop(.08,'#242b23');grad.addColorStop(1,'#292e27');
    ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle='#e8e1cb';ctx.font='100px Georgia,serif';ctx.fillText('Minimal',95,220);ctx.fillText('Collector',95,320);
    if(photo)ctx.drawImage(photo,95,385,485,268);
    ctx.font='24px sans-serif';ctx.fillText('수집 도록',95,740);
    return c;
  }
  texture(source) {
    const gl=this.gl, tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    return tex;
  }
  // Wrap on word boundaries, falling back to characters for long titles.
  lines(ctx,text,x,y,maxWidth,leading) {
    let line='';
    for(const word of text.split(/\s+/)){
      const joined=line?line+' '+word:word;
      if(line && ctx.measureText(joined).width>maxWidth){
        ctx.fillText(line,x,y); y+=leading;line='';
      }
      for(const ch of (line?' ':'')+word){
        if(ctx.measureText(line+ch).width>maxWidth){ctx.fillText(line,x,y);y+=leading;line='';}
        line+=ch;
      }
    }
    if(line)ctx.fillText(line,x,y);
    return y+leading;
  }
  spread(data,img) {
    const w=864,h=832;
    const page=this.sheet(), a=page.getContext('2d');
    a.fillStyle='#eee9da';a.fillRect(0,0,w,h);
    a.fillStyle='#4c473c';a.font='21px Georgia,serif';a.fillText(data.english.toUpperCase(),48,57);
    a.textAlign='right';a.fillText(data.number,816,57);a.textAlign='left';
    a.strokeStyle='#a69d8a';a.beginPath();a.moveTo(48,82);a.lineTo(816,82);a.stroke();
    const scale=Math.min(792/img.naturalWidth,524/img.naturalHeight);
    const iw=img.naturalWidth*scale, ih=img.naturalHeight*scale;
    const ix=(w-iw)/2,iy=110+(524-ih)/2;
    a.drawImage(img,ix,iy,iw,ih);
    a.fillStyle='#272820';a.font='42px Georgia,"Malgun Gothic",serif';
    a.fillText(data.title,48,719,768);a.fillStyle='#5a5548';a.font='22px sans-serif';a.fillText(data.subject,49,767,765);
    const focus=data.stairs?[.50,.734]:[.50,.50];
    const right=this.sheet(), b=right.getContext('2d');
    b.fillStyle='#30372e';b.fillRect(0,0,w,h);
    b.fillStyle='#d6cbb2';b.font='22px Georgia,serif';b.fillText(data.english+'  /  '+data.group,52,57);
    b.strokeStyle='#7a806e';b.beginPath();b.moveTo(52,82);b.lineTo(812,82);b.stroke();
    b.fillStyle='#eeeada';b.font='49px Georgia,"Malgun Gothic",serif';
    this.lines(b,data.description,58,294,738,80);
    b.fillStyle='#cbc6b3';b.font='22px sans-serif';b.fillText(data.credit,59,766);
    let pin=[(ix+focus[0]*iw)/w,(iy+focus[1]*ih)/h];
    if(data.stairs){
      // Paint one continuous photograph, then print each half on its own sheet.
      const full=document.createElement('canvas');
      full.width=w*2;full.height=h;
      const art=full.getContext('2d');
      const photographicWidth=1360, photoHeight=img.naturalHeight*photographicWidth/img.naturalWidth;
      const photoY=(h-photoHeight)*.36;
      art.drawImage(img,0,photoY,photographicWidth,photoHeight);
      art.drawImage(img,img.naturalWidth-2,0,2,img.naturalHeight,photographicWidth,photoY,w*2-photographicWidth,photoHeight);
      const wash=art.createLinearGradient(830,0,w*2-30,0);
      wash.addColorStop(0,'rgba(35,33,27,0)');wash.addColorStop(.35,'rgba(35,33,27,.44)');
      wash.addColorStop(.72,'rgba(35,33,27,.92)');wash.addColorStop(1,'#23221e');
      art.fillStyle=wash;art.fillRect(830,0,w*2-830,h);
      art.fillStyle='#242821';art.font='22px Georgia,serif';art.fillText('SPACES',44,58);
      art.fillStyle='#e7ddc7';art.font='23px Georgia,serif';art.fillText('Firenze',1225,99);
      art.textAlign='right';art.fillText(data.number,1675,99);art.textAlign='left';
      art.fillStyle='#f9f4e9';art.font='59px Georgia,"Malgun Gothic",serif';
      art.fillText('라우렌치아나',1218,262,460);art.fillText('도서관',1218,337);
      art.fillStyle='#e8ddc8';art.font='29px "Malgun Gothic",sans-serif';
      this.lines(art,data.description,1225,471,440,49);
      art.font='20px sans-serif';art.fillText(data.credit,1225,772);
      a.drawImage(full,0,0,w,h,0,0,w,h);
      b.drawImage(full,w,0,w,h,0,0,w,h);
      pin=[(focus[0]*photographicWidth)/w,(photoY+focus[1]*photoHeight)/h];
    }
    const detail=this.sheet(), d=detail.getContext('2d');
    const sample=Math.min(img.naturalWidth*.56,img.naturalHeight*.65);
    const sx=Math.max(0,Math.min(img.naturalWidth-sample,focus[0]*img.naturalWidth-sample/2));
    const sy=Math.max(0,Math.min(img.naturalHeight-sample,focus[1]*img.naturalHeight-sample/2));
    d.fillStyle='#30372e';d.fillRect(0,0,w,h);
    d.drawImage(img,sx,sy,sample,sample,0,0,w,720);
    d.fillStyle='#f1edde';d.font='30px sans-serif';d.fillText(data.detail,52,784);
    return {left:this.texture(page),right:this.texture(right),detail:this.texture(detail),
      pin};
  }
  pinPosition() {
    const [u,v]=this.current.pin,r=1-u,y=.5-v,z=.026*Math.sin(r*Math.PI);
    const w=1-z*.12-y*.06;
    return [(1-r*.9/w)*50,(1-(y*1.47+z*.29-.08)/w)*50];
  }
  drop(spread) {
    if(spread) for(const key of ['left','right','detail']) this.gl.deleteTexture(spread[key]);
  }
  reset() {
    cancelAnimationFrame(this.frame);this.frame=0;
    this.drop(this.current);this.drop(this.pending);
    this.current=null;this.pending=null;this.turn=null;this.detail=false;
  }
  draw() {
    const {canvas,gl}=this;
    if(!this.current || !canvas.clientWidth || !canvas.clientHeight)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    const width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const leaf=(side,front,back=front,q=0,shadow=0,color=null,margin=0)=>{
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,front);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,back);
      for(const [name,value] of [['side',side],['turn',q],['lift',0],['shadow',shadow],['solid',color?1:0],['margin',margin]]){
        gl.uniform1f(this.uniform[name],value);
      }
      if(color)gl.uniform3fv(this.uniform.color,color);
      gl.drawArrays(gl.TRIANGLES,0,this.count);
    };
    const current=this.current, next=this.pending, t=this.turn;
    const opening=t?.kind==='open';
    const sides=opening?[1]:[-1,1];
    for(const side of sides){
      leaf(side,this.cover,this.cover,0,1,null,.033);
      leaf(side,this.cover,this.cover,0,0,[.14,.14,.115],.026);
      leaf(side,this.cover,this.cover,0,0,[.64,.60,.51],.018);
      leaf(side,this.cover,this.cover,0,0,[.83,.80,.72],.010);
    }
    const right=this.detail?current.detail:current.right;
    if(!t){leaf(-1,current.left);leaf(1,right);return;}
    if(opening){leaf(1,right);leaf(1,this.cover,current.left,t.q,1);leaf(1,this.cover,current.left,t.q);return;}
    const forward=t.kind==='next', side=forward?1:-1;
    leaf(-1,forward?current.left:next.left);leaf(1,forward?next.right:right);
    const front=forward?right:current.left, back=forward?next.left:next.right;
    leaf(side,front,back,t.q,1);leaf(side,front,back,t.q);
  }
  animate(end,done) {
    cancelAnimationFrame(this.frame);
    const start=this.turn.q, stamp=performance.now();
    const speed=this.turn.kind==='open' ? (end===0 ? 520 : 840) : 690;
    const duration=this.motion.matches?0:Math.max(140,speed*Math.abs(end-start));
    const tick=now=>{
      const t=duration?Math.min(1,(now-stamp)/duration):1;
      this.turn.q=start+(end-start)*(t*t*(3-2*t));this.draw();
      if(t<1){this.frame=requestAnimationFrame(tick);return;}
      this.frame=0;done();
    };
    this.frame=requestAnimationFrame(tick);
  }
}
