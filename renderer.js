import {multiply,perspective,lookAt,transform,identity} from './geometry.js';

const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uModel;
uniform mat4 uVP;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uVP*world;}`;
const fragment=`#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uEye;
uniform vec3 uHighlight;
uniform float uSelected;
uniform float uAlpha;
uniform float uClip;
uniform float uCut;
uniform float uEmissive;
out vec4 outColor;
void main(){
  if(uClip>0.5 && vWorld.y>uCut)discard;
  vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
  vec3 light=normalize(vec3(-0.35,0.8,0.6)),fill=normalize(vec3(0.7,0.15,-0.6)),view=normalize(uEye-vWorld);
  float ndl=max(dot(n,light),0.0),rim=pow(1.0-max(dot(n,view),0.0),3.0);
  float spec=pow(max(dot(n,normalize(light+view)),0.0),45.0);
  vec3 base=mix(vColor,uHighlight,uSelected*.55);
  vec3 c=base*(.23+ndl*.7+max(dot(n,fill),0.0)*.32);
  c+=vec3(.78,.86,.91)*spec*.65+vec3(.21,.3,.36)*rim*.38;
  c+=uHighlight*uSelected*.16+base*uEmissive;
  c=pow(c,vec3(.86));
  outColor=vec4(c,uAlpha);
}`;
const particleVertex=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;
layout(location=1)in vec4 aColor;
layout(location=2)in float aSize;
uniform mat4 uVP;
uniform float uPixelRatio;
out vec4 vColor;
void main(){vec4 p=uVP*vec4(aPosition,1.0);gl_Position=p;gl_PointSize=clamp(aSize*uPixelRatio*12.0/max(p.w,1.0),1.0,48.0);vColor=aColor;}`;
const particleFragment=`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main(){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;float a=pow(1.0-r,1.8);outColor=vec4(vColor.rgb,vColor.a*a);}`;

function program(gl,vs,fs){
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(msg);}return s;}
  const p=gl.createProgram(),a=shader(gl.VERTEX_SHADER,vs),b=shader(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
}

export class Renderer {
  constructor(canvas){
    this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('WebGL 2 unavailable');this.gl=gl;
    this.p=program(gl,vertex,fragment);this.particles=program(gl,particleVertex,particleFragment);this.loc={};for(const n of ['uModel','uVP','uEye','uHighlight','uSelected','uAlpha','uClip','uCut','uEmissive'])this.loc[n]=gl.getUniformLocation(this.p,n);
    this.pLoc={};for(const n of ['uVP','uPixelRatio'])this.pLoc[n]=gl.getUniformLocation(this.particles,n);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    this.particleVao=gl.createVertexArray();gl.bindVertexArray(this.particleVao);this.particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,8000*8*4,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,32,28);gl.bindVertexArray(null);
    this.vp=identity();this.eye=[0,3,15];this.width=1;this.height=1;this.lost=false;
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;document.getElementById('render-error').hidden=false;});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  upload(data){const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.vertices),gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data.indices),gl.STATIC_DRAW);for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);}gl.bindVertexArray(null);return{vao,vb,ib,count:data.indices.length};}
  begin(eye,target){
    const gl=this.gl;this.width=this.canvas.clientWidth;this.height=this.canvas.clientHeight;this.ratio=Math.min(window.devicePixelRatio||1,2);const w=Math.round(this.width*this.ratio),h=Math.round(this.height*this.ratio);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);gl.depthMask(true);
    this.eye=eye;this.vp=multiply(perspective(Math.PI/4,this.width/Math.max(1,this.height),.05,150),lookAt(eye,target));gl.useProgram(this.p);gl.uniformMatrix4fv(this.loc.uVP,false,this.vp);gl.uniform3fv(this.loc.uEye,eye);
  }
  draw(mesh,model,{alpha=1,selected=0,highlight=[.94,.65,.4],clip=false,cut=0,emissive=0}={}){
    const gl=this.gl;gl.useProgram(this.p);if(alpha<1){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}
    gl.uniformMatrix4fv(this.loc.uModel,false,model);gl.uniform1f(this.loc.uAlpha,alpha);gl.uniform1f(this.loc.uSelected,selected);gl.uniform3fv(this.loc.uHighlight,highlight);gl.uniform1f(this.loc.uClip,clip?1:0);gl.uniform1f(this.loc.uCut,cut);gl.uniform1f(this.loc.uEmissive,emissive);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0);
  }
  drawParticles(data,count){if(!count)return;const gl=this.gl;gl.useProgram(this.particles);gl.uniformMatrix4fv(this.pLoc.uVP,false,this.vp);gl.uniform1f(this.pLoc.uPixelRatio,this.ratio);gl.bindVertexArray(this.particleVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*8));gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,count);gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);}
  project(point){const p=transform(point,this.vp);return{x:(p[0]+1)*this.width/2,y:(1-p[1])*this.height/2,z:p[2],visible:p[3]>0&&Math.abs(p[0])<.96&&Math.abs(p[1])<.88};}
}

export class OrbitCamera {
  constructor(canvas,onChange=()=>{}){
    this.canvas=canvas;this.yaw=-.28;this.pitch=.27;this.distance=15;this.target=[.25,0,0];this.desired={target:[.25,0,0],distance:15,yaw:-.28,pitch:.27};this.auto=false;this.dragging=false;this.pointers=new Map();this.onChange=onChange;
    canvas.addEventListener('pointerdown',e=>{this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);this.dragging=true;this.desired=null;this.onChange();});
    canvas.addEventListener('pointermove',e=>{
      const prev=this.pointers.get(e.pointerId);if(!prev)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
      if(this.pointers.size===2){const other=[...this.pointers].find(([id])=>id!==e.pointerId)?.[1];if(other){const before=Math.hypot(prev.x-other.x,prev.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);this.distance=Math.max(.9,Math.min(40,this.distance*before/Math.max(1,after)));}}
      else if(e.shiftKey||e.buttons===2){this.target[0]-=dx*this.distance*.0015*Math.cos(this.yaw);this.target[2]+=dx*this.distance*.0015*Math.sin(this.yaw);this.target[1]+=dy*this.distance*.0015;}
      else{this.yaw-=dx*.007;this.pitch=Math.max(-1.35,Math.min(1.35,this.pitch+dy*.006));}
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    });
    const end=e=>{this.pointers.delete(e.pointerId);this.dragging=this.pointers.size>0;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.desired=null;this.distance=Math.max(.9,Math.min(40,this.distance*Math.exp(e.deltaY*.001)));this.onChange();},{passive:false});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('keydown',e=>{let handled=true;this.desired=null;if(e.key==='ArrowLeft')this.yaw+=.1;else if(e.key==='ArrowRight')this.yaw-=.1;else if(e.key==='ArrowUp')this.pitch=Math.min(1.35,this.pitch+.1);else if(e.key==='ArrowDown')this.pitch=Math.max(-1.35,this.pitch-.1);else if(e.key==='+'||e.key==='=')this.distance=Math.max(.9,this.distance*.9);else if(e.key==='-')this.distance=Math.min(40,this.distance*1.1);else handled=false;if(handled){e.preventDefault();this.onChange();}});
  }
  focus(target,distance,{yaw=-.15,pitch=.25}={}){this.desired={target:[...target],distance,yaw,pitch};}
  tick(dt){if(this.desired){const f=1-Math.exp(-dt*5);this.target=this.target.map((v,i)=>v+(this.desired.target[i]-v)*f);this.distance+=(this.desired.distance-this.distance)*f;this.yaw+=(this.desired.yaw-this.yaw)*f;this.pitch+=(this.desired.pitch-this.pitch)*f;}if(this.auto&&!this.dragging){this.desired=null;this.yaw+=dt*.12;}return [this.target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,this.target[1]+Math.sin(this.pitch)*this.distance,this.target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance];}
}
