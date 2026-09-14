export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const approach=(a,b,dt,tau)=>b+(a-b)*Math.exp(-dt/tau);

export class EngineSimulation {
  constructor(){this.power=.5;this.governor=1500;this.state='running';this.elapsed=0;this.ng=85;this.np=1500;this.itt=620;this.fuel=1;this.shaftPower=525;this.torque=2492;this.flame=1;this.phase='Steady running';this.propMode='govern';this.pitch=27;}
  restart(){this.state='starting';this.elapsed=0;this.ng=0;this.np=0;this.itt=20;this.shaftPower=0;this.torque=0;this.flame=0;this.fuel=0;this.phase='Starter · gas generator begins turning';}
  shutdown(){this.state='stopping';this.elapsed=0;this.phase='Fuel cut off · shafts coast down';}
  tick(dt){
    dt=clamp(dt,0,.1);this.elapsed+=dt;
    let targetNg=0,targetNp=0,targetItt=20,targetPower=0,targetFlame=0;
    if(this.state==='running'){
      targetNg=62+38*Math.pow(this.power,.48);
      targetNp=this.propMode==='feather'?Math.min(this.governor,700):this.governor;
      targetPower=42+1008*this.power;
      if(this.propMode==='feather')targetPower*=.12;
      targetItt=450+310*Math.pow(this.power,.65);
      targetFlame=.35+.65*this.power;
      this.phase=this.propMode==='feather'?'Feather geometry study · power and load simplified':this.propMode==='reverse'?'Reverse geometry study · slipstream direction reversed':'Steady running · continuous combustion sustains itself after ignition.';
    }else if(this.state==='starting'){
      const t=this.elapsed;
      if(t<2.5){targetNg=18;this.phase='1 / 4 · Starter turns the gas generator; fuel is off.';}
      else if(t<5.5){targetNg=38;targetItt=610;targetFlame=clamp((t-2.5)/1.5,0,.6);this.phase='2 / 4 · Fuel and ignition establish a flame.';}
      else {targetNg=62;targetNp=this.propMode==='feather'?600:this.governor;targetItt=510;targetFlame=.4;targetPower=60;this.phase=t<9?'3 / 4 · Gas energy accelerates the free power turbine.':'4 / 4 · The engine settles toward the selected power.';}
      if(t>=12){this.state='running';this.elapsed=0;}
    }else if(this.state==='stopping'){
      this.phase=this.ng>5?'Fuel off · stored heat decays as the shafts coast down.':'Engine stopped · residual heat continues to dissipate.';
      if(this.ng<.4&&this.np<3){this.state='off';this.ng=0;this.np=0;this.phase='Engine stopped · restart to follow the starting sequence.';}
    }else this.phase='Engine stopped · restart to follow the starting sequence.';
    this.ng=approach(this.ng,targetNg,dt,this.state==='stopping'?3.2:1.7);
    this.np=approach(this.np,targetNp,dt,this.state==='stopping'?5.0:2.4);
    this.itt=approach(this.itt,targetItt,dt,this.state==='starting'?1.1:this.state==='stopping'||this.state==='off'?17:2.0);
    this.shaftPower=approach(this.shaftPower,targetPower,dt,this.state==='stopping'?.65:2.4);
    this.flame=approach(this.flame,targetFlame,dt,.35);
    if(this.flame<.001)this.flame=0;
    this.fuel=this.flame;
    this.torque=this.np>25?this.shaftPower*745.7/(this.np*2*Math.PI/60):0;
    const pitch=this.propMode==='feather'?84:this.propMode==='reverse'?-18:15+this.power*28+(1500-this.governor)*.018;
    this.pitch=approach(this.pitch,pitch,dt,1.0);
    return this;
  }
  get nFree(){return this.np*17.58;}
  get readout(){return {state:this.state,ng:this.ng,np:this.np,itt:this.itt,shp:this.shaftPower,torque:this.torque,pitch:this.pitch,flame:this.flame};}
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
