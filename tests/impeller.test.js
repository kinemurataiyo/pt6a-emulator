import test from 'node:test';
import assert from 'node:assert/strict';
import {buildImpellerParts,buildImpeller} from '../impeller.js';
import {cross,sub,dot,norm} from '../geometry.js';

const points=mesh=>Array.from({length:mesh.vertices.length/9},(_,i)=>mesh.vertices.slice(i*9,i*9+3));
const radius=p=>Math.hypot(p[1],p[2]);

test('open impeller has deep exposed vane passages above its thin backplate',()=>{
  const {backplate,vanes,hub}=buildImpellerParts();
  const platePoints=points(backplate),vanePoints=points(vanes);
  for(const r of [.5,.65,.8,.95]){
    const plate=platePoints.filter(p=>Math.abs(radius(p)-r)<.02);
    const blade=vanePoints.filter(p=>Math.abs(radius(p)-r)<.02);
    assert.ok(plate.length&&blade.length,'both backplate and vanes span the radial passage');
    const plateFront=Math.max(...plate.map(p=>p[0]));
    const bladeFront=Math.max(...blade.map(p=>p[0]));
    assert.ok(bladeFront-plateFront>.10,`vanes at radius ${r} must stand above the backplate`);
    assert.ok(Math.max(...plate.map(p=>p[0]))-Math.min(...plate.map(p=>p[0]))<.08,
      'the backplate cannot become a solid cone that buries the working vanes');
  }
  assert.ok(Math.max(...points(hub).map(radius))<.31,'the central hub leaves the passages open');
  assert.ok(Math.max(...vanePoints.map(p=>p[0]))>.41,'a raised axial inducer is present');
  assert.ok(Math.max(...vanePoints.map(radius))>.95,'vanes reach the radial discharge');

  // Near the discharge lip, each tall blade occupies a narrow angular region;
  // broad empty gaps between all 24 blades make distinct open channels.
  const lip=vanePoints.filter(p=>radius(p)>.95&&p[0]>-.055);
  const occupied=new Set(lip.map(p=>Math.floor((Math.atan2(p[2],p[1])+Math.PI)/(2*Math.PI)*720)));
  assert.ok(occupied.size<180,'vanes do not bridge into a smooth front shroud');
});

test('impeller inducer draws air axially in and swept vanes drive it radially out for positive gas rotation',()=>{
  const {vanes}=buildImpellerParts();
  let inletFaces=0,outletFaces=0;
  for(let i=0;i<vanes.indices.length;i+=3){
    const vertices=vanes.indices.slice(i,i+3).map(index=>vanes.vertices.slice(index*9,index*9+3));
    const p=vertices[0].map((_,axis)=>vertices.reduce((sum,v)=>sum+v[axis],0)/3);
    const n=norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])));
    const r=radius(p),v=[0,-p[2],p[1]],normalMotion=dot(v,n);
    // Sample the interior of the broad working surfaces, clear of the sealed
    // root/tip and leading/discharge edge caps.
    if(r>.325&&r<.36&&p[0]>.23&&p[0]<.31){
      assert.ok(normalMotion*n[0]<0,'inducer incidence pulls inlet air toward -X');
      inletFaces++;
    }
    if(r>.90&&r<.94&&p[0]>-.12&&p[0]<-.065){
      const radialNormal=(n[1]*p[1]+n[2]*p[2])/r;
      assert.ok(normalMotion*radialNormal>0,'backswept discharge vanes accelerate air outward');
      outletFaces++;
    }
  }
  assert.ok(inletFaces>100&&outletFaces>100,'test covers working faces around the complete rotor');
});

test('impeller surfaces and closed vane edges have finite unit normals with consistent winding',()=>{
  const mesh=buildImpeller();
  assert.ok(mesh.vertices.length/9<65536,'the rotor stays within the interactive mesh budget');
  assert.ok(mesh.vertices.every(Number.isFinite));
  for(let i=0;i<mesh.vertices.length;i+=9){
    const n=mesh.vertices.slice(i+3,i+6);
    assert.ok(Math.abs(Math.hypot(...n)-1)<1e-10,'every rendered surface has a unit normal');
  }
  for(let i=0;i<mesh.indices.length;i+=3){
    const v=mesh.indices.slice(i,i+3).map(index=>mesh.vertices.slice(index*9,index*9+6));
    const face=cross(sub(v[1].slice(0,3),v[0].slice(0,3)),sub(v[2].slice(0,3),v[0].slice(0,3)));
    const average=v[0].slice(3).map((_,axis)=>v.reduce((sum,p)=>sum+p[axis+3],0)/3);
    assert.ok(Math.hypot(...face)>1e-12,'closed edges contain no degenerate triangles');
    assert.ok(dot(face,average)>0,'lighting normals agree with triangle winding');
  }
});
