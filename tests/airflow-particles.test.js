import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineScene,propellerFlow} from '../scene.js';
import {EngineSimulation,pathPoint} from '../simulation.js';

const settings={selected:null,isolate:false,view:'cutaway',shafts:false,
  airflow:true,combustionMode:'flame',speed:1,explode:0};
const wrap=value=>((value%1)+1)%1;

function fixture(){
  let rendered;
  const renderer={upload:mesh=>mesh,drawParticles:(data,count)=>{
    rendered={data:data.slice(0,count*8),count};
  }};
  const scene=new EngineScene(renderer);
  return {scene,render:(sim,options=settings)=>{
    scene.drawFlows(sim,options);
    return rendered;
  }};
}

function near(actual,expected,label){
  assert.ok(Math.abs(actual-expected)<2e-6,`${label}: expected ${expected}, got ${actual}`);
}

function assertCorePosition(rendered,phase,label){
  assert.ok(rendered.count>=850,`${label}: all gas-path particles remain present`);
  // Sample the complete folded path, including normal exit-to-inlet recycling.
  // Global X is not a flow-direction test: the PT6 combustor turns the gas twice.
  for(const index of [0,3,41,97,169,250,330,416,510,620,719,801,849]){
    const u=wrap(index/850+phase),[x,radius]=pathPoint(u);
    const angle=u>.92?(index%2?1.57:4.71):index*2.39996;
    const r=radius+Math.sin(index*31.42)*.035;
    const expected=[x,r*Math.cos(angle),r*Math.sin(angle)];
    expected.forEach((value,axis)=>near(rendered.data[index*8+axis],value,
      `${label}, particle ${index}, axis ${axis}`));
  }
}

function positions(rendered){
  return Array.from({length:rendered.count},(_,index)=>
    Array.from(rendered.data.slice(index*8,index*8+3)));
}

test('long-running core particles keep advancing along the gas path through repeated power changes',()=>{
  const {scene,render}=fixture(),sim=new EngineSimulation();
  const dt=.05;
  let phase=0;
  // Accumulate an hour of real frame steps. The old elapsed-time * current-Ng
  // formula magnifies even a small subsequent Ng change into a backward jump.
  for(let frame=0;frame<3600/dt;frame++){
    scene.animate(dt,sim,settings);
    phase=wrap(phase+dt*.070*sim.ng/100);
  }
  assertCorePosition(render(sim),phase,'after one hour');
  let previousNg=sim.ng,decelerated=false,accelerated=false;
  for(const power of [0,1,.1,.9,.25,.7,0]){
    sim.power=power;
    for(let frame=0;frame<100;frame++){
      sim.tick(dt);
      decelerated ||= sim.ng<previousNg-.001;
      accelerated ||= sim.ng>previousNg+.001;
      previousNg=sim.ng;
      scene.animate(dt,sim,settings);
      phase=wrap(phase+dt*.070*sim.ng/100);
      if(frame%5===0)assertCorePosition(render(sim),phase,`power ${power}, frame ${frame}`);
    }
  }
  assert.ok(decelerated&&accelerated,'the regression exercises actual spool-down and spool-up');
});

test('changing Ng cannot reposition existing core particles without elapsed animation time',()=>{
  const {scene,render}=fixture(),sim={ng:96,np:1500,pitch:27,flame:.7};
  scene.animate(317,sim,settings);
  const before=positions(render(sim)).slice(0,850);
  sim.ng=62;
  assert.deepEqual(positions(render(sim)).slice(0,850),before,'decreasing Ng during a paused redraw');
  sim.ng=100;
  assert.deepEqual(positions(render(sim)).slice(0,850),before,'increasing Ng during a paused redraw');
});

test('animation speed changes affect future travel and zero speed freezes particles',()=>{
  const {scene,render}=fixture(),sim={ng:80,np:1500,pitch:27,flame:.7};
  let phase=0;
  for(const [duration,speed] of [[91,1],[.05,.25],[.05,2],[.05,.5]]){
    scene.animate(duration,sim,{...settings,speed});
    phase=wrap(phase+duration*speed*.070*sim.ng/100);
    assertCorePosition(render(sim),phase,`speed ${speed}`);
  }
  const before=render(sim);
  scene.animate(10,sim,{...settings,speed:0});
  assert.deepEqual(render(sim),before,'zero animation speed freezes all rendered particle channels');
  assert.deepEqual(render(sim),before,'paused redraws do not advance particle lifetime');
});

test('flame particle lifetime stays continuous when Ng changes after a long run',()=>{
  const {scene,render}=fixture(),sim={ng:98,np:1500,pitch:27,flame:1};
  const flameSettings={...settings,selected:'combustor',isolate:true,airflow:false};
  const duration=601,dt=.05;
  scene.animate(duration,sim,flameSettings);
  let phase=wrap(duration*(.28+.22*sim.ng/100));
  const initial=render(sim,flameSettings);
  assert.equal(initial.count,650);
  for(const ng of [62,99,68,90]){
    sim.ng=ng;
    const before=positions(render(sim,flameSettings));
    if(ng===62)assert.deepEqual(before,positions(initial),'Ng alone cannot reset a flame particle age');
    scene.animate(dt,sim,flameSettings);
    phase=wrap(phase+dt*(.28+.22*ng/100));
    const after=render(sim,flameSettings);
    for(const index of [0,1,29,217,511,649]){
      const age=wrap(index*.618033+phase);
      near(after.data[index*8],-.12+age*1.2,`Ng ${ng}, flame particle ${index}`);
    }
  }
});

test('a reduction in flame intensity fades downstream particles without pulling survivors upstream',()=>{
  const {scene,render}=fixture(),sim={ng:98,np:1500,pitch:27,flame:1};
  const flameSettings={...settings,selected:'combustor',isolate:true,airflow:false};
  scene.animate(71,sim,flameSettings);
  const before=render(sim,flameSettings);
  const originalPositions=new Set(positions(before).map(point=>point.join(',')));
  sim.flame=.35;
  const after=render(sim,flameSettings);
  assert.ok(after.count>0&&after.count<before.count,'a lower fuel rate shortens the visible flame');
  for(const point of positions(after)){
    assert.ok(originalPositions.has(point.join(',')),
      `surviving flame particle moved merely because intensity changed: ${point}`);
  }
});

test('propeller slipstream speed changes preserve travel phase in forward and reverse pitch',()=>{
  const {scene,render}=fixture();
  const propSettings={...settings,selected:'propeller',isolate:true};
  const sim={ng:90,np:1700,pitch:27,flame:0};
  const dt=.05;
  let phase=0;
  for(const pitch of [27,-18]){
    const axialPositions=render(sim,propSettings).data.filter((_,index)=>index%8===0);
    sim.pitch=pitch;
    assert.deepEqual(render(sim,propSettings).data.filter((_,index)=>index%8===0),axialPositions,
      'changing thrust direction must not teleport the slipstream along the shaft');
    for(const [duration,np] of [[481,1700],[dt,700],[dt,1650],[dt,900]]){
      const before=positions(render(sim,propSettings));
      sim.np=np;
      assert.deepEqual(positions(render(sim,propSettings)),before,'RPM alone cannot teleport slipstream particles');
      scene.animate(duration,sim,propSettings);
      const thrust=propellerFlow(sim);
      phase=wrap(phase+duration*.17*Math.sign(thrust)*Math.sqrt(Math.abs(thrust)));
      const after=render(sim,propSettings);
      assert.equal(after.count,700);
      for(const index of [0,1,103,349,698]){
        const u=wrap(index/700+phase);
        const x=-4.65-3+u*6;
        near(after.data[index*8],x,`${pitch}° pitch, ${np} RPM, particle ${index}`);
      }
    }
  }
});
