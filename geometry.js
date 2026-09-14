export const TAU=Math.PI*2;
export const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
export const rotateX=(a,t)=>[a[0],a[1]*Math.cos(t)-a[2]*Math.sin(t),a[1]*Math.sin(t)+a[2]*Math.cos(t)];
export const rotateY=(a,t)=>[a[0]*Math.cos(t)+a[2]*Math.sin(t),a[1],-a[0]*Math.sin(t)+a[2]*Math.cos(t)];
export const rotateZ=(a,t)=>[a[0]*Math.cos(t)-a[1]*Math.sin(t),a[0]*Math.sin(t)+a[1]*Math.cos(t),a[2]];

export class MeshData {
  constructor(){this.vertices=[];this.indices=[];}
  v(p,n,c){this.vertices.push(...p,...n,...c);return this.vertices.length/9-1;}
  tri(a,b,c){this.indices.push(a,b,c);}
  append(mesh,{x=0,y=0,z=0,rx=0,ry=0,rz=0}={}){
    const off=this.vertices.length/9;
    for(let i=0;i<mesh.vertices.length;i+=9){
      let p=mesh.vertices.slice(i,i+3),n=mesh.vertices.slice(i+3,i+6);
      if(rx){p=rotateX(p,rx);n=rotateX(n,rx);}if(ry){p=rotateY(p,ry);n=rotateY(n,ry);}if(rz){p=rotateZ(p,rz);n=rotateZ(n,rz);}
      this.v([p[0]+x,p[1]+y,p[2]+z],n,mesh.vertices.slice(i+6,i+9));
    }
    for(const i of mesh.indices)this.indices.push(i+off);
    return this;
  }
}

export function lathe(profile,color='#b4bec3',segments=64,start=0,arc=TAU){
  const m=new MeshData(),c=Array.isArray(color)?color:rgb(color);
  // Separate profile edges preserve crisp flange and end-cap normals.
  for(let j=0;j<profile.length-1;j++){
    const [x0,r0]=profile[j],[x1,r1]=profile[j+1],dx=x1-x0,dr=r1-r0;
    const o=m.vertices.length/9;
    for(let k=0;k<=segments;k++){
      const a=start+arc*k/segments,ca=Math.cos(a),sa=Math.sin(a),n=norm([-dr,dx*ca,dx*sa]);
      m.v([x0,r0*ca,r0*sa],n,c);m.v([x1,r1*ca,r1*sa],n,c);
    }
    for(let k=0;k<segments;k++){const a=o+2*k;m.tri(a,a+2,a+1);m.tri(a+2,a+3,a+1);}
  }
  return m;
}
export const cylinder=(r,length,color,segments=48)=>lathe([[-length/2,0],[-length/2,r],[length/2,r],[length/2,0]],color,segments);
export const ring=(r,thick,width,color,segments=64)=>lathe([[-width/2,r-thick],[-width/2,r],[width/2,r],[width/2,r-thick],[-width/2,r-thick]],color,segments);

export function box(w,h,d,color='#8d999f'){
  const m=new MeshData(),c=rgb(color),x=w/2,y=h/2,z=d/2;
  const faces=[[[x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z]], [[-x,-y,z],[-x,y,z],[-x,y,-z],[-x,-y,-z]], [[-x,y,-z],[-x,y,z],[x,y,z],[x,y,-z]], [[-x,-y,z],[-x,-y,-z],[x,-y,-z],[x,-y,z]], [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]], [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]]];
  for(const f of faces){const n=norm(cross(sub(f[1],f[0]),sub(f[2],f[0]))),o=m.vertices.length/9;for(const p of f)m.v(p,n,c);m.tri(o,o+1,o+2);m.tri(o,o+2,o+3);}
  return m;
}

// A twisted, cambered closed airfoil. Values are visual design parameters.
export function blade({root=.3,tip=.8,chord=.22,twist=.7,sweep=.12,color='#aab9c0',spans=7,sides=14,prop=false}={}){
  const m=new MeshData(),c=rgb(color),surface=[];
  for(let j=0;j<=spans;j++){
    const t=j/spans,r=root+(tip-root)*t,angle=twist*(1-.5*t);
    const width=chord*(prop?(.45+.7*Math.sin(Math.PI*t*.85)):(1-.2*t));
    const points=[];
    for(let k=0;k<sides;k++){
      const a=TAU*k/sides,u=Math.cos(a)*.5,v=Math.sin(a)*(.045+.035*Math.sin(Math.PI*t));
      let xx=u*width,zz=v*width+.065*width*(1-4*u*u);
      const p=[xx*Math.cos(angle)+zz*Math.sin(angle)+sweep*t*t,r,-xx*Math.sin(angle)+zz*Math.cos(angle)];points.push(p);
    }surface.push(points);
  }
  // Triangulate with smooth normals accumulated from adjacent surface patches.
  const ns=surface.map(row=>row.map(()=>[0,0,0]));
  const triples=[];
  for(let j=0;j<spans;j++)for(let k=0;k<sides;k++){
    const k1=(k+1)%sides;
    for(const tri of [[[j,k],[j+1,k],[j+1,k1]],[[j,k],[j+1,k1],[j,k1]]]){
      triples.push(tri);const [a,b,c0]=tri.map(([s,q])=>surface[s][q]),n=norm(cross(sub(b,a),sub(c0,a)));
      for(const [s,q]of tri)ns[s][q]=add(ns[s][q],n);
    }
  }
  for(let j=0;j<=spans;j++)for(let k=0;k<sides;k++)m.v(surface[j][k],norm(ns[j][k]),prop&&j/spans>.92?rgb('#f1eee1'):c);
  for(const tri of triples)m.tri(...tri.map(([s,q])=>s*sides+q));
  for(const j of [0,spans]){const center=m.v([sweep*(j/spans)**2,root+(tip-root)*j/spans,0],[0,j?1:-1,0],c);for(let k=0;k<sides;k++)m.tri(center,j*sides+k,j*sides+(k+1)%sides);}
  return m;
}

export function bladeRing(count,options){
  const m=new MeshData(),b=blade(options);
  for(let i=0;i<count;i++)m.append(b,{rx:i*TAU/count});
  return m;
}

export function torus(major,minor,color='#839096',radial=64,tubular=8){
  const m=new MeshData(),c=rgb(color);
  for(let j=0;j<=radial;j++)for(let k=0;k<=tubular;k++){
    const a=j/radial*TAU,b=k/tubular*TAU;
    m.v([minor*Math.sin(b),(major+minor*Math.cos(b))*Math.cos(a),(major+minor*Math.cos(b))*Math.sin(a)],[Math.sin(b),Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a)],c);
  }
  for(let j=0;j<radial;j++)for(let k=0;k<tubular;k++){const a=j*(tubular+1)+k,b=a+tubular+1;m.tri(a,b,a+1);m.tri(a+1,b,b+1);}
  return m;
}

export function tube(points,radius,color='#8b9294',sides=9){
  const m=new MeshData(),c=rgb(color);
  for(let i=0;i<points.length;i++){
    const tangent=norm(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));
    const helper=Math.abs(tangent[1])>.9?[0,0,1]:[0,1,0];const u=norm(cross(tangent,helper)),v=cross(tangent,u);
    for(let k=0;k<=sides;k++){const a=k/sides*TAU,n=add(u.map(q=>q*Math.cos(a)),v.map(q=>q*Math.sin(a)));m.v(add(points[i],n.map(q=>q*radius)),n,c);}
  }
  for(let i=0;i<points.length-1;i++)for(let k=0;k<sides;k++){const a=i*(sides+1)+k,b=a+sides+1;m.tri(a,a+1,b);m.tri(b,a+1,b+1);}
  return m;
}

export function gear(radius,teeth,width,color='#b1b6b4',hole=.06){
  const m=new MeshData();m.append(ring(radius*.9,radius*.9-hole,width,color,64));
  const tooth=box(width,radius*.16,TAU*radius/teeth*.42,color);
  for(let k=0;k<teeth;k++){const a=TAU*k/teeth;m.append(tooth,{rx:a,y:Math.cos(a)*radius*.94,z:Math.sin(a)*radius*.94});}
  m.append(ring(hole+.024,.025,width+.02,'#56666f',32));return m;
}

export function boltRing(radius,count,width=.07){
  const m=new MeshData(),b=cylinder(.038,width,'#c4c8c5',6);
  for(let k=0;k<count;k++){const a=TAU*k/count;m.append(b,{y:Math.cos(a)*radius,z:Math.sin(a)*radius});}return m;
}

export const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function matrix({x=0,y=0,z=0,rx=0,ry=0,rz=0}={}){
  const xx=rotateZ(rotateY(rotateX([1,0,0],rx),ry),rz),yy=rotateZ(rotateY(rotateX([0,1,0],rx),ry),rz),zz=rotateZ(rotateY(rotateX([0,0,1],rx),ry),rz);
  return new Float32Array([...xx,0,...yy,0,...zz,0,x,y,z,1]);
}
export function multiply(a,b){const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
export function lookAt(eye,center,up=[0,1,0]){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function transform(p,m){const [x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w,w];}
