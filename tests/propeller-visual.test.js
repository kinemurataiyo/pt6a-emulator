import test from 'node:test';
import assert from 'node:assert/strict';
import {blade,transform,cross,dot,sub} from '../geometry.js';
import {EngineScene,propellerFlow} from '../scene.js';
import {EngineSimulation,PROP_MODEL} from '../simulation.js';

function near(actual,expected,tolerance,label){
  assert.ok(Math.abs(actual-expected)<=tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

test('propeller twist is referenced to the disc plane at 75% blade radius',()=>{
  // This mesh has an exact station at radius .75, between its .25 root and 1 tip.
  // Chord endpoints share the same sweep, so their difference measures pitch.
  const mesh=blade({root:.25,tip:1,spans:3,sides:18,twist:.38,sweep:.2,prop:true});
  const chordAt=station=>{
    const a=mesh.vertices.slice(station*18*9,station*18*9+3);
    const b=mesh.vertices.slice((station*18+9)*9,(station*18+9)*9+3);
    return a.map((value,index)=>value-b[index]);
  };
  const reference=chordAt(2);
  near(reference[0],0,1e-12,'reference chord has no axial component at zero pitch');
  near(reference[1],0,1e-12,'chord is perpendicular to its radial pitch axis');
  assert.ok(Math.abs(reference[2])>.1,'reference chord lies across the disc');
  assert.ok(chordAt(0)[0]<0,'root twist is coarser than the reference station');
  assert.ok(chordAt(3)[0]>0,'tip twist is finer than the reference station');
});

test('propeller camber faces the nose while turbine airfoil camber stays unchanged',()=>{
  const options={root:.25,tip:1,chord:.3,spans:3,sides:20,sweep:0};
  const prop=blade({...options,twist:.38,prop:true});
  const turbine=blade({...options,twist:0});
  const point=(mesh,side)=>mesh.vertices.slice((2*20+side)*9,(2*20+side)*9+3);
  // At the exact 75% radius, pair the two mid-chord thickness samples.
  // Their average removes thickness and exposes the direction of camber.
  const camber=mesh=>{
    const a=point(mesh,5),b=point(mesh,15);
    return a.map((value,index)=>(value+b[index])/2);
  };
  assert.ok(camber(prop)[0]<0,'the tractor propeller convex face points forward (-X)');
  for(const side of [0,10])near(point(prop,side)[0],0,1e-12,'camber leaves reference chord endpoints in the disc');
  const turbineWidth=options.chord*(1-.2*(2/3));
  near(camber(turbine)[2],.065*turbineWidth,1e-12,'non-propeller airfoil keeps its original positive camber');
});

test('the scene applies actual pitch around each of the four rotating radial axes',()=>{
  const draws=[];
  const renderer={eye:[0,0,10],upload:mesh=>mesh,
    draw:(mesh,model)=>draws.push({mesh,model}),drawParticles:()=>{}};
  const scene=new EngineScene(renderer);
  const blades=scene.parts.filter(part=>part.propBlade!==undefined);
  assert.equal(blades.length,4);
  scene.propAngle=.37;
  const settings={selected:'propeller',isolate:true,view:'solid',shafts:false,
    airflow:false,combustionMode:'flame'};
  for(const pitch of [-18,0,15,45,84]){
    draws.length=0;
    scene.draw({pitch,np:1500,ng:0,flame:0},settings);
    for(const part of blades){
      const {model}=draws.find(draw=>draw.mesh===part.mesh);
      const center=transform([0,0,0],model);
      // The preceding geometry test establishes this reference chord direction.
      const endpoint=transform([0,0,-1],model);
      const chord=endpoint.slice(0,3).map((value,index)=>value-center[index]);
      const radialEnd=transform([0,1,0],model);
      const radial=radialEnd.slice(0,3).map((value,index)=>value-center[index]);
      const azimuth=scene.propAngle+part.propBlade*Math.PI/2;
      near(radial[0],0,1e-6,'pitching does not tilt the blade radial axis');
      near(radial[1],Math.cos(azimuth),1e-6,'radial Y orientation');
      near(radial[2],Math.sin(azimuth),1e-6,'radial Z orientation');
      near(chord.reduce((sum,value,index)=>sum+value*radial[index],0),0,1e-6,
        'chord stays perpendicular to the radial axis');
      const actual=Math.atan2(-chord[0],Math.hypot(chord[1],chord[2]))*180/Math.PI;
      near(actual,pitch,1e-5,`rendered angle of blade ${part.propBlade}`);
    }
  }
});

test('output shafts turn clockwise from the rear through both reduction stages in every propeller mode',()=>{
  const renderer={upload:mesh=>mesh};
  const scene=new EngineScene(renderer);
  for(const propMode of ['govern','beta','reverse','feather']){
    scene.gasAngle=scene.freeAngle=scene.carrierAngle=scene.propAngle=0;
    scene.animate(.1,{ng:100,np:1700,propMode},{speed:1,explode:0});
    // The engine rear is +X. Clockwise when looking forward is negative Rx.
    assert.ok(scene.freeAngle<0,`${propMode}: power turbine turns clockwise from the rear`);
    assert.ok(scene.carrierAngle<0,`${propMode}: first carrier keeps the input direction`);
    assert.ok(scene.propAngle<0,`${propMode}: pitch selection must not reverse shaft rotation`);
    assert.ok(scene.gasAngle>0,`${propMode}: compressor rotates opposite to the free turbine`);
    near(scene.freeAngle/scene.carrierAngle,5.78,1e-10,'first reduction ratio');
    near(scene.freeAngle/scene.propAngle,17.58,1e-10,'overall reduction ratio');
  }
  const stoppedAngle=scene.propAngle;
  scene.animate(.1,{ng:0,np:0,propMode:'feather'},{speed:1,explode:0});
  near(scene.propAngle,stoppedAngle,0,'a stopped output shaft does not animate');
});

test('rendered blade incidence agrees with aft slipstream at full fine and forward slipstream in reverse',()=>{
  const draws=[];
  const renderer={eye:[0,0,10],upload:mesh=>mesh,
    draw:(mesh,model)=>draws.push({mesh,model}),drawParticles:()=>{}};
  const scene=new EngineScene(renderer);
  const blades=scene.parts.filter(part=>part.propBlade!==undefined);
  const settings={selected:'propeller',isolate:true,view:'solid',shafts:false,
    airflow:false,combustionMode:'flame',speed:1,explode:0};
  const fullFine=new EngineSimulation();
  fullFine.governor=PROP_MODEL.maxRpm;
  for(let i=0;i<1800;i++)fullFine.tick(.05);
  near(fullFine.np,1700,5,'full-fine selection reaches governed speed');
  assert.ok(fullFine.pitch>=PROP_MODEL.fine&&fullFine.pitch<65);
  const cases=[
    {label:'constant-speed full fine',sim:fullFine,direction:1},
    {label:'fine-pitch stop',sim:{ng:90,np:1700,pitch:PROP_MODEL.fine,flame:0,propMode:'govern'},direction:1},
    {label:'reverse',sim:{ng:90,np:1600,pitch:PROP_MODEL.reverse,flame:0,propMode:'reverse'},direction:-1}
  ];
  for(const {label,sim,direction} of cases){
    // Take angular velocity from the real animator rather than assuming its sign.
    scene.propAngle=.37;
    const before=scene.propAngle;
    scene.animate(.05,sim,settings);
    const angularVelocity=(scene.propAngle-before)/.05;
    draws.length=0;
    scene.draw(sim,settings);
    assert.equal(Math.sign(propellerFlow(sim)),direction,`${label}: indicated slipstream direction`);
    for(const part of blades){
      const {mesh,model}=draws.find(draw=>draw.mesh===part.mesh);
      const center=transform([0,0,0],model).slice(0,3);
      const radial=sub(transform([0,1,0],model).slice(0,3),center);
      // Use the actual mesh chord nearest 75% radius (station 13 of 18).
      const point=side=>transform(mesh.vertices.slice((13*18+side)*9,(13*18+side)*9+3),model).slice(0,3);
      const a=point(0),b=point(9),chord=sub(a,b);
      const section=sub(a.map((value,index)=>(value+b[index])/2),center);
      const velocity=cross([angularVelocity,0,0],section);
      const normal=cross(radial,chord);
      // Project blade motion onto the section normal. Its axial sign describes
      // which way a pitched plate pushes air; this is not a calibrated force.
      // Reversing the arbitrary chord/normal orientation leaves this unchanged.
      const axialMotion=dot(velocity,normal)*normal[0];
      assert.equal(Math.sign(axialMotion),direction,
        `${label}: blade ${part.propBlade} must push air ${direction>0?'aft (+X)':'forward (-X)'}`);
    }
  }
});

test('slipstream follows actual blade angle while mode selection is in transition',()=>{
  const forward=propellerFlow({pitch:27,np:1500,propMode:'govern'});
  assert.ok(forward>0);
  assert.equal(propellerFlow({pitch:27,np:1500,propMode:'reverse'}),forward,
    'selecting reverse cannot immediately reverse a forward-pitched propeller');
  assert.equal(propellerFlow({pitch:27,np:1500,propMode:'feather'}),forward,
    'selecting feather cannot hide flow before the blades move');
  assert.ok(propellerFlow({pitch:-18,np:1500,propMode:'govern'})<0,
    'returning from reverse retains reverse flow until pitch passes through zero');
  assert.equal(propellerFlow({pitch:0,np:1500}),0);
});

test('feather and stopped blades suppress the thrust arrow and slipstream',()=>{
  assert.equal(propellerFlow({pitch:84,np:1500}),0);
  assert.equal(propellerFlow({pitch:27,np:0}),0);
  near(propellerFlow({pitch:-18,np:0}),0,0,'stopped reverse-pitched blades have no flow');
  let previous=Infinity;
  for(const pitch of [65,70,75,80,84]){
    const flow=propellerFlow({pitch,np:1500});
    assert.ok(flow>=0&&flow<previous,'flow fades continuously toward feather');
    previous=flow;
  }
  assert.ok(propellerFlow({pitch:27,np:300})<propellerFlow({pitch:27,np:1500}),
    'a coasting propeller produces less visual flow than a fast propeller');
});
