import test from 'node:test';
import assert from 'node:assert/strict';
import {blade,cylinder,transform,cross,dot,sub,norm,TAU} from '../geometry.js';
import {EngineScene} from '../scene.js';

const settings={selected:null,isolate:false,view:'cutaway',shafts:false,
  airflow:false,combustionMode:'flame',speed:1,explode:0};
const running={ng:85,np:1700,pitch:25,flame:0};
const rowSides=14,rowSpans=7;
const bladeVertexCount=blade({sides:rowSides,spans:rowSpans}).vertices.length/9;
// The assembled rotor starts with its hub; the stator starts with its vane row.
const hubVertexCount=cylinder(.29,.22).vertices.length/9;

function fixture(){
  const draws=[];
  const renderer={eye:[0,0,10],upload:mesh=>mesh,
    draw:(mesh,model)=>draws.push({mesh,model}),drawParticles:()=>{}};
  const scene=new EngineScene(renderer);
  const draw=()=>{draws.length=0;scene.draw(running,settings);};
  const model=part=>{
    const rendered=draws.find(d=>d.mesh===part.mesh);
    assert.ok(rendered,`${part.id} is rendered`);
    return rendered.model;
  };
  return {scene,draw,model};
}

function section(part,model,bladeIndex,station=4){
  const offset=part.bladeRow==='rotor'?hubVertexCount:0;
  const start=offset+bladeIndex*bladeVertexCount+station*rowSides;
  const point=side=>transform(part.mesh.vertices.slice((start+side)*9,(start+side)*9+3),model).slice(0,3);
  const a=point(0),b=point(7),center=a.map((value,i)=>(value+b[i])/2);
  const axis=transform([0,0,0],model).slice(0,3);
  const radius=sub(center,axis),radial=norm([0,radius[1],radius[2]]);
  const tangent=cross([1,0,0],radial),normal=norm(cross(radial,sub(a,b)));
  // Opposite airfoil samples cancel thickness and chordwise displacement.
  const c=point(3),d=point(10),camber=sub(c.map((value,i)=>(value+d[i])/2),center);
  return {radius,tangent,normal,camber};
}

test('all axial rotor blades send air into the core with gas-shaft rotation',()=>{
  const {scene,draw,model}=fixture();
  scene.gasAngle=.31;
  const before=scene.gasAngle;
  scene.animate(.015,running,settings);
  const angularVelocity=(scene.gasAngle-before)/.015;
  assert.ok(angularVelocity>0,'gas generator turns counterclockwise viewed from the rear (+X)');
  draw();
  for(let stage=0;stage<3;stage++){
    const id=`axial${stage+1}`;
    const rotor=scene.parts.find(p=>p.id===id&&p.bladeRow==='rotor');
    assert.ok(rotor,`${id} has an identifiable rotor row`);
    for(let bladeIndex=0;bladeIndex<24+stage*5;bladeIndex++){
      for(const station of [1,4,6]){
        const q=section(rotor,model(rotor),bladeIndex,station);
        const velocity=cross([angularVelocity,0,0],q.radius);
        // Pitched-plate projection verifies visible handedness, not a
        // calibrated aerodynamic force or compressor performance prediction.
        const normalMotion=q.normal.map(value=>value*dot(velocity,q.normal));
        assert.ok(normalMotion[0]<0,`${id} blade ${bladeIndex}: motion pushes air forward (-X) into the core`);
        assert.ok(dot(normalMotion,q.tangent)>0,`${id}: rotor adds swirl with shaft rotation`);
        assert.ok(dot(q.camber,q.tangent)<0,`${id}: convex camber faces opposite the direction of travel`);
      }
    }
  }
  // Compare with the actual rendered particle path, not a duplicate path table.
  scene.drawFlows(running,{...settings,airflow:true});
  const previous=scene.particles.slice(0,scene.particleCount*8);
  scene.animate(.015,running,settings);
  scene.drawFlows(running,{...settings,airflow:true});
  let compared=0;
  for(let i=0;i<Math.min(previous.length,scene.particleCount*8);i+=8){
    if(previous[i]>2.85&&previous[i]<4.3){
      assert.ok(scene.particles[i]<previous[i],'airflow through the axial rows travels in the same -X direction');
      compared++;
    }
  }
  assert.ok(compared>15,'several rendered particles cover the axial compressor');
});

test('stationary compressor vanes reduce the rotor swirl and do not animate',()=>{
  const {scene,draw,model}=fixture();
  draw();
  const stators=scene.parts.filter(p=>p.bladeRow==='stator');
  assert.equal(stators.length,3);
  const initial=stators.map(part=>Array.from(model(part)));
  scene.animate(.015,running,settings);
  draw();
  for(let stage=0;stage<3;stage++){
    const id=`axial${stage+1}`;
    const rotor=scene.parts.find(p=>p.id===id&&p.bladeRow==='rotor');
    const stator=stators.find(p=>p.id===id);
    assert.deepEqual(Array.from(model(stator)),initial[stators.indexOf(stator)],`${id}: stator stays fixed`);
    // Match the flow components produced by a rotor section to each stator's
    // local azimuth. Projecting onto the vane chord should reduce positive
    // swirl while retaining flow toward the next stage.
    const r=section(rotor,model(rotor),0);
    const motion=r.normal.map(value=>value*dot(r.tangent,r.normal));
    const swirl=dot(motion,r.tangent);
    for(let vane=0;vane<27+stage*5;vane++){
      const q=section(stator,model(stator),vane);
      const incoming=[motion[0],q.tangent[1]*swirl,q.tangent[2]*swirl];
      const outgoing=incoming.map((value,i)=>value-dot(incoming,q.normal)*q.normal[i]);
      assert.ok(outgoing[0]<0,`${id}: stator retains forward core flow`);
      const exitSwirl=dot(outgoing,q.tangent);
      assert.ok(exitSwirl>=0&&exitSwirl<swirl,`${id}: stator reduces the rotor's positive swirl`);
    }
  }
});

test('the gas-generator assembly stays synchronous without slow-frame reverse aliasing',()=>{
  const {scene,draw,model}=fixture();
  const gas=scene.parts.filter(p=>p.spin==='gas');
  for(const id of ['axial1','axial2','axial3','impeller','compressorTurbine','gasShaft']){
    assert.ok(gas.some(p=>p.id===id),`${id} belongs to the gas-generator shaft`);
  }
  scene.animate(1/60,{...running,ng:100},settings);
  assert.ok(Math.abs(scene.gasAngle-1.8/60)<1e-12,'normal 60 Hz study speed is unchanged');
  const before=scene.gasAngle;
  scene.animate(.05,{...running,ng:100},{...settings,speed:2});
  const advance=scene.gasAngle-before;
  // The 40-blade compressor turbine has the smallest repeating gas-shaft
  // blade spacing. Staying below half a spacing avoids apparent reversal.
  assert.ok(advance>0&&advance<TAU/40/2,'a slow frame at 2x retains forward apparent motion');
  assert.ok(scene.freeAngle<0,'the corrected power turbine and propeller keep their opposite rotation');
  draw();
  for(const part of gas){
    const m=model(part),origin=transform([0,0,0],m).slice(0,3);
    const radial=sub(transform([0,1,0],m).slice(0,3),origin);
    assert.ok(Math.abs(radial[1]-Math.cos(scene.gasAngle))<1e-6,`${part.id}: same gas-shaft phase (Y)`);
    assert.ok(Math.abs(radial[2]-Math.sin(scene.gasAngle))<1e-6,`${part.id}: same gas-shaft phase (Z)`);
  }
  const stopped=scene.gasAngle;
  scene.animate(.05,{...running,ng:0,np:1700},settings);
  assert.equal(scene.gasAngle,stopped,'output rotation cannot drive the stopped gas generator');
});
