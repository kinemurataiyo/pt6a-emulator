import {stages,overview,combustionModes} from './content.js';
import {EngineSimulation,clamp} from './simulation.js';
import {Renderer,OrbitCamera} from './renderer.js';
import {EngineScene,explodedX} from './scene.js';

const $=id=>document.getElementById(id);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sim=new EngineSimulation();
const settings={selected:null,view:'cutaway',speed:1,paused:reduced,airflow:true,labels:true,shafts:false,isolate:false,explode:0,combustionMode:'flame',tour:false};
let renderer,camera,engine,lastFrame=0,lastReadout=0,lastLabel=0;
let initializationError=null;

// Stage navigation always remains useful, even on devices without WebGL.
let group='';
for(const s of stages){
  if(s.group!==group){const label=document.createElement('div');label.className='stage-group-label';label.textContent=s.group;$('stage-list').append(label);group=s.group;}
  const button=document.createElement('button');button.className='stage-button';button.dataset.stage=s.id;button.setAttribute('aria-pressed','false');button.innerHTML=`<span class="num">${s.n}</span><span>${s.name}</span><i class="mini-dot" aria-hidden="true"></i>`;button.addEventListener('click',()=>selectStage(s.id));$('stage-list').append(button);
}
document.querySelector('.sidebar-title .small-muted').textContent=stages.length+' assemblies';

function detailSection(title,text){return `<section class="detail-section"><h3>${title}</h3><p>${text}</p></section>`;}
function renderDetail(){
  const s=stages.find(q=>q.id===settings.selected);
  $('detail-index').textContent=s?`${s.n} / ${stages.length}`:'OVERVIEW';
  $('detail-eyebrow').textContent=settings.tour?'GUIDED TOUR':s?s.group:'HOW IT WORKS';
  let html=settings.tour?`<div class="tour-progress"><i style="width:${s?Number(s.n)/stages.length*100:0}%"></i></div>`:'';
  if(!s){
    html+=`<div class="detail-symbol">01—14</div><h2>${overview.title}</h2><p class="detail-lead">${overview.lead}</p><div class="energy-path"><div class="energy-row"><span class="energy-icon">01</span><div><strong>Compress the air</strong><small>Axial stages + centrifugal impeller</small></div></div><div class="energy-row"><span class="energy-icon">02</span><div><strong>Add heat</strong><small>Continuous, reverse-flow combustion</small></div></div><div class="energy-row"><span class="energy-icon">03</span><div><strong>Extract shaft power</strong><small>Separate gas generator and free turbine</small></div></div><div class="energy-row"><span class="energy-icon">04</span><div><strong>Accelerate the slipstream</strong><small>Reduction gearing + propeller</small></div></div></div>`;
    html+=overview.sections.map(([a,b])=>detailSection(a,b)).join('');html+=`<p class="detail-note">${overview.note}</p>`;
  }else{
    html+=`<div class="detail-symbol">${s.symbol}</div><h2>${s.title}</h2><p class="detail-lead">${s.lead}</p><div class="stage-facts">${s.facts.map(([a,b])=>`<div><small>${a}</small><strong>${b}</strong></div>`).join('')}</div>`;
    if(s.id==='combustor')html+=`<section class="detail-section"><h3>INSIDE THE COMBUSTOR</h3><div class="combustion-modes" role="group" aria-label="Combustion animation">${Object.entries(combustionModes).map(([id,m])=>`<button data-combustion="${id}" class="${settings.combustionMode===id?'active':''}" aria-pressed="${settings.combustionMode===id}">${m.name}</button>`).join('')}</div><p class="mode-description" id="mode-description" aria-live="polite">${combustionModes[settings.combustionMode].description}</p></section>`;
    if(s.id==='propeller')html+=`<label class="inline-select">Blade orientation study<select id="prop-mode"><option value="govern">Governed forward thrust</option><option value="feather">Feather · reduced drag</option><option value="reverse">Reverse · ground deceleration</option></select></label>`;
    html+=s.sections.map(([a,b])=>detailSection(a,b)).join('');
    if(s.equation)html+=`<p class="science-equation">${s.equation}</p>`;
    html+=`<p class="detail-note">${s.note}</p><p class="detail-reading">Schematic construction · see Model notes for sources and limitations.</p>`;
  }
  $('detail-content').innerHTML=html;
  const idx=stages.findIndex(q=>q.id===settings.selected),next=stages[idx+1];
  $('previous').disabled=idx<0;
  $('next').innerHTML=next?`${idx<0?'Explore the air inlet':'Next: '+next.short} <span aria-hidden="true">→</span>`:'Back to full engine <span aria-hidden="true">↗</span>';
  document.querySelectorAll('[data-combustion]').forEach(b=>b.addEventListener('click',()=>{
    settings.combustionMode=b.dataset.combustion;
    if(settings.paused)setPaused(false);
    setView('cutaway');settings.shafts=false;syncToggle('power-toggle',false);
    if(engine&&settings.combustionMode==='ignition')engine.clock=0;
    document.querySelectorAll('[data-combustion]').forEach(q=>{q.classList.toggle('active',q.dataset.combustion===settings.combustionMode);q.setAttribute('aria-pressed',String(q.dataset.combustion===settings.combustionMode));});
    $('mode-description').textContent=combustionModes[settings.combustionMode].description;
    if(sim.state==='off'||sim.state==='stopping')sim.restart();
  }));
  const propMode=$('prop-mode');if(propMode){propMode.value=sim.propMode;propMode.addEventListener('change',()=>{sim.propMode=propMode.value;});}
}

function selectStage(id,focus=true){
  if(id!==null&&!stages.some(s=>s.id===id))return;
  settings.selected=id;
  document.querySelectorAll('[data-stage]').forEach(b=>{const active=b.dataset.stage===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('overview').classList.toggle('active',id===null);
  const s=stages.find(q=>q.id===id);
  $('view-eyebrow').textContent=s?`${s.group} / ${s.n}`:'PRATT & WHITNEY CANADA';
  $('view-title').textContent=s?s.name:'The power behind the propeller.';
  $('view-subtitle').textContent=s?(s.id==='combustor'?'Fuel, flame, cooling air, and a folded gas path':s.id==='propeller'?'Follow shaft power into the surrounding air stream':'Select · isolate · orbit around the assembly'):'PT6A–60A · King Air 350 · 1,050 shp rated shaft power';
  if(!id){settings.isolate=false;syncToggle('isolate',false);}
  if(id==='combustor'){setView('cutaway');settings.shafts=false;syncToggle('power-toggle',false);}
  if(id==='propeller'){settings.airflow=true;syncToggle('flow-toggle',true);}
  renderDetail();updateLabelSet();
  if(camera&&focus)focusSelection();
}
function focusSelection(){
  const s=stages.find(q=>q.id===settings.selected),aspect=$('viewport').clientWidth/$('viewport').clientHeight;
  if(!s){camera.focus([.2,0,0],Math.max(14,13/Math.max(.7,aspect))*(1+settings.explode*.45),{yaw:-.22,pitch:.27});return;}
  const x=s.x+explodedX(s.id,settings.explode);
  let distance=s.id==='propeller'?8.5:s.id==='combustor'?6.4:s.id==='gearbox'?4.9:4.6;
  if(aspect<1.1)distance*=1.2;
  camera.focus([x,.02,0],distance,{yaw:s.id==='propeller'?-.65:-.18,pitch:.28});
}
function setView(view){settings.view=view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));}
function syncToggle(id,on){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
function setPaused(on){settings.paused=on;$('pause').textContent=on?'▶':'Ⅱ';$('pause').setAttribute('aria-label',on?'Resume animation':'Pause animation');}
function updateLabelSet(){
  const ids=settings.selected?[settings.selected]:['propeller','gearbox','combustor','impeller','axial1','inlet'];
  $('part-labels').replaceChildren();
  for(const id of ids){const s=stages.find(q=>q.id===id);const b=document.createElement('button');b.className='part-label'+(id===settings.selected?' selected':'');b.dataset.label=id;b.textContent=s.short;b.addEventListener('click',()=>selectStage(id));$('part-labels').append(b);}
}
function positionLabels(){
  if(!renderer||!engine)return;
  $('part-labels').hidden=!settings.labels;
  const used=[];
  for(const b of $('part-labels').children){
    const s=stages.find(q=>q.id===b.dataset.label),pos=renderer.project([s.x+explodedX(s.id,engine.explode),s.radius+.26,0]);
    b.hidden=!pos.visible||settings.isolate&&settings.selected!==s.id;
    if(b.hidden)continue;
    const half=b.offsetWidth/2+4,x=clamp(pos.x,half,renderer.width-half);let y=pos.y-17;
    for(const box of used)if(Math.abs(x-box.x)<half+box.half+5&&Math.abs(y-box.y)<34)y=box.y-37;
    y=Math.max(83,Math.min(renderer.height-95,y));b.style.left=x+'px';b.style.top=y+'px';used.push({x,y,half});
  }
}

$('overview').addEventListener('click',()=>{settings.tour=false;$('tour').classList.remove('tour-active');selectStage(null);});
$('previous').addEventListener('click',()=>{const i=stages.findIndex(s=>s.id===settings.selected);selectStage(i>0?stages[i-1].id:null);});
$('next').addEventListener('click',()=>{const i=stages.findIndex(s=>s.id===settings.selected);if(i+1>=stages.length){settings.tour=false;$('tour').classList.remove('tour-active');}selectStage(stages[i+1]?.id||null);});
$('tour').addEventListener('click',()=>{settings.tour=!settings.tour;$('tour').classList.toggle('tour-active',settings.tour);if(settings.tour){settings.explode=0;$('explode').value='0';settings.isolate=false;syncToggle('isolate',false);selectStage('inlet');}else renderDetail();});
$('shaft-explain').addEventListener('click',()=>{settings.shafts=true;syncToggle('power-toggle',true);selectStage('powerTurbine1',false);camera?.focus([.2,0,0],15,{yaw:-.22,pitch:.28});});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('pause').addEventListener('click',()=>setPaused(!settings.paused));
$('speed').addEventListener('change',()=>settings.speed=Number($('speed').value));
for(const [id,key]of [['flow-toggle','airflow'],['labels-toggle','labels'],['power-toggle','shafts'],['isolate','isolate']])$(id).addEventListener('click',()=>{
  if(key==='isolate'&&!settings.selected)selectStage('combustor');
  settings[key]=!settings[key];syncToggle(id,settings[key]);
  if(key==='isolate'&&settings.isolate&&camera)focusSelection();
});
$('explode').addEventListener('input',()=>{settings.explode=Number($('explode').value);if(camera)focusSelection();$('flow-legend').style.opacity=settings.explode>.08?'.35':'1';});
$('home-camera').addEventListener('click',()=>{if(!camera)return;camera.auto=false;$('auto-orbit').setAttribute('aria-pressed','false');focusSelection();});
$('auto-orbit').addEventListener('click',()=>{if(!camera)return;camera.auto=!camera.auto;$('auto-orbit').setAttribute('aria-pressed',String(camera.auto));});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('viewport').requestFullscreen)await $('viewport').requestFullscreen();}catch{/* Embedded browsers may not allow fullscreen. */}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
$('power').addEventListener('input',()=>{sim.power=Number($('power').value)/100;$('power-output').textContent=Math.round(sim.power*100)+'%';});
$('rpm').addEventListener('input',()=>{sim.governor=Number($('rpm').value);$('rpm-output').textContent=sim.governor.toLocaleString()+' rpm';});
$('start').addEventListener('click',()=>{sim.restart();setPaused(false);});
$('stop').addEventListener('click',()=>{sim.shutdown();setPaused(false);});
$('about').addEventListener('click',()=>{$('about-dialog').showModal();});
$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const rect=$('about-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('about-dialog').close();}});

function readings(){
  const set=(id,value,unit)=>{$(id).replaceChildren(document.createTextNode(value));const small=document.createElement('small');small.textContent=unit;$(id).append(small);};
  set('ng',sim.ng.toFixed(1),'%');set('np',Math.round(sim.np).toLocaleString(),'rpm');set('itt',Math.round(sim.itt).toLocaleString(),'°C');set('shp',Math.round(sim.shaftPower).toLocaleString(),'shp');set('torque',Math.round(sim.torque).toLocaleString(),'N·m');
  for(const [id,val,max]of [['ng',sim.ng,100],['np',sim.np,1700],['itt',sim.itt,800],['shp',sim.shaftPower,1050],['torque',sim.torque,6800]])$(id+'-meter').style.width=clamp(val/max*100,0,100)+'%';
  const state=settings.paused?'PAUSED':sim.state.toUpperCase();if($('engine-state').textContent!==state)$('engine-state').textContent=state;
  const note=settings.explode>.08?'Exploded view · the continuous gas path is hidden while assemblies are separated.':sim.phase;
  if($('sequence-note').textContent!==note)$('sequence-note').textContent=note;
  $('start').disabled=sim.state==='starting';
  document.querySelector('.live-dot').style.background=sim.state==='off'?'#708087':sim.state==='starting'?'#f0ad72':'#9cbca5';
}

function frame(time){
  const dt=Math.min((time-lastFrame)/1000||.016,.05);lastFrame=time;
  if(!settings.paused){sim.tick(dt);engine?.animate(dt,sim,settings);}else if(engine){engine.explode+=(settings.explode-engine.explode)*(1-Math.exp(-dt*6));}
  if(renderer&&camera&&engine&&!renderer.lost){const eye=camera.tick(dt);renderer.begin(eye,camera.target);engine.draw(sim,settings);if(time-lastLabel>90){positionLabels();lastLabel=time;}}
  if(time-lastReadout>140){readings();lastReadout=time;}
  requestAnimationFrame(frame);
}

renderDetail();updateLabelSet();setPaused(reduced);
try{
  renderer=new Renderer($('engine-canvas'));
  camera=new OrbitCamera($('engine-canvas'));
  engine=new EngineScene(renderer);focusSelection();
}catch(error){initializationError=String(error);console.error('Engine renderer:',error);$('render-error').hidden=false;}
readings();requestAnimationFrame(frame);

// A small, read-only state surface also supports accessible inspection and QA.
window.engineLab={getState:()=>({...sim.readout,selected:settings.selected,view:settings.view,paused:settings.paused,combustionMode:settings.combustionMode,explode:settings.explode,rendererReady:!!renderer&&!initializationError,initializationError})};

// Progressive WebMCP support. All tools operate only on this page's local state.
const modelContext=document.modelContext;
if(modelContext&&typeof modelContext.registerTool==='function'){
  const lifecycle=new AbortController();
  const respond=data=>({content:[{type:'text',text:JSON.stringify(data)}]});
  const tools=[
    {name:'inspect_engine_stage',description:'Select a PT6A educational engine stage and focus its 3D view.',annotations:{readOnlyHint:false,untrustedContentHint:false},inputSchema:{type:'object',properties:{stage:{type:'string',enum:['overview',...stages.map(s=>s.id)]}},required:['stage'],additionalProperties:false},execute:async(input)=>{const stage=input?.stage;if(stage!=='overview'&&!stages.some(s=>s.id===stage))return respond({error:'Unknown stage'});selectStage(stage==='overview'?null:stage);return respond(window.engineLab.getState());}},
    {name:'read_engine_simulation',description:'Read the current illustrative engine state and selected view.',annotations:{readOnlyHint:true,untrustedContentHint:false},inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>respond(window.engineLab.getState())}
  ];
  for(const tool of tools){try{void Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.info('Optional page tools unavailable:',error.message));}catch(error){console.info('Optional page tools unavailable:',error.message);}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
