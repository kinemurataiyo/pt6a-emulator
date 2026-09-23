import test from 'node:test';
import assert from 'node:assert/strict';
import {blade,transform} from '../geometry.js';
import {EngineScene,propellerFlow} from '../scene.js';

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
