export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const approach=(a,b,dt,tau)=>b+(a-b)*Math.exp(-dt/tau);

// These are teaching-model constants, not installation limits or measured data.
// Source mapping and omitted aircraft systems: docs/propeller-governor.md.
export const PROP_MODEL=Object.freeze({fine:15,feather:84,reverse:-18,inertia:75,
  minRpm:1100,maxRpm:1700,overspeedRpm:1700*1.04,maxPitchRate:18});
const RPM_TO_RAD=2*Math.PI/60;

export class EngineSimulation {
  constructor(){
    this.power=.5;this.governor=1500;this.propMode='govern';this.betaPosition=.5;
    this.state='running';this.elapsed=0;this.ng=89.2;this.np=1500;this.itt=648;
    this.availablePower=546;this.shaftPower=546;this.torque=546*745.7/(1500*RPM_TO_RAD);
    this.pitch=27;this.flame=.675;this.fuel=.675;this.fuelLimit=1;this.fuelIntegral=1;
    this.governorState='On speed';this.oilFlow='blocked';this.oilPressure=1;
    this.overspeedActive=false;this.fuelGovernorActive=false;this.fuelGovernorRpm=1590;
    this.phase='Constant-speed governing · pitch balances propeller load against shaft power.';
  }
  restart(){
    this.state='starting';this.elapsed=0;this.ng=0;this.np=0;this.itt=20;
    this.availablePower=0;this.shaftPower=0;this.torque=0;this.flame=0;this.fuel=0;
    this.fuelLimit=1;this.fuelIntegral=1;this.overspeedActive=false;this.fuelGovernorActive=false;
    this.oilPressure=0;this.oilFlow='blocked';this.governorState='No governor oil pressure';
    this.phase='Starter · gas generator begins turning';
  }
  shutdown(){this.state='stopping';this.elapsed=0;this.fuel=0;this.phase='Fuel cut off · shafts coast down';}
  tick(dt){
    if(!Number.isFinite(dt)||dt<=0)return this;
    // Substeps keep hydraulic and shaft transients stable at different frame rates.
    let remaining=Math.min(dt,.1);
    while(remaining>1e-9){const step=Math.min(remaining,.01);this.step(step);remaining-=step;}
    return this;
  }
  step(dt){
    this.elapsed+=dt;
    const power=clamp(this.power,0,1),rpm=clamp(this.governor,PROP_MODEL.minRpm,PROP_MODEL.maxRpm);
    const ground=this.propMode==='beta'||this.propMode==='reverse';
    this.fuelGovernorRpm=rpm*(ground?.95:1.06);
    // Nf/Py fuel topping is separate from the CSU's hydraulic pitch control.
    if(this.state==='running'){
      const error=(this.fuelGovernorRpm-this.np)/rpm;
      const candidate=this.fuelIntegral+error*.8*dt;
      const demand=candidate+error*3;
      // Proportional damping prevents fuel/shaft lag from causing hunting.
      // Integrate only when unsaturated or when returning from a fuel limit.
      if((demand>.02&&demand<1)||(demand>=1&&error<0)||(demand<=.02&&error>0))this.fuelIntegral=candidate;
      this.fuelLimit=clamp(this.fuelIntegral+error*3,.02,1);
    }else {this.fuelLimit=1;this.fuelIntegral=1;}
    this.fuelGovernorActive=this.state==='running'&&this.fuelLimit<.995;
    let targetNg=0,targetItt=20,targetPower=0,targetFlame=0;
    if(this.state==='running'){
      targetPower=(42+1008*power)*this.fuelLimit;
      const effective=clamp((targetPower-42)/1008,0,1);
      targetNg=62+38*Math.pow(effective,.48);targetItt=450+310*Math.pow(effective,.65);
      targetFlame=(.35+.65*power)*this.fuelLimit;
      this.phase=this.propMode==='feather'?'Feather selected · oil drains; the gas generator continues running.'
        :ground?'Ground range · beta valve controls pitch; Nf governor limits speed through fuel.'
        :'Constant-speed governing · pitch balances propeller load against shaft power.';
    }else if(this.state==='starting'){
      const t=this.elapsed;
      if(t<2.5){targetNg=18;this.phase='1 / 4 · Starter turns the gas generator; fuel is off.';}
      else if(t<5.5){targetNg=38;targetItt=610;targetFlame=clamp((t-2.5)/1.5,0,.6);this.phase='2 / 4 · Fuel and ignition establish a flame.';}
      else {targetNg=62;targetItt=510;targetFlame=.4;targetPower=60;this.phase=t<9?'3 / 4 · Gas energy accelerates the free power turbine.':'4 / 4 · The engine settles toward the selected power.';}
      if(t>=12){this.state='running';this.elapsed=0;}
    }else if(this.state==='stopping')this.phase='Fuel off · shafts coast down independently; oil pressure decays.';
    else this.phase='Engine stopped · restart to follow the starting sequence.';
    this.ng=approach(this.ng,targetNg,dt,this.state==='stopping'?3.2:1.7);
    this.itt=approach(this.itt,targetItt,dt,this.state==='starting'?1.1:this.state==='stopping'||this.state==='off'?17:2);
    this.availablePower=approach(this.availablePower,targetPower,dt,this.state==='stopping'?.65:.9);
    this.flame=approach(this.flame,targetFlame,dt,.35);
    if(this.flame<.001)this.flame=0;
    this.fuel=this.state==='stopping'||this.state==='off'?0:targetFlame;

    // Engine oil supply plus the prop-driven governor pump. This normalized
    // availability is illustrative; it is not an oil-pressure gauge in psi.
    this.oilPressure=clamp(this.ng/45,0,1)*clamp(this.np/650,.15,1);
    this.updatePitch(dt,rpm,ground,power);

    // Actual RPM follows torque balance, never a selected-RPM interpolation.
    // The static-air load curve is intentionally qualitative. In feather a
    // powered prop may keep turning; feather does not shut off engine fuel.
    const loadCoefficient=.12+.88*Math.pow(Math.abs(this.pitch)/27,2.5);
    const aerodynamicTorque=2500*loadCoefficient*Math.pow(this.np/1500,2);
    const friction=this.np>0?30+.04*this.np:0;
    const driveTorque=this.availablePower*745.7/(Math.max(this.np,300)*RPM_TO_RAD);
    const acceleration=(driveTorque-aerodynamicTorque-friction)/PROP_MODEL.inertia;
    this.np=Math.max(0,this.np+acceleration/RPM_TO_RAD*dt);
    this.torque=driveTorque;this.shaftPower=this.torque*this.np*RPM_TO_RAD/745.7;
    if(this.state==='stopping'&&this.ng<.4&&this.np<3){
      this.state='off';this.ng=0;this.np=0;this.torque=0;this.availablePower=0;this.shaftPower=0;
    }
  }
  updatePitch(dt,rpm,ground,power){
    const {fine,feather,reverse,maxPitchRate,overspeedRpm}=PROP_MODEL;
    let rate=0,minPitch=ground?reverse:fine;
    this.overspeedActive=this.np>overspeedRpm&&this.propMode!=='feather';
    if(this.propMode==='feather'){
      rate=maxPitchRate;this.governorState=this.pitch>=feather-.05?'Feathered':'Feathering · oil draining';
    }else if(this.oilPressure<.08){
      rate=5;this.governorState=this.pitch>=feather-.05?'Feathered · no governor oil pressure':'Oil pressure lost · moving toward feather';
    }else if(this.overspeedActive){
      rate=clamp((this.np-overspeedRpm)*.12,0,maxPitchRate);
      this.governorState='Overspeed governor · draining oil';
    }else if(ground){
      const target=this.propMode==='reverse'?reverse*power:fine*(1-clamp(this.betaPosition,0,1));
      rate=clamp((target-this.pitch)*2,-maxPitchRate,maxPitchRate);
      this.governorState=this.propMode==='reverse'?'Reverse · beta valve controls pitch':'Beta · valve controls pitch';
    }else{
      const error=this.np-rpm;
      rate=Math.abs(error)>2?clamp(error*.025,-maxPitchRate,maxPitchRate):0;
      this.governorState=error>2?'Overspeed · increasing pitch':error< -2?'Underspeed · decreasing pitch':'On speed';
      // Returning from reverse must traverse zero continuously to the fine stop.
      if(this.pitch<fine){rate=Math.max(rate,8);minPitch=reverse;this.governorState='Returning to flight fine pitch';}
      else if(this.pitch<=fine+.02&&rate<0){rate=0;this.governorState='Fine-pitch stop · below selected RPM';}
      else if(this.pitch>=feather&&rate>0){rate=0;this.governorState='Coarse-pitch stop';}
    }
    if(rate<0)rate*=this.oilPressure;
    const previous=this.pitch;
    this.pitch=clamp(previous+rate*dt,Math.min(previous,minPitch),feather);
    if(this.pitch<minPitch&&previous>=minPitch)this.pitch=minPitch;
    // Feather leaves the drain path open even after the blades reach the stop.
    this.oilFlow=this.propMode==='feather'||this.oilPressure<.08?'drain'
      :this.pitch<previous-1e-8?'supply':this.pitch>previous+1e-8?'drain':'blocked';
  }
  get nFree(){return this.np*17.58;}
  get readout(){return {state:this.state,ng:this.ng,np:this.np,itt:this.itt,shp:this.shaftPower,torque:this.torque,pitch:this.pitch,flame:this.flame,
    governor:this.governor,propMode:this.propMode,betaPosition:this.betaPosition,governorState:this.governorState,
    oilFlow:this.oilFlow,oilPressure:this.oilPressure,overspeedActive:this.overspeedActive,
    fuelGovernorActive:this.fuelGovernorActive,fuelGovernorRpm:this.fuelGovernorRpm};}
}

// Continuous schematic station path, from aft inlet to the split exhaust.
// Coordinates are model units, not engineering dimensions.
export const gasPath=[
 [5.2,.92,0],[4.77,.69,0],[4.24,.59,0],[3.7,.54,0],[3.12,.49,0],
 [2.60,.38,0],[2.35,.66,0],[2.23,1.06,0],[1.9,1.18,0],
 [1.05,1.2,0],[.14,1.18,0],[-.12,1.02,0],[.24,.86,1],[.79,.87,1],
 [1.4,.83,1],[1.57,.62,1],[1.35,.44,1],[.6,.44,1],[-.35,.49,1],
 [-.78,.52,2],[-1.32,.6,2],[-1.91,.7,2],[-2.47,.8,2],[-2.64,1.25,2],[-1.96,1.78,2]
];
export function pathPoint(t){
  const s=clamp(t,0,1)*(gasPath.length-1),i=Math.min(Math.floor(s),gasPath.length-2),f=s-i;
  const a=gasPath[i],b=gasPath[i+1];
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
}
