import {MeshData,lathe,cylinder,ring,box,blade,bladeRing,torus,tube,gear,boltRing,matrix,rgb,TAU,rotateX} from './geometry.js';
import {stages} from './content.js';
import {pathPoint,clamp} from './simulation.js';

const COLORS={metal:'#aebec5',dark:'#637b86',edge:'#c4c9c6',case:'#657780',hot:'#ab8b71',brass:'#caa775',shaft:'#ad98d0'};
const offsets={propeller:-2.8,gearbox:-1.9,exhaust:-1.25,powerTurbine2:-.85,powerTurbine1:-.55,compressorTurbine:-.28,combustor:0,diffuser:.55,impeller:.85,axial3:1.2,axial2:1.55,axial1:1.9,inlet:2.25,accessories:2.8};
export const explodedX=(id,amount)=>offsets[id]*amount;

export function buildEngine(){
  const parts=[];
  function put(id,data,options={}){parts.push({id,data,x:stages.find(s=>s.id===id)?.x||0,...options});}
  // Compressor stages: independently inspectable fixed and rotating rows.
  for(let i=0;i<3;i++){
    const id='axial'+(i+1),r=[.78,.73,.67][i],hub=[.29,.32,.35][i];
    const rotor=new MeshData().append(cylinder(hub,.22,COLORS.dark));
    rotor.append(bladeRing(24+i*5,{root:hub,tip:r,chord:.20-i*.01,twist:.88-i*.05,sweep:.055,color:COLORS.metal}));
    rotor.append(ring(hub+.016,.026,.17,COLORS.edge));
    rotor.append(boltRing(hub*.75,8,.055),{x:.13});
    put(id,rotor,{spin:'gas'});
    const fixed=new MeshData().append(bladeRing(27+i*5,{root:hub+.025,tip:r+.016,chord:.13,twist:-.55,sweep:-.04,color:'#859ba5'}),{x:-.24});
    fixed.append(ring(r+.037,.035,.11,COLORS.edge),{x:-.24});put(id,fixed);
    const shell=lathe([[-.32,r+.018],[-.32,r+.065],[.26,r+.09],[.26,r+.043],[-.32,r+.018]],COLORS.case);
    shell.append(ring(r+.095,.045,.06,COLORS.edge),{x:.23});shell.append(boltRing(r+.083,20),{x:.28});put(id,shell,{shell:true});
  }
  // Rear annular inlet and supporting struts, with an open center.
  const inlet=lathe([[-.42,.78],[-.42,.91],[-.12,1.02],[.25,1.03],[.4,.82],[.4,.59],[.3,.52],[.15,.59],[-.25,.72]],'#7e939d');
  inlet.append(ring(1.055,.035,.07,'#c3c9c9'),{x:.08});
  for(let k=0;k<12;k++){const a=k*TAU/12;inlet.append(box(.12,.44,.035,'#9cadaf'),{x:.27,y:.69*Math.cos(a),z:.69*Math.sin(a),rx:a});}
  put('inlet',inlet,{shell:true});
  const inletScreen=new MeshData();
  for(let i=0;i<9;i++)inletScreen.append(torus(.84+i*.018,.007,'#52636b',64,4),{x:.13+i*.022});
  put('inlet',inletScreen,{shell:true});
  // Centrifugal impeller: curved passages from the eye to the rim.
  const impeller=lathe([[-.14,.08],[-.14,.93],[-.045,.96],[.04,.78],[.17,.47],[.28,.29],[.28,.08]],'#aab3b4');
  for(let k=0;k<22;k++){
    const a=k*TAU/22,pts=[];
    for(let j=0;j<=12;j++){const t=j/12,r=.29+.63*t,angle=a+.5*t*t;pts.push([.23-.30*t,r*Math.cos(angle),r*Math.sin(angle)]);}
    impeller.append(tube(pts,.017,'#c7c9b8',6));
    // Radial vane wall, thicker at the hub and narrowing at the rim.
    const vane=new MeshData(),col=rgb('#b8c4c5');
    for(let j=0;j<12;j++){
      const t=j/12,t1=(j+1)/12;
      const point=(u,h)=>[.23-.30*u-h,(.29+.63*u)*Math.cos(a+.5*u*u),(.29+.63*u)*Math.sin(a+.5*u*u)];
      const p=[point(t,0),point(t1,0),point(t1,.11),point(t,.11)];
      const n=[0,-Math.sin(a+.5*t*t),Math.cos(a+.5*t*t)],o=vane.vertices.length/9;for(const q of p)vane.v(q,n,col);vane.tri(o,o+1,o+2);vane.tri(o,o+2,o+3);
    }impeller.append(vane);
  }
  impeller.append(cylinder(.16,.48,COLORS.dark));put('impeller',impeller,{spin:'gas'});
  const impellerCase=lathe([[-.22,.98],[-.22,1.09],[.12,1.09],[.32,.78],[.32,.73],[.08,1.01],[-.22,.98]],COLORS.case);
  impellerCase.append(boltRing(1.07,24),{x:-.24});put('impeller',impellerCase,{shell:true});
  const diffuser=new MeshData();
  for(let k=0;k<18;k++){
    const a=TAU*k/18,pts=[];for(let j=0;j<7;j++){const t=j/6;pts.push([.10-.3*t,(1.02+.14*t)*Math.cos(a+.18*t),(1.02+.14*t)*Math.sin(a+.18*t)]);}diffuser.append(tube(pts,.057,'#a5ad9b',8));
  }
  diffuser.append(ring(1.225,.045,.09,'#b0b5a3'),{x:-.23});diffuser.append(ring(1.04,.035,.07,'#bdc1ac'),{x:.1});put('diffuser',diffuser);
  // Combustor liners and outer pressure vessel. The top is sectioned by shader.
  const outer=lathe([[-.87,1.02],[-.75,1.16],[.90,1.17],[1.12,1.06]],'#827764',96);
  outer.append(ring(1.18,.04,.08,'#b4a48b'),{x:-.70});outer.append(ring(1.19,.04,.08,'#b4a48b'),{x:.83});
  for(let j=0;j<8;j++)outer.append(torus(1.169,.017,j%2?'#99876f':'#afa084'),{x:-.62+j*.19});
  outer.append(boltRing(1.145,28),{x:.88});put('combustor',outer,{shell:true});
  // Annular liner includes radial cooling openings represented by repeated lips.
  const liner=new MeshData();
  liner.append(lathe([[-.55,.97],[.67,.98],[.91,.83],[1.0,.61],[.90,.39],[.59,.35]],'#a18d74',96));
  liner.append(lathe([[-.54,.70],[.55,.70],[.66,.62],[.55,.52],[-.62,.44]],'#83745f',96));
  for(let j=0;j<6;j++){
    liner.append(torus(.977,.018,'#c1ab87'),{x:-.42+j*.19});
    for(let k=0;k<28;k++){const a=k*TAU/28+(j%2)*.045;liner.append(box(.055,.018,.045,'#443e33'),{x:-.43+j*.19,rx:a,y:.982*Math.cos(a),z:.982*Math.sin(a)});}
  }
  put('combustor',liner,{liner:true});
  const fuel=new MeshData();fuel.append(torus(1.06,.027,'#b9a173'),{x:-.63});fuel.append(torus(1.09,.023,'#706854'),{x:-.70});
  for(let k=0;k<14;k++){const a=TAU*k/14;fuel.append(cylinder(.056,.23,'#c5b494',12),{x:-.65,y:.84*Math.cos(a),z:.84*Math.sin(a)});fuel.append(tube([[-.63,.84*Math.cos(a),.84*Math.sin(a)],[-.63,1.06*Math.cos(a),1.06*Math.sin(a)]],.023,'#b5a381',7));}
  for(const a of [.75,3.5]){fuel.append(cylinder(.065,.23,'#ccd4d7',12),{x:-.30,y:1.06*Math.cos(a),z:1.06*Math.sin(a),rz:Math.PI/2,rx:a});}
  put('combustor',fuel);
  // Turbine vane/rotor rows. Each power disk belongs to the same free shaft.
  for(const [id,r,count,spin,twist]of [['compressorTurbine',.72,40,'gas',-.8],['powerTurbine1',.77,38,'free',.78],['powerTurbine2',.86,42,'free',.70]]){
    const hub=r*.46,rotor=new MeshData().append(lathe([[-.1,.11],[-.1,hub],[0,hub*1.06],[.1,hub],[.1,.11]],'#887b6b'));
    rotor.append(bladeRing(count,{root:hub,tip:r,chord:.15,twist,sweep:.028,color:id==='compressorTurbine'?'#c2b49c':'#bcbcb1',spans:6,sides:12}));
    rotor.append(ring(r+.015,.022,.12,'#a6a69a'));rotor.append(boltRing(hub*.72,12,.05),{x:-.11});put(id,rotor,{spin});
    const stator=new MeshData().append(bladeRing(count-5,{root:hub,tip:r+.013,chord:.13,twist:-twist*.8,sweep:-.01,color:'#928b7b',spans:5,sides:10}),{x:.22});stator.append(ring(r+.05,.035,.1,'#b2a68e'),{x:.22});put(id,stator);
    const casing=lathe([[-.2,r+.04],[-.2,r+.11],[.34,r+.11],[.34,r+.04]],'#817d70');casing.append(boltRing(r+.09,24),{x:-.2});put(id,casing,{shell:true});
  }
  // Gas-generator and output shafts do not connect to each other.
  put('gasShaft',cylinder(.075,6.10,'#aa97cf',32),{x:2.4,spin:'gas',shaft:true});
  put('freeShaft',cylinder(.095,2.25,'#b9a3e4',32),{x:-2.35,spin:'free',shaft:true});
  const coupler=new MeshData().append(ring(.17,.07,.20,'#c7cad0'));put('compressorTurbine',coupler,{x:-.4,spin:'gas'});
  // Exhaust collector and two aft-directed outlet pipes.
  const exhaust=lathe([[-.3,.35],[-.3,.84],[-.10,1.01],[.29,.95],[.38,.86]],'#948e81');
  for(const sign of [-1,1]){
    const pts=[[0,0,sign*.81],[-.12,.02,sign*1.07],[-.12,.05,sign*1.36],[.10,.07,sign*1.59],[.42,.08,sign*1.77]];
    exhaust.append(tube(pts,.23,'#a0947f',24));
    exhaust.append(tube(pts.map(p=>[p[0]+.005,p[1],p[2]]),.19,'#5d5147',20));
  }
  exhaust.append(ring(.98,.045,.085,'#a79e8c'),{x:.29});put('exhaust',exhaust,{shell:true});
  // Planetary gearbox: schematic tooth counts, kinematically consistent ratios.
  const gearCase=lathe([[-.78,.31],[-.62,.47],[-.35,.68],[.29,.86],[.67,.83],[.75,.43]],'#668089');
  gearCase.append(ring(.87,.04,.07,'#abc0c7'),{x:.29});gearCase.append(ring(.69,.04,.07,'#adc0c6'),{x:-.34});gearCase.append(boltRing(.835,24),{x:.3});put('gearbox',gearCase,{shell:true});
  for(let stage=0;stage<2;stage++){
    const gx=stage?-.29:.36,rad=stage?.48:.66,sunR=stage?.225:.137,n=stage?5:3,planetR=(rad-sunR)/2,center=sunR+planetR;
    put('gearbox',gear(sunR,stage?18:12,.115,'#c9ad7b'),{x:-3.32+gx,spin:stage?'carrier1':'free',gearStage:stage});
    const ringGear=ring(rad+.06,.08,.13,'#9aa4a5');
    for(let k=0;k<48;k++){const a=k*TAU/48;ringGear.append(box(.13,.044,.028,'#bac2bf'),{rx:a,y:(rad-.009)*Math.cos(a),z:(rad-.009)*Math.sin(a)});}put('gearbox',ringGear,{x:-3.32+gx});
    for(let k=0;k<n;k++){put('gearbox',gear(planetR,stage?14:22,.112,'#b9bfc0'),{x:-3.32+gx,planet:{stage,index:k,count:n,center,sunR,planetR}});}
    const carrier=new MeshData().append(cylinder(.09,.065,'#9aa6aa'));
    for(let k=0;k<n;k++){const a=k*TAU/n;carrier.append(box(.043,center,.057,'#8d9ca4'),{rx:a,y:center*.5*Math.cos(a),z:center*.5*Math.sin(a)});carrier.append(cylinder(.034,.075,'#d0d2ca',10),{y:center*Math.cos(a),z:center*Math.sin(a)});}
    put('gearbox',carrier,{x:-3.32+gx-.11,spin:stage?'prop':'carrier1'});
  }
  put('propeller',cylinder(.16,1.13,'#c1c6c8'),{x:-4.06,spin:'prop',shaft:true});
  const hub=new MeshData().append(cylinder(.285,.35,'#8f9da0'));hub.append(lathe([[-.5,0],[-.45,.12],[-.30,.25],[-.12,.34],[.17,.33]],'#c6cdcc',64));hub.append(boltRing(.272,12),{x:.19});put('propeller',hub,{spin:'prop'});
  for(let k=0;k<4;k++){
    const b=blade({root:.29,tip:2.20,chord:.31,twist:.5,sweep:.23,color:'#c4ced0',spans:18,sides:18,prop:true});
    put('propeller',b,{spin:'prop',propBlade:k});
  }
  // Rear accessory casing and a schematic starter-generator.
  const agb=lathe([[-.22,.47],[-.22,.65],[-.11,.77],[.23,.74],[.27,.32]],'#58717a');agb.append(boltRing(.68,16),{x:.22});agb.append(cylinder(.24,.65,'#809399'),{x:.57,y:-.38,z:.25});agb.append(cylinder(.17,.46,'#a3a98e'),{x:.49,y:.39,z:-.3});agb.append(box(.33,.3,.27,'#7a939b'),{x:.30,y:.38,z:.29});put('accessories',agb);
  // External plumbing and mounts provide visual context without hiding internals.
  const tubes=new MeshData();
  for(const a of [2.65,3.65]){
    const pts=[[5.4,-.55,Math.cos(a)*.53],[4.65,-.90,Math.cos(a)*.8],[2.75,-1.08,Math.cos(a)*.91],[1.7,-1.15,Math.cos(a)*.86],[.10,-1.09,Math.cos(a)*.78]];tubes.append(tube(pts,.027,'#a19b82',8));
  }
  put('plumbing',tubes,{x:0,external:true});
  return parts;
}

export class EngineScene {
  constructor(renderer){
    this.renderer=renderer;this.parts=buildEngine().map(p=>{const mesh=renderer.upload(p.data);return{...p,data:null,mesh};});
    this.gasAngle=0;this.freeAngle=0;this.propAngle=0;this.carrierAngle=0;this.clock=0;this.explode=0;this.particles=new Float32Array(8000*8);this.particleCount=0;this.view='cutaway';
    const grid=new MeshData();for(let x=-9;x<=9;x+=1)grid.append(box(.008,.008,8,'#27363e'),{x,y:-2.32});for(let z=-4;z<=4;z+=1)grid.append(box(18,.008,.008,'#27363e'),{y:-2.32,z});this.grid=renderer.upload(grid);
    const arrow=new MeshData();arrow.append(cylinder(.023,2.0,'#a9d9d2',16),{x:-.9});arrow.append(lathe([[-.38,0],[0,.16],[0,0]],'#a9d9d2',20),{x:-1.98});this.arrow=renderer.upload(arrow);
  }
  addParticle(x,y,z,c,alpha,size){const i=this.particleCount++*8;this.particles[i]=x;this.particles[i+1]=y;this.particles[i+2]=z;this.particles[i+3]=c[0];this.particles[i+4]=c[1];this.particles[i+5]=c[2];this.particles[i+6]=alpha;this.particles[i+7]=size;}
  animate(dt,sim,settings){
    const d=dt*settings.speed;this.clock+=d;this.gasAngle=(this.gasAngle-d*(sim.ng/100)*1.8)%TAU;this.freeAngle=(this.freeAngle+d*(sim.np/1700)*1.9)%TAU;this.carrierAngle=(this.carrierAngle+d*(sim.np/1700)*1.9/5.78)%TAU;this.propAngle=(this.propAngle+d*(sim.np/1700)*1.9/17.58)%TAU;
    this.explode+=(settings.explode-this.explode)*(1-Math.exp(-dt*6));
  }
  draw(sim,s){
    const r=this.renderer,selected=s.selected;
    r.draw(this.grid,matrix(),{alpha:.6});
    const opaque=[],transparent=[];
    for(const p of this.parts){
      if(s.isolate&&selected&&p.id!==selected&&!p.shaft)continue;
      if(s.isolate&&selected&&p.shaft&&!(selected==='compressorTurbine'&&p.id==='gasShaft'||selected==='gearbox'&&p.id==='freeShaft'||selected==='propeller'&&p.id==='propeller'))continue;
      if(p.external&&this.explode>.06)continue;
      if(p.external&&s.isolate)continue;
      let x=p.x+explodedX(p.id,this.explode)||p.x;let y=0,z=0,rx=0,ry=0,rz=0;
      const angle=p.spin==='gas'?this.gasAngle:p.spin==='free'?this.freeAngle:p.spin==='carrier1'?this.carrierAngle:p.spin==='prop'?this.propAngle:0;rx=angle;
      if(p.planet){const q=p.planet,carrier=q.stage?this.propAngle:this.carrierAngle,sun=q.stage?this.carrierAngle:this.freeAngle,a=q.index*TAU/q.count+carrier;y=q.center*Math.cos(a);z=q.center*Math.sin(a);rx=carrier-(sun-carrier)*q.sunR/q.planetR;}
      let model=matrix({x,y,z,rx});
      if(p.propBlade!==undefined){const a=this.propAngle+p.propBlade*TAU/4;model=matrix({x});const pitch=(sim.pitch-30)*Math.PI/180;model=multiplyLocal(model,multiplyLocal(matrix({rx:a}),matrix({ry:pitch})));}
      let alpha=1,clip=false,emissive=0;
      if(p.shell||p.liner){
        clip=s.view==='cutaway';
        if(s.view==='xray')alpha=p.liner?.14:.09;
        if(s.isolate&&selected==='combustor'&&p.shell)alpha=.07;
      }
      if(s.shafts&&!p.shaft&&p.id!=='gearbox')alpha=Math.min(alpha,.22);
      if(p.shaft&&s.shafts)emissive=.7;
      if(p.shaft&&this.explode>.1&&p.id!=='propeller')alpha=.3;
      const sel=selected===p.id?1:0,highlight=rgb(stages.find(q=>q.id===p.id)?.color||'#b9a4df');
      const data={p,model,opts:{alpha,clip,cut:0.11,selected:sel*.55,highlight,emissive}};
      (alpha<1?transparent:opaque).push(data);
    }
    for(const q of opaque)r.draw(q.p.mesh,q.model,q.opts);
    transparent.sort((a,b)=>Math.abs(b.p.x-r.eye[0])-Math.abs(a.p.x-r.eye[0]));for(const q of transparent)r.draw(q.p.mesh,q.model,q.opts);
    if(selected==='propeller'){
      const reverse=sim.propMode==='reverse',x=-4.55+explodedX('propeller',this.explode);r.draw(this.arrow,matrix({x,y:2.5,ry:reverse?Math.PI:0}),{emissive:.5});
    }
    this.drawFlows(sim,s);
  }
  drawFlows(sim,s){
    this.particleCount=0;const t=this.clock,flow=Math.max(0,sim.ng/100),mode=s.combustionMode,comb=s.selected==='combustor',prop=s.selected==='propeller',e=this.explode;
    const allowCore=!s.isolate||!s.selected||s.selected==='combustor';
    // An assembled gas path is meaningful only while assemblies remain together.
    if(s.airflow&&flow>.015&&e<.08&&allowCore&&s.view!=='solid'&&!s.shafts){
      for(let i=0;i<850;i++){
        const u=(i/850+t*.070*flow)%1,[x,rad,heat]=pathPoint(u),a=i*2.39996;
        if(comb&&(x>2.1||x<-.9))continue;
        if(heat>.1&&sim.flame<.03&&s.selected!=='combustor')continue;
        const col=heat>1?[.91,.49,.24]:heat>.1?[1,.64,.22]:u>.22?[.73,.84,.37]:[.31,.78,.94];
        // Twin exhaust branches, downstream of the collector.
        const aa=u>.92?(i%2?1.57:4.71):a;const rr=rad+(Math.sin(i*31.42)*.035);
        this.addParticle(x,rr*Math.cos(aa),rr*Math.sin(aa),col,.63,3.8);
      }
    }
    if((!s.isolate||comb)&&!s.shafts&&s.view!=='solid'&&sim.flame>.003){
      const x0=explodedX('combustor',e),intensity=sim.flame;
      let ignite=1;
      if(comb&&mode==='ignition'){const cycle=t%6;ignite=clamp((cycle-.6)/2,0,1);}
      if(!comb||mode==='flame'||mode==='ignition'||mode==='path'){
        for(let i=0;i<650;i++){
          const nozzle=i%14,a=nozzle*TAU/14,age=(i*.618033+t*(.28+.22*flow))%1;
          if(comb&&mode==='ignition'&&nozzle/14>ignite+.05)continue;
          const length=(.40+.8*intensity)*Math.max(.1,ignite),x=x0-.12+age*length;
          const spread=.025+.08*age,swirl=a+.06*Math.sin(age*12+t*2+i);
          const rad=.84+Math.sin(i*17.21+t*3)*spread;
          const col=age<.17?[.23,.57,1]:age<.45?[1,.76,.34]:[1,.32+.25*(1-age),.09];
          this.addParticle(x,rad*Math.cos(swirl),rad*Math.sin(swirl),col,(1-age)*.50*intensity*(comb?1.4:1),comb?12:8);
        }
        if(comb&&mode==='ignition'&&t%6<1.4){for(let i=0;i<32;i++){const a=.75,rad=.84+i*.002;this.addParticle(-.12+x0+.06*Math.sin(i),rad*Math.cos(a),rad*Math.sin(a),[.5,.78,1],.8,8);}}
      }
      if(comb&&mode==='spray'){
        for(let i=0;i<750;i++){const a=i%14*TAU/14,age=(i*.41421+t*.8)%1,l=.75*age,phase=i*2.4,spread=.12*age;const yy=.84*Math.cos(a)+Math.cos(phase)*spread,zz=.84*Math.sin(a)+Math.sin(phase)*spread;this.addParticle(-.12+x0+l,yy,zz,[.55,.78,1],(1-age)*.9,4);}
      }
      if(comb&&mode==='mixing'){
        for(let i=0;i<650;i++){const a=i%14*TAU/14,p=(i*.381966+t*.28)%1*TAU;const x=.36+x0+.35*Math.cos(p),rad=.84+.09*Math.sin(p),swirl=a+.10*Math.cos(p);this.addParticle(x,rad*Math.cos(swirl),rad*Math.sin(swirl),i%3?[1,.64,.24]:[.30,.71,.97],.8,4.5);}
      }
      if(comb&&mode==='cooling'){
        for(let i=0;i<750;i++){const a=i*2.39996,age=(i*.41421+t*.30)%1,x=-.01+x0+age*1.2,rad=i%2?.975-.1*age:.706+.06*age;this.addParticle(x,rad*Math.cos(a),rad*Math.sin(a),[.29,.78,.99],.8,5);}
      }
    }
    if(prop&&s.airflow&&sim.np>30){
      const reverse=sim.propMode==='reverse',feather=sim.propMode==='feather';
      for(let i=0;i<700;i++){
        const u=(i/700+t*.17*(sim.np/1700))%1,x0=-4.65+explodedX('propeller',e),r0=.45+((i*23.717)%1)*1.72;
        const x=reverse?x0+2.3-u*6:x0-2.3+u*6,rad=r0*(1-.2*u),a=i*2.39996+u*(feather?.05:.4);
        this.addParticle(x,rad*Math.cos(a),rad*Math.sin(a),[.36,.80,.84],(feather?.12:.58)*Math.sin(Math.PI*u),4.0);
      }
    }
    this.renderer.drawParticles(this.particles,this.particleCount);
  }
}

function multiplyLocal(a,b){const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
