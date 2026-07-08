// Plain-JS version of RuntimeEngine, embedded verbatim into exported HTML.
// Kept in sync with engine.ts / gradientMath.ts. No imports, no TS — runs standalone in OBS.
export const RUNTIME_ENGINE_SRC = String.raw`
function samplePath(path, segments){
  segments = segments || 48;
  var pts = path.points;
  if (pts.length < 2) return pts.map(function(p){return {x:p.x,y:p.y};});
  var out = [];
  var list = path.closed ? pts.concat([pts[0]]) : pts;
  if((path.mode || 'curve') === 'angle') {
    for (var li=0;li<list.length-1;li++){
      var a=list[li], b=list[li+1];
      for (var ls=0;ls<segments;ls++){
        var lt=ls/segments;
        out.push({x:a.x+(b.x-a.x)*lt,y:a.y+(b.y-a.y)*lt});
      }
    }
    var ll=list[list.length-1]; out.push({x:ll.x,y:ll.y});
    return out;
  }
  for (var i=0;i<list.length-1;i++){
    var p0=list[i], p1=list[i+1];
    var c0={x:p0.x+p0.hOut.x,y:p0.y+p0.hOut.y};
    var c1={x:p1.x+p1.hIn.x,y:p1.y+p1.hIn.y};
    for (var s=0;s<segments;s++){
      var t=s/segments, mt=1-t;
      var x=mt*mt*mt*p0.x+3*mt*mt*t*c0.x+3*mt*t*t*c1.x+t*t*t*p1.x;
      var y=mt*mt*mt*p0.y+3*mt*mt*t*c0.y+3*mt*t*t*c1.y+t*t*t*p1.y;
      out.push({x:x,y:y});
    }
  }
  var last=list[list.length-1]; out.push({x:last.x,y:last.y});
  return out;
}
function pointInZone(x,y,z){
  if(z.shape==='rect') return x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h;
  if(z.shape==='ellipse'){
    var cx=z.x+z.w/2, cy=z.y+z.h/2, rx=z.w/2, ry=z.h/2;
    if(rx===0||ry===0) return false;
    var dx=(x-cx)/rx, dy=(y-cy)/ry; return dx*dx+dy*dy<=1;
  }
  if(z.shape==='triangle'){
    var t1={x:z.x+z.w/2,y:z.y}, t2={x:z.x,y:z.y+z.h}, t3={x:z.x+z.w,y:z.y+z.h};
    var sign=function(a,b,c){return (a.x-c.x)*(b.y-c.y)-(b.x-c.x)*(a.y-c.y);};
    var pt={x:x,y:y}; var d1=sign(pt,t1,t2), d2=sign(pt,t2,t3), d3=sign(pt,t3,t1);
    var hasNeg=(d1<0||d2<0||d3<0), hasPos=(d1>0||d2>0||d3>0);
    return !(hasNeg&&hasPos);
  }
  var p=z.points, inside=false;
  for(var i=0,j=p.length-1;i<p.length;j=i++){
    if((p[i].y>y)!==(p[j].y>y)&&x<((p[j].x-p[i].x)*(y-p[i].y)/(p[j].y-p[i].y)+p[i].x)) inside=!inside;
  }
  return inside;
}
function allowedByZones(x,y,zones,inc,exc){
  if(inc&&inc.length){
    var incZ=zones.filter(function(z){return inc.indexOf(z.id)>=0;});
    if(incZ.length && !incZ.some(function(z){return pointInZone(x,y,z);})) return false;
  }
  if(exc&&exc.length){
    var excZ=zones.filter(function(z){return exc.indexOf(z.id)>=0;});
    if(excZ.some(function(z){return pointInZone(x,y,z);})) return false;
  }
  return true;
}

// ===== Gradient color helpers (mirrors src/gradientMath.ts) =====
function _parseColor(input){
  if(!input) return [0,0,0];
  if(input.indexOf('rgb')===0){
    var nums=(input.match(/[\d.]+/g)||[0,0,0]).map(Number);
    return [nums[0]||0, nums[1]||0, nums[2]||0];
  }
  var h=input.replace('#',''); if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');
  var n=parseInt(h||'000000',16); return [(n>>16)&255,(n>>8)&255,n&255];
}
function _rgbToHex(rgb){
  var to=function(v){return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');};
  return '#'+to(rgb[0])+to(rgb[1])+to(rgb[2]);
}
function _lerpColor(a,b,t){
  var pa=_parseColor(a),pb=_parseColor(b);
  return 'rgb('+Math.round(pa[0]+(pb[0]-pa[0])*t)+','+Math.round(pa[1]+(pb[1]-pa[1])*t)+','+Math.round(pa[2]+(pb[2]-pa[2])*t)+')';
}
function _sampleGradient(stops,t){
  if(!stops||!stops.length)return '#fff';
  var s=stops.slice().sort(function(a,b){return a.offset-b.offset;});
  var tt=((t%1)+1)%1;
  if(tt<=s[0].offset)return s[0].color;
  if(tt>=s[s.length-1].offset)return s[s.length-1].color;
  for(var i=0;i<s.length-1;i++){
    if(tt>=s[i].offset&&tt<=s[i+1].offset){
      var loc=(tt-s[i].offset)/Math.max(0.0001,s[i+1].offset-s[i].offset);
      return _lerpColor(s[i].color,s[i+1].color,loc);
    }
  }
  return s[0].color;
}
function _shiftHue(hex,deg){
  if(!deg) return hex;
  var rgb=_parseColor(hex); var r=rgb[0]/255,g=rgb[1]/255,b=rgb[2]/255;
  var max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s,l=(max+min)/2,d=max-min;
  if(d===0)s=0;else s=d/(1-Math.abs(2*l-1));
  if(d!==0){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}
  h=(h+deg)%360;if(h<0)h+=360;
  var c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(((h/60)%2)-1)),m=l-c/2,rr=0,gg=0,bb=0;
  if(h<60){rr=c;gg=x;}else if(h<120){rr=x;gg=c;}else if(h<180){gg=c;bb=x;}else if(h<240){gg=x;bb=c;}else if(h<300){rr=x;bb=c;}else{rr=c;bb=x;}
  return _rgbToHex([(rr+m)*255,(gg+m)*255,(bb+m)*255]);
}
function _computeGradAnim(g, elapsedSec){
  if(!g.animate) return {angle:g.angle, hueShift:0, panPercent:0, sampleShift:0};
  var speed=Math.max(0.1, g.speed||20);
  var cycle=(elapsedSec/speed)%1;
  var animType=g.animType||(g.type==='linear'?'rotation':'hue');
  if(animType==='rotation') return {angle:(g.angle+cycle*360)%360, hueShift:0, panPercent:0, sampleShift:cycle};
  if(animType==='panning') return {angle:g.angle, hueShift:0, panPercent:cycle*100, sampleShift:cycle};
  if(animType==='hue') return {angle:g.angle, hueShift:cycle*360, panPercent:0, sampleShift:0};
  return {angle:g.angle, hueShift:0, panPercent:0, sampleShift:0};
}
function _gradientCss(type, angle, stops, hueShift){
  var sorted=stops.slice().sort(function(a,b){return a.offset-b.offset;});
  var stopStr=sorted.map(function(s){return (hueShift?_shiftHue(s.color,hueShift):s.color)+' '+(s.offset*100).toFixed(1)+'%';}).join(', ');
  if(type==='radial') return 'radial-gradient(circle, '+stopStr+')';
  if(type==='conic') return 'conic-gradient(from '+angle+'deg, '+stopStr+')';
  return 'linear-gradient('+angle+'deg, '+stopStr+')';
}
function _oneShotTransform(anim,progress,entering){
  var t=Math.max(0,Math.min(1,progress)), e=entering?t:1-t, inv=1-e;
  if(!anim||anim==='none')return {transform:'',opacity:1};
  if(anim==='fade')return {transform:'',opacity:e};
  if(anim==='scale')return {transform:'scale('+(0.2+e*0.8)+')',opacity:e};
  if(anim==='pop')return {transform:'scale('+(e<0.7?0.4+e*1.05:1.12-(e-0.7)*0.4)+')',opacity:e};
  if(anim==='spin')return {transform:'rotate('+(inv*(entering?-180:180))+'deg) scale('+(0.5+e*0.5)+')',opacity:e};
  var d=inv*80;
  if(anim==='slide-up')return {transform:'translateY('+d+'px)',opacity:e};
  if(anim==='slide-down')return {transform:'translateY('+(-d)+'px)',opacity:e};
  if(anim==='slide-left')return {transform:'translateX('+d+'px)',opacity:e};
  if(anim==='slide-right')return {transform:'translateX('+(-d)+'px)',opacity:e};
  return {transform:'',opacity:1};
}
function _ease01(x,easing){
  x=Math.max(0,Math.min(1,x));
  if(easing==='ease-in')return x*x; if(easing==='ease-out')return 1-(1-x)*(1-x);
  if(easing==='ease-in-out')return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
  if(easing==='smoothstep')return x*x*(3-2*x); if(easing==='sine')return -(Math.cos(Math.PI*x)-1)/2;
  if(easing==='bounce'){var n1=7.5625,d1=2.75;if(x<1/d1)return n1*x*x;if(x<2/d1){var y=x-1.5/d1;return n1*y*y+0.75;}if(x<2.5/d1){var y2=x-2.25/d1;return n1*y2*y2+0.9375;}var y3=x-2.625/d1;return n1*y3*y3+0.984375;}
  return x;
}
function _behaviorTransform(anim,t,speed,baseRot,baseSX,baseSY){
  var transform='rotate('+baseRot+'deg) scale('+baseSX+','+baseSY+') ';
  var filter=null; if(!anim||anim==='none')return {transform:transform};
  var p=t*speed;
  switch(anim){
    case 'pendulum': transform+='rotate('+(Math.sin(p*4)*15)+'deg)'; break;
    case 'rotation': transform+='rotate('+((p*360)%360)+'deg)'; break;
    case 'float': transform+='translateY('+(Math.sin(p*3)*20)+'px)'; break;
    case 'pulse': transform+='scale('+(1+Math.sin(p*4)*0.15)+')'; break;
    case 'bounce': transform+='translateY('+(Math.abs(Math.sin(p*5))*-35)+'px)'; break;
    case 'shake': transform+='translate('+((Math.random()-0.5)*10)+'px,'+((Math.random()-0.5)*10)+'px)'; break;
    case 'wiggle': transform+='translateX('+(Math.sin(p*10)*12)+'px)'; break;
    case 'skew': transform+='skewX('+(Math.sin(p*3)*12)+'deg)'; break;
    case 'blur': filter='blur('+Math.max(0,Math.sin(p*2)*8)+'px)'; break;
    case 'heartbeat': var beat=Math.pow(Math.abs(Math.sin(p*5)),8); transform+='scale('+(1+beat*0.25)+')'; break;
    case 'sway': transform+='rotate('+(Math.sin(p*2)*8)+'deg) translateX('+(Math.sin(p*2)*8)+'px)'; break;
    case 'jelly': transform+='scale('+(1+Math.sin(p*5)*0.12)+','+(1-Math.sin(p*5)*0.1)+')'; break;
    case 'breathe': transform+='scale('+(1+(Math.sin(p*2)*0.5+0.5)*0.12)+')'; break;
    case 'drift': transform+='translate('+(Math.sin(p*1.3)*24)+'px,'+(Math.cos(p*1.1)*18)+'px)'; break;
    case 'glitch': transform+='translate('+(Math.sin(p*41)*6)+'px,'+(Math.cos(p*37)*3)+'px) skewX('+(Math.sin(p*29)*8)+'deg)'; filter='hue-rotate('+(Math.sin(p*13)*25)+'deg)'; break;
    case 'orbit': transform+='translate('+(Math.cos(p*2)*18)+'px,'+(Math.sin(p*2)*18)+'px)'; break;
    case 'tada': transform+='rotate('+(Math.sin(p*10)*10)+'deg) scale('+(1+Math.abs(Math.sin(p*5))*0.12)+')'; break;
  }
  return {transform:transform,filter:filter};
}

function RuntimeEngine(root, data, opts){
  this.root=root; this.data=data; this.opts=opts||{};
  this.mediaMap={}; for(var i=0;i<data.media.length;i++) this.mediaMap[data.media[i].id]=data.media[i].dataUrl;
  this.layerEls={}; this.activeEvents=[]; this.groupTimers={}; this.particleState={};
  this.imgCache={}; this.dirState={}; this.bgRotEls=[]; this.bgRotIndex=0; this.running=false; this.lastTs=0;
  this.startTime=0; this.audioLevel=0;
  this.spawnCounts={}; this.mediaTimers={}; this.mediaNextSpawnAt={}; this.mediaInterval={};
  this.timeScaleValue=Math.max(0.1, this.opts.timeScale || (this.opts.simulateFast ? 10 : 1)); this.realBaseTime=0; this.simBaseTime=0;
  this.build();
}
RuntimeEngine.prototype.timeScale=function(){ return this.timeScaleValue; };
RuntimeEngine.prototype.scaledNow=function(now){ now = now || performance.now(); return this.startTime ? this.simBaseTime + (now - this.realBaseTime) * this.timeScale() : now; };
RuntimeEngine.prototype.scaledDate=function(now){ now = now || performance.now(); return new Date(Date.now() + (this.scaledNow(now) - now)); };
RuntimeEngine.prototype.setTimeScale=function(scale){
  var next=Math.max(0.1, scale || 1); var now=performance.now();
  this.simBaseTime=this.scaledNow(now); this.realBaseTime=now; this.timeScaleValue=next; this.opts.timeScale=next;
  if(this.running){ clearInterval(this.bgRotTimer); this.startBgRotation(); }
};
RuntimeEngine.prototype.elapsedSec=function(){
  if(!this.startTime) return 0;
  return (this.scaledNow()-this.startTime)/1000;
};
RuntimeEngine.prototype.build=function(){
  var d=this.data, root=this.root, self=this;
  root.innerHTML=''; root.style.position='relative'; root.style.overflow='hidden';
  root.style.width=d.canvasWidth+'px'; root.style.height=d.canvasHeight+'px';
  var studio=d.gradientStudio;
  var useStudioBg=studio&&(studio.mode==='background'||studio.mode==='hybrid')&&studio.gradient.stops.length;
  var bgGrad=useStudioBg?studio.gradient:(d.bgGradient&&d.bgGradient.enabled?d.bgGradient:null);
  if(bgGrad){ this.applyGradientBackground(bgGrad); }
  else { root.style.background=d.bgColor; }
  d.layers.forEach(function(layer,idx){
    var el=document.createElement('div');
    el.style.position='absolute'; el.style.inset='0'; el.style.zIndex=String(idx*10+1); el.style.pointerEvents='none';
    if(!layer.visible) el.style.display='none';
    self.layerEls[layer.id]=el; root.appendChild(el);
  });
  d.assets.forEach(function(a){
    if(!a.visible) return;
    if(a.layerId==='layer-rand') return;
    var layerEl=self.layerEls[a.layerId]||root;
    var el=document.createElement('div');
    el.style.position='absolute'; el.style.left=a.x+'px'; el.style.top=a.y+'px';
    el.style.width=a.width+'px'; el.style.height=a.height+'px'; el.style.opacity=String(a.opacity);
    el.style.zIndex=String(a.zoffset);
    el.style.mixBlendMode=a.blend==='normal'?'normal':(a.blend==='add'?'plus-lighter':a.blend);
    el.style.transformOrigin=((a.refPointX||0.5)*100)+'% '+((a.refPointY||0.5)*100)+'%';
    var sx=a.flipH?-a.scale:a.scale, sy=a.flipV?-a.scale:a.scale;
    if(a.animation && a.animation !== 'none'){
      var tick=function(){
        if(!el.parentNode) return;
        var animState = _behaviorTransform(a.animation, performance.now()/1000, a.animSpeed||1, a.rotation, sx, sy);
        el.style.transform=animState.transform;
        if(animState.filter) el.style.filter=animState.filter;
        if(a.shadow&&a.shadow.enabled){
          var s=a.shadow; var sh='drop-shadow('+s.offsetX+'px '+s.offsetY+'px '+s.blur+'px '+s.color+')';
          el.style.filter=(animState.filter)?(animState.filter+' '+sh):sh;
        }
        requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    } else {
      el.style.transform='rotate('+a.rotation+'deg) scale('+sx+','+sy+')';
      if(a.shadow&&a.shadow.enabled){
        var s2=a.shadow; el.style.filter='drop-shadow('+s2.offsetX+'px '+s2.offsetY+'px '+s2.blur+'px '+s2.color+')';
      }
    }
    var staticMedia=a.mediaId?d.media.find(function(m){return m.id===a.mediaId;}):null;
    if(staticMedia&&staticMedia.type==='lottie'){
      try{
        var isData=staticMedia.dataUrl.indexOf('data:')===0;
        var la;if(isData){ la=lottie.loadAnimation({container:el,renderer:'svg',loop:true,autoplay:true,animationData:JSON.parse(atob(staticMedia.dataUrl.split(',')[1]))}); }
        else { la=lottie.loadAnimation({container:el,renderer:'svg',loop:true,autoplay:true,path:staticMedia.dataUrl}); }
        la.addEventListener('complete',function(){la.goToAndPlay(0,true);}); setInterval(function(){if(el.isConnected&&la.isPaused)la.play();},1000);
      }catch(e){ console.warn('Lottie runtime error',e); }
    } else {
      el.innerHTML=self.assetMarkup(a);
    }
    layerEl.appendChild(el);
  });
  this.particleCanvas=document.createElement('canvas');
  this.particleCanvas.width=d.canvasWidth; this.particleCanvas.height=d.canvasHeight;
  this.particleCanvas.style.position='absolute'; this.particleCanvas.style.inset='0';
  this.particleCanvas.style.pointerEvents='none'; this.particleCanvas.style.zIndex='5000';
  root.appendChild(this.particleCanvas); this.pctx=this.particleCanvas.getContext('2d');
  this.initParticles();
  if(d.bgRotation.enabled&&d.bgRotation.mediaIds.length){
    d.bgRotation.mediaIds.forEach(function(mid,i){
      var el=document.createElement('div'); el.style.position='absolute'; el.style.inset='0'; el.style.zIndex='0';
      el.style.backgroundImage='url('+self.mediaMap[mid]+')'; el.style.backgroundSize='cover'; el.style.backgroundPosition='center';
      el.style.opacity=i===0?'1':'0'; el.style.transition='opacity '+d.bgRotation.crossfadeSec+'s ease';
      root.insertBefore(el,root.firstChild); self.bgRotEls.push(el);
    });
  }
  this.nightEl=document.createElement('div');
  this.nightEl.style.position='absolute'; this.nightEl.style.inset='0'; this.nightEl.style.pointerEvents='none';
  this.nightEl.style.zIndex='9000'; this.nightEl.style.mixBlendMode='multiply';
  this.nightEl.style.background=d.dayNight.nightOverlayColor; this.nightEl.style.opacity='0';
  if(d.dayNight.enabled) root.appendChild(this.nightEl);
};
RuntimeEngine.prototype.applyGradientBackground=function(g){
  this.curBgGrad=g; this.renderBgGradient(g.angle);
  this.root.style.backgroundSize=(g.type==='linear')?'220% 220%':'100% 100%';
  this.root.style.backgroundPosition='0% 50%';
};
RuntimeEngine.prototype.renderBgGradient=function(angle,hueShift){
  var g=this.curBgGrad; if(!g)return;
  this.root.style.background=_gradientCss(g.type, angle, g.stops, hueShift||0);
};
RuntimeEngine.prototype.assetMarkup=function(asset){
  if(asset.shape) {
    var shape = asset.shape; var sw = shape.strokeWidth, fill = shape.fill, stroke = shape.stroke, common = 'vector-effect:non-scaling-stroke;';
    if (shape.kind === 'ellipse') return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="'+(50-sw)+'" ry="'+(50-sw)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" style="'+common+'"/></svg>';
    if (shape.kind === 'triangle') return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><polygon points="50,4 96,96 4,96" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" style="'+common+'"/></svg>';
    if (shape.kind === 'line') return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><line x1="2" y1="50" x2="98" y2="50" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round" style="'+common+'"/></svg>';
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"><rect x="'+sw+'" y="'+sw+'" width="'+(100-sw*2)+'" height="'+(100-sw*2)+'" rx="'+shape.radius+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" style="'+common+'"/></svg>';
  }
  if(!asset.mediaId) return '';
  return this.mediaTag(asset.mediaId, asset.fit || 'contain');
};
RuntimeEngine.prototype.mediaTag=function(mediaId,fit){
  var url=this.mediaMap[mediaId]; if(!url) return '';
  var media=this.data.media.find(function(m){return m.id===mediaId;});
  var objectFit=fit==='auto'?'scale-down':(fit||'contain');
  var style='width:100%;height:100%;object-fit:'+objectFit+';display:block;';
  var safeUrl=String(url).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  if(media&&media.type==='video') return '<video src="'+safeUrl+'" autoplay loop muted playsinline referrerpolicy="no-referrer" style="'+style+'"></video>';
  return '<img src="'+safeUrl+'" style="'+style+'" draggable="false" referrerpolicy="no-referrer"/>';
};
RuntimeEngine.prototype.studioGradient=function(){
  var studio = this.data.gradientStudio;
  if (studio && studio.gradient.stops.length) return studio.gradient;
  return undefined;
};
RuntimeEngine.prototype.initParticles=function(){
  this.particleState={};
  for(var i=0;i<this.data.particles.length;i++){
    var ps=this.data.particles[i]; if(!ps.enabled) continue;
    var arr=[]; var nImgs=ps.customMediaIds.length||1;
    for(var k=0;k<ps.density;k++) arr.push(this.spawnParticle(ps,k%nImgs,true));
    this.particleState[ps.id]=arr;
  }
};
RuntimeEngine.prototype.spawnParticle=function(ps,imgIndex,initial){
  var W=this.data.canvasWidth,H=this.data.canvasHeight;
  var size=ps.size*(1+(Math.random()-0.5)*ps.sizeVariance*2);
  var gp=Math.random(); var x=Math.random()*W; var y=initial?Math.random()*H:-size-Math.random()*100;
  var studioGrad=this.studioGradient(); var color=ps.color;
  if(ps.colorMode!=='solid'&&studioGrad){
    var anim=_computeGradAnim(studioGrad, this.elapsedSec());
    color=_sampleGradient(studioGrad.stops, gp+anim.sampleShift);
    if(anim.hueShift) color=_shiftHue(color, anim.hueShift);
  }
  var vx,vy;
  if(ps.type==='fireflies'){ vx=(Math.random()-0.5)*1.2; vy=(Math.random()-0.5)*1.2; }
  else { vx=ps.windX*(0.5+Math.random())*ps.spread; vy=ps.speed*(0.5+Math.random()*1.5)*(ps.windY||1); }
  return {x:x,y:y,vx:vx,vy:vy,size:Math.max(1,size),rot:Math.random()*Math.PI*2,vr:(Math.random()-0.5)*ps.rotationSpeed,opacity:ps.opacity*(0.6+Math.random()*0.4),imgIndex:imgIndex,gradPos:gp,color:color,phase:Math.random()*Math.PI*2,phaseSpeed:0.5+Math.random()*2};
};
RuntimeEngine.prototype.globalExcludeIds=function(){
  return this.data.zones.filter(function(z){return z.global&&z.kind==='exclude';}).map(function(z){return z.id;});
};
RuntimeEngine.prototype.updateParticles=function(dt){
  var ctx=this.pctx; ctx.clearRect(0,0,this.data.canvasWidth,this.data.canvasHeight);
  var W=this.data.canvasWidth,H=this.data.canvasHeight, self=this;
  var globalExcl=this.globalExcludeIds();
  var studioGrad=this.studioGradient();
  var gradAnim=studioGrad?_computeGradAnim(studioGrad, this.elapsedSec()):null;
  var ar=this.data.audioReactive, level=ar&&ar.enabled?this.audioLevel:0;
  var sens=ar?ar.sensitivity/5:1, sMul=ar&&ar.enabled&&ar.affectSize?1+level*sens*1.5:1;
  var spMul=ar&&ar.enabled&&ar.affectSpeed?1+level*sens*2:1, oMul=ar&&ar.enabled&&ar.affectOpacity?Math.min(1.5,0.5+level*sens*1.5):1;
  for(var i=0;i<this.data.particles.length;i++){
    var ps=this.data.particles[i]; if(!ps.enabled) continue;
    var arr=this.particleState[ps.id]; if(!arr) continue;
    var exclAll=ps.excludeZoneIds.concat(globalExcl);
    var imgs=ps.customMediaIds.map(function(id){return self.getImg(id);});
    for(var j=0;j<arr.length;j++){
      var p=arr[j]; p.phase+=p.phaseSpeed*dt;
      if(ps.type==='fireflies'){
        p.vx+=(Math.random()-0.5)*0.4; p.vy+=(Math.random()-0.5)*0.4; p.vx*=0.98; p.vy*=0.98; p.x+=p.vx; p.y+=p.vy;
        if(p.x<-20)p.x=W+20; if(p.x>W+20)p.x=-20; if(p.y<-20)p.y=H+20; if(p.y>H+20)p.y=-20;
      } else {
        p.x+=p.vx*dt*30*ps.speed*spMul+(Math.random()-0.5)*ps.randomness; p.y+=p.vy*dt*30*spMul; p.rot+=p.vr*dt;
        if(p.y>H+30||p.x<-50||p.x>W+50){ var np=this.spawnParticle(ps,p.imgIndex,false); for(var kk in np) p[kk]=np[kk]; }
      }
      if(ps.colorMode==='global'&&studioGrad&&gradAnim) p.color=_sampleGradient(studioGrad.stops, p.x/W+gradAnim.sampleShift);
      if(!allowedByZones(p.x,p.y,this.data.zones,ps.includeZoneIds,exclAll)) continue;
      var fill=ps.colorMode==='solid'?ps.color:p.color;
      if(ps.colorMode!=='solid'&&studioGrad&&gradAnim){
        if(ps.colorMode==='per-particle'){ fill=gradAnim.hueShift?_shiftHue(p.color,gradAnim.hueShift):p.color; }
        else if(ps.colorMode==='individual'){
          var g=ctx.createLinearGradient(-p.size/2,0,p.size/2,0); var sorted=studioGrad.stops.slice().sort(function(a,b){return a.offset-b.offset;});
          sorted.forEach(function(s){g.addColorStop(s.offset, gradAnim.hueShift?_shiftHue(s.color,gradAnim.hueShift):s.color);}); fill=g;
        }
      }
      var dSize=p.size*sMul;
      ctx.save(); ctx.globalAlpha=Math.min(1,p.opacity*oMul); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      var img=imgs[p.imgIndex];
      if(img&&img.complete&&img.naturalWidth){
        if(ps.colorMode!=='solid'){ ctx.save(); ctx.drawImage(img,-dSize/2,-dSize/2,dSize,dSize); ctx.globalCompositeOperation='source-in'; ctx.fillStyle=fill; ctx.fillRect(-dSize/2,-dSize/2,dSize,dSize); ctx.restore(); }
        else { ctx.drawImage(img,-dSize/2,-dSize/2,dSize,dSize); }
      } else { this.drawBuiltinParticle(ctx,ps.type,dSize,fill,p); }
      ctx.restore();
    }
  }
};
RuntimeEngine.prototype.drawBuiltinParticle=function(ctx,type,size,color,p){
  var isSolid=(typeof color==='string');
  if(type==='fireflies'&&p){
    var alpha=(Math.sin(p.phase)*0.5+0.5)*0.8+0.2; ctx.globalAlpha*=alpha;
    var g=ctx.createRadialGradient(0,0,0,0,0,size/2); g.addColorStop(0,isSolid?color:'#fff'); g.addColorStop(0.4,isSolid?color:'#fff'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill(); return;
  }
  if(type==='bokeh'){
    ctx.globalAlpha*=0.25; var g=ctx.createRadialGradient(0,0,0,0,0,size/2); g.addColorStop(0,isSolid?color:'#fff'); g.addColorStop(0.8,isSolid?color:'#fff'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill(); return;
  }
  if(type==='rain'){ ctx.strokeStyle=color; ctx.lineWidth=Math.max(1,size/5); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,-size); ctx.lineTo(0,size); ctx.stroke(); }
  else if(type==='snow'||type==='dust'){
    if(isSolid){ var g=ctx.createRadialGradient(0,0,0,0,0,size/2); g.addColorStop(0,color); g.addColorStop(0.6,color); g.addColorStop(1,'transparent'); ctx.fillStyle=g; }
    ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill();
  } else if(type==='sparkle'){
    if(isSolid){ var g5=ctx.createRadialGradient(0,0,0,0,0,size/2); g5.addColorStop(0,color); g5.addColorStop(1,'transparent'); ctx.fillStyle=g5; }
    ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill(); ctx.fillStyle=color; ctx.beginPath();
    for(var i=0;i<4;i++){var a=i*Math.PI/2;ctx.lineTo(Math.cos(a)*size*0.6,Math.sin(a)*size*0.6);ctx.lineTo(Math.cos(a+Math.PI/4)*size*0.12,Math.sin(a+Math.PI/4)*size*0.12);}
    ctx.closePath(); ctx.fill();
  } else if(type==='leaves'){ ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(0,0,size/2,size/4,0,0,Math.PI*2); ctx.fill(); }
  else if(type==='fog'){
    if(isSolid){ var g2=ctx.createRadialGradient(0,0,0,0,0,size); g2.addColorStop(0,color); g2.addColorStop(0.5,color); g2.addColorStop(1,'transparent'); ctx.fillStyle=g2; }
    ctx.globalAlpha*=0.5; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill();
  } else { ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill(); }
};
RuntimeEngine.prototype.getImg=function(mediaId){
  if(this.imgCache[mediaId]) return this.imgCache[mediaId];
  var url=this.mediaMap[mediaId]; if(!url) return undefined;
  var img=new Image(); img.referrerPolicy='no-referrer'; img.src=url; this.imgCache[mediaId]=img; return img;
};
RuntimeEngine.prototype.scheduleGroups=function(){
  var now=this.scaledNow();
  for(var j=0;j<this.data.media.length;j++){
    var m=this.data.media[j];
    if(m.inLibrary && m.schedule && m.schedule.enabled !== false && m.schedule.hourlyLimit > 0){
      var hasCanvasTemplate = false;
      for(var k=0;k<this.data.assets.length;k++){
        if(this.data.assets[k].mediaId === m.id){ hasCanvasTemplate = true; break; }
      }
      if(hasCanvasTemplate){
        var perHour=Math.max(0.01, m.schedule.hourlyLimit);
        var interval=(3600/perHour)*1000;
        this.mediaInterval[m.id]=interval;
        this.mediaNextSpawnAt[m.id]=now+500+Math.random()*1000;
      }
    }
  }
};
RuntimeEngine.prototype.checkMediaSpawns=function(now){
  var scaledNow=this.scaledNow(now);
  for(var mediaId in this.mediaNextSpawnAt){
    if(scaledNow >= this.mediaNextSpawnAt[mediaId]){
      var m=this.data.media.find(function(x){return x.id===mediaId;});
      if(m && this.mediaAllowedNow(m)){
        this.triggerMedia(mediaId);
      }
      var interval=this.mediaInterval[mediaId]||4000;
      this.mediaNextSpawnAt[mediaId]=scaledNow+interval;
    }
  }
};
RuntimeEngine.prototype.mediaAllowedNow=function(m){
  var s=m.schedule; if(s && s.enabled === false) return false;
  var now=this.scaledDate(); var today=now.toISOString().slice(0,10);
  if(s.dateStart&&today<s.dateStart) return false; if(s.dateEnd&&today>s.dateEnd) return false;
  var h=now.getHours()+now.getMinutes()/60;
  if(s.hourStart<=s.hourEnd){if(h<s.hourStart||h>s.hourEnd)return false;}else{if(h<s.hourStart&&h>s.hourEnd)return false;}
  return this.mediaWithinLimits(m);
};
RuntimeEngine.prototype.mediaWithinLimits=function(m){
  var s=m.schedule; var now=this.scaledDate(); var h=now.getHours(); var d=now.getDate();
  var week=Math.floor(now.getTime()/(7*24*3600*1000));
  var state=this.spawnCounts[m.id]; if(!state) return true;
  if(state.lastHour!==h){state.hour=0;state.lastHour=h;} if(state.lastDay!==d){state.day=0;state.lastDay=d;} if(state.lastWeek!==week){state.week=0;state.lastWeek=week;}
  if(s.hourlyLimit&&state.hour>=s.hourlyLimit) return false;
  if(s.dailyLimit&&state.day>=s.dailyLimit) return false;
  if(s.weeklyLimit&&state.week>=s.weeklyLimit) return false;
  return true;
};
RuntimeEngine.prototype.triggerMedia=function(mediaId){
  var self=this; var media=this.data.media.find(function(x){return x.id===mediaId;}); if(!media) return;
  var state=this.spawnCounts[media.id]||(this.spawnCounts[media.id]={total:0,hour:0,day:0,week:0,lastHour:-1,lastDay:-1,lastWeek:-1});
  state.total++;state.hour++;state.day++;state.week++;
  var cat=(this.data.categories||[]).find(function(c){return c.id===media.categoryId;});
  var path=cat&&cat.pathId?this.data.paths.find(function(p){return p.id===cat.pathId;}):null;
  
  if(media.schedule.spawnMode==='path' && (!path || !path.points || path.points.length<2)) return;

  var poly;
  var ltr=true;
  if(cat&&cat.direction==='rtl') ltr=false;
  else if(cat&&cat.direction==='random') ltr=Math.random()>0.5;
  
  if(cat&&cat.alternateDirection){
    if(this.dirState[media.id]===undefined) this.dirState[media.id]=ltr;
    else this.dirState[media.id]=!this.dirState[media.id];
    ltr=this.dirState[media.id];
  }

  if(media.schedule.spawnMode==='static'){
    var x=Math.random()*(this.data.canvasWidth-200)+100; var y=Math.random()*(this.data.canvasHeight-200)+100;
    poly=[{x:x,y:y},{x:x,y:y}];
  } else if(path){
    poly=samplePath(path, 48); if(!ltr) poly=poly.slice().reverse();
  } else {
    var fallbackY=this.data.canvasHeight*(0.4+Math.random()*0.4);
    poly=ltr?[{x:-200,y:fallbackY},{x:this.data.canvasWidth+200,y:fallbackY}]:[{x:this.data.canvasWidth+200,y:fallbackY},{x:-200,y:fallbackY}];
  }
  
  if(!poly || poly.length===0) return;

  var templateAsset=this.data.assets.find(function(a){return a.mediaId===mediaId;});
  var w=templateAsset?templateAsset.width:(media.width||200);
  var h=templateAsset?templateAsset.height:(media.height||120);
  var layerEl=this.layerEls[cat&&cat.layerId||'layer-rand']||this.root;
  var el=document.createElement('div'); el.style.position='absolute'; el.style.width=w+'px'; el.style.height=h+'px'; el.style.willChange='transform, opacity, filter';
  el.style.zIndex=String(templateAsset&&templateAsset.zoffset!==undefined?templateAsset.zoffset:100);
  el.style.opacity=String(templateAsset&&templateAsset.opacity!==undefined?templateAsset.opacity:1);
  el.style.mixBlendMode=templateAsset&&templateAsset.blend==='add'?'plus-lighter':((templateAsset&&templateAsset.blend)||'normal');
  if(poly.length>0) el.style.transform='translate('+(poly[0].x-w/2)+'px,'+(poly[0].y-h/2)+'px)';
  if(media.type==='lottie'){
    try{var ad=JSON.parse(atob(media.dataUrl.split(',')[1])); var la2=lottie.loadAnimation({container:el,renderer:'svg',loop:true,autoplay:true,animationData:ad}); la2.addEventListener('complete',function(){la2.goToAndPlay(0,true);}); setInterval(function(){if(el.isConnected&&la2.isPaused)la2.play();},1000);}catch(e){}
  } else if(media.type==='video'){
    var safeUrlV=String(media.dataUrl).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    el.innerHTML='<video src="'+safeUrlV+'" autoplay loop muted playsinline referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:contain"></video>';
  } else {
    var safeUrlI=String(media.dataUrl).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    el.innerHTML='<img src="'+safeUrlI+'" style="width:100%;height:100%;object-fit:contain" draggable="false" referrerpolicy="no-referrer"/>';
  }
  layerEl.appendChild(el);
  
  var travelTime = 10;
  if(media.schedule.spawnMode==='path' && poly.length>1) {
    var pathLength = 0;
    for(var i=0;i<poly.length-1;i++) {
      var dx=poly[i+1].x-poly[i].x; var dy=poly[i+1].y-poly[i].y;
      pathLength += Math.sqrt(dx*dx+dy*dy);
    }
    var speedPxPerSec = ((cat&&cat.speed)?cat.speed:1) * 300;
    travelTime = pathLength / Math.max(1, speedPxPerSec);
  } else {
    travelTime = media.schedule.durationSec||10;
  }
  
  var shouldFlip = cat&&cat.flipOnDirection && !ltr;
  var flipAxis = shouldFlip ? (cat.flipAxis || 'horizontal') : null;
  this.activeEvents.push({el:el,start:this.scaledNow(),duration:travelTime*1000,path:poly,flipAxis:flipAxis,exclIds:[], rotateAlongPath: cat&&cat.rotateAlongPath, easing:path&&path.easing, template:templateAsset?JSON.parse(JSON.stringify(templateAsset)):undefined});
};
RuntimeEngine.prototype.updateEvents=function(now){
  var scaledNow=this.scaledNow(now);
  for(var i=this.activeEvents.length-1;i>=0;i--){
    var rawT=(scaledNow-ev.start)/ev.duration;
    if(rawT>=1){ev.el.remove();this.activeEvents.splice(i,1);continue;}
    var t=_ease01(rawT, ev.easing);
    var seg=t*(ev.path.length-1); var idx=Math.floor(seg); var frac=seg-idx, a=ev.path[idx], b=ev.path[Math.min(idx+1,ev.path.length-1)];
    var x=a.x+(b.x-a.x)*frac, y=a.y+(b.y-a.y)*frac, w=parseFloat(ev.el.style.width), h=parseFloat(ev.el.style.height);
    var tmpl=ev.template;
    var baseSX=tmpl?(tmpl.flipH?-(tmpl.scale||1):(tmpl.scale||1)):1, baseSY=tmpl?(tmpl.flipV?-(tmpl.scale||1):(tmpl.scale||1)):1;
    var behavior=_behaviorTransform(tmpl&&tmpl.animation,(scaledNow-ev.start)/1000,(tmpl&&tmpl.animSpeed)||1,(tmpl&&tmpl.rotation)||0,baseSX,baseSY);
    var oneShot={transform:'',opacity:1};
    var enterDur=((tmpl&&tmpl.entranceDuration)||0.6)*1000, exitDur=((tmpl&&tmpl.exitDuration)||0.6)*1000;
    if(tmpl&&tmpl.entranceAnim&&tmpl.entranceAnim!=='none'&&scaledNow-ev.start<enterDur) oneShot=_oneShotTransform(tmpl.entranceAnim,(scaledNow-ev.start)/enterDur,true);
    if(tmpl&&tmpl.exitAnim&&tmpl.exitAnim!=='none'&&ev.start+ev.duration-scaledNow<exitDur) oneShot=_oneShotTransform(tmpl.exitAnim,1-((ev.start+ev.duration-scaledNow)/exitDur),false);
    var transform='translate('+(x-w/2)+'px,'+(y-h/2)+'px)';
    if(ev.rotateAlongPath){ var angle = Math.atan2(b.y-a.y, b.x-a.x) * 180 / Math.PI; transform += ' rotate('+angle+'deg)'; }
    if(!tmpl){ if(ev.flipAxis==='horizontal') transform+=' scaleX(-1)'; else if(ev.flipAxis==='vertical') transform+=' scaleY(-1)'; else if(ev.flipAxis==='both') transform+=' scale(-1,-1)'; }
    transform+=' '+behavior.transform+' '+oneShot.transform;
    ev.el.style.transform=transform; ev.el.style.opacity=String(((tmpl&&tmpl.opacity!==undefined)?tmpl.opacity:1)*oneShot.opacity);
    var shadow=tmpl&&tmpl.shadow&&tmpl.shadow.enabled?'drop-shadow('+tmpl.shadow.offsetX+'px '+tmpl.shadow.offsetY+'px '+tmpl.shadow.blur+'px '+tmpl.shadow.color+')':'';
    ev.el.style.filter=[shadow,behavior.filter].filter(Boolean).join(' ');
    if(ev.exclIds&&ev.exclIds.length) ev.el.style.visibility=allowedByZones(x,y,this.data.zones,[],ev.exclIds)?'visible':'hidden';
  }
};
RuntimeEngine.prototype.updateDayNight=function(now){
  if(!this.data.dayNight.enabled||!this.nightEl) return;
  var cycle=this.data.dayNight.cycleSec*1000, phase=((now-this.startTime)%cycle)/cycle, dark=(Math.sin((phase-0.25)*Math.PI*2)*0.5+0.5)*this.data.dayNight.maxDarkness;
  this.nightEl.style.opacity=String(dark);
};
RuntimeEngine.prototype.startBgRotation=function(){
  if(!this.data.bgRotation.enabled||this.bgRotEls.length<2) return; var self=this;
  var interval=(this.data.bgRotation.intervalMin*60000)/this.timeScale();
  this.bgRotTimer=setInterval(function(){ self.bgRotEls[self.bgRotIndex].style.opacity='0'; self.bgRotIndex=(self.bgRotIndex+1)%self.bgRotEls.length; self.bgRotEls[self.bgRotIndex].style.opacity='1'; },interval);
};
RuntimeEngine.prototype.loop=function(ts){
  if(!this.running) return;
  try{
    var dt=this.lastTs?Math.min(0.05,(ts-this.lastTs)/1000):0.016; this.lastTs=ts;
    var studio=this.data.gradientStudio, useStudioBg=studio&&(studio.mode==='background'||studio.mode==='hybrid')&&studio.gradient.stops.length;
    var bgG=useStudioBg?studio.gradient:(this.data.bgGradient&&this.data.bgGradient.enabled?this.data.bgGradient:null);
    if(bgG&&bgG.animate){
      var anim=_computeGradAnim(bgG, this.elapsedSec()); var animType=bgG.animType||(bgG.type==='linear'?'rotation':'hue');
      if(animType==='panning') this.root.style.backgroundPosition=anim.panPercent+'% 50%';
      else if(animType==='hue') this.renderBgGradient(bgG.angle, anim.hueShift);
      else this.renderBgGradient(anim.angle);
    }
    if(this.data.audioReactive&&this.data.audioReactive.enabled) this.updateAudio();
    this.updateParticles(dt*this.timeScale()); this.updateEvents(ts); this.updateDayNight(this.scaledNow(ts));
    this.checkMediaSpawns(ts);
  }catch(e){console.error('Runtime loop error',e);}finally{
    var self=this; this.raf=requestAnimationFrame(function(t){self.loop(t);});
  }
};
RuntimeEngine.prototype.updateAudio=function(){
  if(!this.analyser||!this.audioData)return; this.analyser.getByteFrequencyData(this.audioData);
  var sum=0;for(var i=0;i<this.audioData.length;i++)sum+=this.audioData[i];
  var instant=sum/this.audioData.length/255, smoothing=this.data.audioReactive.smoothing||0.7;
  this.audioLevel=this.audioLevel*smoothing+instant*(1-smoothing);
};
RuntimeEngine.prototype.initAudio=function(){
  var self=this;
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){
    self.audioCtx=new (window.AudioContext||window.webkitAudioContext)(); var src=self.audioCtx.createMediaStreamSource(s);
    self.analyser=self.audioCtx.createAnalyser(); self.analyser.fftSize=256; src.connect(self.analyser); self.audioData=new Uint8Array(self.analyser.frequencyBinCount);
  }).catch(function(e){console.warn('Mic denied',e);});
};
RuntimeEngine.prototype.start=function(){
  if(this.running) return; this.running=true; this.startTime=performance.now(); this.realBaseTime=this.startTime; this.simBaseTime=this.startTime; this.lastTs=0;
  var self=this; this.raf=requestAnimationFrame(function(t){self.loop(t);});
  this.scheduleGroups(); this.startBgRotation();
  if(this.data.audioReactive&&this.data.audioReactive.enabled) this.initAudio();
};
RuntimeEngine.prototype.stop=function(){
  this.running=false; cancelAnimationFrame(this.raf);
  if(this.audioCtx)this.audioCtx.close(); clearInterval(this.bgRotTimer);
  this.activeEvents.forEach(function(e){e.el.remove();}); this.activeEvents=[];
  this.mediaNextSpawnAt={}; this.mediaInterval={};
};
RuntimeEngine.prototype.destroy=function(){this.stop();this.root.innerHTML='';};
`;