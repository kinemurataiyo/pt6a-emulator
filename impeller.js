import {MeshData,TAU,rgb,lathe,norm,cross,sub} from './geometry.js?v=compressor-1';

// Illustrative open centrifugal rotor, with its inlet toward +X. The gas
// generator turns +Rx, so the inducer leans into that motion and the radial
// passages sweep back against it. Dimensions are visual, not manufacturing data.
const EYE=.31,RIM=.96,VANE_COUNT=24,SPAN_STEPS=24,HEIGHT_STEPS=8;
const plateX=t=>-.16+.32*(1-t)**1.6;
const vaneHeight=t=>.13+.13*(1-t)**1.7;
const smooth=t=>t*t*(3-2*t);

function surface(t,h){
  const r=EYE+(RIM-EYE)*t;
  // Axial inflow (-X) follows the inducer down/back relative to rotation,
  // then the passage opens radially. The height variation makes sheet vanes,
  // not a decorative ridge lying on the backplate.
  const a=-.34*smooth(t)+.43*(1-t)**2*h;
  return [plateX(t)+vaneHeight(t)*h,r*Math.cos(a),r*Math.sin(a)];
}

function sheetNormal(t,h){
  const e=.0001;
  const along=sub(surface(Math.min(1,t+e),h),surface(Math.max(0,t-e),h));
  const up=sub(surface(t,Math.min(1,h+e)),surface(t,Math.max(0,h-e)));
  return norm(cross(along,up));
}

function patch(mesh,points,faces,color){
  const normals=points.map(()=>[0,0,0]);
  for(const face of faces){
    const n=cross(sub(points[face[1]],points[face[0]]),sub(points[face[2]],points[face[0]]));
    for(const i of face)for(let axis=0;axis<3;axis++)normals[i][axis]+=n[axis];
  }
  const offset=mesh.vertices.length/9;
  for(let i=0;i<points.length;i++)mesh.v(points[i],norm(normals[i]),color);
  for(const face of faces)mesh.tri(...face.map(i=>i+offset));
}

function impellerVane(){
  const mesh=new MeshData(),skins=[],rows=HEIGHT_STEPS+1;
  for(const side of [1,-1]){
    const points=[],faces=[];
    for(let i=0;i<=SPAN_STEPS;i++)for(let j=0;j<=HEIGHT_STEPS;j++){
      const t=i/SPAN_STEPS,h=j/HEIGHT_STEPS,p=surface(t,h),n=sheetNormal(t,h);
      const halfThickness=.0065-.002*t;
      points.push(p.map((v,axis)=>v+side*halfThickness*n[axis]));
    }
    for(let i=0;i<SPAN_STEPS;i++)for(let j=0;j<HEIGHT_STEPS;j++){
      const a=i*rows+j,b=a+rows;
      for(const f of [[a,b,b+1],[a,b+1,a+1]])faces.push(side>0?f:f.toReversed());
    }
    patch(mesh,points,faces,rgb(side>0?'#c2c9c8':'#a5b2b5'));
    skins.push(points);
  }
  // Seal the leading edge, discharge edge and blade tip with proper hard
  // edge normals. The root is also closed and intersects the backplate slightly.
  const cap=(indices,reverse=false)=>{
    const points=[],faces=[];
    for(const i of indices)points.push(skins[0][i],skins[1][i]);
    for(let i=0;i<indices.length-1;i++){
      const a=2*i;
      for(const f of [[a,a+2,a+3],[a,a+3,a+1]])faces.push(reverse?f.toReversed():f);
    }
    patch(mesh,points,faces,rgb('#d1d4cf'));
  };
  cap(Array.from({length:rows},(_,j)=>j));
  cap(Array.from({length:rows},(_,j)=>SPAN_STEPS*rows+j),true);
  cap(Array.from({length:SPAN_STEPS+1},(_,i)=>i*rows),true);
  cap(Array.from({length:SPAN_STEPS+1},(_,i)=>i*rows+HEIGHT_STEPS));
  return mesh;
}

export function buildImpellerParts(){
  const profile=[[-.02,.105],[-.02,EYE]];
  // A thin, dished backplate exposes the full passage depth. There is no
  // smooth front cover bridging across the working blade tips.
  profile[1]=[plateX(0)-.035,EYE];
  for(let i=1;i<=SPAN_STEPS;i++){
    const t=i/SPAN_STEPS;
    profile.push([plateX(t)-.035,EYE+(RIM-EYE)*t]);
  }
  for(let i=SPAN_STEPS;i>=0;i--){
    const t=i/SPAN_STEPS;
    profile.push([plateX(t),EYE+(RIM-EYE)*t]);
  }
  profile.push([.16,.105],[-.02,.105]);
  const backplate=lathe(profile,'#8f9da1',96);
  const hub=lathe([[-.02,.105],[-.02,.255],[.14,.299],
    [.33,.299],[.355,.28],[.34,.251],[.25,.236],[.225,.105],[-.02,.105]],'#abb6b8',96);
  const vanes=new MeshData(),vane=impellerVane();
  for(let i=0;i<VANE_COUNT;i++)vanes.append(vane,{rx:i*TAU/VANE_COUNT});
  return {backplate,vanes,hub};
}

export function buildImpeller(){
  const mesh=new MeshData();
  for(const part of Object.values(buildImpellerParts()))mesh.append(part);
  return mesh;
}
