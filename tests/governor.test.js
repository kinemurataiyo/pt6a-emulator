import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineSimulation, PROP_MODEL} from '../simulation.js';

// Exercise complete shaft/hydraulic/fuel transients, not just controller formulas.
function advance(sim, seconds, dt=.02, sample=()=>{}) {
  for (let elapsed=0; elapsed<seconds-1e-9;) {
    const step=Math.min(dt,seconds-elapsed);
    sim.tick(step);
    elapsed+=step;
    sample(sim);
  }
  return sim;
}
function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual-expected)<=tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}
function finiteState(sim) {
  for (const [name,value] of Object.entries(sim.readout)) {
    if (typeof value==='number') assert.ok(Number.isFinite(value),`${name} must be finite`);
  }
  assert.ok(sim.np>=0,'propeller must not rotate backward numerically');
  assert.ok(sim.pitch>=PROP_MODEL.reverse&&sim.pitch<=PROP_MODEL.feather,'pitch stays in physical range');
  assert.ok(sim.oilPressure>=0&&sim.oilPressure<=1,'normalized oil availability stays bounded');
  assert.ok(sim.fuelLimit>=0&&sim.fuelLimit<=1,'fuel limiter stays bounded');
  near(sim.shaftPower,sim.torque*sim.np*(2*Math.PI/60)/745.7,1e-8,
    'shaft power agrees with delivered torque and actual shaft speed');
}

test('flight governing settles across power and selected-RPM ranges',()=>{
  for (const power of [.25,.5,1]) {
    for (const rpm of [1100,1400,1700]) {
      const sim=new EngineSimulation();
      sim.power=power;
      sim.governor=rpm;
      advance(sim,90);
      near(sim.np,rpm,5,`power ${power}, selected RPM ${rpm}`);
      assert.ok(sim.pitch>=PROP_MODEL.fine&&sim.pitch<PROP_MODEL.feather);
      assert.equal(sim.overspeedActive,false);
      assert.equal(sim.fuelGovernorActive,false);
      near(sim.shaftPower,42+1008*power,1,'steady power follows power lever');
      const settled=[];
      advance(sim,10,.02,s=>settled.push(s.np));
      assert.ok(Math.max(...settled)-Math.min(...settled)<5,'RPM does not keep hunting');
      finiteState(sim);
    }
  }
});

test('lower RPM selection drains oil and coarsens pitch; higher selection supplies oil and fines pitch',()=>{
  const sim=advance(new EngineSimulation(),45);
  const initialPitch=sim.pitch;
  sim.governor=1200;
  sim.tick(.1);
  assert.ok(sim.pitch>initialPitch,'lower setpoint must first increase blade angle');
  assert.equal(sim.oilFlow,'drain');
  assert.ok(sim.np>1400,'RPM must not jump directly to the new selection');
  advance(sim,90);
  near(sim.np,1200,5,'lower setpoint settles');
  const coarsePitch=sim.pitch;
  sim.governor=1600;
  sim.tick(.1);
  assert.ok(sim.pitch<coarsePitch,'higher setpoint must first decrease blade angle');
  assert.equal(sim.oilFlow,'supply');
  advance(sim,90);
  near(sim.np,1600,5,'higher setpoint settles');
  assert.ok(sim.pitch<initialPitch);
});

test('power increase is absorbed by coarser pitch at the same selected RPM',()=>{
  const sim=new EngineSimulation();
  sim.power=.3;
  advance(sim,90);
  const before={pitch:sim.pitch,torque:sim.torque};
  sim.power=.8;
  let peakRpm=0;
  advance(sim,90,.02,s=>{peakRpm=Math.max(peakRpm,s.np);});
  assert.ok(peakRpm>sim.governor+5,'torque imbalance produces an actual shaft-speed transient');
  near(sim.np,sim.governor,5,'governor recovers selected RPM');
  assert.ok(sim.pitch>before.pitch+5,'more shaft power requires coarser blades');
  assert.ok(sim.torque>before.torque,'shaft torque increases with power');
});

test('flight fine-pitch stop cannot manufacture enough RPM at idle',()=>{
  const sim=new EngineSimulation();
  sim.power=0;
  sim.governor=1700;
  advance(sim,90);
  near(sim.pitch,PROP_MODEL.fine,.05,'pitch rests on the flight fine stop');
  assert.ok(sim.np<sim.governor-300,'idle remains below selected RPM');
  assert.ok(sim.np>0,'running idle still drives the propeller');
  assert.equal(sim.oilFlow,'blocked');
  assert.match(sim.governorState,/fine.*stop/i);
});

test('feather drains oil progressively and slows Np without shutting down the gas generator',()=>{
  const sim=advance(new EngineSimulation(),30);
  const initial={pitch:sim.pitch,np:sim.np,ng:sim.ng};
  sim.propMode='feather';
  sim.tick(.1);
  assert.ok(sim.pitch>initial.pitch&&sim.pitch<PROP_MODEL.feather,'feather must be a visible transient');
  assert.equal(sim.oilFlow,'drain');
  let previous=sim.pitch;
  advance(sim,30,.02,s=>{
    assert.ok(s.pitch>=previous-1e-8,'feather movement remains toward coarse pitch');
    previous=s.pitch;
    finiteState(s);
  });
  near(sim.pitch,PROP_MODEL.feather,.01,'feather angle');
  assert.ok(sim.np<initial.np*.65,'feather reduces propeller RPM');
  assert.equal(sim.state,'running');
  assert.ok(sim.flame>.2&&sim.fuel>0,'feather must not cut engine fuel');
  near(sim.ng,initial.ng,1,'gas generator remains independent of Np');
});

test('feather works without oil pressure, and unfeather requires an oil supply',()=>{
  const sim=advance(new EngineSimulation(),1);
  sim.shutdown();
  advance(sim,120);
  assert.equal(sim.state,'off');
  // Begin with a stopped prop at a finer angle to isolate the spring/oil direction.
  sim.pitch=PROP_MODEL.fine;
  sim.propMode='feather';
  advance(sim,10);
  near(sim.pitch,PROP_MODEL.feather,.01,'spring/counterweight feathering without oil');
  assert.equal(sim.oilPressure,0);
  assert.equal(sim.np,0);
  sim.propMode='govern';
  advance(sim,10);
  near(sim.pitch,PROP_MODEL.feather,.01,'no oil means no hydraulic unfeathering');
});

test('returning from powered feather supplies oil and restores selected RPM',()=>{
  const sim=new EngineSimulation();
  sim.propMode='feather';
  advance(sim,30);
  const featheredRpm=sim.np;
  sim.propMode='govern';
  sim.tick(.1);
  assert.equal(sim.oilFlow,'supply');
  assert.ok(sim.pitch<PROP_MODEL.feather);
  advance(sim,90);
  near(sim.np,sim.governor,5,'unfeathered governing RPM');
  assert.ok(sim.np>featheredRpm);
  assert.ok(sim.pitch>=PROP_MODEL.fine&&sim.pitch<PROP_MODEL.feather);
});

test('fuel cutoff produces independent shaft coastdown and eventually a stopped engine',()=>{
  const sim=new EngineSimulation();
  const ng0=sim.ng,np0=sim.np;
  sim.shutdown();
  advance(sim,2);
  assert.equal(sim.fuel,0);
  assert.ok(sim.ng>0&&sim.ng<ng0);
  assert.ok(sim.np>0&&sim.np<np0);
  assert.ok(Math.abs(sim.ng/ng0-sim.np/np0)>.1,'Ng and Np must not be the same coastdown interpolation');
  advance(sim,120);
  assert.equal(sim.state,'off');
  assert.equal(sim.ng,0);
  assert.equal(sim.np,0);
  assert.equal(sim.flame,0);
  assert.equal(sim.torque,0);
  finiteState(sim);
});

test('restart turns Ng before propeller acceleration and eventually restores governing',()=>{
  const sim=new EngineSimulation();
  sim.restart();
  advance(sim,2);
  assert.equal(sim.state,'starting');
  assert.ok(sim.ng>0,'starter rotates the gas generator');
  assert.equal(sim.np,0,'starter is not mechanically connected to the free turbine');
  assert.equal(sim.flame,0,'pre-lightoff stage remains fuel-off');
  advance(sim,3);
  assert.ok(sim.flame>0,'lightoff establishes flame before free-turbine power');
  assert.equal(sim.np,0);
  advance(sim,100);
  assert.equal(sim.state,'running');
  near(sim.np,sim.governor,5,'restart returns to governing');
  finiteState(sim);
});

for (const mode of ['beta','reverse']) {
  test(`${mode} directly controls pitch while Nf fuel governing stabilizes RPM`,()=>{
    const sim=new EngineSimulation();
    sim.propMode=mode;
    sim.betaPosition=.5;
    sim.power=.5;
    advance(sim,120);
    const targetPitch=mode==='beta'?PROP_MODEL.fine*.5:PROP_MODEL.reverse*.5;
    near(sim.pitch,targetPitch,.1,`${mode} blade-angle selection`);
    assert.ok(sim.fuelGovernorRpm<sim.governor,'ground range resets Nf limit below flight selection');
    assert.ok(sim.fuelGovernorActive,'small blade angle requires fuel limiting');
    assert.ok(sim.shaftPower<42+1008*sim.power,'Nf governor reduces available fuel/power');
    const rpms=[];
    advance(sim,10,.02,s=>{
      rpms.push(s.np);
      near(s.pitch,targetPitch,.1,'fuel governor must not replace direct beta pitch control');
      finiteState(s);
    });
    near(sim.np,sim.fuelGovernorRpm,20,'Nf governor settles near its selected limit');
    assert.ok(Math.max(...rpms)-Math.min(...rpms)<20,'Nf governor must not sustain a fuel/RPM limit cycle');
  });
}

test('return from reverse traverses zero continuously before the flight fine stop',()=>{
  const sim=new EngineSimulation();
  sim.propMode='reverse';
  advance(sim,60);
  assert.ok(sim.pitch<0);
  sim.propMode='govern';
  let previous=sim.pitch,sawNearZero=false;
  advance(sim,90,.02,s=>{
    assert.ok(Math.abs(s.pitch-previous)<=PROP_MODEL.maxPitchRate*.02+.01,'mode changes must not snap the blades');
    if (Math.abs(s.pitch)<1) sawNearZero=true;
    previous=s.pitch;
  });
  assert.ok(sawNearZero);
  near(sim.np,sim.governor,5,'flight RPM after reverse');
  assert.ok(sim.pitch>=PROP_MODEL.fine);
});

test('overspeed backup drains oil independently of the higher flight Nf fuel limit',()=>{
  const sim=new EngineSimulation();
  sim.governor=PROP_MODEL.maxRpm;
  sim.np=PROP_MODEL.overspeedRpm+15;
  const pitch=sim.pitch;
  sim.tick(.01);
  assert.ok(sim.np<sim.fuelGovernorRpm,'test is below the separate flight Nf threshold');
  assert.equal(sim.overspeedActive,true);
  assert.equal(sim.fuelGovernorActive,false);
  assert.ok(sim.pitch>pitch);
  assert.equal(sim.oilFlow,'drain');
  assert.match(sim.governorState,/overspeed governor/i);
  advance(sim,90);
  assert.equal(sim.overspeedActive,false);
  near(sim.np,sim.governor,5,'recovery after protection acts');
});

test('shaft/pitch results are insensitive to normal rendering frame intervals',()=>{
  const results=[.01,1/60,.1].map(dt=>{
    const sim=new EngineSimulation();
    sim.power=.85;
    sim.governor=1200;
    advance(sim,45,dt,finiteState);
    return sim;
  });
  for (const sim of results.slice(1)) {
    near(sim.np,results[0].np,2,'RPM with changed timestep');
    near(sim.pitch,results[0].pitch,.2,'pitch with changed timestep');
    near(sim.ng,results[0].ng,.1,'Ng with changed timestep');
  }
});

test('mixed lever/mode transitions remain finite and ignore invalid timestep values',()=>{
  const sim=new EngineSimulation();
  for (const mode of ['govern','feather','govern','beta','reverse','govern']) {
    sim.propMode=mode;
    for (const power of [0,1,.1,.9]) {
      sim.power=power;
      sim.governor=power>.5?1100:1700;
      advance(sim,12,.1,finiteState);
    }
  }
  const before=sim.readout;
  for (const dt of [0,-1,NaN,Infinity]) sim.tick(dt);
  assert.deepEqual(sim.readout,before,'invalid time steps do not corrupt the engine');
});
