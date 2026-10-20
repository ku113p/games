/*! three.js (c) 2010-2026 three.js authors, MIT License. Full notice: THIRD_PARTY.md next to this build. */
function hn(e,t,n,i){return e+t*i+n*i*i}var My=1831565813;function Bo(e){e.rngState=e.rngState+My|0;let t=e.rngState;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Sr(e){let t=e.boostFactor>0?e.stepMs/e.boostFactor:e.stepMs;return t<e.minBoostedStepMs?Math.min(e.stepMs,e.minBoostedStepMs):t}function Qn(e){return e.boosting?Sr(e):e.stepMs}var Jp=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}];function ko(e,t,n,i){return e>=0&&t>=0&&n>=0&&e<i&&t<i&&n<i}function wy(e,t,n,i){let s=new Set;for(let r of t)s.add(hn(r.x,r.y,r.z,n));for(let r=-i;r<=i;r++)for(let o=-i;o<=i;o++)for(let a=-i;a<=i;a++){let l=e.x+r,d=e.y+o,c=e.z+a;if(!ko(l,d,c,n))continue;s.add(hn(l,d,c,n))}return s}function Ey(e,t,n){let i=e*e*e,s=new Uint8Array(i),r=[];for(let a of n)if(!t.has(a)&&!s[a])s[a]=1,r.push(a);let o=0;while(o<r.length){let a=r[o++],l=a%e,d=Math.floor(a/e)%e,c=Math.floor(a/(e*e));for(let h of Jp){let u=l+h.x,p=d+h.y,g=c+h.z;if(!ko(u,p,g,e))continue;let x=hn(u,p,g,e);if(s[x]||t.has(x))continue;s[x]=1,r.push(x)}}for(let a=0;a<i;a++)if(!t.has(a)&&!s[a])t.add(a)}function Yp(e,t,n){let i=Math.floor(e/2);return n<i-t||e-1-n>i+t}function Ty(e,t,n,i,s){let r=i-1-s;return e<s||t<s||n<s||e>r||t>r||n>r}function Ay(e,t,n,i,s,r=0){let o=e*e*e,a=new Set,l=Math.floor(o*t);function d(u,p,g){if(!ko(u,p,g,e))return!1;if(Ty(u,p,g,e,r))return!1;let x=hn(u,p,g,e);if(i.has(x)||a.has(x))return!1;return a.add(x),!0}let c=o,h=0;while(a.size<l&&h<c){h++;let u=Math.floor(s()*e),p=Math.floor(s()*e),g=Math.floor(s()*e);if(!d(u,p,g))continue;for(let x of Jp){if(a.size>=l)break;if(s()<n)d(u+x.x,p+x.y,g+x.z)}}return Ey(e,a,i),a}function ld(e){if(e.mode==="plane"&&Cy(e,e.planeAppleMaxSteps))return e.apple;return Ry(e)}function Ry(e){let t=e.size,n=t*t*t,i=Math.floor(Bo(e)*n);for(let s=0;s<n;s++){let r=(i+s)%n,o=r%t,a=Math.floor(r/t)%t,l=Math.floor(r/(t*t)),d=hn(o,a,l,t);if(!e.snakeCells.has(d)&&!e.obstacles.has(d))return e.apple.x=o,e.apple.y=a,e.apple.z=l,e.apple}return e.apple}var od=new Int16Array(0),jp=new Int32Array(0);function Cy(e,t){return Xp(e,t)||Xp(e,2*e.size)}function Xp(e,t){let{size:n,frame:i}=e,s=e.snake[0],{right:r,up:o}=i,a=Math.max(1,Math.min(Math.floor(t),2*n)),l=2*a+1;if(od.length<l*l)od=new Int16Array(l*l),jp=new Int32Array(l*l);let d=od,c=jp;d.fill(-1,0,l*l);let h=a*l+a;d[h]=0,c[0]=h;let u=0,p=1,g=0;while(u<p){let E=c[u++],b=Math.floor(E/l)-a,S=E%l-a,A=d[E];if(A>=a)continue;for(let y=0;y<4;y++){let v=b+(y===0?1:y===1?-1:0),_=S+(y===2?1:y===3?-1:0);if(v<-a||v>a||_<-a||_>a)continue;let z=(v+a)*l+(_+a);if(d[z]>=0)continue;let P=s.x+v*r.x+_*o.x,D=s.y+v*r.y+_*o.y,N=s.z+v*r.z+_*o.z;if(!ko(P,D,N,n))continue;let C=hn(P,D,N,n);if(e.obstacles.has(C)||e.snakeCells.has(C))continue;d[z]=A+1,c[p++]=z,g++}}if(g===0)return!1;let x=1+Math.floor(Bo(e)*g),m=c[x],f=Math.floor(m/l)-a,T=m%l-a;return e.apple.x=s.x+f*r.x+T*o.x,e.apple.y=s.y+f*r.y+T*o.y,e.apple.z=s.z+f*r.z+T*o.z,!0}function ad(e,t){let n=e.x===t.x&&e.y===t.y&&e.z===t.z,i=e.x===-t.x&&e.y===-t.y&&e.z===-t.z;if(n||i)return;let s=t.y*e.z-t.z*e.y,r=t.z*e.x-t.x*e.z,o=t.x*e.y-t.y*e.x;e.x=s+0,e.y=r+0,e.z=o+0}function Ly(e,t){dd(e.frame,t)}function dd(e,t){ad(e.right,t),ad(e.up,t),ad(e.depth,t)}var Py={x:0,y:0,z:0};function qp(e,t){let n=e.heading,i=Py;i.x=n.y*t.z-n.z*t.y,i.y=n.z*t.x-n.x*t.z,i.z=n.x*t.y-n.y*t.x,Ly(e,i)}function Kp(e){let{heading:t,frame:n}=e,i=n.depth;if(i.x=-t.x+0,i.y=-t.y+0,i.z=-t.z+0,t.x*n.right.x+t.y*n.right.y+t.z*n.right.z!==0){let{up:r,right:o}=n;o.x=r.y*i.z-r.z*i.y+0,o.y=r.z*i.x-r.x*i.z+0,o.z=r.x*i.y-r.y*i.x+0}else{let{right:r,up:o}=n;o.x=i.y*r.z-i.z*r.y+0,o.y=i.z*r.x-i.x*r.z+0,o.z=i.x*r.y-i.y*r.x+0}}function Iy(e){let{heading:t,frame:n}=e;n.depth.x=-t.x+0,n.depth.y=-t.y+0,n.depth.z=-t.z+0,n.up.x=0,n.up.y=1,n.up.z=0;let{up:i,depth:s}=n;n.right.x=i.y*s.z-i.z*s.y+0,n.right.y=i.z*s.x-i.x*s.z+0,n.right.z=i.x*s.y-i.y*s.x+0}function Dy(e){return Number.isFinite(e)&&e>=1}function zy(e){return Number.isFinite(e)&&e>0?e:1}function Fy(e){return Number.isFinite(e)&&e>=0?e:1}function cd(e,t,n=1){let i=e.speed.startStepMs-t*e.speed.stepMsPerApple;return Math.max(e.speed.minStepMs,i)*n}function Uy(){return{right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},depth:{x:0,y:0,z:1}}}function Ny(e,t,n){return n?e.cube.default:t}function Zp(e,t,n,i,s=e.speed.boostFactor,r={}){let o=Ny(e,t,i),a=zy(r.paceScale??1),l=Fy(r.obstacleMult??1),d=Math.floor(o/2),c=e.snake.startLength,h={x:1,y:0,z:0},u=Uy(),p=[],g=new Set;for(let f=0;f<c;f++){let T={x:d-f,y:d,z:d};p.push(T),g.add(hn(T.x,T.y,T.z,o))}let x={size:o,snake:p,snakeCells:g,obstacles:new Set,apple:{x:0,y:0,z:0},heading:h,frame:u,pendingTurn:null,mode:i?"plane":"free",stepCount:0,growth:0,phase:"ready",score:0,applesEaten:0,stepMs:cd(e,0,a),paceScale:a,boostRequested:!1,boosting:!1,boostFactor:Dy(s)?s:1,minBoostedStepMs:e.speed.minEffectiveStepMs!==void 0&&e.speed.minEffectiveStepMs>0?e.speed.minEffectiveStepMs:0,sinceStepMs:0,elapsedMs:0,planeAppleMaxSteps:e.plane.appleMaxSteps,demoTurnPending:i,rngState:n|0};if(!i)Iy(x);let m=wy(p[0],p,o,e.obstacles.clearRadius);return x.obstacles=Ay(o,e.obstacles.density*l,e.obstacles.stickiness,m,()=>Bo(x),e.obstacles.wallMargin),ld(x),x}var Oy=Object.freeze({type:"started"}),By=Object.freeze({type:"moved"}),ky=Object.freeze({type:"boostChanged",on:!0}),Gy=Object.freeze({type:"boostChanged",on:!1}),Hy=Object.freeze({type:"demoTurn"}),Vy=Object.freeze({type:"modeChanged",mode:"free"}),Qp=new WeakMap;function Go(e){let t=Qp.get(e);if(!t)t=[],Qp.set(e,t);return t}function Wy(e,t){switch(e){case"right":return{x:t.right.x,y:t.right.y,z:t.right.z};case"left":return{x:Cs(-1,t.right.x),y:Cs(-1,t.right.y),z:Cs(-1,t.right.z)};case"up":return{x:t.up.x,y:t.up.y,z:t.up.z};case"down":return{x:Cs(-1,t.up.x),y:Cs(-1,t.up.y),z:Cs(-1,t.up.z)}}}function jy(e,t){return e.x===-t.x&&e.y===-t.y&&e.z===-t.z}function Cs(e,t){let n=e*t;return n===0?0:n}function Xy(e,t){if(e.snake.length<2)return!1;let n=e.snake[0],i=e.snake[1];return n.x+t.x===i.x&&n.y+t.y===i.y&&n.z+t.z===i.z}function $p(e){let t=Go(e);if(t.length=0,e.phase!=="ready")return t;return e.phase="running",t.push(Oy),t}function ef(e,t){let n=Go(e);if(n.length=0,e.phase!=="running")return n;if(e.boostRequested===t)return n;return e.boostRequested=t,n.push(t?ky:Gy),n}function tf(e,t){let n=Go(e);if(n.length=0,e.phase!=="running")return n;let i=Wy(t,e.frame);if(jy(i,e.heading)||Xy(e,i))return n;return e.pendingTurn=i,n.push({type:"turned",heading:i}),n}function Jy(e,t){e.demoTurnPending=!1;let n=e.pendingTurn;if(n!==null&&n.x===e.heading.x&&n.y===e.heading.y&&n.z===e.heading.z)e.pendingTurn=null;return e.mode="free",Kp(e),t.push(Vy),t.push(Hy),!0}function Yy(e,t,n){if(e.demoTurnPending&&e.stepCount>=t.demo.afterSteps&&Jy(e,n))return!0;if(e.pendingTurn){if(e.mode==="free")qp(e,e.pendingTurn);e.heading.x=e.pendingTurn.x,e.heading.y=e.pendingTurn.y,e.heading.z=e.pendingTurn.z,e.pendingTurn=null}let i=e.snake[0],s=i.x+e.heading.x,r=i.y+e.heading.y,o=i.z+e.heading.z;if(s<0||r<0||o<0||s>=e.size||r>=e.size||o>=e.size)return e.phase="dead",n.push({type:"died",cause:"wall"}),!1;let a=hn(s,r,o,e.size);if(e.obstacles.has(a))return e.phase="dead",n.push({type:"died",cause:"obstacle"}),!1;let l=e.growth>0,d=e.snake[e.snake.length-1],c=hn(d.x,d.y,d.z,e.size),h=a===c&&!l;if(e.snakeCells.has(a)&&!h)return e.phase="dead",n.push({type:"died",cause:"body"}),!1;if(l){let u={x:s,y:r,z:o};e.snake.unshift(u),e.snakeCells.add(a),e.growth-=1}else{let u=e.snake.pop();e.snakeCells.delete(c),u.x=s,u.y=r,u.z=o,e.snake.unshift(u),e.snakeCells.add(a)}if(e.stepCount+=1,n.push(By),s===e.apple.x&&r===e.apple.y&&o===e.apple.z){e.growth+=t.snake.growPerApple,e.applesEaten+=1,e.score+=1,n.push({type:"ate",apple:{x:s,y:r,z:o},score:e.score});let u=cd(t,e.applesEaten,e.paceScale);if(u!==e.stepMs)e.stepMs=u,n.push({type:"speedUp",stepMs:u});ld(e),n.push({type:"appleSpawned",apple:{x:e.apple.x,y:e.apple.y,z:e.apple.z}})}return!1}function nf(e,t,n){let i=Go(e);if(i.length=0,e.phase!=="running")return i;let s=Math.min(n,t.loop.maxFrameMs);if(!(s>0))return i;if(!(Qn(e)>0))return i;e.elapsedMs+=s,e.sinceStepMs+=s;let r=e.boostRequested&&e.boostFactor>1?Sr(e):Qn(e),o=Math.ceil(t.loop.maxFrameMs/r)+1,a=0;while(a<o&&e.phase==="running"){let d=Qn(e);if(!(d>0)||e.sinceStepMs<d)break;e.sinceStepMs-=d,a++;let c=Yy(e,t,i);if(e.boosting=e.boostRequested,c)break}let l=Qn(e);if(l>0&&e.sinceStepMs>=l)e.sinceStepMs=0;return i}function wt(e){return e.snake[0]}function Ls(e){return e.phase!=="dead"}function ln(e){return e.snake.length}function sf(e){return e.frame}function Ho(e){return e.score}function wr(e,t){let n=e.size;for(let i of e.obstacles){let s=i%n,r=Math.floor(i/n)%n,o=Math.floor(i/(n*n));t(s,r,o)}}function _i(e,t){let n=e.snake;for(let i=0;i<n.length;i++){let s=n[i];t(s.x,s.y,s.z,i)}}function Cn(e){return e.apple}function Et(e){return e.size}function $n(e){return e.elapsedMs}function Gn(e){return e.mode}function rf(e){let t=Qn(e);if(!(t>0))return 0;let n=e.sinceStepMs/t;return n<0?0:n>1?1:n}function Vo(e){return e.pendingTurn??e.heading}var Mr={right:{x:0,y:0,z:0},up:{x:0,y:0,z:0},depth:{x:0,y:0,z:0}},ji={x:0,y:0,z:0};function ud(e,t){e.x=t.x,e.y=t.y,e.z=t.z}function pn(e){let t=e.pendingTurn;if(e.mode!=="free"||t===null)return e.frame;let n=e.heading;if(ji.x=n.y*t.z-n.z*t.y,ji.y=n.z*t.x-n.x*t.z,ji.z=n.x*t.y-n.y*t.x,ji.x===0&&ji.y===0&&ji.z===0)return e.frame;return ud(Mr.right,e.frame.right),ud(Mr.up,e.frame.up),ud(Mr.depth,e.frame.depth),dd(Mr,ji),Mr}function of(e,t,n,i,s){let r=e.size;if(t<0||n<0||i<0||t>=r||n>=r||i>=r)return!0;let o=hn(t,n,i,r);if(e.obstacles.has(o))return!0;if(!e.snakeCells.has(o))return!1;let a=e.snake,l=Math.min(s-e.growth,a.length-1);for(let d=a.length-1;d>a.length-1-l;d--){let c=a[d];if(c.x===t&&c.y===n&&c.z===i)return!1}return!0}function af(e,t){if(e.phase!=="running")return 0;let n=e.snake[0],i=Vo(e);for(let s=1;s<=t;s++)if(of(e,n.x+i.x*s,n.y+i.y*s,n.z+i.z*s,s))return s;return 0}function lf(e){if(e.phase!=="running")return!1;let t=e.snake[0],n=e.apple,i=Vo(e),s=n.x-t.x,r=n.y-t.y,o=n.z-t.z,a=s*i.x+r*i.y+o*i.z;if(a<1)return!1;if(s-i.x*a!==0||r-i.y*a!==0||o-i.z*a!==0)return!1;for(let l=1;l<a;l++)if(of(e,t.x+i.x*l,t.y+i.y*l,t.z+i.z*l,l))return!1;return!0}function df(e){let t=Sr(e);return t>0?e.stepMs/t:e.boostFactor}var Of="186";var Bf=0,zd=1,kf=2;var Ur=1,Gf=2,qs=3,Ks=0,dn=1,cn=2,Sn=0,Nr=1,Or=2,Fd=3,Ud=4,Hf=5;var Zs=100,Vf=101,Wf=102,jf=103,Xf=104,Jf=200,Yf=201,qf=202,Kf=203,Zf=204,Qf=205,$f=206,em=207,tm=208,nm=209,im=210,sm=211,rm=212,om=213,am=214,lm=0,dm=1,cm=2,Br=3,um=4,hm=5,ga=6,pm=7,fm=0,mm=1,gm=2,gn=0,kr=1,Gr=2,Hr=3,Vr=4,Wr=5,jr=6,Xr=7;var Qs=301,Zi=302,va=303,xa=304,Jr=306,vm=1000,ba=1001,xm=1002,Yt=1003,bm=1004;var Yr=1005;var qt=1006,ya=1007;var Qi=1008;var Kt=1009,ym=1010,_m=1011,qr=1012,Nd=1013,Ri=1014,zn=1015,zt=1016,Od=1017,Bd=1018,$s=1020,Sm=35902,Mm=35899,wm=1021,Em=1022,jn=1023,$i=1026,es=1027,ts=1028,kd=1029,ns=1030,Gd=1031;var Hd=1033,_a=33776,Sa=33777,Ma=33778,wa=33779,Vd=35840,Wd=35841,jd=35842,Xd=35843,Jd=36196,Yd=37492,qd=37496,Kd=37488,Zd=37489,Ea=37490,Qd=37491,$d=37808,ec=37809,tc=37810,nc=37811,ic=37812,sc=37813,rc=37814,oc=37815,ac=37816,lc=37817,dc=37818,cc=37819,uc=37820,hc=37821,pc=36492,fc=36494,mc=36495,gc=36283,vc=36284,Ta=36285,xc=36286;var bc=0,Tm=1,is="",Aa="srgb",yc="srgb-linear",_c="linear",ut="srgb";var Am=512,Rm=513,Cm=514,Ra=515,Lm=516,Pm=517,Ca=518,Im=519;var Sc="300 es",Mc=2000;function qy(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Ky(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function zr(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function Dm(){let e=zr("canvas");return e.style.display="block",e}var cf={},Js=null;function Fr(...e){let t="THREE."+e.shift();if(Js)Js("log",t,...e);else console.log(t,...e)}function zm(e){let t=e[0];if(typeof t==="string"&&t.startsWith("TSL:")){let n=e[1];if(n&&n.isStackTrace)e[0]+=" "+n.getLocation();else e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function ze(...e){e=zm(e);let t="THREE."+e.shift();if(Js)Js("warn",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.warn(n.getError(t));else console.warn(t,...e)}}function Be(...e){e=zm(e);let t="THREE."+e.shift();if(Js)Js("error",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.error(n.getError(t));else console.error(t,...e)}}function Ki(...e){let t=e.join(" ");if(t in cf)return;cf[t]=!0,ze(...e)}function Fm(e,t,n){return new Promise(function(i,s){function r(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:s();break;case e.TIMEOUT_EXPIRED:setTimeout(r,n);break;default:i()}}setTimeout(r,n)})}var Um={[0]:1,[2]:6,[4]:7,[3]:5,[1]:0,[6]:2,[7]:4,[5]:3};class ai{addEventListener(e,t){if(this._listeners===void 0)this._listeners={};let n=this._listeners;if(n[e]===void 0)n[e]=[];if(n[e].indexOf(t)===-1)n[e].push(t)}hasEventListener(e,t){let n=this._listeners;if(n===void 0)return!1;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let s=i.indexOf(t);if(s!==-1)i.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let s=0,r=i.length;s<r;s++)i[s].call(this,e);e.target=null}}}var jt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],uf=1234567,Ir=Math.PI/180,Ys=180/Math.PI;function ri(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(jt[e&255]+jt[e>>8&255]+jt[e>>16&255]+jt[e>>24&255]+"-"+jt[t&255]+jt[t>>8&255]+"-"+jt[t>>16&15|64]+jt[t>>24&255]+"-"+jt[n&63|128]+jt[n>>8&255]+"-"+jt[n>>16&255]+jt[n>>24&255]+jt[i&255]+jt[i>>8&255]+jt[i>>16&255]+jt[i>>24&255]).toLowerCase()}function tt(e,t,n){return Math.max(t,Math.min(n,e))}function wc(e,t){return(e%t+t)%t}function Zy(e,t,n,i,s){return i+(e-t)*(s-i)/(n-t)}function Qy(e,t,n){if(e!==t)return(n-e)/(t-e);else return 0}function Dr(e,t,n){return(1-n)*e+n*t}function $y(e,t,n,i){return Dr(e,t,1-Math.exp(-n*i))}function e_(e,t=1){return t-Math.abs(wc(e,t*2)-t)}function t_(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*(3-2*e)}function n_(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10)}function i_(e,t){return e+Math.floor(Math.random()*(t-e+1))}function s_(e,t){return e+Math.random()*(t-e)}function r_(e){return e*(0.5-Math.random())}function o_(e){if(e!==void 0)uf=e;let t=uf+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function a_(e){return e*Ir}function l_(e){return e*Ys}function d_(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function c_(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))}function u_(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}function h_(e,t,n,i,s){let{cos:r,sin:o}=Math,a=r(n/2),l=o(n/2),d=r((t+i)/2),c=o((t+i)/2),h=r((t-i)/2),u=o((t-i)/2),p=r((i-t)/2),g=o((i-t)/2);switch(s){case"XYX":e.set(a*c,l*h,l*u,a*d);break;case"YZY":e.set(l*u,a*c,l*h,a*d);break;case"ZXZ":e.set(l*h,l*u,a*c,a*d);break;case"XZX":e.set(a*c,l*g,l*p,a*d);break;case"YXY":e.set(l*p,a*c,l*g,a*d);break;case"ZYZ":e.set(l*g,l*p,a*c,a*d);break;default:ze("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Dn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error("THREE.MathUtils: Invalid component type.")}}function dt(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error("THREE.MathUtils: Invalid component type.")}}var Ke={DEG2RAD:Ir,RAD2DEG:Ys,generateUUID:ri,clamp:tt,euclideanModulo:wc,mapLinear:Zy,inverseLerp:Qy,lerp:Dr,damp:$y,pingpong:e_,smoothstep:t_,smootherstep:n_,randInt:i_,randFloat:s_,randFloatSpread:r_,seededRandom:o_,degToRad:a_,radToDeg:l_,isPowerOfTwo:d_,ceilPowerOfTwo:c_,floorPowerOfTwo:u_,setQuaternionFromProperEuler:h_,normalize:dt,denormalize:Dn};class Ce{static{Ce.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,r=this.y-e.y;return this.x=s*n-r*i+e.x,this.y=s*i+r*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Pt{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,s,r,o){let a=n[i+0],l=n[i+1],d=n[i+2],c=n[i+3],h=s[r+0],u=s[r+1],p=s[r+2],g=s[r+3];if(c!==g||a!==h||l!==u||d!==p){let x=a*h+l*u+d*p+c*g;if(x<0)h=-h,u=-u,p=-p,g=-g,x=-x;let m=1-o;if(x<0.9995){let f=Math.acos(x),T=Math.sin(f);m=Math.sin(m*f)/T,o=Math.sin(o*f)/T,a=a*m+h*o,l=l*m+u*o,d=d*m+p*o,c=c*m+g*o}else{a=a*m+h*o,l=l*m+u*o,d=d*m+p*o,c=c*m+g*o;let f=1/Math.sqrt(a*a+l*l+d*d+c*c);a*=f,l*=f,d*=f,c*=f}}e[t]=a,e[t+1]=l,e[t+2]=d,e[t+3]=c}static multiplyQuaternionsFlat(e,t,n,i,s,r){let o=n[i],a=n[i+1],l=n[i+2],d=n[i+3],c=s[r],h=s[r+1],u=s[r+2],p=s[r+3];return e[t]=o*p+d*c+a*u-l*h,e[t+1]=a*p+d*h+l*c-o*u,e[t+2]=l*p+d*u+o*h-a*c,e[t+3]=d*p-o*c-a*h-l*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let{_x:n,_y:i,_z:s,_order:r}=e,{cos:o,sin:a}=Math,l=o(n/2),d=o(i/2),c=o(s/2),h=a(n/2),u=a(i/2),p=a(s/2);switch(r){case"XYZ":this._x=h*d*c+l*u*p,this._y=l*u*c-h*d*p,this._z=l*d*p+h*u*c,this._w=l*d*c-h*u*p;break;case"YXZ":this._x=h*d*c+l*u*p,this._y=l*u*c-h*d*p,this._z=l*d*p-h*u*c,this._w=l*d*c+h*u*p;break;case"ZXY":this._x=h*d*c-l*u*p,this._y=l*u*c+h*d*p,this._z=l*d*p+h*u*c,this._w=l*d*c-h*u*p;break;case"ZYX":this._x=h*d*c-l*u*p,this._y=l*u*c+h*d*p,this._z=l*d*p-h*u*c,this._w=l*d*c+h*u*p;break;case"YZX":this._x=h*d*c+l*u*p,this._y=l*u*c+h*d*p,this._z=l*d*p-h*u*c,this._w=l*d*c-h*u*p;break;case"XZY":this._x=h*d*c-l*u*p,this._y=l*u*c-h*d*p,this._z=l*d*p+h*u*c,this._w=l*d*c+h*u*p;break;default:ze("Quaternion: .setFromEuler() encountered an unknown order: "+r)}if(t===!0)this._onChangeCallback();return this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],d=t[6],c=t[10],h=n+o+c;if(h>0){let u=0.5/Math.sqrt(h+1);this._w=0.25/u,this._x=(d-a)*u,this._y=(s-l)*u,this._z=(r-i)*u}else if(n>o&&n>c){let u=2*Math.sqrt(1+n-o-c);this._w=(d-a)/u,this._x=0.25*u,this._y=(i+r)/u,this._z=(s+l)/u}else if(o>c){let u=2*Math.sqrt(1+o-n-c);this._w=(s-l)/u,this._x=(i+r)/u,this._y=0.25*u,this._z=(a+d)/u}else{let u=2*Math.sqrt(1+c-n-o);this._w=(r-i)/u,this._x=(s+l)/u,this._y=(a+d)/u,this._z=0.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;if(n<0.00000001)if(n=0,Math.abs(e.x)>Math.abs(e.z))this._x=-e.y,this._y=e.x,this._z=0,this._w=n;else this._x=0,this._y=-e.z,this._z=e.y,this._w=n;else this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n;return this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(tt(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();if(e===0)this._x=0,this._y=0,this._z=0,this._w=1;else e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e;return this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let{_x:n,_y:i,_z:s,_w:r}=e,{_x:o,_y:a,_z:l,_w:d}=t;return this._x=n*d+r*o+i*l-s*a,this._y=i*d+r*a+s*o-n*l,this._z=s*d+r*l+n*a-i*o,this._w=r*d-n*o-i*a-s*l,this._onChangeCallback(),this}slerp(e,t){let{_x:n,_y:i,_z:s,_w:r}=e,o=this.dot(e);if(o<0)n=-n,i=-i,s=-s,r=-r,o=-o;let a=1-t;if(o<0.9995){let l=Math.acos(o),d=Math.sin(l);a=Math.sin(a*l)/d,t=Math.sin(t*l)/d,this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+s*t,this._w=this._w*a+r*t,this._onChangeCallback()}else this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+s*t,this._w=this._w*a+r*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class I{static{I.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){if(n===void 0)n=this.z;return this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(hf.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(hf.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=e.elements,r=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*r,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*r,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*r,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,{x:s,y:r,z:o,w:a}=e,l=2*(r*i-o*n),d=2*(o*t-s*i),c=2*(s*n-r*t);return this.x=t+a*l+r*c-o*d,this.y=n+a*d+o*l-s*c,this.z=i+a*c+s*d-r*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let{x:n,y:i,z:s}=e,{x:r,y:o,z:a}=t;return this.x=i*a-s*o,this.y=s*r-n*a,this.z=n*o-i*r,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return hd.copy(this).projectOnVector(e),this.sub(hd)}reflect(e){return this.sub(hd.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var hd=new I,hf=new Pt;class ke{static{ke.prototype.isMatrix3=!0}constructor(e,t,n,i,s,r,o,a,l){if(this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0)this.set(e,t,n,i,s,r,o,a,l)}set(e,t,n,i,s,r,o,a,l){let d=this.elements;return d[0]=e,d[1]=i,d[2]=o,d[3]=t,d[4]=s,d[5]=a,d[6]=n,d[7]=r,d[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,r=n[0],o=n[3],a=n[6],l=n[1],d=n[4],c=n[7],h=n[2],u=n[5],p=n[8],g=i[0],x=i[3],m=i[6],f=i[1],T=i[4],E=i[7],b=i[2],S=i[5],A=i[8];return s[0]=r*g+o*f+a*b,s[3]=r*x+o*T+a*S,s[6]=r*m+o*E+a*A,s[1]=l*g+d*f+c*b,s[4]=l*x+d*T+c*S,s[7]=l*m+d*E+c*A,s[2]=h*g+u*f+p*b,s[5]=h*x+u*T+p*S,s[8]=h*m+u*E+p*A,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],a=e[6],l=e[7],d=e[8];return t*r*d-t*o*l-n*s*d+n*o*a+i*s*l-i*r*a}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],a=e[6],l=e[7],d=e[8],c=d*r-o*l,h=o*a-d*s,u=l*s-r*a,p=t*c+n*h+i*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let g=1/p;return e[0]=c*g,e[1]=(i*l-d*n)*g,e[2]=(o*n-i*r)*g,e[3]=h*g,e[4]=(d*t-i*a)*g,e[5]=(i*s-o*t)*g,e[6]=u*g,e[7]=(n*a-l*t)*g,e[8]=(r*t-n*s)*g,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,r,o){let a=Math.cos(s),l=Math.sin(s);return this.set(n*a,n*l,-n*(a*r+l*o)+r+e,-i*l,i*a,-i*(-l*r+a*o)+o+t,0,0,1),this}scale(e,t){return Ki("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(pd.makeScale(e,t)),this}rotate(e){return Ki("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(pd.makeRotation(-e)),this}translate(e,t){return Ki("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(pd.makeTranslation(e,t)),this}makeTranslation(e,t){if(e.isVector2)this.set(1,0,e.x,0,1,e.y,0,0,1);else this.set(1,0,e,0,1,t,0,0,1);return this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}var pd=new ke,pf=new ke().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),ff=new ke().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function p_(){let e={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(s,r,o){if(this.enabled===!1||r===o||!r||!o)return s;if(this.spaces[r].transfer==="srgb")s.r=oi(s.r),s.g=oi(s.g),s.b=oi(s.b);if(this.spaces[r].primaries!==this.spaces[o].primaries)s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ);if(this.spaces[o].transfer==="srgb")s.r=Xs(s.r),s.g=Xs(s.g),s.b=Xs(s.b);return s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){if(s==="")return"linear";return this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Ki("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Ki("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(s,r)}},t=[0.64,0.33,0.3,0.6,0.15,0.06],n=[0.2126,0.7152,0.0722],i=[0.3127,0.329];return e.define({["srgb-linear"]:{primaries:t,whitePoint:i,transfer:"linear",toXYZ:pf,fromXYZ:ff,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:t,whitePoint:i,transfer:"srgb",toXYZ:pf,fromXYZ:ff,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),e}var Ze=p_();function oi(e){return e<0.04045?e*0.0773993808:Math.pow(e*0.9478672986+0.0521327014,2.4)}function Xs(e){return e<0.0031308?e*12.92:1.055*Math.pow(e,0.41666)-0.055}var Ps;class Ec{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src))return e.src;if(typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{if(Ps===void 0)Ps=zr("canvas");Ps.width=e.width,Ps.height=e.height;let i=Ps.getContext("2d");if(e instanceof ImageData)i.putImageData(e,0,0);else i.drawImage(e,0,0,e.width,e.height);n=Ps}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=zr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),s=i.data;for(let r=0;r<s.length;r++)s[r]=oi(s[r]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)if(t instanceof Uint8Array||t instanceof Uint8ClampedArray)t[n]=Math.floor(oi(t[n]/255)*255);else t[n]=oi(t[n]);return{data:t,width:e.width,height:e.height}}else return ze("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}var f_=0;class Kr{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:f_++}),this.uuid=ri(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;if(typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement)e.set(t.videoWidth,t.videoHeight,0);else if(typeof VideoFrame<"u"&&t instanceof VideoFrame)e.set(t.displayWidth,t.displayHeight,0);else if(t!==null)e.set(t.width,t.height,t.depth||0);else e.set(0,0,0);return e}set needsUpdate(e){if(e===!0)this.version++}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let r=0,o=i.length;r<o;r++)if(i[r].isDataTexture)s.push(fd(i[r].image));else s.push(fd(i[r]))}else s=fd(i);n.url=s}if(!t)e.images[this.uuid]=n;return n}}function fd(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap)return Ec.getDataURL(e);else if(e.data)return{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name};else return ze("Texture: Unable to serialize Texture."),{}}var m_=0,md=new I;class Nt extends ai{constructor(e=Nt.DEFAULT_IMAGE,t=Nt.DEFAULT_MAPPING,n=1001,i=1001,s=1006,r=1008,o=1023,a=1009,l=Nt.DEFAULT_ANISOTROPY,d=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:m_++}),this.uuid=ri(),this.name="",this.source=new Kr(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=r,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=a,this.offset=new Ce(0,0),this.repeat=new Ce(1,1),this.center=new Ce(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ke,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=e&&e.depth&&e.depth>1?!0:!1,this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(md).x}get height(){return this.source.getSize(md).y}get depth(){return this.source.getSize(md).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){ze(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){ze(`Texture.setValues(): property '${t}' does not exist.`);continue}if(i&&n&&(i.isVector2&&n.isVector2))i.copy(n);else if(i&&n&&(i.isVector3&&n.isVector3))i.copy(n);else if(i&&n&&(i.isMatrix3&&n.isMatrix3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)n.userData=this.userData;if(!t)e.textures[this.uuid]=n;return n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case 1000:e.x=e.x-Math.floor(e.x);break;case 1001:e.x=e.x<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.x)%2)===1)e.x=Math.ceil(e.x)-e.x;else e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case 1000:e.y=e.y-Math.floor(e.y);break;case 1001:e.y=e.y<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.y)%2)===1)e.y=Math.ceil(e.y)-e.y;else e.y=e.y-Math.floor(e.y);break}if(this.flipY)e.y=1-e.y;return e}set needsUpdate(e){if(e===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate(e){if(e===!0)this.pmremVersion++}}Nt.DEFAULT_IMAGE=null;Nt.DEFAULT_MAPPING=300;Nt.DEFAULT_ANISOTROPY=1;class Tt{static{Tt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=this.w,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i+r[12]*s,this.y=r[1]*t+r[5]*n+r[9]*i+r[13]*s,this.z=r[2]*t+r[6]*n+r[10]*i+r[14]*s,this.w=r[3]*t+r[7]*n+r[11]*i+r[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);if(t<0.0001)this.x=1,this.y=0,this.z=0;else this.x=e.x/t,this.y=e.y/t,this.z=e.z/t;return this}setAxisAngleFromRotationMatrix(e){let t,n,i,s,r=0.01,o=0.1,a=e.elements,l=a[0],d=a[4],c=a[8],h=a[1],u=a[5],p=a[9],g=a[2],x=a[6],m=a[10];if(Math.abs(d-h)<0.01&&Math.abs(c-g)<0.01&&Math.abs(p-x)<0.01){if(Math.abs(d+h)<0.1&&Math.abs(c+g)<0.1&&Math.abs(p+x)<0.1&&Math.abs(l+u+m-3)<0.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(l+1)/2,E=(u+1)/2,b=(m+1)/2,S=(d+h)/4,A=(c+g)/4,y=(p+x)/4;if(T>E&&T>b)if(T<0.01)n=0,i=0.707106781,s=0.707106781;else n=Math.sqrt(T),i=S/n,s=A/n;else if(E>b)if(E<0.01)n=0.707106781,i=0,s=0.707106781;else i=Math.sqrt(E),n=S/i,s=y/i;else if(b<0.01)n=0.707106781,i=0.707106781,s=0;else s=Math.sqrt(b),n=A/s,i=y/s;return this.set(n,i,s,t),this}let f=Math.sqrt((x-p)*(x-p)+(c-g)*(c-g)+(h-d)*(h-d));if(Math.abs(f)<0.001)f=1;return this.x=(x-p)/f,this.y=(c-g)/f,this.z=(h-d)/f,this.w=Math.acos((l+u+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this.w=tt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this.w=tt(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Tc extends ai{constructor(e=1,t=1,n={}){super();n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Tt(0,0,e,t),this.scissorTest=!1,this.viewport=new Tt(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},s=new Nt(i),r=n.count;for(let o=0;o<r;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if(e.mapping!==void 0)t.mapping=e.mapping;if(e.wrapS!==void 0)t.wrapS=e.wrapS;if(e.wrapT!==void 0)t.wrapT=e.wrapT;if(e.wrapR!==void 0)t.wrapR=e.wrapR;if(e.magFilter!==void 0)t.magFilter=e.magFilter;if(e.minFilter!==void 0)t.minFilter=e.minFilter;if(e.format!==void 0)t.format=e.format;if(e.type!==void 0)t.type=e.type;if(e.anisotropy!==void 0)t.anisotropy=e.anisotropy;if(e.colorSpace!==void 0)t.colorSpace=e.colorSpace;if(e.flipY!==void 0)t.flipY=e.flipY;if(e.generateMipmaps!==void 0)t.generateMipmaps=e.generateMipmaps;if(e.internalFormat!==void 0)t.internalFormat=e.internalFormat;for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){if(this._depthTexture!==null&&this._depthTexture.renderTarget===this)this._depthTexture.renderTarget=null;if(e!==null&&e.renderTarget===null)e.renderTarget=this;this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)if(this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0)this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new Kr(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class St extends Tc{constructor(e=1,t=1,n={}){super(e,t,n);this.isWebGLRenderTarget=!0}}class La extends Nt{constructor(e=null,t=1,n=1,i=1){super(null);this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Ac extends Nt{constructor(e=null,t=1,n=1,i=1){super(null);this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class Je{static{Je.prototype.isMatrix4=!0}constructor(e,t,n,i,s,r,o,a,l,d,c,h,u,p,g,x){if(this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0)this.set(e,t,n,i,s,r,o,a,l,d,c,h,u,p,g,x)}set(e,t,n,i,s,r,o,a,l,d,c,h,u,p,g,x){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=s,m[5]=r,m[9]=o,m[13]=a,m[2]=l,m[6]=d,m[10]=c,m[14]=h,m[3]=u,m[7]=p,m[11]=g,m[15]=x,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Je().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){if(this.determinantAffine()===0)return e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this;return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/Is.setFromMatrixColumn(e,0).length(),s=1/Is.setFromMatrixColumn(e,1).length(),r=1/Is.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*r,t[9]=n[9]*r,t[10]=n[10]*r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,{x:n,y:i,z:s}=e,r=Math.cos(n),o=Math.sin(n),a=Math.cos(i),l=Math.sin(i),d=Math.cos(s),c=Math.sin(s);if(e.order==="XYZ"){let h=r*d,u=r*c,p=o*d,g=o*c;t[0]=a*d,t[4]=-a*c,t[8]=l,t[1]=u+p*l,t[5]=h-g*l,t[9]=-o*a,t[2]=g-h*l,t[6]=p+u*l,t[10]=r*a}else if(e.order==="YXZ"){let h=a*d,u=a*c,p=l*d,g=l*c;t[0]=h+g*o,t[4]=p*o-u,t[8]=r*l,t[1]=r*c,t[5]=r*d,t[9]=-o,t[2]=u*o-p,t[6]=g+h*o,t[10]=r*a}else if(e.order==="ZXY"){let h=a*d,u=a*c,p=l*d,g=l*c;t[0]=h-g*o,t[4]=-r*c,t[8]=p+u*o,t[1]=u+p*o,t[5]=r*d,t[9]=g-h*o,t[2]=-r*l,t[6]=o,t[10]=r*a}else if(e.order==="ZYX"){let h=r*d,u=r*c,p=o*d,g=o*c;t[0]=a*d,t[4]=p*l-u,t[8]=h*l+g,t[1]=a*c,t[5]=g*l+h,t[9]=u*l-p,t[2]=-l,t[6]=o*a,t[10]=r*a}else if(e.order==="YZX"){let h=r*a,u=r*l,p=o*a,g=o*l;t[0]=a*d,t[4]=g-h*c,t[8]=p*c+u,t[1]=c,t[5]=r*d,t[9]=-o*d,t[2]=-l*d,t[6]=u*c+p,t[10]=h-g*c}else if(e.order==="XZY"){let h=r*a,u=r*l,p=o*a,g=o*l;t[0]=a*d,t[4]=-c,t[8]=l*d,t[1]=h*c+g,t[5]=r*d,t[9]=u*c-p,t[2]=p*c-u,t[6]=o*d,t[10]=g*c+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(g_,e,v_)}lookAt(e,t,n){let i=this.elements;if(fn.subVectors(e,t),fn.lengthSq()===0)fn.z=1;if(fn.normalize(),Si.crossVectors(n,fn),Si.lengthSq()===0){if(Math.abs(n.z)===1)fn.x+=0.0001;else fn.z+=0.0001;fn.normalize(),Si.crossVectors(n,fn)}return Si.normalize(),Wo.crossVectors(fn,Si),i[0]=Si.x,i[4]=Wo.x,i[8]=fn.x,i[1]=Si.y,i[5]=Wo.y,i[9]=fn.y,i[2]=Si.z,i[6]=Wo.z,i[10]=fn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,r=n[0],o=n[4],a=n[8],l=n[12],d=n[1],c=n[5],h=n[9],u=n[13],p=n[2],g=n[6],x=n[10],m=n[14],f=n[3],T=n[7],E=n[11],b=n[15],S=i[0],A=i[4],y=i[8],v=i[12],_=i[1],z=i[5],P=i[9],D=i[13],N=i[2],C=i[6],B=i[10],k=i[14],G=i[3],Q=i[7],W=i[11],q=i[15];return s[0]=r*S+o*_+a*N+l*G,s[4]=r*A+o*z+a*C+l*Q,s[8]=r*y+o*P+a*B+l*W,s[12]=r*v+o*D+a*k+l*q,s[1]=d*S+c*_+h*N+u*G,s[5]=d*A+c*z+h*C+u*Q,s[9]=d*y+c*P+h*B+u*W,s[13]=d*v+c*D+h*k+u*q,s[2]=p*S+g*_+x*N+m*G,s[6]=p*A+g*z+x*C+m*Q,s[10]=p*y+g*P+x*B+m*W,s[14]=p*v+g*D+x*k+m*q,s[3]=f*S+T*_+E*N+b*G,s[7]=f*A+T*z+E*C+b*Q,s[11]=f*y+T*P+E*B+b*W,s[15]=f*v+T*D+E*k+b*q,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],r=e[1],o=e[5],a=e[9],l=e[13],d=e[2],c=e[6],h=e[10],u=e[14],p=e[3],g=e[7],x=e[11],m=e[15],f=a*u-l*h,T=o*u-l*c,E=o*h-a*c,b=r*u-l*d,S=r*h-a*d,A=r*c-o*d;return t*(g*f-x*T+m*E)-n*(p*f-x*b+m*S)+i*(p*T-g*b+m*A)-s*(p*E-g*S+x*A)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[1],r=e[5],o=e[9],a=e[2],l=e[6],d=e[10];return t*(r*d-o*l)-n*(s*d-o*a)+i*(s*l-r*a)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;if(e.isVector3)i[12]=e.x,i[13]=e.y,i[14]=e.z;else i[12]=e,i[13]=t,i[14]=n;return this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],a=e[6],l=e[7],d=e[8],c=e[9],h=e[10],u=e[11],p=e[12],g=e[13],x=e[14],m=e[15],f=t*o-n*r,T=t*a-i*r,E=t*l-s*r,b=n*a-i*o,S=n*l-s*o,A=i*l-s*a,y=d*g-c*p,v=d*x-h*p,_=d*m-u*p,z=c*x-h*g,P=c*m-u*g,D=h*m-u*x,N=f*D-T*P+E*z+b*_-S*v+A*y;if(N===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let C=1/N;return e[0]=(o*D-a*P+l*z)*C,e[1]=(i*P-n*D-s*z)*C,e[2]=(g*A-x*S+m*b)*C,e[3]=(h*S-c*A-u*b)*C,e[4]=(a*_-r*D-l*v)*C,e[5]=(t*D-i*_+s*v)*C,e[6]=(x*E-p*A-m*T)*C,e[7]=(d*A-h*E+u*T)*C,e[8]=(r*P-o*_+l*y)*C,e[9]=(n*_-t*P-s*y)*C,e[10]=(p*S-g*E+m*f)*C,e[11]=(c*E-d*S-u*f)*C,e[12]=(o*v-r*z-a*y)*C,e[13]=(t*z-n*v+i*y)*C,e[14]=(g*T-p*b-x*f)*C,e[15]=(d*b-c*T+h*f)*C,this}scale(e){let t=this.elements,{x:n,y:i,z:s}=e;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){if(e.isVector3)this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1);else this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1);return this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),s=1-n,{x:r,y:o,z:a}=e,l=s*r,d=s*o;return this.set(l*r+n,l*o-i*a,l*a+i*o,0,l*o+i*a,d*o+n,d*a-i*r,0,l*a-i*o,d*a+i*r,s*a*a+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,s,r){return this.set(1,n,s,0,e,1,r,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,{_x:s,_y:r,_z:o,_w:a}=t,l=s+s,d=r+r,c=o+o,h=s*l,u=s*d,p=s*c,g=r*d,x=r*c,m=o*c,f=a*l,T=a*d,E=a*c,{x:b,y:S,z:A}=n;return i[0]=(1-(g+m))*b,i[1]=(u+E)*b,i[2]=(p-T)*b,i[3]=0,i[4]=(u-E)*S,i[5]=(1-(h+m))*S,i[6]=(x+f)*S,i[7]=0,i[8]=(p+T)*A,i[9]=(x-f)*A,i[10]=(1-(h+g))*A,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),t.identity(),this;let r=Is.set(i[0],i[1],i[2]).length(),o=Is.set(i[4],i[5],i[6]).length(),a=Is.set(i[8],i[9],i[10]).length();if(s<0)r=-r;Ln.copy(this);let l=1/r,d=1/o,c=1/a;return Ln.elements[0]*=l,Ln.elements[1]*=l,Ln.elements[2]*=l,Ln.elements[4]*=d,Ln.elements[5]*=d,Ln.elements[6]*=d,Ln.elements[8]*=c,Ln.elements[9]*=c,Ln.elements[10]*=c,t.setFromRotationMatrix(Ln),n.x=r,n.y=o,n.z=a,this}makePerspective(e,t,n,i,s,r,o=2000,a=!1){let l=this.elements,d=2*s/(t-e),c=2*s/(n-i),h=(t+e)/(t-e),u=(n+i)/(n-i),p,g;if(a)p=s/(r-s),g=r*s/(r-s);else if(o===2000)p=-(r+s)/(r-s),g=-2*r*s/(r-s);else if(o===2001)p=-r/(r-s),g=-r*s/(r-s);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=d,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=c,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,s,r,o=2000,a=!1){let l=this.elements,d=2/(t-e),c=2/(n-i),h=-(t+e)/(t-e),u=-(n+i)/(n-i),p,g;if(a)p=1/(r-s),g=r/(r-s);else if(o===2000)p=-2/(r-s),g=-(r+s)/(r-s);else if(o===2001)p=-1/(r-s),g=-s/(r-s);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=d,l[4]=0,l[8]=0,l[12]=h,l[1]=0,l[5]=c,l[9]=0,l[13]=u,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}var Is=new I,Ln=new Je,g_=new I(0,0,0),v_=new I(1,1,1),Si=new I,Wo=new I,fn=new I,mf=new Je,gf=new Pt;class Ai{constructor(e=0,t=0,n=0,i=Ai.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,s=i[0],r=i[4],o=i[8],a=i[1],l=i[5],d=i[9],c=i[2],h=i[6],u=i[10];switch(t){case"XYZ":if(this._y=Math.asin(tt(o,-1,1)),Math.abs(o)<0.9999999)this._x=Math.atan2(-d,u),this._z=Math.atan2(-r,s);else this._x=Math.atan2(h,l),this._z=0;break;case"YXZ":if(this._x=Math.asin(-tt(d,-1,1)),Math.abs(d)<0.9999999)this._y=Math.atan2(o,u),this._z=Math.atan2(a,l);else this._y=Math.atan2(-c,s),this._z=0;break;case"ZXY":if(this._x=Math.asin(tt(h,-1,1)),Math.abs(h)<0.9999999)this._y=Math.atan2(-c,u),this._z=Math.atan2(-r,l);else this._y=0,this._z=Math.atan2(a,s);break;case"ZYX":if(this._y=Math.asin(-tt(c,-1,1)),Math.abs(c)<0.9999999)this._x=Math.atan2(h,u),this._z=Math.atan2(a,s);else this._x=0,this._z=Math.atan2(-r,l);break;case"YZX":if(this._z=Math.asin(tt(a,-1,1)),Math.abs(a)<0.9999999)this._x=Math.atan2(-d,l),this._y=Math.atan2(-c,s);else this._x=0,this._y=Math.atan2(o,u);break;case"XZY":if(this._z=Math.asin(-tt(r,-1,1)),Math.abs(r)<0.9999999)this._x=Math.atan2(h,l),this._y=Math.atan2(o,s);else this._x=Math.atan2(-d,u),this._y=0;break;default:ze("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}if(this._order=t,n===!0)this._onChangeCallback();return this}setFromQuaternion(e,t,n){return mf.makeRotationFromQuaternion(e),this.setFromRotationMatrix(mf,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return gf.setFromEuler(this),this.setFromQuaternion(gf,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){if(this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0)this._order=e[3];return this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Ai.DEFAULT_ORDER="XYZ";class Pa{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}var x_=0,vf=new I,Ds=new Pt,ei=new Je,jo=new I,Er=new I,b_=new I,y_=new Pt,xf=new I(1,0,0),bf=new I(0,1,0),yf=new I(0,0,1),_f={type:"added"},__={type:"removed"},zs={type:"childadded",child:null},gd={type:"childremoved",child:null};class Jt extends ai{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:x_++}),this.uuid=ri(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Jt.DEFAULT_UP.clone();let e=new I,t=new Ai,n=new Pt,i=new I(1,1,1);function s(){n.setFromEuler(t,!1)}function r(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Je},normalMatrix:{value:new ke}}),this.matrix=new Je,this.matrixWorld=new Je,this.matrixAutoUpdate=Jt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Jt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Pa,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ds.setFromAxisAngle(e,t),this.quaternion.multiply(Ds),this}rotateOnWorldAxis(e,t){return Ds.setFromAxisAngle(e,t),this.quaternion.premultiply(Ds),this}rotateX(e){return this.rotateOnAxis(xf,e)}rotateY(e){return this.rotateOnAxis(bf,e)}rotateZ(e){return this.rotateOnAxis(yf,e)}translateOnAxis(e,t){return vf.copy(e).applyQuaternion(this.quaternion),this.position.add(vf.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(xf,e)}translateY(e){return this.translateOnAxis(bf,e)}translateZ(e){return this.translateOnAxis(yf,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(ei.copy(this.matrixWorld).invert())}lookAt(e,t,n){if(e.isVector3)jo.copy(e);else jo.set(e,t,n);let i=this.parent;if(this.updateWorldMatrix(!0,!1),Er.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)ei.lookAt(Er,jo,this.up);else ei.lookAt(jo,Er,this.up);if(this.quaternion.setFromRotationMatrix(ei),i)ei.extractRotation(i.matrixWorld),Ds.setFromRotationMatrix(ei),this.quaternion.premultiply(Ds.invert())}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}if(e===this)return Be("Object3D.add: object can't be added as a child of itself.",e),this;if(e&&e.isObject3D)e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(_f),zs.child=e,this.dispatchEvent(zs),zs.child=null;else Be("Object3D.add: object not an instance of THREE.Object3D.",e);return this}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);if(t!==-1)e.parent=null,this.children.splice(t,1),e.dispatchEvent(__),gd.child=e,this.dispatchEvent(gd),gd.child=null;return this}removeFromParent(){let e=this.parent;if(e!==null)e.remove(this);return this}clear(){return this.remove(...this.children)}attach(e){if(this.updateWorldMatrix(!0,!1),ei.copy(this.matrixWorld).invert(),e.parent!==null)e.parent.updateWorldMatrix(!0,!1),ei.multiply(e.parent.matrixWorld);return e.applyMatrix4(ei),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(_f),zs.child=e,this.dispatchEvent(zs),zs.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}return}getObjectsByProperty(e,t,n=[]){if(this[e]===t)n.push(this);let i=this.children;for(let s=0,r=i.length;s<r;s++)i[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Er,e,b_),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Er,y_,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;if(t!==null)e(t),t.traverseAncestors(e)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let{x:t,y:n,z:i}=e,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*i,s[13]+=n-s[1]*t-s[5]*n-s[9]*i,s[14]+=i-s[2]*t-s[6]*n-s[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||e){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,e=!0}let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null)i.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||n){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,n=!0}if(t===!0){let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==="string",n={};if(t)e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let i={};if(i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0)i.userData=this.userData;if(i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null)i.pivot=this.pivot.toArray();if(this.morphTargetDictionary!==void 0)i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary);if(this.morphTargetInfluences!==void 0)i.morphTargetInfluences=this.morphTargetInfluences.slice();if(this.isInstancedMesh){if(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)i.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map((o)=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map((o)=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null)i.colorsTexture=this._colorsTexture.toJSON(e);if(this.boundingSphere!==null)i.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)i.boundingBox=this.boundingBox.toJSON()}function s(o,a){if(o[a.uuid]===void 0)o[a.uuid]=a.toJSON(e);return a.uuid}if(this.isScene){if(this.background){if(this.background.isColor)i.background=this.background.toJSON();else if(this.background.isTexture)i.background=this.background.toJSON(e).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)i.environment=this.environment.toJSON(e).uuid}else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let a=o.shapes;if(Array.isArray(a))for(let l=0,d=a.length;l<d;l++){let c=a[l];s(e.shapes,c)}else s(e.shapes,a)}}if(this.isSkinnedMesh){if(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(s(e.materials,this.material[a]));i.material=o}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let a=this.animations[o];i.animations.push(s(e.animations,a))}}if(t){let o=r(e.geometries),a=r(e.materials),l=r(e.textures),d=r(e.images),c=r(e.shapes),h=r(e.skeletons),u=r(e.animations),p=r(e.nodes);if(o.length>0)n.geometries=o;if(a.length>0)n.materials=a;if(l.length>0)n.textures=l;if(d.length>0)n.images=d;if(c.length>0)n.shapes=c;if(h.length>0)n.skeletons=h;if(u.length>0)n.animations=u;if(p.length>0)n.nodes=p}return n.object=i,n;function r(o){let a=[];for(let l in o){let d=o[l];delete d.metadata,a.push(d)}return a}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Jt.DEFAULT_UP=new I(0,1,0);Jt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Jt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class js extends Jt{constructor(){super();this.isGroup=!0,this.type="Group"}}var S_={type:"move"};class Zr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new js,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new js,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new I,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new I;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new js,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new I,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new I,this._grip.eventsEnabled=!1;return this._grip}dispatchEvent(e){if(this._targetRay!==null)this._targetRay.dispatchEvent(e);if(this._grip!==null)this._grip.dispatchEvent(e);if(this._hand!==null)this._hand.dispatchEvent(e);return this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){if(this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update(e,t,n){let i=null,s=null,r=null,o=this._targetRay,a=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){r=!0;for(let g of e.hand.values()){let x=t.getJointPose(g,n),m=this._getHandJoint(l,g);if(x!==null)m.matrix.fromArray(x.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=x.radius;m.visible=x!==null}let d=l.joints["index-finger-tip"],c=l.joints["thumb-tip"],h=d.position.distanceTo(c.position),u=0.02,p=0.005;if(l.inputState.pinching&&h>u+p)l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this});else if(!l.inputState.pinching&&h<=u-p)l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this})}else if(a!==null&&e.gripSpace){if(s=t.getPose(e.gripSpace,n),s!==null){if(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity)a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity);else a.hasLinearVelocity=!1;if(s.angularVelocity)a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity);else a.hasAngularVelocity=!1;if(a.eventsEnabled)a.dispatchEvent({type:"gripUpdated",data:e,target:this})}}if(o!==null){if(i=t.getPose(e.targetRaySpace,n),i===null&&s!==null)i=s;if(i!==null){if(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity)o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity);else o.hasLinearVelocity=!1;if(i.angularVelocity)o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity);else o.hasAngularVelocity=!1;this.dispatchEvent(S_)}}}if(o!==null)o.visible=i!==null;if(a!==null)a.visible=s!==null;if(l!==null)l.visible=r!==null;return this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new js;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}var Nm={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Mi={h:0,s:0,l:0},Xo={h:0,s:0,l:0};function vd(e,t,n){if(n<0)n+=1;if(n>1)n-=1;if(n<0.16666666666666666)return e+(t-e)*6*n;if(n<0.5)return t;if(n<0.6666666666666666)return e+(t-e)*6*(0.6666666666666666-n);return e}class ae{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;if(i&&i.isColor)this.copy(i);else if(typeof i==="number")this.setHex(i);else if(typeof i==="string")this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t="srgb"){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ze.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=Ze.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ze.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=Ze.workingColorSpace){if(e=wc(e,1),t=tt(t,0,1),n=tt(n,0,1),t===0)this.r=this.g=this.b=n;else{let s=n<=0.5?n*(1+t):n+t-n*t,r=2*n-s;this.r=vd(r,s,e+0.3333333333333333),this.g=vd(r,s,e),this.b=vd(r,s,e-0.3333333333333333)}return Ze.colorSpaceToWorking(this,i),this}setStyle(e,t="srgb"){function n(s){if(s===void 0)return;if(parseFloat(s)<1)ze("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,r=i[1],o=i[2];switch(r){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:ze("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=i[1],r=s.length;if(r===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);else if(r===6)return this.setHex(parseInt(s,16),t);else ze("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t="srgb"){let n=Nm[e.toLowerCase()];if(n!==void 0)this.setHex(n,t);else ze("Color: Unknown color "+e);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=oi(e.r),this.g=oi(e.g),this.b=oi(e.b),this}copyLinearToSRGB(e){return this.r=Xs(e.r),this.g=Xs(e.g),this.b=Xs(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e="srgb"){return Ze.workingToColorSpace(Xt.copy(this),e),Math.round(tt(Xt.r*255,0,255))*65536+Math.round(tt(Xt.g*255,0,255))*256+Math.round(tt(Xt.b*255,0,255))}getHexString(e="srgb"){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ze.workingColorSpace){Ze.workingToColorSpace(Xt.copy(this),t);let{r:n,g:i,b:s}=Xt,r=Math.max(n,i,s),o=Math.min(n,i,s),a,l,d=(o+r)/2;if(o===r)a=0,l=0;else{let c=r-o;switch(l=d<=0.5?c/(r+o):c/(2-r-o),r){case n:a=(i-s)/c+(i<s?6:0);break;case i:a=(s-n)/c+2;break;case s:a=(n-i)/c+4;break}a/=6}return e.h=a,e.s=l,e.l=d,e}getRGB(e,t=Ze.workingColorSpace){return Ze.workingToColorSpace(Xt.copy(this),t),e.r=Xt.r,e.g=Xt.g,e.b=Xt.b,e}getStyle(e="srgb"){Ze.workingToColorSpace(Xt.copy(this),e);let{r:t,g:n,b:i}=Xt;if(e!=="srgb")return`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`;return`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Mi),this.setHSL(Mi.h+e,Mi.s+t,Mi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Mi),e.getHSL(Xo);let n=Dr(Mi.h,Xo.h,t),i=Dr(Mi.s,Xo.s,t),s=Dr(Mi.l,Xo.l,t);return this.setHSL(n,i,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*i,this.g=s[1]*t+s[4]*n+s[7]*i,this.b=s[2]*t+s[5]*n+s[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var Xt=new ae;ae.NAMES=Nm;class ss{constructor(e,t=0.00025){this.isFogExp2=!0,this.name="",this.color=new ae(e),this.density=t}clone(){return new ss(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class er extends Jt{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ai,this.environmentIntensity=1,this.environmentRotation=new Ai,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){if(super.copy(e,t),e.background!==null)this.background=e.background.clone();if(e.environment!==null)this.environment=e.environment.clone();if(e.fog!==null)this.fog=e.fog.clone();if(this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null)this.overrideMaterial=e.overrideMaterial.clone();return this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);if(this.fog!==null)t.object.fog=this.fog.toJSON();return t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}var Pn=new I,ti=new I,xd=new I,ni=new I,Fs=new I,Us=new I,Sf=new I,bd=new I,yd=new I,_d=new I,Sd=new Tt,Md=new Tt,wd=new Tt;class _n{constructor(e=new I,t=new I,n=new I){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),Pn.subVectors(e,t),i.cross(Pn);let s=i.lengthSq();if(s>0)return i.multiplyScalar(1/Math.sqrt(s));return i.set(0,0,0)}static getBarycoord(e,t,n,i,s){Pn.subVectors(i,t),ti.subVectors(n,t),xd.subVectors(e,t);let r=Pn.dot(Pn),o=Pn.dot(ti),a=Pn.dot(xd),l=ti.dot(ti),d=ti.dot(xd),c=r*l-o*o;if(c===0)return s.set(0,0,0),null;let h=1/c,u=(l*a-o*d)*h,p=(r*d-o*a)*h;return s.set(1-u-p,p,u)}static containsPoint(e,t,n,i){if(this.getBarycoord(e,t,n,i,ni)===null)return!1;return ni.x>=0&&ni.y>=0&&ni.x+ni.y<=1}static getInterpolation(e,t,n,i,s,r,o,a){if(this.getBarycoord(e,t,n,i,ni)===null){if(a.x=0,a.y=0,"z"in a)a.z=0;if("w"in a)a.w=0;return null}return a.setScalar(0),a.addScaledVector(s,ni.x),a.addScaledVector(r,ni.y),a.addScaledVector(o,ni.z),a}static getInterpolatedAttribute(e,t,n,i,s,r){return Sd.setScalar(0),Md.setScalar(0),wd.setScalar(0),Sd.fromBufferAttribute(e,t),Md.fromBufferAttribute(e,n),wd.fromBufferAttribute(e,i),r.setScalar(0),r.addScaledVector(Sd,s.x),r.addScaledVector(Md,s.y),r.addScaledVector(wd,s.z),r}static isFrontFacing(e,t,n,i){return Pn.subVectors(n,t),ti.subVectors(e,t),Pn.cross(ti).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Pn.subVectors(this.c,this.b),ti.subVectors(this.a,this.b),Pn.cross(ti).length()*0.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal(e){return _n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return _n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,s){return _n.getInterpolation(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return _n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return _n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,s=this.c,r,o;Fs.subVectors(i,n),Us.subVectors(s,n),bd.subVectors(e,n);let a=Fs.dot(bd),l=Us.dot(bd);if(a<=0&&l<=0)return t.copy(n);yd.subVectors(e,i);let d=Fs.dot(yd),c=Us.dot(yd);if(d>=0&&c<=d)return t.copy(i);let h=a*c-d*l;if(h<=0&&a>=0&&d<=0)return r=a/(a-d),t.copy(n).addScaledVector(Fs,r);_d.subVectors(e,s);let u=Fs.dot(_d),p=Us.dot(_d);if(p>=0&&u<=p)return t.copy(s);let g=u*l-a*p;if(g<=0&&l>=0&&p<=0)return o=l/(l-p),t.copy(n).addScaledVector(Us,o);let x=d*p-u*c;if(x<=0&&c-d>=0&&u-p>=0)return Sf.subVectors(s,i),o=(c-d)/(c-d+(u-p)),t.copy(i).addScaledVector(Sf,o);let m=1/(x+g+h);return r=g*m,o=h*m,t.copy(n).addScaledVector(Fs,r).addScaledVector(Us,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class li{constructor(e=new I(1/0,1/0,1/0),t=new I(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(In.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(In.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=In.copy(t).multiplyScalar(0.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let r=0,o=s.count;r<o;r++){if(e.isMesh===!0)e.getVertexPosition(r,In);else In.fromBufferAttribute(s,r);In.applyMatrix4(e.matrixWorld),this.expandByPoint(In)}else{if(e.boundingBox!==void 0){if(e.boundingBox===null)e.computeBoundingBox();Jo.copy(e.boundingBox)}else{if(n.boundingBox===null)n.computeBoundingBox();Jo.copy(n.boundingBox)}Jo.applyMatrix4(e.matrixWorld),this.union(Jo)}}let i=e.children;for(let s=0,r=i.length;s<r;s++)this.expandByObject(i[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,In),In.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;if(e.normal.x>0)t=e.normal.x*this.min.x,n=e.normal.x*this.max.x;else t=e.normal.x*this.max.x,n=e.normal.x*this.min.x;if(e.normal.y>0)t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y;else t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y;if(e.normal.z>0)t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z;else t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z;return t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Tr),Yo.subVectors(this.max,Tr),Ns.subVectors(e.a,Tr),Os.subVectors(e.b,Tr),Bs.subVectors(e.c,Tr),wi.subVectors(Os,Ns),Ei.subVectors(Bs,Os),Xi.subVectors(Ns,Bs);let t=[0,-wi.z,wi.y,0,-Ei.z,Ei.y,0,-Xi.z,Xi.y,wi.z,0,-wi.x,Ei.z,0,-Ei.x,Xi.z,0,-Xi.x,-wi.y,wi.x,0,-Ei.y,Ei.x,0,-Xi.y,Xi.x,0];if(!Ed(t,Ns,Os,Bs,Yo))return!1;if(t=[1,0,0,0,1,0,0,0,1],!Ed(t,Ns,Os,Bs,Yo))return!1;return qo.crossVectors(wi,Ei),t=[qo.x,qo.y,qo.z],Ed(t,Ns,Os,Bs,Yo)}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,In).distanceTo(e)}getBoundingSphere(e){if(this.isEmpty())e.makeEmpty();else this.getCenter(e.center),e.radius=this.getSize(In).length()*0.5;return e}intersect(e){if(this.min.max(e.min),this.max.min(e.max),this.isEmpty())this.makeEmpty();return this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){if(this.isEmpty())return this;return ii[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),ii[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),ii[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),ii[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),ii[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),ii[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),ii[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),ii[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(ii),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}var ii=[new I,new I,new I,new I,new I,new I,new I,new I],In=new I,Jo=new li,Ns=new I,Os=new I,Bs=new I,wi=new I,Ei=new I,Xi=new I,Tr=new I,Yo=new I,qo=new I,Ji=new I;function Ed(e,t,n,i,s){for(let r=0,o=e.length-3;r<=o;r+=3){Ji.fromArray(e,r);let a=s.x*Math.abs(Ji.x)+s.y*Math.abs(Ji.y)+s.z*Math.abs(Ji.z),l=t.dot(Ji),d=n.dot(Ji),c=i.dot(Ji);if(Math.max(-Math.max(l,d,c),Math.min(l,d,c))>a)return!1}return!0}var Ut=new I,Ko=new Ce,M_=0;class _t extends ai{constructor(e,t,n=!1){super();if(Array.isArray(e))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:M_++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Ko.fromBufferAttribute(this,t),Ko.applyMatrix3(e),this.setXY(t,Ko.x,Ko.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyMatrix3(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyMatrix4(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.applyNormalMatrix(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ut.fromBufferAttribute(this,t),Ut.transformDirection(e),this.setXYZ(t,Ut.x,Ut.y,Ut.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];if(this.normalized)n=Dn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=dt(n,this.array);return this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];if(this.normalized)t=Dn(t,this.array);return t}setX(e,t){if(this.normalized)t=dt(t,this.array);return this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];if(this.normalized)t=Dn(t,this.array);return t}setY(e,t){if(this.normalized)t=dt(t,this.array);return this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];if(this.normalized)t=Dn(t,this.array);return t}setZ(e,t){if(this.normalized)t=dt(t,this.array);return this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];if(this.normalized)t=Dn(t,this.array);return t}setW(e,t){if(this.normalized)t=dt(t,this.array);return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){if(e*=this.itemSize,this.normalized)t=dt(t,this.array),n=dt(n,this.array);return this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){if(e*=this.itemSize,this.normalized)t=dt(t,this.array),n=dt(n,this.array),i=dt(i,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){if(e*=this.itemSize,this.normalized)t=dt(t,this.array),n=dt(n,this.array),i=dt(i,this.array),s=dt(s,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class Ia extends _t{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Da extends _t{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Oe extends _t{constructor(e,t,n){super(new Float32Array(e),t,n)}}var w_=new li,Ar=new I,Td=new I;class Mn{constructor(e=new I,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;if(t!==void 0)n.copy(t);else w_.setFromPoints(e).getCenter(n);let i=0;for(let s=0,r=e.length;s<r;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);if(t.copy(e),n>this.radius*this.radius)t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center);return t}getBoundingBox(e){if(this.isEmpty())return e.makeEmpty(),e;return e.set(this.center,this.center),e.expandByScalar(this.radius),e}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ar.subVectors(e,this.center);let t=Ar.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*0.5;this.center.addScaledVector(Ar,i/n),this.radius+=i}return this}union(e){if(e.isEmpty())return this;if(this.isEmpty())return this.copy(e),this;if(this.center.equals(e.center)===!0)this.radius=Math.max(this.radius,e.radius);else Td.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ar.copy(e.center).add(Td)),this.expandByPoint(Ar.copy(e.center).sub(Td));return this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}var E_=0,yn=new Je,Ad=new Jt,ks=new I,mn=new li,Rr=new li,Gt=new I;class Qe extends ai{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:E_++}),this.uuid=ri(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){if(Array.isArray(e))this.index=new((qy(e))?Da:Ia)(e,1);else this.index=e;return this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;if(t!==void 0)t.applyMatrix4(e),t.needsUpdate=!0;let n=this.attributes.normal;if(n!==void 0){let s=new ke().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let i=this.attributes.tangent;if(i!==void 0)i.transformDirection(e),i.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this._transformed=!0,this}applyQuaternion(e){return yn.makeRotationFromQuaternion(e),this.applyMatrix4(yn),this}rotateX(e){return yn.makeRotationX(e),this.applyMatrix4(yn),this}rotateY(e){return yn.makeRotationY(e),this.applyMatrix4(yn),this}rotateZ(e){return yn.makeRotationZ(e),this.applyMatrix4(yn),this}translate(e,t,n){return yn.makeTranslation(e,t,n),this.applyMatrix4(yn),this}scale(e,t,n){return yn.makeScale(e,t,n),this.applyMatrix4(yn),this}lookAt(e){return Ad.lookAt(e),Ad.updateMatrix(),this.applyMatrix4(Ad.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ks).negate(),this.translate(ks.x,ks.y,ks.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,s=e.length;i<s;i++){let r=e[i];n.push(r.x,r.y,r.z||0)}this.setAttribute("position",new Oe(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let s=e[i];t.setXYZ(i,s.x,s.y,s.z||0)}if(e.length>t.count)ze("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");t.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new li;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Be("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new I(-1/0,-1/0,-1/0),new I(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let s=t[n];if(mn.setFromBufferAttribute(s),this.morphTargetsRelative)Gt.addVectors(this.boundingBox.min,mn.min),this.boundingBox.expandByPoint(Gt),Gt.addVectors(this.boundingBox.max,mn.max),this.boundingBox.expandByPoint(Gt);else this.boundingBox.expandByPoint(mn.min),this.boundingBox.expandByPoint(mn.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))Be('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new Mn;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Be("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new I,1/0);return}if(e){let n=this.boundingSphere.center;if(mn.setFromBufferAttribute(e),t)for(let s=0,r=t.length;s<r;s++){let o=t[s];if(Rr.setFromBufferAttribute(o),this.morphTargetsRelative)Gt.addVectors(mn.min,Rr.min),mn.expandByPoint(Gt),Gt.addVectors(mn.max,Rr.max),mn.expandByPoint(Gt);else mn.expandByPoint(Rr.min),mn.expandByPoint(Rr.max)}mn.getCenter(n);let i=0;for(let s=0,r=e.count;s<r;s++)Gt.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(Gt));if(t)for(let s=0,r=t.length;s<r;s++){let o=t[s],a=this.morphTargetsRelative;for(let l=0,d=o.count;l<d;l++){if(Gt.fromBufferAttribute(o,l),a)ks.fromBufferAttribute(e,l),Gt.add(ks);i=Math.max(i,n.distanceToSquared(Gt))}}if(this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius))Be('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Be("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:n,normal:i,uv:s}=t,r=this.getAttribute("tangent");if(r===void 0||r.count!==n.count)r=new _t(new Float32Array(4*n.count),4),this.setAttribute("tangent",r);let o=[],a=[];for(let y=0;y<n.count;y++)o[y]=new I,a[y]=new I;let l=new I,d=new I,c=new I,h=new Ce,u=new Ce,p=new Ce,g=new I,x=new I;function m(y,v,_){l.fromBufferAttribute(n,y),d.fromBufferAttribute(n,v),c.fromBufferAttribute(n,_),h.fromBufferAttribute(s,y),u.fromBufferAttribute(s,v),p.fromBufferAttribute(s,_),d.sub(l),c.sub(l),u.sub(h),p.sub(h);let z=1/(u.x*p.y-p.x*u.y);if(!isFinite(z))return;g.copy(d).multiplyScalar(p.y).addScaledVector(c,-u.y).multiplyScalar(z),x.copy(c).multiplyScalar(u.x).addScaledVector(d,-p.x).multiplyScalar(z),o[y].add(g),o[v].add(g),o[_].add(g),a[y].add(x),a[v].add(x),a[_].add(x)}let f=this.groups;if(f.length===0)f=[{start:0,count:e.count}];for(let y=0,v=f.length;y<v;++y){let _=f[y],{start:z,count:P}=_;for(let D=z,N=z+P;D<N;D+=3)m(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let T=new I,E=new I,b=new I,S=new I;function A(y){b.fromBufferAttribute(i,y),S.copy(b);let v=o[y];T.copy(v),T.sub(b.multiplyScalar(b.dot(v))).normalize(),E.crossVectors(S,v);let z=E.dot(a[y])<0?-1:1;r.setXYZW(y,T.x,T.y,T.z,z)}for(let y=0,v=f.length;y<v;++y){let _=f[y],{start:z,count:P}=_;for(let D=z,N=z+P;D<N;D+=3)A(e.getX(D+0)),A(e.getX(D+1)),A(e.getX(D+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new _t(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let h=0,u=n.count;h<u;h++)n.setXYZ(h,0,0,0);let i=new I,s=new I,r=new I,o=new I,a=new I,l=new I,d=new I,c=new I;if(e)for(let h=0,u=e.count;h<u;h+=3){let p=e.getX(h+0),g=e.getX(h+1),x=e.getX(h+2);i.fromBufferAttribute(t,p),s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,x),d.subVectors(r,s),c.subVectors(i,s),d.cross(c),o.fromBufferAttribute(n,p),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),o.add(d),a.add(d),l.add(d),n.setXYZ(p,o.x,o.y,o.z),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(x,l.x,l.y,l.z)}else for(let h=0,u=t.count;h<u;h+=3)i.fromBufferAttribute(t,h+0),s.fromBufferAttribute(t,h+1),r.fromBufferAttribute(t,h+2),d.subVectors(r,s),c.subVectors(i,s),d.cross(c),n.setXYZ(h+0,d.x,d.y,d.z),n.setXYZ(h+1,d.x,d.y,d.z),n.setXYZ(h+2,d.x,d.y,d.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Gt.fromBufferAttribute(e,t),Gt.normalize(),e.setXYZ(t,Gt.x,Gt.y,Gt.z)}toNonIndexed(){function e(o,a){let{array:l,itemSize:d,normalized:c}=o,h=new l.constructor(a.length*d),u=0,p=0;for(let g=0,x=a.length;g<x;g++){if(o.isInterleavedBufferAttribute)u=a[g]*o.data.stride+o.offset;else u=a[g]*d;for(let m=0;m<d;m++)h[p++]=l[u++]}return new _t(h,d,c)}if(this.index===null)return ze("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new Qe,n=this.index.array,i=this.attributes;for(let o in i){let a=i[o],l=e(a,n);t.setAttribute(o,l)}let s=this.morphAttributes;for(let o in s){let a=[],l=s[o];for(let d=0,c=l.length;d<c;d++){let h=l[d],u=e(h,n);a.push(u)}t.morphAttributes[o]=a}t.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,a=r.length;o<a;o++){let l=r[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0)e.userData=this.userData;if(this.parameters!==void 0&&this._transformed!==!0){let a=this.parameters;for(let l in a)if(a[l]!==void 0)e[l]=a[l];return e}e.data={attributes:{}};let t=this.index;if(t!==null)e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)};let n=this.attributes;for(let a in n){let l=n[a];e.data.attributes[a]=l.toJSON(e.data)}let i={},s=!1;for(let a in this.morphAttributes){let l=this.morphAttributes[a],d=[];for(let c=0,h=l.length;c<h;c++){let u=l[c];d.push(u.toJSON(e.data))}if(d.length>0)i[a]=d,s=!0}if(s)e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;if(r.length>0)e.data.groups=JSON.parse(JSON.stringify(r));let o=this.boundingSphere;if(o!==null)e.data.boundingSphere=o.toJSON();return e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;if(n!==null)this.setIndex(n.clone());let i=e.attributes;for(let l in i){let d=i[l];this.setAttribute(l,d.clone(t))}let s=e.morphAttributes;for(let l in s){let d=[],c=s[l];for(let h=0,u=c.length;h<u;h++)d.push(c[h].clone(t));this.morphAttributes[l]=d}this.morphTargetsRelative=e.morphTargetsRelative;let r=e.groups;for(let l=0,d=r.length;l<d;l++){let c=r[l];this.addGroup(c.start,c.count,c.materialIndex)}let o=e.boundingBox;if(o!==null)this.boundingBox=o.clone();let a=e.boundingSphere;if(a!==null)this.boundingSphere=a.clone();return this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}class za{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=ri()}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ri();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer;let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ri();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}}var rn=new I;class vn{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.applyMatrix4(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.applyNormalMatrix(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)rn.fromBufferAttribute(this,t),rn.transformDirection(e),this.setXYZ(t,rn.x,rn.y,rn.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];if(this.normalized)n=Dn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=dt(n,this.array);return this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){if(this.normalized)t=dt(t,this.array);return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){if(this.normalized)t=dt(t,this.array);return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){if(this.normalized)t=dt(t,this.array);return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){if(this.normalized)t=dt(t,this.array);return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];if(this.normalized)t=Dn(t,this.array);return t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];if(this.normalized)t=Dn(t,this.array);return t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];if(this.normalized)t=Dn(t,this.array);return t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];if(this.normalized)t=Dn(t,this.array);return t}setXY(e,t,n){if(e=e*this.data.stride+this.offset,this.normalized)t=dt(t,this.array),n=dt(n,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){if(e=e*this.data.stride+this.offset,this.normalized)t=dt(t,this.array),n=dt(n,this.array),i=dt(i,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){if(e=e*this.data.stride+this.offset,this.normalized)t=dt(t,this.array),n=dt(n,this.array),i=dt(i,this.array),s=dt(s,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){Fr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new _t(new this.array.constructor(t),this.itemSize,this.normalized)}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.clone(e);return new vn(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}}toJSON(e){if(e===void 0){Fr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e);return{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}}var Rd=new I,T_=new I,A_=new ke;class Vn{constructor(e=new I(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=Rd.subVectors(n,t).cross(T_.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(Rd),s=this.normal.dot(i);if(s===0){if(this.distanceToPoint(e.start)===0)return t.copy(e.start);return null}let r=-(e.start.dot(this.normal)+this.constant)/s;if(n===!0&&(r<0||r>1))return null;return t.copy(e.start).addScaledVector(i,r)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||A_.getNormalMatrix(e),i=this.coplanarPoint(Rd).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}var R_=0;class Ci extends ai{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:R_++}),this.uuid=ri(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ae(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){if(this._alphaTest>0!==e>0)this.version++;this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e===void 0)return;for(let t in e){let n=e[t];if(n===void 0){ze(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){ze(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}if(i&&i.isColor)i.set(n);else if(i&&i.isVector2&&(n&&n.isVector2)||i&&i.isEuler&&(n&&n.isEuler)||i&&i.isVector3&&(n&&n.isVector3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(t)e={textures:{},images:{}};let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor)n.color=this.color.getHex();if(this.roughness!==void 0)n.roughness=this.roughness;if(this.metalness!==void 0)n.metalness=this.metalness;if(this.sheen!==void 0)n.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)n.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)n.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)n.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0)n.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)n.specular=this.specular.getHex();if(this.specularIntensity!==void 0)n.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)n.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)n.shininess=this.shininess;if(this.clearcoat!==void 0)n.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)n.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.sheenColorMap&&this.sheenColorMap.isTexture)n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid;if(this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture)n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid;if(this.dispersion!==void 0)n.dispersion=this.dispersion;if(this.retroreflectivity!==void 0)n.retroreflectivity=this.retroreflectivity;if(this.iridescence!==void 0)n.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)n.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)n.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid;if(this.anisotropy!==void 0)n.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)n.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid;if(this.map&&this.map.isTexture)n.map=this.map.toJSON(e).uuid;if(this.matcap&&this.matcap.isTexture)n.matcap=this.matcap.toJSON(e).uuid;if(this.alphaMap&&this.alphaMap.isTexture)n.alphaMap=this.alphaMap.toJSON(e).uuid;if(this.lightMap&&this.lightMap.isTexture)n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)n.roughnessMap=this.roughnessMap.toJSON(e).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)n.metalnessMap=this.metalnessMap.toJSON(e).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)n.emissiveMap=this.emissiveMap.toJSON(e).uuid;if(this.specularMap&&this.specularMap.isTexture)n.specularMap=this.specularMap.toJSON(e).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)n.specularColorMap=this.specularColorMap.toJSON(e).uuid;if(this.envMap&&this.envMap.isTexture){if(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0)n.combine=this.combine}if(this.envMapRotation!==void 0)n.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)n.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)n.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)n.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)n.gradientMap=this.gradientMap.toJSON(e).uuid;if(this.transmission!==void 0)n.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)n.transmissionMap=this.transmissionMap.toJSON(e).uuid;if(this.thickness!==void 0)n.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)n.thicknessMap=this.thicknessMap.toJSON(e).uuid;if(this.attenuationDistance!==void 0)n.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)n.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)n.size=this.size;if(this.sizeAttenuation!==void 0)n.sizeAttenuation=this.sizeAttenuation;if(Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0)n.clippingPlanes=this.clippingPlanes.map((s)=>s.toJSON());if(this.rotation!==void 0)n.rotation=this.rotation;if(this.depthPacking!==void 0)n.depthPacking=this.depthPacking;if(this.linewidth!==void 0)n.linewidth=this.linewidth;if(this.linecap!==void 0)n.linecap=this.linecap;if(this.linejoin!==void 0)n.linejoin=this.linejoin;if(this.dashSize!==void 0)n.dashSize=this.dashSize;if(this.gapSize!==void 0)n.gapSize=this.gapSize;if(this.scale!==void 0)n.scale=this.scale;if(this.wireframe!==void 0)n.wireframe=this.wireframe;if(this.wireframeLinewidth!==void 0)n.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!==void 0)n.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!==void 0)n.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading!==void 0)n.flatShading=this.flatShading;if(this.fog!==void 0)n.fog=this.fog;if(Object.keys(this.userData).length>0)n.userData=this.userData;function i(s){let r=[];for(let o in s){let a=s[o];delete a.metadata,r.push(a)}return r}if(t){let s=i(e.textures),r=i(e.images);if(s.length>0)n.textures=s;if(r.length>0)n.images=r}return n}fromJSON(e,t){if(e.uuid!==void 0)this.uuid=e.uuid;if(e.name!==void 0)this.name=e.name;if(e.color!==void 0&&this.color!==void 0)this.color.setHex(e.color);if(e.roughness!==void 0)this.roughness=e.roughness;if(e.metalness!==void 0)this.metalness=e.metalness;if(e.sheen!==void 0)this.sheen=e.sheen;if(e.sheenColor!==void 0)this.sheenColor=new ae().setHex(e.sheenColor);if(e.sheenRoughness!==void 0)this.sheenRoughness=e.sheenRoughness;if(e.emissive!==void 0&&this.emissive!==void 0)this.emissive.setHex(e.emissive);if(e.specular!==void 0&&this.specular!==void 0)this.specular.setHex(e.specular);if(e.specularIntensity!==void 0)this.specularIntensity=e.specularIntensity;if(e.specularColor!==void 0&&this.specularColor!==void 0)this.specularColor.setHex(e.specularColor);if(e.shininess!==void 0)this.shininess=e.shininess;if(e.clearcoat!==void 0)this.clearcoat=e.clearcoat;if(e.clearcoatRoughness!==void 0)this.clearcoatRoughness=e.clearcoatRoughness;if(e.dispersion!==void 0)this.dispersion=e.dispersion;if(e.retroreflectivity!==void 0)this.retroreflectivity=e.retroreflectivity;if(e.iridescence!==void 0)this.iridescence=e.iridescence;if(e.iridescenceIOR!==void 0)this.iridescenceIOR=e.iridescenceIOR;if(e.iridescenceThicknessRange!==void 0)this.iridescenceThicknessRange=e.iridescenceThicknessRange;if(e.transmission!==void 0)this.transmission=e.transmission;if(e.thickness!==void 0)this.thickness=e.thickness;if(e.attenuationDistance!==void 0)this.attenuationDistance=e.attenuationDistance;if(e.attenuationColor!==void 0&&this.attenuationColor!==void 0)this.attenuationColor.setHex(e.attenuationColor);if(e.anisotropy!==void 0)this.anisotropy=e.anisotropy;if(e.anisotropyRotation!==void 0)this.anisotropyRotation=e.anisotropyRotation;if(e.fog!==void 0)this.fog=e.fog;if(e.flatShading!==void 0)this.flatShading=e.flatShading;if(e.blending!==void 0)this.blending=e.blending;if(e.combine!==void 0)this.combine=e.combine;if(e.side!==void 0)this.side=e.side;if(e.shadowSide!==void 0)this.shadowSide=e.shadowSide;if(e.opacity!==void 0)this.opacity=e.opacity;if(e.transparent!==void 0)this.transparent=e.transparent;if(e.alphaTest!==void 0)this.alphaTest=e.alphaTest;if(e.alphaHash!==void 0)this.alphaHash=e.alphaHash;if(e.depthFunc!==void 0)this.depthFunc=e.depthFunc;if(e.depthTest!==void 0)this.depthTest=e.depthTest;if(e.depthWrite!==void 0)this.depthWrite=e.depthWrite;if(e.colorWrite!==void 0)this.colorWrite=e.colorWrite;if(e.clippingPlanes!==void 0)this.clippingPlanes=e.clippingPlanes.map((n)=>new Vn().fromJSON(n));if(e.clipIntersection!==void 0)this.clipIntersection=e.clipIntersection;if(e.clipShadows!==void 0)this.clipShadows=e.clipShadows;if(e.depthPacking!==void 0)this.depthPacking=e.depthPacking;if(e.blendSrc!==void 0)this.blendSrc=e.blendSrc;if(e.blendDst!==void 0)this.blendDst=e.blendDst;if(e.blendEquation!==void 0)this.blendEquation=e.blendEquation;if(e.blendSrcAlpha!==void 0)this.blendSrcAlpha=e.blendSrcAlpha;if(e.blendDstAlpha!==void 0)this.blendDstAlpha=e.blendDstAlpha;if(e.blendEquationAlpha!==void 0)this.blendEquationAlpha=e.blendEquationAlpha;if(e.blendColor!==void 0&&this.blendColor!==void 0)this.blendColor.setHex(e.blendColor);if(e.blendAlpha!==void 0)this.blendAlpha=e.blendAlpha;if(e.stencilWriteMask!==void 0)this.stencilWriteMask=e.stencilWriteMask;if(e.stencilFunc!==void 0)this.stencilFunc=e.stencilFunc;if(e.stencilRef!==void 0)this.stencilRef=e.stencilRef;if(e.stencilFuncMask!==void 0)this.stencilFuncMask=e.stencilFuncMask;if(e.stencilFail!==void 0)this.stencilFail=e.stencilFail;if(e.stencilZFail!==void 0)this.stencilZFail=e.stencilZFail;if(e.stencilZPass!==void 0)this.stencilZPass=e.stencilZPass;if(e.stencilWrite!==void 0)this.stencilWrite=e.stencilWrite;if(e.wireframe!==void 0)this.wireframe=e.wireframe;if(e.wireframeLinewidth!==void 0)this.wireframeLinewidth=e.wireframeLinewidth;if(e.wireframeLinecap!==void 0)this.wireframeLinecap=e.wireframeLinecap;if(e.wireframeLinejoin!==void 0)this.wireframeLinejoin=e.wireframeLinejoin;if(e.rotation!==void 0)this.rotation=e.rotation;if(e.linewidth!==void 0)this.linewidth=e.linewidth;if(e.linecap!==void 0)this.linecap=e.linecap;if(e.linejoin!==void 0)this.linejoin=e.linejoin;if(e.dashSize!==void 0)this.dashSize=e.dashSize;if(e.gapSize!==void 0)this.gapSize=e.gapSize;if(e.scale!==void 0)this.scale=e.scale;if(e.polygonOffset!==void 0)this.polygonOffset=e.polygonOffset;if(e.polygonOffsetFactor!==void 0)this.polygonOffsetFactor=e.polygonOffsetFactor;if(e.polygonOffsetUnits!==void 0)this.polygonOffsetUnits=e.polygonOffsetUnits;if(e.dithering!==void 0)this.dithering=e.dithering;if(e.alphaToCoverage!==void 0)this.alphaToCoverage=e.alphaToCoverage;if(e.premultipliedAlpha!==void 0)this.premultipliedAlpha=e.premultipliedAlpha;if(e.forceSinglePass!==void 0)this.forceSinglePass=e.forceSinglePass;if(e.allowOverride!==void 0)this.allowOverride=e.allowOverride;if(e.visible!==void 0)this.visible=e.visible;if(e.toneMapped!==void 0)this.toneMapped=e.toneMapped;if(e.userData!==void 0)this.userData=e.userData;if(e.vertexColors!==void 0)if(typeof e.vertexColors==="number")this.vertexColors=e.vertexColors>0;else this.vertexColors=e.vertexColors;if(e.size!==void 0)this.size=e.size;if(e.sizeAttenuation!==void 0)this.sizeAttenuation=e.sizeAttenuation;if(e.map!==void 0)this.map=t[e.map]||null;if(e.matcap!==void 0)this.matcap=t[e.matcap]||null;if(e.alphaMap!==void 0)this.alphaMap=t[e.alphaMap]||null;if(e.bumpMap!==void 0)this.bumpMap=t[e.bumpMap]||null;if(e.bumpScale!==void 0)this.bumpScale=e.bumpScale;if(e.normalMap!==void 0)this.normalMap=t[e.normalMap]||null;if(e.normalMapType!==void 0)this.normalMapType=e.normalMapType;if(e.normalScale!==void 0){let n=e.normalScale;if(Array.isArray(n)===!1)n=[n,n];this.normalScale=new Ce().fromArray(n)}if(e.displacementMap!==void 0)this.displacementMap=t[e.displacementMap]||null;if(e.displacementScale!==void 0)this.displacementScale=e.displacementScale;if(e.displacementBias!==void 0)this.displacementBias=e.displacementBias;if(e.roughnessMap!==void 0)this.roughnessMap=t[e.roughnessMap]||null;if(e.metalnessMap!==void 0)this.metalnessMap=t[e.metalnessMap]||null;if(e.emissiveMap!==void 0)this.emissiveMap=t[e.emissiveMap]||null;if(e.emissiveIntensity!==void 0)this.emissiveIntensity=e.emissiveIntensity;if(e.specularMap!==void 0)this.specularMap=t[e.specularMap]||null;if(e.specularIntensityMap!==void 0)this.specularIntensityMap=t[e.specularIntensityMap]||null;if(e.specularColorMap!==void 0)this.specularColorMap=t[e.specularColorMap]||null;if(e.envMap!==void 0)this.envMap=t[e.envMap]||null;if(e.envMapRotation!==void 0)this.envMapRotation.fromArray(e.envMapRotation);if(e.envMapIntensity!==void 0)this.envMapIntensity=e.envMapIntensity;if(e.reflectivity!==void 0)this.reflectivity=e.reflectivity;if(e.refractionRatio!==void 0)this.refractionRatio=e.refractionRatio;if(e.lightMap!==void 0)this.lightMap=t[e.lightMap]||null;if(e.lightMapIntensity!==void 0)this.lightMapIntensity=e.lightMapIntensity;if(e.aoMap!==void 0)this.aoMap=t[e.aoMap]||null;if(e.aoMapIntensity!==void 0)this.aoMapIntensity=e.aoMapIntensity;if(e.gradientMap!==void 0)this.gradientMap=t[e.gradientMap]||null;if(e.clearcoatMap!==void 0)this.clearcoatMap=t[e.clearcoatMap]||null;if(e.clearcoatRoughnessMap!==void 0)this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null;if(e.clearcoatNormalMap!==void 0)this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null;if(e.clearcoatNormalScale!==void 0)this.clearcoatNormalScale=new Ce().fromArray(e.clearcoatNormalScale);if(e.iridescenceMap!==void 0)this.iridescenceMap=t[e.iridescenceMap]||null;if(e.iridescenceThicknessMap!==void 0)this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null;if(e.transmissionMap!==void 0)this.transmissionMap=t[e.transmissionMap]||null;if(e.thicknessMap!==void 0)this.thicknessMap=t[e.thicknessMap]||null;if(e.anisotropyMap!==void 0)this.anisotropyMap=t[e.anisotropyMap]||null;if(e.sheenColorMap!==void 0)this.sheenColorMap=t[e.sheenColorMap]||null;if(e.sheenRoughnessMap!==void 0)this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null;return this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=Array(i);for(let s=0;s!==i;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){if(e===!0)this.version++}}var si=new I,Cd=new I,Zo=new I,Qo=new I;class Qr{constructor(e=new I,t=new I(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,si)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);if(n<0)return t.copy(this.origin);return t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=si.subVectors(e,this.origin).dot(this.direction);if(t<0)return this.origin.distanceToSquared(e);return si.copy(this.origin).addScaledVector(this.direction,t),si.distanceToSquared(e)}distanceSqToSegment(e,t,n,i){Cd.copy(e).add(t).multiplyScalar(0.5),Zo.copy(t).sub(e).normalize(),Qo.copy(this.origin).sub(Cd);let s=e.distanceTo(t)*0.5,r=-this.direction.dot(Zo),o=Qo.dot(this.direction),a=-Qo.dot(Zo),l=Qo.lengthSq(),d=Math.abs(1-r*r),c,h,u,p;if(d>0)if(c=r*a-o,h=r*o-a,p=s*d,c>=0)if(h>=-p)if(h<=p){let g=1/d;c*=g,h*=g,u=c*(c+r*h+2*o)+h*(r*c+h+2*a)+l}else h=s,c=Math.max(0,-(r*h+o)),u=-c*c+h*(h+2*a)+l;else h=-s,c=Math.max(0,-(r*h+o)),u=-c*c+h*(h+2*a)+l;else if(h<=-p)c=Math.max(0,-(-r*s+o)),h=c>0?-s:Math.min(Math.max(-s,-a),s),u=-c*c+h*(h+2*a)+l;else if(h<=p)c=0,h=Math.min(Math.max(-s,-a),s),u=h*(h+2*a)+l;else c=Math.max(0,-(r*s+o)),h=c>0?s:Math.min(Math.max(-s,-a),s),u=-c*c+h*(h+2*a)+l;else h=r>0?-s:s,c=Math.max(0,-(r*h+o)),u=-c*c+h*(h+2*a)+l;if(n)n.copy(this.origin).addScaledVector(this.direction,c);if(i)i.copy(Cd).addScaledVector(Zo,h);return u}intersectSphere(e,t){if(e.radius<0)return null;si.subVectors(e.center,this.origin);let n=si.dot(this.direction),i=si.dot(si)-n*n,s=e.radius*e.radius;if(i>s)return null;let r=Math.sqrt(s-i),o=n-r,a=n+r;if(a<0)return null;if(o<0)return this.at(a,t);return this.at(o,t)}intersectsSphere(e){if(e.radius<0)return!1;return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0){if(e.distanceToPoint(this.origin)===0)return 0;return null}let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);if(n===null)return null;return this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);if(t===0)return!0;if(e.normal.dot(this.direction)*t<0)return!0;return!1}intersectBox(e,t){let n,i,s,r,o,a,l=1/this.direction.x,d=1/this.direction.y,c=1/this.direction.z,h=this.origin;if(l>=0)n=(e.min.x-h.x)*l,i=(e.max.x-h.x)*l;else n=(e.max.x-h.x)*l,i=(e.min.x-h.x)*l;if(d>=0)s=(e.min.y-h.y)*d,r=(e.max.y-h.y)*d;else s=(e.max.y-h.y)*d,r=(e.min.y-h.y)*d;if(n>r||s>i)return null;if(s>n||isNaN(n))n=s;if(r<i||isNaN(i))i=r;if(c>=0)o=(e.min.z-h.z)*c,a=(e.max.z-h.z)*c;else o=(e.max.z-h.z)*c,a=(e.min.z-h.z)*c;if(n>a||o>i)return null;if(o>n||n!==n)n=o;if(a<i||i!==i)i=a;if(i<0)return null;return this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,si)!==null}intersectTriangle(e,t,n,i,s){let r=this.origin,o=this.direction,{x:a,y:l,z:d}=o,c=e.x-r.x,h=e.y-r.y,u=e.z-r.z,p=t.x-r.x,g=t.y-r.y,x=t.z-r.z,m=n.x-r.x,f=n.y-r.y,T=n.z-r.z,E=Math.abs(a),b=Math.abs(l),S=Math.abs(d),A,y,v,_,z,P,D,N,C,B,k,G;if(E>=b&&E>=S)if(v=a,P=c,C=p,G=m,a>=0)A=l,y=d,_=h,z=u,D=g,N=x,B=f,k=T;else A=d,y=l,_=u,z=h,D=x,N=g,B=T,k=f;else if(b>=S)if(v=l,P=h,C=g,G=f,l>=0)A=d,y=a,_=u,z=c,D=x,N=p,B=T,k=m;else A=a,y=d,_=c,z=u,D=p,N=x,B=m,k=T;else if(v=d,P=u,C=x,G=T,d>=0)A=a,y=l,_=c,z=h,D=p,N=g,B=m,k=f;else A=l,y=a,_=h,z=c,D=g,N=p,B=f,k=m;if(v===0)return null;let Q=A/v,W=y/v,q=1/v,ee=_-Q*P,xe=z-W*P,_e=D-Q*C,Ve=N-W*C,Fe=B-Q*G,J=k-W*G,te=Fe*Ve-J*_e,se=ee*J-xe*Fe,Re=_e*xe-Ve*ee;if(i){if(te<0||se<0||Re<0)return null}else if((te<0||se<0||Re<0)&&(te>0||se>0||Re>0))return null;let Pe=te+se+Re;if(Pe===0)return null;let Ee=q*(te*P+se*C+Re*G);if(Pe>0?Ee<0:Ee>0)return null;return this.at(Ee/Pe,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class At extends Ci{constructor(e){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ae(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ai,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}var Mf=new Je,Yi=new Qr,$o=new Mn,wf=new I,ea=new I,ta=new I,na=new I,Ld=new I,ia=new I,Ef=new I,sa=new I;class nt extends Jt{constructor(e=new Qe,t=new At){super();this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){if(super.copy(e,t),e.morphTargetInfluences!==void 0)this.morphTargetInfluences=e.morphTargetInfluences.slice();if(e.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary);return this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,r=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(s&&o){ia.set(0,0,0);for(let a=0,l=s.length;a<l;a++){let d=o[a],c=s[a];if(d===0)continue;if(Ld.fromBufferAttribute(c,e),r)ia.addScaledVector(Ld,d);else ia.addScaledVector(Ld.sub(t),d)}t.add(ia)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,s=this.matrixWorld;if(i===void 0)return;if(n.boundingSphere===null)n.computeBoundingSphere();if($o.copy(n.boundingSphere),$o.applyMatrix4(s),Yi.copy(e.ray).recast(e.near),$o.containsPoint(Yi.origin)===!1){if(Yi.intersectSphere($o,wf)===null)return;if(Yi.origin.distanceToSquared(wf)>(e.far-e.near)**2)return}if(Mf.copy(s).invert(),Yi.copy(e.ray).applyMatrix4(Mf),n.boundingBox!==null){if(Yi.intersectsBox(n.boundingBox)===!1)return}this._computeIntersections(e,t,Yi)}_computeIntersections(e,t,n){let i,s=this.geometry,r=this.material,o=s.index,a=s.attributes.position,l=s.attributes.uv,d=s.attributes.uv1,c=s.attributes.normal,{groups:h,drawRange:u}=s;if(o!==null)if(Array.isArray(r))for(let p=0,g=h.length;p<g;p++){let x=h[p],m=r[x.materialIndex],f=Math.max(x.start,u.start),T=Math.min(o.count,Math.min(x.start+x.count,u.start+u.count));for(let E=f,b=T;E<b;E+=3){let S=o.getX(E),A=o.getX(E+1),y=o.getX(E+2);if(i=ra(this,m,e,n,l,d,c,S,A,y),i)i.faceIndex=Math.floor(E/3),i.face.materialIndex=x.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(o.count,u.start+u.count);for(let x=p,m=g;x<m;x+=3){let f=o.getX(x),T=o.getX(x+1),E=o.getX(x+2);if(i=ra(this,r,e,n,l,d,c,f,T,E),i)i.faceIndex=Math.floor(x/3),t.push(i)}}else if(a!==void 0)if(Array.isArray(r))for(let p=0,g=h.length;p<g;p++){let x=h[p],m=r[x.materialIndex],f=Math.max(x.start,u.start),T=Math.min(a.count,Math.min(x.start+x.count,u.start+u.count));for(let E=f,b=T;E<b;E+=3){let S=E,A=E+1,y=E+2;if(i=ra(this,m,e,n,l,d,c,S,A,y),i)i.faceIndex=Math.floor(E/3),i.face.materialIndex=x.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(a.count,u.start+u.count);for(let x=p,m=g;x<m;x+=3){let f=x,T=x+1,E=x+2;if(i=ra(this,r,e,n,l,d,c,f,T,E),i)i.faceIndex=Math.floor(x/3),t.push(i)}}}}function C_(e,t,n,i,s,r,o,a){let l;if(t.side===1)l=i.intersectTriangle(o,r,s,!0,a);else l=i.intersectTriangle(s,r,o,t.side===0,a);if(l===null)return null;sa.copy(a),sa.applyMatrix4(e.matrixWorld);let d=n.ray.origin.distanceTo(sa);if(d<n.near||d>n.far)return null;return{distance:d,point:sa.clone(),object:e}}function ra(e,t,n,i,s,r,o,a,l,d){e.getVertexPosition(a,ea),e.getVertexPosition(l,ta),e.getVertexPosition(d,na);let c=C_(e,t,n,i,ea,ta,na,Ef);if(c){let h=new I;if(_n.getBarycoord(Ef,ea,ta,na,h),s)c.uv=_n.getInterpolatedAttribute(s,a,l,d,h,new Ce);if(r)c.uv1=_n.getInterpolatedAttribute(r,a,l,d,h,new Ce);if(o){if(c.normal=_n.getInterpolatedAttribute(o,a,l,d,h,new I),c.normal.dot(i.direction)>0)c.normal.multiplyScalar(-1)}let u={a,b:l,c:d,normal:new I,materialIndex:0};_n.getNormal(ea,ta,na,u.normal),c.face=u,c.barycoord=h}return c}class di extends Nt{constructor(e=null,t=1,n=1,i,s,r,o,a,l=1003,d=1003,c,h){super(null,r,o,a,l,d,i,s,c,h);this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Wn extends _t{constructor(e,t,n,i=1){super(e,t,n);this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}var Gs=new Je,Tf=new Je,oa=[],Af=new li,L_=new Je,Cr=new nt,Lr=new Mn;class tr extends nt{constructor(e,t,n){super(e,t);this.isInstancedMesh=!0,this.instanceMatrix=new Wn(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,L_)}computeBoundingBox(){let e=this.geometry,t=this.count;if(this.boundingBox===null)this.boundingBox=new li;if(e.boundingBox===null)e.computeBoundingBox();this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Gs),Af.copy(e.boundingBox).applyMatrix4(Gs),this.boundingBox.union(Af)}computeBoundingSphere(){let e=this.geometry,t=this.count;if(this.boundingSphere===null)this.boundingSphere=new Mn;if(e.boundingSphere===null)e.computeBoundingSphere();this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Gs),Lr.copy(e.boundingSphere).applyMatrix4(Gs),this.boundingSphere.union(Lr)}copy(e,t){if(super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null)this.morphTexture=e.morphTexture.clone();if(e.instanceColor!==null)this.instanceColor=e.instanceColor.clone();if(this.count=e.count,e.boundingBox!==null)this.boundingBox=e.boundingBox.clone();if(e.boundingSphere!==null)this.boundingSphere=e.boundingSphere.clone();return this}getColorAt(e,t){if(this.instanceColor===null)return t.setRGB(1,1,1);else return t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,r=e*s+1;for(let o=0;o<n.length;o++)n[o]=i[r+o]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(Cr.geometry=this.geometry,Cr.material=this.material,Cr.material===void 0)return;if(this.boundingSphere===null)this.computeBoundingSphere();if(Lr.copy(this.boundingSphere),Lr.applyMatrix4(n),e.ray.intersectsSphere(Lr)===!1)return;for(let s=0;s<i;s++){this.getMatrixAt(s,Gs),Tf.multiplyMatrices(n,Gs),Cr.matrixWorld=Tf,Cr.raycast(e,oa);for(let r=0,o=oa.length;r<o;r++){let a=oa[r];a.instanceId=s,a.object=this,t.push(a)}oa.length=0}}setColorAt(e,t){if(this.instanceColor===null)this.instanceColor=new Wn(new Float32Array(this.instanceMatrix.count*3).fill(1),3);return t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;if(this.morphTexture===null)this.morphTexture=new di(new Float32Array(i*this.count),i,this.count,1028,1015);let s=this.morphTexture.source.data.data,r=0;for(let l=0;l<n.length;l++)r+=n[l];let o=this.geometry.morphTargetsRelative?1:1-r,a=i*e;return s[a]=o,s.set(n,a+1),this}updateMorphTargets(){}dispose(){if(super.dispose(),this.morphTexture!==null)this.morphTexture.dispose(),this.morphTexture=null}}var qi=new Mn,P_=new Ce(0.5,0.5),aa=new I;class Fa{constructor(e=new Vn,t=new Vn,n=new Vn,i=new Vn,s=new Vn,r=new Vn){this.planes=[e,t,n,i,s,r]}set(e,t,n,i,s,r){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(r),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2000,n=!1){let i=this.planes,s=e.elements,r=s[0],o=s[1],a=s[2],l=s[3],d=s[4],c=s[5],h=s[6],u=s[7],p=s[8],g=s[9],x=s[10],m=s[11],f=s[12],T=s[13],E=s[14],b=s[15];if(i[0].setComponents(l-r,u-d,m-p,b-f).normalize(),i[1].setComponents(l+r,u+d,m+p,b+f).normalize(),i[2].setComponents(l+o,u+c,m+g,b+T).normalize(),i[3].setComponents(l-o,u-c,m-g,b-T).normalize(),n)i[4].setComponents(a,h,x,E).normalize(),i[5].setComponents(l-a,u-h,m-x,b-E).normalize();else if(i[4].setComponents(l-a,u-h,m-x,b-E).normalize(),t===2000)i[5].setComponents(l+a,u+h,m+x,b+E).normalize();else if(t===2001)i[5].setComponents(a,h,x,E).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0){if(e.boundingSphere===null)e.computeBoundingSphere();qi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld)}else{let t=e.geometry;if(t.boundingSphere===null)t.computeBoundingSphere();qi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(qi)}intersectsSprite(e){qi.center.set(0,0,0);let t=P_.distanceTo(e.center);return qi.radius=0.7071067811865476+t,qi.applyMatrix4(e.matrixWorld),this.intersectsSphere(qi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(aa.x=i.normal.x>0?e.max.x:e.min.x,aa.y=i.normal.y>0?e.max.y:e.min.y,aa.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(aa)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Li extends Ci{constructor(e){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ae(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}var fa=new I,ma=new I,Rf=new Je,Pr=new Qr,la=new Mn,Pd=new I,Cf=new I;class Ua extends Jt{constructor(e=new Qe,t=new Li){super();this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)fa.fromBufferAttribute(t,i-1),ma.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=fa.distanceTo(ma);e.setAttribute("lineDistance",new Oe(n,1))}else ze("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,r=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(la.copy(n.boundingSphere),la.applyMatrix4(i),la.radius+=s,e.ray.intersectsSphere(la)===!1)return;Rf.copy(i).invert(),Pr.copy(e.ray).applyMatrix4(Rf);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=this.isLineSegments?2:1,d=n.index,h=n.attributes.position;if(d!==null){let u=Math.max(0,r.start),p=Math.min(d.count,r.start+r.count);for(let g=u,x=p-1;g<x;g+=l){let m=d.getX(g),f=d.getX(g+1),T=da(this,e,Pr,a,m,f,g);if(T)t.push(T)}if(this.isLineLoop){let g=d.getX(p-1),x=d.getX(u),m=da(this,e,Pr,a,g,x,p-1);if(m)t.push(m)}}else{let u=Math.max(0,r.start),p=Math.min(h.count,r.start+r.count);for(let g=u,x=p-1;g<x;g+=l){let m=da(this,e,Pr,a,g,g+1,g);if(m)t.push(m)}if(this.isLineLoop){let g=da(this,e,Pr,a,p-1,u,p-1);if(g)t.push(g)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function da(e,t,n,i,s,r,o){let a=e.geometry.attributes.position;if(fa.fromBufferAttribute(a,s),ma.fromBufferAttribute(a,r),n.distanceSqToSegment(fa,ma,Pd,Cf)>i)return;Pd.applyMatrix4(e.matrixWorld);let d=t.ray.origin.distanceTo(Pd);if(d<t.near||d>t.far)return;return{distance:d,point:Cf.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}var Lf=new I,Pf=new I;class wn extends Ua{constructor(e,t){super(e,t);this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)Lf.fromBufferAttribute(t,i),Pf.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Lf.distanceTo(Pf);e.setAttribute("lineDistance",new Oe(n,1))}else ze("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Na extends Ua{constructor(e,t){super(e,t);this.isLineLoop=!0,this.type="LineLoop"}}class Rc extends Ci{constructor(e){super();this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ae(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}var If=new Je,Dd=new Qr,ca=new Mn,ua=new I;class rs extends Jt{constructor(e=new Qe,t=new Rc){super();this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,r=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(ca.copy(n.boundingSphere),ca.applyMatrix4(i),ca.radius+=s,e.ray.intersectsSphere(ca)===!1)return;If.copy(i).invert(),Dd.copy(e.ray).applyMatrix4(If);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=n.index,c=n.attributes.position;if(l!==null){let h=Math.max(0,r.start),u=Math.min(l.count,r.start+r.count);for(let p=h,g=u;p<g;p++){let x=l.getX(p);ua.fromBufferAttribute(c,x),Df(ua,x,a,i,e,t,this)}}else{let h=Math.max(0,r.start),u=Math.min(c.count,r.start+r.count);for(let p=h,g=u;p<g;p++)ua.fromBufferAttribute(c,p),Df(ua,p,a,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Df(e,t,n,i,s,r,o){let a=Dd.distanceSqToPoint(e);if(a<n){let l=new I;Dd.closestPointToPoint(e,l),l.applyMatrix4(i);let d=s.ray.origin.distanceTo(l);if(d<s.near||d>s.far)return;r.push({distance:d,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class Oa extends Nt{constructor(e=[],t=301,n,i,s,r,o,a,l,d){super(e,t,n,i,s,r,o,a,l,d);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class os extends Nt{constructor(e,t,n=1014,i,s,r,o=1003,a=1003,l,d=1026,c=1){if(d!==1026&&d!==1027)throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:c};super(h,i,s,r,o,a,d,n,l);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Kr(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class Cc extends os{constructor(e,t=1014,n=301,i,s,r=1003,o=1003,a,l=1026){let d={width:e,height:e,depth:1},c=[d,d,d,d,d,d];super(e,e,t,n,i,s,r,o,a,l);this.image=c,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Ba extends Nt{constructor(e=null){super();this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Zt extends Qe{constructor(e=1,t=1,n=1,i=1,s=1,r=1){super();this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:r};let o=this;i=Math.floor(i),s=Math.floor(s),r=Math.floor(r);let a=[],l=[],d=[],c=[],h=0,u=0;p("z","y","x",-1,-1,n,t,e,r,s,0),p("z","y","x",1,-1,n,t,-e,r,s,1),p("x","z","y",1,1,e,n,t,i,r,2),p("x","z","y",1,-1,e,n,-t,i,r,3),p("x","y","z",1,-1,e,t,n,i,s,4),p("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(a),this.setAttribute("position",new Oe(l,3)),this.setAttribute("normal",new Oe(d,3)),this.setAttribute("uv",new Oe(c,2));function p(g,x,m,f,T,E,b,S,A,y,v){let _=E/A,z=b/y,P=E/2,D=b/2,N=S/2,C=A+1,B=y+1,k=0,G=0,Q=new I;for(let W=0;W<B;W++){let q=W*z-D;for(let ee=0;ee<C;ee++){let xe=ee*_-P;Q[g]=xe*f,Q[x]=q*T,Q[m]=N,l.push(Q.x,Q.y,Q.z),Q[g]=0,Q[x]=0,Q[m]=S>0?1:-1,d.push(Q.x,Q.y,Q.z),c.push(ee/A),c.push(1-W/y),k+=1}}for(let W=0;W<y;W++)for(let q=0;q<A;q++){let ee=h+q+C*W,xe=h+q+C*(W+1),_e=h+(q+1)+C*(W+1),Ve=h+(q+1)+C*W;a.push(ee,xe,Ve),a.push(xe,_e,Ve),G+=6}o.addGroup(u,G,v),u+=G,h+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Zt(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class nr extends Qe{constructor(e=1,t=32,n=0,i=Math.PI*2){super();this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let s=[],r=[],o=[],a=[],l=new I,d=new Ce;r.push(0,0,0),o.push(0,0,1),a.push(0.5,0.5);for(let c=0,h=3;c<=t;c++,h+=3){let u=n+c/t*i;l.x=e*Math.cos(u),l.y=e*Math.sin(u),r.push(l.x,l.y,l.z),o.push(0,0,1),d.x=(r[h]/e+1)/2,d.y=(r[h+1]/e+1)/2,a.push(d.x,d.y)}for(let c=1;c<=t;c++)s.push(c,c+1,0);this.setIndex(s),this.setAttribute("position",new Oe(r,3)),this.setAttribute("normal",new Oe(o,3)),this.setAttribute("uv",new Oe(a,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new nr(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class ir extends Qe{constructor(e=1,t=1,n=1,i=32,s=1,r=!1,o=0,a=Math.PI*2){super();this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a};let l=this;i=Math.floor(i),s=Math.floor(s);let d=[],c=[],h=[],u=[],p=0,g=[],x=n/2,m=0;if(f(),r===!1){if(e>0)T(!0);if(t>0)T(!1)}this.setIndex(d),this.setAttribute("position",new Oe(c,3)),this.setAttribute("normal",new Oe(h,3)),this.setAttribute("uv",new Oe(u,2));function f(){let E=new I,b=new I,S=0,A=(t-e)/n;for(let y=0;y<=s;y++){let v=[],_=y/s,z=_*(t-e)+e;for(let P=0;P<=i;P++){let D=P/i,N=D*a+o,C=Math.sin(N),B=Math.cos(N);b.x=z*C,b.y=-_*n+x,b.z=z*B,c.push(b.x,b.y,b.z),E.set(C,A,B).normalize(),h.push(E.x,E.y,E.z),u.push(D,1-_),v.push(p++)}g.push(v)}for(let y=0;y<i;y++)for(let v=0;v<s;v++){let _=g[v][y],z=g[v+1][y],P=g[v+1][y+1],D=g[v][y+1];if(e>0||v!==0)d.push(_,z,D),S+=3;if(t>0||v!==s-1)d.push(z,P,D),S+=3}l.addGroup(m,S,0),m+=S}function T(E){let b=p,S=new Ce,A=new I,y=0,v=E===!0?e:t,_=E===!0?1:-1;for(let P=1;P<=i;P++)c.push(0,x*_,0),h.push(0,_,0),u.push(0.5,0.5),p++;let z=p;for(let P=0;P<=i;P++){let N=P/i*a+o,C=Math.cos(N),B=Math.sin(N);A.x=v*B,A.y=x*_,A.z=v*C,c.push(A.x,A.y,A.z),h.push(0,_,0),S.x=C*0.5+0.5,S.y=B*0.5*_+0.5,u.push(S.x,S.y),p++}for(let P=0;P<i;P++){let D=b+P,N=z+P;if(E===!0)d.push(N,N+1,D);else d.push(N+1,N,D);y+=3}l.addGroup(m,y,E===!0?1:2),m+=y}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ir(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ci extends ir{constructor(e=1,t=1,n=32,i=1,s=!1,r=0,o=Math.PI*2){super(0,e,t,n,i,s,r,o);this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:r,thetaLength:o}}static fromJSON(e){return new ci(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class as extends Qe{constructor(e=1,t=1,n=1,i=1){super();this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let s=e/2,r=t/2,o=Math.floor(n),a=Math.floor(i),l=o+1,d=a+1,c=e/o,h=t/a,u=[],p=[],g=[],x=[];for(let m=0;m<d;m++){let f=m*h-r;for(let T=0;T<l;T++){let E=T*c-s;p.push(E,-f,0),g.push(0,0,1),x.push(T/o),x.push(1-m/a)}}for(let m=0;m<a;m++)for(let f=0;f<o;f++){let T=f+l*m,E=f+l*(m+1),b=f+1+l*(m+1),S=f+1+l*m;u.push(T,E,S),u.push(E,b,S)}this.setIndex(u),this.setAttribute("position",new Oe(p,3)),this.setAttribute("normal",new Oe(g,3)),this.setAttribute("uv",new Oe(x,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new as(e.width,e.height,e.widthSegments,e.heightSegments)}}class $r extends Qe{constructor(e=0.5,t=1,n=32,i=1,s=0,r=Math.PI*2){super();this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:r},n=Math.max(3,n),i=Math.max(1,i);let o=[],a=[],l=[],d=[],c=e,h=(t-e)/i,u=new I,p=new Ce;for(let g=0;g<=i;g++){for(let x=0;x<=n;x++){let m=s+x/n*r;u.x=c*Math.cos(m),u.y=c*Math.sin(m),a.push(u.x,u.y,u.z),l.push(0,0,1),p.x=(u.x/t+1)/2,p.y=(u.y/t+1)/2,d.push(p.x,p.y)}c+=h}for(let g=0;g<i;g++){let x=g*(n+1);for(let m=0;m<n;m++){let f=m+x,T=f,E=f+n+1,b=f+n+2,S=f+1;o.push(T,E,S),o.push(E,b,S)}}this.setIndex(o),this.setAttribute("position",new Oe(a,3)),this.setAttribute("normal",new Oe(l,3)),this.setAttribute("uv",new Oe(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new $r(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class eo extends Qe{constructor(e=1,t=0.4,n=12,i=48,s=Math.PI*2,r=0,o=Math.PI*2){super();this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:s,thetaStart:r,thetaLength:o},n=Math.floor(n),i=Math.floor(i);let a=[],l=[],d=[],c=[],h=new I,u=new I,p=new I;for(let g=0;g<=n;g++){let x=r+g/n*o;for(let m=0;m<=i;m++){let f=m/i*s;u.x=(e+t*Math.cos(x))*Math.cos(f),u.y=(e+t*Math.cos(x))*Math.sin(f),u.z=t*Math.sin(x),l.push(u.x,u.y,u.z),h.x=e*Math.cos(f),h.y=e*Math.sin(f),p.subVectors(u,h).normalize(),d.push(p.x,p.y,p.z),c.push(m/i),c.push(g/n)}}for(let g=1;g<=n;g++)for(let x=1;x<=i;x++){let m=(i+1)*g+x-1,f=(i+1)*(g-1)+x-1,T=(i+1)*(g-1)+x,E=(i+1)*g+x;a.push(m,f,E),a.push(f,T,E)}this.setIndex(a),this.setAttribute("position",new Oe(l,3)),this.setAttribute("normal",new Oe(d,3)),this.setAttribute("uv",new Oe(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new eo(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc,e.thetaStart,e.thetaLength)}}function ls(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let s=e[n][i];if(zf(s))if(s.isRenderTargetTexture)ze("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null;else t[n][i]=s.clone();else if(Array.isArray(s))if(zf(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[n][i]=r}else t[n][i]=s.slice();else t[n][i]=s}}return t}function Qt(e){let t={};for(let n=0;n<e.length;n++){let i=ls(e[n]);for(let s in i)t[s]=i[s]}return t}function zf(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function I_(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function Lc(e){let t=e.getRenderTarget();if(t===null)return e.outputColorSpace;if(t.isXRRenderTarget===!0)return t.texture.colorSpace;return Ze.workingColorSpace}var Vt={clone:ls,merge:Qt},D_=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,z_=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class He extends Ci{constructor(e){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=D_,this.fragmentShader=z_,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0)this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ls(e.uniforms),this.uniformsGroups=I_(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let r=this.uniforms[i].value;if(r&&r.isTexture)t.uniforms[i]={type:"t",value:r.toJSON(e).uuid};else if(r&&r.isColor)t.uniforms[i]={type:"c",value:r.getHex()};else if(r&&r.isVector2)t.uniforms[i]={type:"v2",value:r.toArray()};else if(r&&r.isVector3)t.uniforms[i]={type:"v3",value:r.toArray()};else if(r&&r.isVector4)t.uniforms[i]={type:"v4",value:r.toArray()};else if(r&&r.isMatrix3)t.uniforms[i]={type:"m3",value:r.toArray()};else if(r&&r.isMatrix4)t.uniforms[i]={type:"m4",value:r.toArray()};else t.uniforms[i]={value:r}}if(Object.keys(this.defines).length>0)t.defines=this.defines;t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)if(this.extensions[i]===!0)n[i]=!0;if(Object.keys(n).length>0)t.extensions=n;return t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new ae().setHex(i.value);break;case"v2":this.uniforms[n].value=new Ce().fromArray(i.value);break;case"v3":this.uniforms[n].value=new I().fromArray(i.value);break;case"v4":this.uniforms[n].value=new Tt().fromArray(i.value);break;case"m3":this.uniforms[n].value=new ke().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Je().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0)this.defines=e.defines;if(e.vertexShader!==void 0)this.vertexShader=e.vertexShader;if(e.fragmentShader!==void 0)this.fragmentShader=e.fragmentShader;if(e.glslVersion!==void 0)this.glslVersion=e.glslVersion;if(e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];if(e.lights!==void 0)this.lights=e.lights;if(e.clipping!==void 0)this.clipping=e.clipping;return this}}class to extends He{constructor(e){super(e);this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Pc extends Ci{constructor(e){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Ic extends Ci{constructor(e){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Hs(e,t){if(!e||e.constructor===t)return e;if(typeof t.BYTES_PER_ELEMENT==="number")return new t(e);return Array.prototype.slice.call(e)}function Id(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}class ds{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],s=t[n-1];n:{e:{let r;t:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=i,i=t[++n],e<i)break e}r=t.length;break t}if(!(e>=s)){let o=t[1];if(e<o)n=2,s=o;for(let a=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(i=s,s=t[--n-1],e>=s)break e}r=n,n=0;break t}break n}while(n<r){let o=n+r>>>1;if(e<t[o])r=o;else n=o+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let r=0;r!==i;++r)t[r]=n[s+r];return t}interpolate_(){throw Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}}class Dc extends ds{constructor(e,t,n,i){super(e,t,n,i);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(e,t,n){let i=this.parameterPositions,s=e-2,r=e+1,o=i[s],a=i[r];if(o===void 0)switch(this.getSettings_().endingStart){case 2401:s=e,o=2*t-n;break;case 2402:s=i.length-2,o=t+i[s]-i[s+1];break;default:s=e,o=n}if(a===void 0)switch(this.getSettings_().endingEnd){case 2401:r=e,a=2*n-t;break;case 2402:r=1,a=n+i[1]-i[0];break;default:r=e-1,a=t}let l=(n-t)*0.5,d=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(a-n),this._offsetPrev=s*d,this._offsetNext=r*d}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,d=this._offsetPrev,c=this._offsetNext,h=this._weightPrev,u=this._weightNext,p=(n-t)/(i-t),g=p*p,x=g*p,m=-h*x+2*h*g-h*p,f=(1+h)*x+(-1.5-2*h)*g+(-0.5+h)*p+1,T=(-1-u)*x+(1.5+u)*g+0.5*p,E=u*x-u*g;for(let b=0;b!==o;++b)s[b]=m*r[d+b]+f*r[l+b]+T*r[a+b]+E*r[c+b];return s}}class zc extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,d=(n-t)/(i-t),c=1-d;for(let h=0;h!==o;++h)s[h]=r[l+h]*c+r[a+h]*d;return s}}class Fc extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class Uc extends ds{interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,d=this.inTangents,c=this.outTangents;if(!d||!c){let p=(n-t)/(i-t),g=1-p;for(let x=0;x!==o;++x)s[x]=r[l+x]*g+r[a+x]*p;return s}let h=o*2,u=e-1;for(let p=0;p!==o;++p){let g=r[l+p],x=r[a+p],m=u*h+p*2,f=c[m],T=c[m+1],E=e*h+p*2,b=d[E],S=d[E+1],A=U_(n,t,f,b,i);s[p]=Om(A,g,T,S,x)}return s}}function Om(e,t,n,i,s){let r=1-e;return r*r*r*t+3*r*r*e*n+3*r*e*e*i+e*e*e*s}function F_(e,t,n,i,s){let r=1-e;return 3*r*r*(n-t)+6*r*e*(i-n)+3*e*e*(s-i)}function U_(e,t,n,i,s){let r=(e-t)/(s-t);for(let o=0;o<8;o++){let a=Om(r,t,n,i,s)-e;if(Math.abs(a)<0.0000000001)break;let l=F_(r,t,n,i,s);if(Math.abs(l)<0.0000000001)break;r=Math.max(0,Math.min(1,r-a/l))}return r}class En{constructor(e,t,n,i){if(e===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Hs(t,this.TimeBufferType),this.values=Hs(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Hs(e.times,Array),values:Hs(e.values,Array)};let i=e.getInterpolation();if(i!==e.DefaultInterpolation)n.interpolation=i;if(Id(e.settings))n.settings={inTangents:Hs(e.settings.inTangents,Array),outTangents:Hs(e.settings.outTangents,Array)}}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Fc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new zc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Dc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Uc(this.times,this.values,this.getValueSize(),e);if(this.settings)t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents;return t}setInterpolation(e){let t;switch(e){case 2300:t=this.InterpolantFactoryMethodDiscrete;break;case 2301:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth;break;case 2303:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(n);return ze("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302;case this.InterpolantFactoryMethodBezier:return 2303}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;if(Id(this.settings))Ff(this.settings.inTangents,e),Ff(this.settings.outTangents,e)}return this}trim(e,t){let n=this.times,i=n.length,s=0,r=i-1;while(s!==i&&n[s]<e)++s;while(r!==-1&&n[r]>t)--r;if(++r,s!==0||r!==i){if(s>=r)r=Math.max(r,1),s=r-1;let o=this.getValueSize();this.times=n.slice(s,r),this.values=this.values.slice(s*o,r*o)}return this}validate(){let e=!0,t=this.getValueSize();if(t-Math.floor(t)!==0)Be("KeyframeTrack: Invalid value size in track.",this),e=!1;let n=this.times,i=this.values,s=n.length;if(s===0)Be("KeyframeTrack: Track is empty.",this),e=!1;let r=null;for(let o=0;o!==s;o++){let a=n[o];if(typeof a==="number"&&isNaN(a)){Be("KeyframeTrack: Time is not a valid number.",this,o,a),e=!1;break}if(r!==null&&r>a){Be("KeyframeTrack: Out of order keys.",this,o,a,r),e=!1;break}r=a}if(i!==void 0){if(Ky(i))for(let o=0,a=i.length;o!==a;++o){let l=i[o];if(isNaN(l)){Be("KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===2302,s=e.length-1,r=1;for(let o=1;o<s;++o){let a=!1,l=e[o],d=e[o+1];if(l!==d&&(o!==1||l!==e[0]))if(!i){let c=o*n,h=c-n,u=c+n;for(let p=0;p!==n;++p){let g=t[c+p];if(g!==t[h+p]||g!==t[u+p]){a=!0;break}}}else a=!0;if(a){if(o!==r){e[r]=e[o];let c=o*n,h=r*n;for(let u=0;u!==n;++u)t[h+u]=t[c+u]}++r}}if(s>0){e[r]=e[s];for(let o=s*n,a=r*n,l=0;l!==n;++l)t[a+l]=t[o+l];++r}if(r!==e.length)this.times=e.slice(0,r),this.values=t.slice(0,r*n);else this.times=e,this.values=t;return this}clone(){let e=this.times.slice(),t=this.values.slice(),i=new this.constructor(this.name,e,t);if(i.createInterpolant=this.createInterpolant,Id(this.settings))i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()};return i}}function Ff(e,t){for(let n=0,i=e.length;n!==i;n+=2)e[n]*=t}En.prototype.ValueTypeName="";En.prototype.TimeBufferType=Float32Array;En.prototype.ValueBufferType=Float32Array;En.prototype.DefaultInterpolation=2301;class cs extends En{constructor(e,t,n){super(e,t,n)}}cs.prototype.ValueTypeName="bool";cs.prototype.ValueBufferType=Array;cs.prototype.DefaultInterpolation=2300;cs.prototype.InterpolantFactoryMethodLinear=void 0;cs.prototype.InterpolantFactoryMethodSmooth=void 0;class Nc extends En{constructor(e,t,n,i){super(e,t,n,i)}}Nc.prototype.ValueTypeName="color";class Oc extends En{constructor(e,t,n,i){super(e,t,n,i)}}Oc.prototype.ValueTypeName="number";class Bc extends ds{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,a=(n-t)/(i-t),l=e*o;for(let d=l+o;l!==d;l+=4)Pt.slerpFlat(s,0,r,l-o,r,l,a);return s}}class ka extends En{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new Bc(this.times,this.values,this.getValueSize(),e)}}ka.prototype.ValueTypeName="quaternion";ka.prototype.InterpolantFactoryMethodSmooth=void 0;class us extends En{constructor(e,t,n){super(e,t,n)}}us.prototype.ValueTypeName="string";us.prototype.ValueBufferType=Array;us.prototype.DefaultInterpolation=2300;us.prototype.InterpolantFactoryMethodLinear=void 0;us.prototype.InterpolantFactoryMethodSmooth=void 0;class kc extends En{constructor(e,t,n,i){super(e,t,n,i)}}kc.prototype.ValueTypeName="vector";class Gc{constructor(e,t,n){let i=this,s=!1,r=0,o=0,a=void 0,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(d){if(o++,s===!1){if(i.onStart!==void 0)i.onStart(d,r,o)}s=!0},this.itemEnd=function(d){if(r++,i.onProgress!==void 0)i.onProgress(d,r,o);if(r===o){if(s=!1,i.onLoad!==void 0)i.onLoad()}},this.itemError=function(d){if(i.onError!==void 0)i.onError(d)},this.resolveURL=function(d){if(d=d.normalize("NFC"),a)return a(d);return d},this.setURLModifier=function(d){return a=d,this},this.addHandler=function(d,c){return l.push(d,c),this},this.removeHandler=function(d){let c=l.indexOf(d);if(c!==-1)l.splice(c,2);return this},this.getHandler=function(d){for(let c=0,h=l.length;c<h;c+=2){let u=l[c],p=l[c+1];if(u.global)u.lastIndex=0;if(u.test(d))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){if(!this._abortController)this._abortController=new AbortController;return this._abortController}}var Bm=new Gc;class Hc{constructor(e){if(this.manager=e!==void 0?e:Bm,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,s){n.load(e,i,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Hc.DEFAULT_MATERIAL_NAME="__DEFAULT";var ha=new I,pa=new Pt,Hn=new I;class Ga extends Jt{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Je,this.projectionMatrix=new Je,this.projectionMatrixInverse=new Je,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.matrixWorld.decompose(ha,pa,Hn),Hn.x===1&&Hn.y===1&&Hn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(ha,pa,Hn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){if(super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ha,pa,Hn),Hn.x===1&&Hn.y===1&&Hn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(ha,pa,Hn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}var Ti=new I,Uf=new Ce,Nf=new Ce;class on extends Ga{constructor(e=50,t=1,n=0.1,i=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=0.5*this.getFilmHeight()/e;this.fov=Ys*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Ir*0.5*this.fov);return 0.5*this.getFilmHeight()/e}getEffectiveFOV(){return Ys*2*Math.atan(Math.tan(Ir*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Ti.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ti.x,Ti.y).multiplyScalar(-e/Ti.z),Ti.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),n.set(Ti.x,Ti.y).multiplyScalar(-e/Ti.z)}getViewSize(e,t){return this.getViewBounds(e,Uf,Nf),t.subVectors(Nf,Uf)}setViewOffset(e,t,n,i,s,r){if(this.aspect=e/t,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Ir*0.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-0.5*i,r=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:a,fullHeight:l}=r;s+=r.offsetX*i/a,t-=r.offsetY*n/l,i*=r.width/a,n*=r.height/l}let o=this.filmOffset;if(o!==0)s+=e*o/this.getFilmWidth();this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null)t.object.view=Object.assign({},this.view);return t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Pi extends Ga{constructor(e=-1,t=1,n=1,i=-1,s=0.1,r=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=r,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,r){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,s=n-e,r=n+e,o=i+t,a=i-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=l*this.view.offsetX,r=s+l*this.view.width,o-=d*this.view.offsetY,a=o-d*this.view.height}this.projectionMatrix.makeOrthographic(s,r,o,a,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null)t.object.view=Object.assign({},this.view);return t}}class hs extends Qe{constructor(){super();this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}}var Vs=-90,Ws=1;class Vc extends Jt{constructor(e,t,n){super();this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new on(Vs,Ws,e,t);i.layers=this.layers,this.add(i);let s=new on(Vs,Ws,e,t);s.layers=this.layers,this.add(s);let r=new on(Vs,Ws,e,t);r.layers=this.layers,this.add(r);let o=new on(Vs,Ws,e,t);o.layers=this.layers,this.add(o);let a=new on(Vs,Ws,e,t);a.layers=this.layers,this.add(a);let l=new on(Vs,Ws,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,s,r,o,a]=t;for(let l of t)this.remove(l);if(e===2000)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),a.up.set(0,1,0),a.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),a.up.set(0,-1,0),a.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;if(this.coordinateSystem!==e.coordinateSystem)this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem();let[s,r,o,a,l,d]=this.children,c=e.getRenderTarget(),h=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let x=!1;if(e.isWebGLRenderer===!0)x=e.state.buffers.depth.getReversed();else x=e.reversedDepthBuffer;if(e.setRenderTarget(n,0,i),x&&e.autoClear===!1)e.clearDepth();if(e.render(t,s),e.setRenderTarget(n,1,i),x&&e.autoClear===!1)e.clearDepth();if(e.render(t,r),e.setRenderTarget(n,2,i),x&&e.autoClear===!1)e.clearDepth();if(e.render(t,o),e.setRenderTarget(n,3,i),x&&e.autoClear===!1)e.clearDepth();if(e.render(t,a),e.setRenderTarget(n,4,i),x&&e.autoClear===!1)e.clearDepth();if(e.render(t,l),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),x&&e.autoClear===!1)e.clearDepth();e.render(t,d),e.setRenderTarget(c,h,u),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}}class Wc extends on{constructor(e=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class Ha{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){if(this._document=e,e.hidden!==void 0)this._pageVisibilityHandler=N_.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1)}disconnect(){if(this._pageVisibilityHandler!==null)this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null;this._document=null}getDelta(){return this._delta/1000}getElapsed(){return this._elapsed/1000}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){if(this._pageVisibilityHandler!==null&&this._document.hidden===!0)this._delta=0;else this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta;return this}}function N_(){if(this._document.hidden===!1)this.reset()}var jc="\\[\\]\\.:\\/",O_=new RegExp("["+jc+"]","g"),Xc="[^"+jc+"]",B_="[^"+jc.replace("\\.","")+"]",k_=/((?:WC+[\/:])*)/.source.replace("WC",Xc),G_=/(WCOD+)?/.source.replace("WCOD",B_),H_=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Xc),V_=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Xc),W_=new RegExp("^"+k_+G_+H_+V_+"$"),j_=["material","materials","bones","map"];class km{constructor(e,t,n){let i=n||ct.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];if(i!==void 0)i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class ct{constructor(e,t,n){this.path=t,this.parsedPath=n||ct.parseTrackName(t),this.node=ct.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){if(!(e&&e.isAnimationObjectGroup))return new ct(e,t,n);else return new ct.Composite(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(O_,"")}static parseTrackName(e){let t=W_.exec(e);if(t===null)throw Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let s=n.nodeName.substring(i+1);if(j_.indexOf(s)!==-1)n.nodeName=n.nodeName.substring(0,i),n.objectName=s}if(n.propertyName===null||n.propertyName.length===0)throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let r=0;r<s.length;r++){let o=s[r];if(o.name===t||o.uuid===t)return o;let a=n(o.children);if(a)return a}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,{objectName:n,propertyName:i,propertyIndex:s}=t;if(!e)e=ct.findNode(this.rootNode,t.nodeName),this.node=e;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ze("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){Be("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Be("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Be("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let d=0;d<e.length;d++)if(e[d].name===l){l=d;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Be("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Be("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Be("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){Be("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let r=e[i];if(r===void 0){let l=t.nodeName;Be("PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;if(this.targetObject=e,e.isMaterial===!0)o=this.Versioning.NeedsUpdate;else if(e.isObject3D===!0)o=this.Versioning.MatrixWorldNeedsUpdate;let a=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Be("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Be("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if(e.morphTargetDictionary[s]!==void 0)s=e.morphTargetDictionary[s]}a=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=s}else if(r.fromArray!==void 0&&r.toArray!==void 0)a=this.BindingType.HasFromToArray,this.resolvedProperty=r;else if(Array.isArray(r))a=this.BindingType.EntireArray,this.resolvedProperty=r;else this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}ct.Composite=km;ct.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ct.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ct.prototype.GetterByBindingType=[ct.prototype._getValue_direct,ct.prototype._getValue_array,ct.prototype._getValue_arrayElement,ct.prototype._getValue_toArray];ct.prototype.SetterByBindingTypeAndVersioning=[[ct.prototype._setValue_direct,ct.prototype._setValue_direct_setNeedsUpdate,ct.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ct.prototype._setValue_array,ct.prototype._setValue_array_setNeedsUpdate,ct.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ct.prototype._setValue_arrayElement,ct.prototype._setValue_arrayElement_setNeedsUpdate,ct.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ct.prototype._setValue_fromArray,ct.prototype._setValue_fromArray_setNeedsUpdate,ct.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var zL=new Float32Array(1);class ps extends za{constructor(e,t,n=1){super(e,t);this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}}class Jc{static{Jc.prototype.isMatrix2=!0}constructor(e,t,n,i){if(this.elements=[1,0,0,1],e!==void 0)this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let s=this.elements;return s[0]=e,s[2]=t,s[1]=n,s[3]=i,this}}function Yc(e,t,n,i){let s=X_(i);switch(n){case 1021:return e*t;case 1028:return e*t/s.components*s.byteLength;case 1029:return e*t/s.components*s.byteLength;case 1030:return e*t*2/s.components*s.byteLength;case 1031:return e*t*2/s.components*s.byteLength;case 1022:return e*t*3/s.components*s.byteLength;case 1023:return e*t*4/s.components*s.byteLength;case 1033:return e*t*4/s.components*s.byteLength;case 33776:case 33777:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 33778:case 33779:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 35841:case 35843:return Math.max(e,16)*Math.max(t,8)/4;case 35840:case 35842:return Math.max(e,8)*Math.max(t,8)/2;case 36196:case 37492:case 37488:case 37489:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 37496:case 37490:case 37491:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37808:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37809:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case 37810:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case 37811:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case 37812:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case 37813:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case 37814:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case 37815:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case 37816:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case 37817:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case 37818:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case 37819:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case 37820:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case 37821:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(e/4)*Math.ceil(t/4)*16;case 36283:case 36284:return Math.ceil(e/4)*Math.ceil(t/4)*8;case 36285:case 36286:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function X_(e){switch(e){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:case 35899:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));if(typeof window<"u")if(window.__THREE__)ze("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="186";function lg(){let e=null,t=!1,n=null,i=null;function s(r,o){i=e.requestAnimationFrame(s),n(r,o)}return{start:function(){if(t===!0)return;if(n===null)return;if(e===null)return;i=e.requestAnimationFrame(s),t=!0},stop:function(){if(e!==null)e.cancelAnimationFrame(i);t=!1},setAnimationLoop:function(r){n=r},setContext:function(r){e=r}}}function K_(e){let t=new WeakMap;function n(a,l){let{array:d,usage:c}=a,h=d.byteLength,u=e.createBuffer();e.bindBuffer(l,u),e.bufferData(l,d,c),a.onUploadCallback();let p;if(d instanceof Float32Array)p=e.FLOAT;else if(typeof Float16Array<"u"&&d instanceof Float16Array)p=e.HALF_FLOAT;else if(d instanceof Uint16Array)if(a.isFloat16BufferAttribute)p=e.HALF_FLOAT;else p=e.UNSIGNED_SHORT;else if(d instanceof Int16Array)p=e.SHORT;else if(d instanceof Uint32Array)p=e.UNSIGNED_INT;else if(d instanceof Int32Array)p=e.INT;else if(d instanceof Int8Array)p=e.BYTE;else if(d instanceof Uint8Array)p=e.UNSIGNED_BYTE;else if(d instanceof Uint8ClampedArray)p=e.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+d);return{buffer:u,type:p,bytesPerElement:d.BYTES_PER_ELEMENT,version:a.version,size:h}}function i(a,l,d){let{array:c,updateRanges:h}=l;if(e.bindBuffer(d,a),h.length===0)e.bufferSubData(d,0,c);else{h.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<h.length;p++){let g=h[u],x=h[p];if(x.start<=g.start+g.count+1)g.count=Math.max(g.count,x.start+x.count-g.start);else++u,h[u]=x}h.length=u+1;for(let p=0,g=h.length;p<g;p++){let x=h[p];e.bufferSubData(d,x.start*c.BYTES_PER_ELEMENT,c,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){if(a.isInterleavedBufferAttribute)a=a.data;return t.get(a)}function r(a){if(a.isInterleavedBufferAttribute)a=a.data;let l=t.get(a);if(l)e.deleteBuffer(l.buffer),t.delete(a)}function o(a,l){if(a.isInterleavedBufferAttribute)a=a.data;if(a.isGLBufferAttribute){let c=t.get(a);if(!c||c.version<a.version)t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let d=t.get(a);if(d===void 0)t.set(a,n(a,l));else if(d.version<a.version){if(d.size!==a.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(d.buffer,a,l),d.version=a.version}}return{get:s,remove:r,update:o}}var Z_=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Q_=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,$_=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,eS=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,tS=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,nS=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,iS=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,sS=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,rS=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,oS=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,aS=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,lS=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,dS=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,cS=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,uS=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,hS=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,pS=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,fS=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,mS=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,gS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,vS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,xS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,bS=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,yS=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,_S=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,SS=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,MS=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,wS=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,ES=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,TS=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,AS="gl_FragColor = linearToOutputTexel( gl_FragColor );",RS=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,CS=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,LS=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,PS=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,IS=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,DS=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,zS=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,FS=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,US=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,NS=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,OS=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,BS=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,kS=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,GS=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,HS=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,VS=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,WS=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,jS=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,XS=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,JS=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,YS=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,qS=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,KS=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ZS=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,QS=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,$S=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,eM=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,tM=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,nM=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,iM=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,sM=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,rM=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,oM=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,aM=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,lM=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,dM=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,cM=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,uM=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,hM=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,pM=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,fM=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,mM=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,gM=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,vM=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,xM=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,bM=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,yM=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,_M=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,SM=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,MM=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,wM=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,EM=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,TM=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,AM=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,RM=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,CM=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,LM=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,PM=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,IM=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,DM=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,zM=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,FM=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,UM=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,NM=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,OM=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,BM=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,kM=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,GM=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,HM=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,VM=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,WM=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,jM=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,XM=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,JM=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,YM=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,qM=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`;var KM=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,ZM=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,QM=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,$M=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ew=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,tw=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,nw=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,iw=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,sw=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,rw=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ow=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,aw=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,lw=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,dw=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,cw=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,uw=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,hw=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pw=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,fw=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,mw=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,gw=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vw=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,xw=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,bw=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,yw=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,_w=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Sw=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Mw=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ww=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ew=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Tw=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Aw=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Rw=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Cw=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Lw=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ye={alphahash_fragment:Z_,alphahash_pars_fragment:Q_,alphamap_fragment:$_,alphamap_pars_fragment:eS,alphatest_fragment:tS,alphatest_pars_fragment:nS,aomap_fragment:iS,aomap_pars_fragment:sS,batching_pars_vertex:rS,batching_vertex:oS,begin_vertex:aS,beginnormal_vertex:lS,bsdfs:dS,iridescence_fragment:cS,bumpmap_pars_fragment:uS,clipping_planes_fragment:hS,clipping_planes_pars_fragment:pS,clipping_planes_pars_vertex:fS,clipping_planes_vertex:mS,color_fragment:gS,color_pars_fragment:vS,color_pars_vertex:xS,color_vertex:bS,common:yS,cube_uv_reflection_fragment:_S,defaultnormal_vertex:SS,displacementmap_pars_vertex:MS,displacementmap_vertex:wS,emissivemap_fragment:ES,emissivemap_pars_fragment:TS,colorspace_fragment:AS,colorspace_pars_fragment:RS,envmap_fragment:CS,envmap_common_pars_fragment:LS,envmap_pars_fragment:PS,envmap_pars_vertex:IS,envmap_physical_pars_fragment:VS,envmap_vertex:DS,fog_vertex:zS,fog_pars_vertex:FS,fog_fragment:US,fog_pars_fragment:NS,gradientmap_pars_fragment:OS,lightmap_pars_fragment:BS,lights_lambert_fragment:kS,lights_lambert_pars_fragment:GS,lights_pars_begin:HS,lights_toon_fragment:WS,lights_toon_pars_fragment:jS,lights_phong_fragment:XS,lights_phong_pars_fragment:JS,lights_physical_fragment:YS,lights_physical_pars_fragment:qS,lights_fragment_begin:KS,lights_fragment_maps:ZS,lights_fragment_end:QS,lightprobes_pars_fragment:$S,logdepthbuf_fragment:eM,logdepthbuf_pars_fragment:tM,logdepthbuf_pars_vertex:nM,logdepthbuf_vertex:iM,map_fragment:sM,map_pars_fragment:rM,map_particle_fragment:oM,map_particle_pars_fragment:aM,metalnessmap_fragment:lM,metalnessmap_pars_fragment:dM,morphinstance_vertex:cM,morphcolor_vertex:uM,morphnormal_vertex:hM,morphtarget_pars_vertex:pM,morphtarget_vertex:fM,normal_fragment_begin:mM,normal_fragment_maps:gM,normal_pars_fragment:vM,normal_pars_vertex:xM,normal_vertex:bM,normalmap_pars_fragment:yM,clearcoat_normal_fragment_begin:_M,clearcoat_normal_fragment_maps:SM,clearcoat_pars_fragment:MM,iridescence_pars_fragment:wM,opaque_fragment:EM,packing:TM,premultiplied_alpha_fragment:AM,project_vertex:RM,dithering_fragment:CM,dithering_pars_fragment:LM,roughnessmap_fragment:PM,roughnessmap_pars_fragment:IM,shadowmap_pars_fragment:DM,shadowmap_pars_vertex:zM,shadowmap_vertex:FM,shadowmask_pars_fragment:UM,skinbase_vertex:NM,skinning_pars_vertex:OM,skinning_vertex:BM,skinnormal_vertex:kM,specularmap_fragment:GM,specularmap_pars_fragment:HM,tonemapping_fragment:VM,tonemapping_pars_fragment:WM,transmission_fragment:jM,transmission_pars_fragment:XM,uv_pars_fragment:JM,uv_pars_vertex:YM,uv_vertex:qM,worldpos_vertex:KM,background_vert:ZM,background_frag:QM,backgroundCube_vert:$M,backgroundCube_frag:ew,cube_vert:tw,cube_frag:nw,depth_vert:iw,depth_frag:sw,distance_vert:rw,distance_frag:ow,equirect_vert:aw,equirect_frag:lw,linedashed_vert:dw,linedashed_frag:cw,meshbasic_vert:uw,meshbasic_frag:hw,meshlambert_vert:pw,meshlambert_frag:fw,meshmatcap_vert:mw,meshmatcap_frag:gw,meshnormal_vert:vw,meshnormal_frag:xw,meshphong_vert:bw,meshphong_frag:yw,meshphysical_vert:_w,meshphysical_frag:Sw,meshtoon_vert:Mw,meshtoon_frag:ww,points_vert:Ew,points_frag:Tw,shadow_vert:Aw,shadow_frag:Rw,sprite_vert:Cw,sprite_frag:Lw},de={common:{diffuse:{value:new ae(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ke}},envmap:{envMap:{value:null},envMapRotation:{value:new ke},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ke}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ke}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ke},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ke},normalScale:{value:new Ce(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ke},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ke}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ke}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ke}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new ae(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new I},probesMax:{value:new I},probesResolution:{value:new I}},points:{diffuse:{value:new ae(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0},uvTransform:{value:new ke}},sprite:{diffuse:{value:new ae(16777215)},opacity:{value:1},center:{value:new Ce(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}}},Jn={basic:{uniforms:Qt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.fog]),vertexShader:Ye.meshbasic_vert,fragmentShader:Ye.meshbasic_frag},lambert:{uniforms:Qt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new ae(0)},envMapIntensity:{value:1}}]),vertexShader:Ye.meshlambert_vert,fragmentShader:Ye.meshlambert_frag},phong:{uniforms:Qt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new ae(0)},specular:{value:new ae(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ye.meshphong_vert,fragmentShader:Ye.meshphong_frag},standard:{uniforms:Qt([de.common,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.roughnessmap,de.metalnessmap,de.fog,de.lights,{emissive:{value:new ae(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ye.meshphysical_vert,fragmentShader:Ye.meshphysical_frag},toon:{uniforms:Qt([de.common,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.gradientmap,de.fog,de.lights,{emissive:{value:new ae(0)}}]),vertexShader:Ye.meshtoon_vert,fragmentShader:Ye.meshtoon_frag},matcap:{uniforms:Qt([de.common,de.bumpmap,de.normalmap,de.displacementmap,de.fog,{matcap:{value:null}}]),vertexShader:Ye.meshmatcap_vert,fragmentShader:Ye.meshmatcap_frag},points:{uniforms:Qt([de.points,de.fog]),vertexShader:Ye.points_vert,fragmentShader:Ye.points_frag},dashed:{uniforms:Qt([de.common,de.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ye.linedashed_vert,fragmentShader:Ye.linedashed_frag},depth:{uniforms:Qt([de.common,de.displacementmap]),vertexShader:Ye.depth_vert,fragmentShader:Ye.depth_frag},normal:{uniforms:Qt([de.common,de.bumpmap,de.normalmap,de.displacementmap,{opacity:{value:1}}]),vertexShader:Ye.meshnormal_vert,fragmentShader:Ye.meshnormal_frag},sprite:{uniforms:Qt([de.sprite,de.fog]),vertexShader:Ye.sprite_vert,fragmentShader:Ye.sprite_frag},background:{uniforms:{uvTransform:{value:new ke},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ye.background_vert,fragmentShader:Ye.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ke}},vertexShader:Ye.backgroundCube_vert,fragmentShader:Ye.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ye.cube_vert,fragmentShader:Ye.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ye.equirect_vert,fragmentShader:Ye.equirect_frag},distance:{uniforms:Qt([de.common,de.displacementmap,{referencePosition:{value:new I},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:Ye.distance_vert,fragmentShader:Ye.distance_frag},shadow:{uniforms:Qt([de.lights,de.fog,{color:{value:new ae(0)},opacity:{value:1}}]),vertexShader:Ye.shadow_vert,fragmentShader:Ye.shadow_frag}};Jn.physical={uniforms:Qt([Jn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ke},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ke},clearcoatNormalScale:{value:new Ce(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ke},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ke},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ke},sheen:{value:0},sheenColor:{value:new ae(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ke},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ke},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ke},transmissionSamplerSize:{value:new Ce},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ke},attenuationDistance:{value:0},attenuationColor:{value:new ae(0)},specularColor:{value:new ae(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ke},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ke},anisotropyVector:{value:new Ce},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ke}}]),vertexShader:Ye.meshphysical_vert,fragmentShader:Ye.meshphysical_frag};var Va={r:0,b:0,g:0},Pw=new Je,dg=new ke;dg.set(-1,0,0,0,1,0,0,0,1);function Iw(e,t,n,i,s,r){let o=new ae(0),a=s===!0?0:1,l,d,c=null,h=0,u=null;function p(T){let E=T.isScene===!0?T.background:null;if(E&&E.isTexture){let b=T.backgroundBlurriness>0;E=t.get(E,b)}return E}function g(T){let E=!1,b=p(T);if(b===null)m(o,a);else if(b&&b.isColor)m(b,1),E=!0;let S=e.xr.getEnvironmentBlendMode();if(S==="additive")n.buffers.color.setClear(0,0,0,1,r);else if(S==="alpha-blend")n.buffers.color.setClear(0,0,0,0,r);if(e.autoClear||E)n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)}function x(T,E){let b=p(E);if(b&&(b.isCubeTexture||b.mapping===Jr)){if(d===void 0)d=new nt(new Zt(1,1,1),new He({name:"BackgroundCubeMaterial",uniforms:ls(Jn.backgroundCube.uniforms),vertexShader:Jn.backgroundCube.vertexShader,fragmentShader:Jn.backgroundCube.fragmentShader,side:dn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),d.geometry.deleteAttribute("normal"),d.geometry.deleteAttribute("uv"),d.onBeforeRender=function(S,A,y){this.matrixWorld.copyPosition(y.matrixWorld)},Object.defineProperty(d.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(d);if(d.material.uniforms.envMap.value=b,d.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,d.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,d.material.uniforms.backgroundRotation.value.setFromMatrix4(Pw.makeRotationFromEuler(E.backgroundRotation)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1)d.material.uniforms.backgroundRotation.value.premultiply(dg);if(d.material.toneMapped=Ze.getTransfer(b.colorSpace)!==ut,c!==b||h!==b.version||u!==e.toneMapping)d.material.needsUpdate=!0,c=b,h=b.version,u=e.toneMapping;d.layers.enableAll(),T.unshift(d,d.geometry,d.material,0,0,null)}else if(b&&b.isTexture){if(l===void 0)l=new nt(new as(2,2),new He({name:"BackgroundMaterial",uniforms:ls(Jn.background.uniforms),vertexShader:Jn.background.vertexShader,fragmentShader:Jn.background.fragmentShader,side:Ks,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l);if(l.material.uniforms.t2D.value=b,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=Ze.getTransfer(b.colorSpace)!==ut,b.matrixAutoUpdate===!0)b.updateMatrix();if(l.material.uniforms.uvTransform.value.copy(b.matrix),c!==b||h!==b.version||u!==e.toneMapping)l.material.needsUpdate=!0,c=b,h=b.version,u=e.toneMapping;l.layers.enableAll(),T.unshift(l,l.geometry,l.material,0,0,null)}}function m(T,E){T.getRGB(Va,Lc(e)),n.buffers.color.setClear(Va.r,Va.g,Va.b,E,r)}function f(){if(d!==void 0)d.geometry.dispose(),d.material.dispose(),d=void 0;if(l!==void 0)l.geometry.dispose(),l.material.dispose(),l=void 0}return{getClearColor:function(){return o},setClearColor:function(T,E=1){o.set(T),a=E,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(T){a=T,m(o,a)},render:g,addToRenderList:x,dispose:f}}function Dw(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},s=u(null),r=s,o=!1;function a(P,D,N,C,B){let k=!1,G=h(P,C,N,D);if(r!==G)r=G,d(r.object);if(k=p(P,C,N,B),k)g(P,C,N,B);if(B!==null)t.update(B,e.ELEMENT_ARRAY_BUFFER);if(k||o){if(o=!1,b(P,D,N,C),B!==null)e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(B).buffer)}}function l(){return e.createVertexArray()}function d(P){return e.bindVertexArray(P)}function c(P){return e.deleteVertexArray(P)}function h(P,D,N,C){let B=C.wireframe===!0,k=i[D.id];if(k===void 0)k={},i[D.id]=k;let G=P.isInstancedMesh===!0?P.id:0,Q=k[G];if(Q===void 0)Q={},k[G]=Q;let W=Q[N.id];if(W===void 0)W={},Q[N.id]=W;let q=W[B];if(q===void 0)q=u(l()),W[B]=q;return q}function u(P){let D=[],N=[],C=[];for(let B=0;B<n;B++)D[B]=0,N[B]=0,C[B]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:N,attributeDivisors:C,object:P,attributes:{},index:null}}function p(P,D,N,C){let B=r.attributes,k=D.attributes,G=0,Q=N.getAttributes();for(let W in Q)if(Q[W].location>=0){let ee=B[W],xe=k[W];if(xe===void 0){if(W==="instanceMatrix"&&P.instanceMatrix)xe=P.instanceMatrix;if(W==="instanceColor"&&P.instanceColor)xe=P.instanceColor}if(ee===void 0)return!0;if(ee.attribute!==xe)return!0;if(xe&&ee.data!==xe.data)return!0;G++}if(r.attributesNum!==G)return!0;if(r.index!==C)return!0;return!1}function g(P,D,N,C){let B={},k=D.attributes,G=0,Q=N.getAttributes();for(let W in Q)if(Q[W].location>=0){let ee=k[W];if(ee===void 0){if(W==="instanceMatrix"&&P.instanceMatrix)ee=P.instanceMatrix;if(W==="instanceColor"&&P.instanceColor)ee=P.instanceColor}let xe={};if(xe.attribute=ee,ee&&ee.data)xe.data=ee.data;B[W]=xe,G++}r.attributes=B,r.attributesNum=G,r.index=C}function x(){let P=r.newAttributes;for(let D=0,N=P.length;D<N;D++)P[D]=0}function m(P){f(P,0)}function f(P,D){let N=r.newAttributes,C=r.enabledAttributes,B=r.attributeDivisors;if(N[P]=1,C[P]===0)e.enableVertexAttribArray(P),C[P]=1;if(B[P]!==D)e.vertexAttribDivisor(P,D),B[P]=D}function T(){let P=r.newAttributes,D=r.enabledAttributes;for(let N=0,C=D.length;N<C;N++)if(D[N]!==P[N])e.disableVertexAttribArray(N),D[N]=0}function E(P,D,N,C,B,k,G){if(G===!0)e.vertexAttribIPointer(P,D,N,B,k);else e.vertexAttribPointer(P,D,N,C,B,k)}function b(P,D,N,C){x();let B=C.attributes,k=N.getAttributes(),G=D.defaultAttributeValues;for(let Q in k){let W=k[Q];if(W.location>=0){let q=B[Q];if(q===void 0){if(Q==="instanceMatrix"&&P.instanceMatrix)q=P.instanceMatrix;if(Q==="instanceColor"&&P.instanceColor)q=P.instanceColor}if(q!==void 0){let ee=q.normalized,xe=q.itemSize,_e=t.get(q);if(_e===void 0)continue;let{buffer:Ve,type:Fe,bytesPerElement:J}=_e,te=Fe===e.INT||Fe===e.UNSIGNED_INT||q.gpuType===Nd;if(q.isInterleavedBufferAttribute){let se=q.data,Re=se.stride,Pe=q.offset;if(se.isInstancedInterleavedBuffer){for(let Ee=0;Ee<W.locationSize;Ee++)f(W.location+Ee,se.meshPerAttribute);if(P.isInstancedMesh!==!0&&C._maxInstanceCount===void 0)C._maxInstanceCount=se.meshPerAttribute*se.count}else for(let Ee=0;Ee<W.locationSize;Ee++)m(W.location+Ee);e.bindBuffer(e.ARRAY_BUFFER,Ve);for(let Ee=0;Ee<W.locationSize;Ee++)E(W.location+Ee,xe/W.locationSize,Fe,ee,Re*J,(Pe+xe/W.locationSize*Ee)*J,te)}else{if(q.isInstancedBufferAttribute){for(let se=0;se<W.locationSize;se++)f(W.location+se,q.meshPerAttribute);if(P.isInstancedMesh!==!0&&C._maxInstanceCount===void 0)C._maxInstanceCount=q.meshPerAttribute*q.count}else for(let se=0;se<W.locationSize;se++)m(W.location+se);e.bindBuffer(e.ARRAY_BUFFER,Ve);for(let se=0;se<W.locationSize;se++)E(W.location+se,xe/W.locationSize,Fe,ee,xe*J,xe/W.locationSize*se*J,te)}}else if(G!==void 0){let ee=G[Q];if(ee!==void 0)switch(ee.length){case 2:e.vertexAttrib2fv(W.location,ee);break;case 3:e.vertexAttrib3fv(W.location,ee);break;case 4:e.vertexAttrib4fv(W.location,ee);break;default:e.vertexAttrib1fv(W.location,ee)}}}}T()}function S(){_();for(let P in i){let D=i[P];for(let N in D){let C=D[N];for(let B in C){let k=C[B];for(let G in k)c(k[G].object),delete k[G];delete C[B]}}delete i[P]}}function A(P){if(i[P.id]===void 0)return;let D=i[P.id];for(let N in D){let C=D[N];for(let B in C){let k=C[B];for(let G in k)c(k[G].object),delete k[G];delete C[B]}}delete i[P.id]}function y(P){for(let D in i){let N=i[D];for(let C in N){let B=N[C];if(B[P.id]===void 0)continue;let k=B[P.id];for(let G in k)c(k[G].object),delete k[G];delete B[P.id]}}}function v(P){for(let D in i){let N=i[D],C=P.isInstancedMesh===!0?P.id:0,B=N[C];if(B===void 0)continue;for(let k in B){let G=B[k];for(let Q in G)c(G[Q].object),delete G[Q];delete B[k]}if(delete N[C],Object.keys(N).length===0)delete i[D]}}function _(){if(z(),o=!0,r===s)return;r=s,d(r.object)}function z(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:_,resetDefaultState:z,dispose:S,releaseStatesOfGeometry:A,releaseStatesOfObject:v,releaseStatesOfProgram:y,initAttributes:x,enableAttribute:m,disableUnusedAttributes:T}}function zw(e,t,n){let i;function s(l){i=l}function r(l,d){e.drawArrays(i,l,d),n.update(d,i,1)}function o(l,d,c){if(c===0)return;e.drawArraysInstanced(i,l,d,c),n.update(d,i,c)}function a(l,d,c){if(c===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,d,0,c);let u=0;for(let p=0;p<c;p++)u+=d[p];n.update(u,i,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Fw(e,t,n,i){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let y=t.get("EXT_texture_filter_anisotropic");s=e.getParameter(y.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(y){if(y!==jn&&i.convert(y)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function a(y){let v=y===zt&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));if(y!==Kt&&y!==zn&&!v&&i.convert(y)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))return!1;return!0}function l(y){if(y==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";y="mediump"}if(y==="mediump"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let d=n.precision!==void 0?n.precision:"highp",c=l(d);if(c!==d)ze("WebGLRenderer:",d,"not supported, using",c,"instead."),d=c;let h=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");if(n.reversedDepthBuffer===!0&&u===!1)ze("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=e.getParameter(e.MAX_TEXTURE_SIZE),m=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),f=e.getParameter(e.MAX_VERTEX_ATTRIBS),T=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),E=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),S=e.getParameter(e.MAX_SAMPLES),A=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:d,logarithmicDepthBuffer:h,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:T,maxVaryings:E,maxFragmentUniforms:b,maxSamples:S,samples:A}}function Uw(e){let t=this,n=null,i=0,s=!1,r=!1,o=new Vn,a=new ke,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,u){let p=h.length!==0||u||i!==0||s;return s=u,i=h.length,p},this.beginShadows=function(){r=!0,c(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,u){n=c(h,u,0)},this.setState=function(h,u,p){let{clippingPlanes:g,clipIntersection:x,clipShadows:m}=h,f=e.get(h);if(!s||g===null||g.length===0||r&&!m)if(r)c(null);else d();else{let T=r?0:i,E=T*4,b=f.clippingState||null;l.value=b,b=c(g,u,E,p);for(let S=0;S!==E;++S)b[S]=n[S];f.clippingState=b,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=T}};function d(){if(l.value!==n)l.value=n,l.needsUpdate=i>0;t.numPlanes=i,t.numIntersection=0}function c(h,u,p,g){let x=h!==null?h.length:0,m=null;if(x!==0){if(m=l.value,g!==!0||m===null){let f=p+x*4,T=u.matrixWorldInverse;if(a.getNormalMatrix(T),m===null||m.length<f)m=new Float32Array(f);for(let E=0,b=p;E!==x;++E,b+=4)o.copy(h[E]).applyMatrix4(T,a),o.normal.toArray(m,b),m[b+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=x,t.numIntersection=0,m}}var rr=4,Nw=6,Ow=20,Bw=256,no=new Pi,Gm=new ae,qc=null,Kc=0,Zc=0,Qc=!1,kw=new I,fs=new I;class tu{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=0.1,i=100,s={}){let{size:r=256,position:o=kw}=s;qc=this._renderer.getRenderTarget(),Kc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel(),Qc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let a=this._allocateTargets();if(a.depthBuffer=!0,this._sceneToCubeUV(e,n,i,a,o),t>0)this._blur(a,0,0,t);return this._applyPMREM(a),this._cleanup(a),a}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=Wm(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=Vm(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose();if(this._backgroundBox!==null)this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._ggxMaterial!==null)this._ggxMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(qc,Kc,Zc),this._renderer.xr.enabled=Qc,e.scissorTest=!1,sr(e,0,0,e.width,e.height)}_fromTexture(e,t){if(e.mapping===Qs||e.mapping===Zi)this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width);else this._setSize(e.image.width/4);qc=this._renderer.getRenderTarget(),Kc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel(),Qc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:qt,minFilter:qt,generateMipmaps:!1,type:zt,format:jn,colorSpace:yc,depthBuffer:!1},i=Hm(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=Hm(e,t,n);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Gw(s)),this._blurMaterial=Vw(s,e,t),this._ggxMaterial=Hw(s,e,t)}return i}_compileMaterial(e){let t=new nt(new Qe,e);this._renderer.compile(t,no)}_sceneToCubeUV(e,t,n,i,s){let a=new on(90,1,t,n),l=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],c=this._renderer,{autoClear:h,toneMapping:u}=c;if(c.getClearColor(Gm),c.toneMapping=gn,c.autoClear=!1,c.state.buffers.depth.getReversed())c.setRenderTarget(i),c.clearDepth(),c.setRenderTarget(null);if(this._backgroundBox===null)this._backgroundBox=new nt(new Zt,new At({name:"PMREM.Background",side:dn,depthWrite:!1,depthTest:!1}));let g=this._backgroundBox,x=g.material,m=!1,f=e.background;if(f){if(f.isColor)x.color.copy(f),e.background=null,m=!0}else x.color.copy(Gm),m=!0;for(let T=0;T<6;T++){let E=T%3;if(E===0)a.up.set(0,l[T],0),a.position.set(s.x,s.y,s.z),a.lookAt(s.x+d[T],s.y,s.z);else if(E===1)a.up.set(0,0,l[T]),a.position.set(s.x,s.y,s.z),a.lookAt(s.x,s.y+d[T],s.z);else a.up.set(0,l[T],0),a.position.set(s.x,s.y,s.z),a.lookAt(s.x,s.y,s.z+d[T]);let b=this._cubeSize;if(sr(i,E*b,T>2?b:0,b,b),c.setRenderTarget(i),m)c.render(g,a);c.render(e,a)}c.toneMapping=u,c.autoClear=h,e.background=f}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Qs||e.mapping===Zi;if(i){if(this._cubemapMaterial===null)this._cubemapMaterial=Wm();this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=Vm();let s=i?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=s;let o=s.uniforms;o.envMap.value=e;let a=this._cubeSize;sr(t,0,0,3*a,2*a),n.setRenderTarget(t),n.render(r,no)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let s=1;s<i;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,s=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[n];o.material=r;let a=r.uniforms,l=n/(this._lodMeshes.length-1),d=t/(this._lodMeshes.length-1),c=Math.sqrt(l*l-d*d),h=l*1.25,u=c*h,{_lodMax:p}=this,g=this._sizeLods[n],x=3*g*(n>p-rr?n-p+rr:0),m=4*(this._cubeSize-g);a.envMap.value=e.texture,a.roughness.value=u,a.mipInt.value=p-t,sr(s,x,m,3*g,2*g),i.setRenderTarget(s),i.render(o,no),a.envMap.value=s.texture,a.roughness.value=0,a.mipInt.value=p-n,sr(e,x,m,3*g,2*g),i.setRenderTarget(e),i.render(o,no)}_blur(e,t,n,i){let s=this._pingPongRenderTarget,r=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,s,t,n,r),this._blurPass(s,e,n,n,r)}_blurPass(e,t,n,i,s){let r=this._renderer,o=this._blurMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=s,l.mipInt.value=this._lodMax-n;let d=this._sizeLods[i],c=3*d*(i>this._lodMax-rr?i-this._lodMax+rr:0),h=4*(this._cubeSize-d);sr(t,c,h,3*d,2*d),r.setRenderTarget(t),r.render(a,no)}}function Gw(e){let t=[],n=[],i=e,s=e-rr+1+Nw;for(let r=0;r<s;r++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,d=1+a,c=[l,l,d,l,d,d,l,l,d,d,l,d],h=6,u=6,p=3,g=new Float32Array(p*u*h),x=new Float32Array(p*u*h);for(let f=0;f<h;f++){let T=f%3*2/3-1,E=f>2?0:-1,b=[T,E,0,T+0.6666666666666666,E,0,T+0.6666666666666666,E+1,0,T,E,0,T+0.6666666666666666,E+1,0,T,E+1,0];g.set(b,p*u*f);for(let S=0;S<u;S++){let A=c[S*2]*2-1,y=c[S*2+1]*2-1;if(f===0)fs.set(1,y,A);else if(f===1)fs.set(-A,1,-y);else if(f===2)fs.set(-A,y,1);else if(f===3)fs.set(-1,y,-A);else if(f===4)fs.set(-A,-1,y);else fs.set(A,y,-1);fs.toArray(x,(f*u+S)*p)}}let m=new Qe;if(m.setAttribute("position",new _t(g,p)),m.setAttribute("outputDirection",new _t(x,p)),n.push(new nt(m,null)),i>rr)i--}return{lodMeshes:n,sizeLods:t}}function Hm(e,t,n){let i=new St(e,t,n);return i.texture.mapping=Jr,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function sr(e,t,n,i,s){e.viewport.set(t,n,i,s),e.scissor.set(t,n,i,s)}function Hw(e,t,n){return new He({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Bw,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:ja(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Sn,depthTest:!1,depthWrite:!1})}function Vw(e,t,n){return new He({name:"SphericalGaussianBlur",defines:{SAMPLES:Ow,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:ja(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Sn,depthTest:!1,depthWrite:!1})}function Vm(){return new He({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Sn,depthTest:!1,depthWrite:!1})}function Wm(){return new He({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Sn,depthTest:!1,depthWrite:!1})}function ja(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class su extends St{constructor(e=1,t={}){super(e,e,t);this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Oa(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Zt(5,5,5),s=new He({name:"CubemapFromEquirect",uniforms:ls(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:dn,blending:Sn});s.uniforms.tEquirect.value=t;let r=new nt(i,s),o=t.minFilter;if(t.minFilter===Qi)t.minFilter=qt;return new Vc(1,10,this).update(e,r),t.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let s=e.getRenderTarget();for(let r=0;r<6;r++)e.setRenderTarget(this,r),e.clear(t,n,i);e.setRenderTarget(s)}}function Ww(e){let t=new WeakMap,n=new WeakMap,i=null;function s(u,p=!1){if(u===null||u===void 0)return null;if(p)return o(u);return r(u)}function r(u){if(u&&u.isTexture){let p=u.mapping;if(p===va||p===xa)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let x=new su(g.height);return x.fromEquirectangularTexture(e,u),t.set(u,x),u.addEventListener("dispose",d),a(x.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let p=u.mapping,g=p===va||p===xa,x=p===Qs||p===Zi;if(g||x){let m=n.get(u),f=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==f){if(i===null)i=new tu(e);return m=g?i.fromEquirectangular(u,m):i.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),m.texture}else if(m!==void 0)return m.texture;else{let T=u.image;if(g&&T&&T.height>0||x&&T&&l(T)){if(i===null)i=new tu(e);return m=g?i.fromEquirectangular(u):i.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),u.addEventListener("dispose",c),m.texture}else return null}}}return u}function a(u,p){if(p===va)u.mapping=Qs;else if(p===xa)u.mapping=Zi;return u}function l(u){let p=0,g=6;for(let x=0;x<g;x++)if(u[x]!==void 0)p++;return p===g}function d(u){let p=u.target;p.removeEventListener("dispose",d);let g=t.get(p);if(g!==void 0)t.delete(p),g.dispose()}function c(u){let p=u.target;p.removeEventListener("dispose",c);let g=n.get(p);if(g!==void 0)n.delete(p),g.dispose()}function h(){if(t=new WeakMap,n=new WeakMap,i!==null)i.dispose(),i=null}return{get:s,dispose:h}}function jw(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let s=e.getExtension(i);return t[i]=s,s}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let s=n(i);if(s===null)Ki("WebGLRenderer: "+i+" extension not supported.");return s}}}function Xw(e,t,n,i){let s={},r=new WeakMap;function o(h){let u=h.target;if(u.index!==null)t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete s[u.id];let p=r.get(u);if(p)t.remove(p),r.delete(u);if(i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0)delete u._maxInstanceCount;n.memory.geometries--}function a(h,u){if(s[u.id]===!0)return u;return u.addEventListener("dispose",o),s[u.id]=!0,n.memory.geometries++,u}function l(h){let u=h.attributes;for(let p in u)t.update(u[p],e.ARRAY_BUFFER)}function d(h){let u=[],p=h.index,g=h.attributes.position,x=0;if(g===void 0)return;if(p!==null){let T=p.array;x=p.version;for(let E=0,b=T.length;E<b;E+=3){let S=T[E+0],A=T[E+1],y=T[E+2];u.push(S,A,A,y,y,S)}}else{let T=g.array;x=g.version;for(let E=0,b=T.length/3-1;E<b;E+=3){let S=E+0,A=E+1,y=E+2;u.push(S,A,A,y,y,S)}}let m=new(g.count>=65535?Da:Ia)(u,1);m.version=x;let f=r.get(h);if(f)t.remove(f);r.set(h,m)}function c(h){let u=r.get(h);if(u){let p=h.index;if(p!==null){if(u.version<p.version)d(h)}}else d(h);return r.get(h)}return{get:a,update:l,getWireframeAttribute:c}}function Jw(e,t,n){let i;function s(h){i=h}let r,o;function a(h){r=h.type,o=h.bytesPerElement}function l(h,u){e.drawElements(i,u,r,h*o),n.update(u,i,1)}function d(h,u,p){if(p===0)return;e.drawElementsInstanced(i,u,r,h*o,p),n.update(u,i,p)}function c(h,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,r,h,0,p);let x=0;for(let m=0;m<p;m++)x+=u[m];n.update(x,i,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=d,this.renderMultiDraw=c}function Yw(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,o,a){switch(n.calls++,o){case e.TRIANGLES:n.triangles+=a*(r/3);break;case e.LINES:n.lines+=a*(r/2);break;case e.LINE_STRIP:n.lines+=a*(r-1);break;case e.LINE_LOOP:n.lines+=a*r;break;case e.POINTS:n.points+=a*r;break;default:Be("WebGLInfo: Unknown draw mode:",o);break}}function s(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:s,update:i}}function qw(e,t,n){let i=new WeakMap,s=new Tt;function r(o,a,l){let d=o.morphTargetInfluences,c=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=c!==void 0?c.length:0,u=i.get(a);if(u===void 0||u.count!==h){let _=function(){y.dispose(),i.delete(a),a.removeEventListener("dispose",_)};if(u!==void 0)u.texture.dispose();let p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],f=a.morphAttributes.normal||[],T=a.morphAttributes.color||[],E=0;if(p===!0)E=1;if(g===!0)E=2;if(x===!0)E=3;let b=a.attributes.position.count*E,S=1;if(b>t.maxTextureSize)S=Math.ceil(b/t.maxTextureSize),b=t.maxTextureSize;let A=new Float32Array(b*S*4*h),y=new La(A,b,S,h);y.type=zn,y.needsUpdate=!0;let v=E*4;for(let z=0;z<h;z++){let P=m[z],D=f[z],N=T[z],C=b*S*4*z;for(let B=0;B<P.count;B++){let k=B*v;if(p===!0)s.fromBufferAttribute(P,B),A[C+k+0]=s.x,A[C+k+1]=s.y,A[C+k+2]=s.z,A[C+k+3]=0;if(g===!0)s.fromBufferAttribute(D,B),A[C+k+4]=s.x,A[C+k+5]=s.y,A[C+k+6]=s.z,A[C+k+7]=0;if(x===!0)s.fromBufferAttribute(N,B),A[C+k+8]=s.x,A[C+k+9]=s.y,A[C+k+10]=s.z,A[C+k+11]=N.itemSize===4?s.w:1}}u={count:h,texture:y,size:new Ce(b,S)},i.set(a,u),a.addEventListener("dispose",_)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",o.morphTexture,n);else{let p=0;for(let x=0;x<d.length;x++)p+=d[x];let g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",d)}l.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:r}}function Kw(e,t,n,i,s){let r=new WeakMap;function o(d){let c=s.render.frame,h=d.geometry,u=t.get(d,h);if(r.get(u)!==c)t.update(u),r.set(u,c);if(d.isInstancedMesh){if(d.hasEventListener("dispose",l)===!1)d.addEventListener("dispose",l);if(r.get(d)!==c){if(n.update(d.instanceMatrix,e.ARRAY_BUFFER),d.instanceColor!==null)n.update(d.instanceColor,e.ARRAY_BUFFER);r.set(d,c)}}if(d.isSkinnedMesh){let p=d.skeleton;if(r.get(p)!==c)p.update(),r.set(p,c)}return u}function a(){r=new WeakMap}function l(d){let c=d.target;if(c.removeEventListener("dispose",l),i.releaseStatesOfObject(c),n.remove(c.instanceMatrix),c.instanceColor!==null)n.remove(c.instanceColor)}return{update:o,dispose:a}}var Zw={[kr]:"LINEAR_TONE_MAPPING",[Gr]:"REINHARD_TONE_MAPPING",[Hr]:"CINEON_TONE_MAPPING",[Vr]:"ACES_FILMIC_TONE_MAPPING",[jr]:"AGX_TONE_MAPPING",[Xr]:"NEUTRAL_TONE_MAPPING",[Wr]:"CUSTOM_TONE_MAPPING"};function Qw(e,t,n,i,s,r){let o=new St(t,n,{type:e,depthBuffer:s,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,d=new Qe;d.setAttribute("position",new Oe([-1,3,0,-1,-1,0,3,-1,0],3)),d.setAttribute("uv",new Oe([0,2,0,0,2,0],2));let c=new to({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new nt(d,c),u=new Pi(-1,1,1,-1,0,1),p=null,g=null,x=!1,m,f=null,T=[],E=!1;this.setSize=function(b,S){if(o.setSize(b,S),a!==null)a.setSize(b,S);if(l!==null)l.setSize(b,S);for(let A=0;A<T.length;A++){let y=T[A];if(y.setSize)y.setSize(b,S)}},this.setEffects=function(b){T=b,E=T.length>0&&T[0].isRenderPass===!0;let{width:S,height:A}=o;if(T.length>0&&a===null)a=new St(S,A,{type:zt,depthBuffer:!1,stencilBuffer:!1}),l=new St(S,A,{type:zt,depthBuffer:!1,stencilBuffer:!1});for(let y=0;y<T.length;y++){let v=T[y];if(v.setSize)v.setSize(S,A)}},this.begin=function(b,S){if(x)return!1;if(b.toneMapping===gn&&T.length===0)return!1;if(f=S,S!==null){let{width:A,height:y}=S;if(o.width!==A||o.height!==y)this.setSize(A,y)}if(E===!1)b.setRenderTarget(o);return m=b.toneMapping,b.toneMapping=gn,!0},this.hasRenderPass=function(){return E},this.end=function(b,S){b.toneMapping=m,x=!0;let A=o,y=a;for(let v=0;v<T.length;v++){let _=T[v];if(_.enabled===!1)continue;if(_.render(b,y,A,S),_.needsSwap!==!1)A=y,y=y===a?l:a}if(p!==b.outputColorSpace||g!==b.toneMapping){if(p=b.outputColorSpace,g=b.toneMapping,c.defines={},Ze.getTransfer(p)===ut)c.defines.SRGB_TRANSFER="";let v=Zw[g];if(v)c.defines[v]="";c.needsUpdate=!0}c.uniforms.tDiffuse.value=A.texture,b.setRenderTarget(f),b.render(h,u),f=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){if(o.dispose(),a!==null)a.dispose();if(l!==null)l.dispose();d.dispose(),c.dispose()}}var cg=new Nt,nu=new os(1,1),ug=new La,hg=new Ac,pg=new Oa,jm=[],Xm=[],Jm=new Float32Array(16),Ym=new Float32Array(9),qm=new Float32Array(4);function or(e,t,n){let i=e[0];if(i<=0||i>0)return e;let s=t*n,r=jm[s];if(r===void 0)r=new Float32Array(s),jm[s]=r;if(t!==0){i.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=n,e[o].toArray(r,a)}return r}function Ot(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function Bt(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function Xa(e,t){let n=Xm[t];if(n===void 0)n=new Int32Array(t),Xm[t]=n;for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function $w(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1f(this.addr,t),n[0]=t}function eE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Ot(n,t))return;e.uniform2fv(this.addr,t),Bt(n,t)}}function tE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else if(t.r!==void 0){if(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b}else{if(Ot(n,t))return;e.uniform3fv(this.addr,t),Bt(n,t)}}function nE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Ot(n,t))return;e.uniform4fv(this.addr,t),Bt(n,t)}}function iE(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Ot(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Bt(n,t)}else{if(Ot(n,i))return;qm.set(i),e.uniformMatrix2fv(this.addr,!1,qm),Bt(n,i)}}function sE(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Ot(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Bt(n,t)}else{if(Ot(n,i))return;Ym.set(i),e.uniformMatrix3fv(this.addr,!1,Ym),Bt(n,i)}}function rE(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Ot(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Bt(n,t)}else{if(Ot(n,i))return;Jm.set(i),e.uniformMatrix4fv(this.addr,!1,Jm),Bt(n,i)}}function oE(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1i(this.addr,t),n[0]=t}function aE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Ot(n,t))return;e.uniform2iv(this.addr,t),Bt(n,t)}}function lE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Ot(n,t))return;e.uniform3iv(this.addr,t),Bt(n,t)}}function dE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Ot(n,t))return;e.uniform4iv(this.addr,t),Bt(n,t)}}function cE(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1ui(this.addr,t),n[0]=t}function uE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Ot(n,t))return;e.uniform2uiv(this.addr,t),Bt(n,t)}}function hE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Ot(n,t))return;e.uniform3uiv(this.addr,t),Bt(n,t)}}function pE(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Ot(n,t))return;e.uniform4uiv(this.addr,t),Bt(n,t)}}function fE(e,t,n){let i=this.cache,s=n.allocateTextureUnit();if(i[0]!==s)e.uniform1i(this.addr,s),i[0]=s;let r;if(this.type===e.SAMPLER_2D_SHADOW)nu.compareFunction=n.isReversedDepthBuffer()?Ca:Ra,r=nu;else r=cg;n.setTexture2D(t||r,s)}function mE(e,t,n){let i=this.cache,s=n.allocateTextureUnit();if(i[0]!==s)e.uniform1i(this.addr,s),i[0]=s;n.setTexture3D(t||hg,s)}function gE(e,t,n){let i=this.cache,s=n.allocateTextureUnit();if(i[0]!==s)e.uniform1i(this.addr,s),i[0]=s;n.setTextureCube(t||pg,s)}function vE(e,t,n){let i=this.cache,s=n.allocateTextureUnit();if(i[0]!==s)e.uniform1i(this.addr,s),i[0]=s;n.setTexture2DArray(t||ug,s)}function xE(e){switch(e){case 5126:return $w;case 35664:return eE;case 35665:return tE;case 35666:return nE;case 35674:return iE;case 35675:return sE;case 35676:return rE;case 5124:case 35670:return oE;case 35667:case 35671:return aE;case 35668:case 35672:return lE;case 35669:case 35673:return dE;case 5125:return cE;case 36294:return uE;case 36295:return hE;case 36296:return pE;case 35678:case 36198:case 36298:case 36306:case 35682:return fE;case 35679:case 36299:case 36307:return mE;case 35680:case 36300:case 36308:case 36293:return gE;case 36289:case 36303:case 36311:case 36292:return vE}}function bE(e,t){e.uniform1fv(this.addr,t)}function yE(e,t){let n=or(t,this.size,2);e.uniform2fv(this.addr,n)}function _E(e,t){let n=or(t,this.size,3);e.uniform3fv(this.addr,n)}function SE(e,t){let n=or(t,this.size,4);e.uniform4fv(this.addr,n)}function ME(e,t){let n=or(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function wE(e,t){let n=or(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function EE(e,t){let n=or(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function TE(e,t){e.uniform1iv(this.addr,t)}function AE(e,t){e.uniform2iv(this.addr,t)}function RE(e,t){e.uniform3iv(this.addr,t)}function CE(e,t){e.uniform4iv(this.addr,t)}function LE(e,t){e.uniform1uiv(this.addr,t)}function PE(e,t){e.uniform2uiv(this.addr,t)}function IE(e,t){e.uniform3uiv(this.addr,t)}function DE(e,t){e.uniform4uiv(this.addr,t)}function zE(e,t,n){let i=this.cache,s=t.length,r=Xa(n,s);if(!Ot(i,r))e.uniform1iv(this.addr,r),Bt(i,r);let o;if(this.type===e.SAMPLER_2D_SHADOW)o=nu;else o=cg;for(let a=0;a!==s;++a)n.setTexture2D(t[a]||o,r[a])}function FE(e,t,n){let i=this.cache,s=t.length,r=Xa(n,s);if(!Ot(i,r))e.uniform1iv(this.addr,r),Bt(i,r);for(let o=0;o!==s;++o)n.setTexture3D(t[o]||hg,r[o])}function UE(e,t,n){let i=this.cache,s=t.length,r=Xa(n,s);if(!Ot(i,r))e.uniform1iv(this.addr,r),Bt(i,r);for(let o=0;o!==s;++o)n.setTextureCube(t[o]||pg,r[o])}function NE(e,t,n){let i=this.cache,s=t.length,r=Xa(n,s);if(!Ot(i,r))e.uniform1iv(this.addr,r),Bt(i,r);for(let o=0;o!==s;++o)n.setTexture2DArray(t[o]||ug,r[o])}function OE(e){switch(e){case 5126:return bE;case 35664:return yE;case 35665:return _E;case 35666:return SE;case 35674:return ME;case 35675:return wE;case 35676:return EE;case 5124:case 35670:return TE;case 35667:case 35671:return AE;case 35668:case 35672:return RE;case 35669:case 35673:return CE;case 5125:return LE;case 36294:return PE;case 36295:return IE;case 36296:return DE;case 35678:case 36198:case 36298:case 36306:case 35682:return zE;case 35679:case 36299:case 36307:return FE;case 35680:case 36300:case 36308:case 36293:return UE;case 36289:case 36303:case 36311:case 36292:return NE}}class fg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=xE(t.type)}}class mg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=OE(t.type)}}class gg{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let s=0,r=i.length;s!==r;++s){let o=i[s];o.setValue(e,t[o.id],n)}}}var $c=/(\w+)(\])?(\[|\.)?/g;function Km(e,t){e.seq.push(t),e.map[t.id]=t}function BE(e,t,n){let i=e.name,s=i.length;$c.lastIndex=0;while(!0){let r=$c.exec(i),o=$c.lastIndex,a=r[1],l=r[2]==="]",d=r[3];if(l)a=a|0;if(d===void 0||d==="["&&o+2===s){Km(n,d===void 0?new fg(a,e,t):new mg(a,e,t));break}else{let h=n.map[a];if(h===void 0)h=new gg(a),Km(n,h);n=h}}}class ro{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let o=e.getActiveUniform(t,r),a=e.getUniformLocation(t,o.name);BE(o,a,this)}let i=[],s=[];for(let r of this.seq)if(r.type===e.SAMPLER_2D_SHADOW||r.type===e.SAMPLER_CUBE_SHADOW||r.type===e.SAMPLER_2D_ARRAY_SHADOW)i.push(r);else s.push(r);if(i.length>0)this.seq=i.concat(s)}setValue(e,t,n,i){let s=this.map[t];if(s!==void 0)s.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];if(i!==void 0)this.setValue(e,n,i)}static upload(e,t,n,i){for(let s=0,r=t.length;s!==r;++s){let o=t[s],a=n[o.id];if(a.needsUpdate!==!1)o.setValue(e,a.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,s=e.length;i!==s;++i){let r=e[i];if(r.id in t)n.push(r)}return n}}function Zm(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var kE=37297,GE=0;function HE(e,t){let n=e.split(`
`),i=[],s=Math.max(t-6,0),r=Math.min(t+6,n.length);for(let o=s;o<r;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${n[o]}`)}return i.join(`
`)}var Qm=new ke;function VE(e){Ze._getMatrix(Qm,Ze.workingColorSpace,e);let t=`mat3( ${Qm.elements.map((n)=>n.toFixed(4))} )`;switch(Ze.getTransfer(e)){case _c:return[t,"LinearTransferOETF"];case ut:return[t,"sRGBTransferOETF"];default:return ze("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function $m(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),r=(e.getShaderInfoLog(t)||"").trim();if(i&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return n.toUpperCase()+`

`+r+`

`+HE(e.getShaderSource(t),a)}else return r}function WE(e,t){let n=VE(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var jE={[kr]:"Linear",[Gr]:"Reinhard",[Hr]:"Cineon",[Vr]:"ACESFilmic",[jr]:"AgX",[Xr]:"Neutral",[Wr]:"Custom"};function XE(e,t){let n=jE[t];if(n===void 0)return ze("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }";return"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var Wa=new I;function JE(){Ze.getLuminanceCoefficients(Wa);let e=Wa.x.toFixed(4),t=Wa.y.toFixed(4),n=Wa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function YE(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(so).join(`
`)}function qE(e){let t=[];for(let n in e){let i=e[n];if(i===!1)continue;t.push("#define "+n+" "+i)}return t.join(`
`)}function KE(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let r=e.getActiveAttrib(t,s),o=r.name,a=1;if(r.type===e.FLOAT_MAT2)a=2;if(r.type===e.FLOAT_MAT3)a=3;if(r.type===e.FLOAT_MAT4)a=4;n[o]={type:r.type,location:e.getAttribLocation(t,o),locationSize:a}}return n}function so(e){return e!==""}function eg(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function tg(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var ZE=/^[ \t]*#include +<([\w\d./]+)>/gm;function iu(e){return e.replace(ZE,$E)}var QE=new Map;function $E(e,t){let n=Ye[t];if(n===void 0){let i=QE.get(t);if(i!==void 0)n=Ye[i],ze('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return iu(n)}var eT=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ng(e){return e.replace(eT,tT)}function tT(e,t,n,i){let s="";for(let r=parseInt(t);r<parseInt(n);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function ig(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;if(e.precision==="highp")t+=`
#define HIGH_PRECISION`;else if(e.precision==="mediump")t+=`
#define MEDIUM_PRECISION`;else if(e.precision==="lowp")t+=`
#define LOW_PRECISION`;return t}var nT={[Ur]:"SHADOWMAP_TYPE_PCF",[qs]:"SHADOWMAP_TYPE_VSM"};function iT(e){return nT[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var sT={[Qs]:"ENVMAP_TYPE_CUBE",[Zi]:"ENVMAP_TYPE_CUBE",[Jr]:"ENVMAP_TYPE_CUBE_UV"};function rT(e){if(e.envMap===!1)return"ENVMAP_TYPE_CUBE";return sT[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var oT={[Zi]:"ENVMAP_MODE_REFRACTION"};function aT(e){if(e.envMap===!1)return"ENVMAP_MODE_REFLECTION";return oT[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var lT={[fm]:"ENVMAP_BLENDING_MULTIPLY",[mm]:"ENVMAP_BLENDING_MIX",[gm]:"ENVMAP_BLENDING_ADD"};function dT(e){if(e.envMap===!1)return"ENVMAP_BLENDING_NONE";return lT[e.combine]||"ENVMAP_BLENDING_NONE"}function cT(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),112)),texelHeight:i,maxMip:n}}function uT(e,t,n,i){let s=e.getContext(),{defines:r,vertexShader:o,fragmentShader:a}=n,l=iT(n),d=rT(n),c=aT(n),h=dT(n),u=cT(n),p=YE(n),g=qE(r),x=s.createProgram(),m,f,T=n.glslVersion?"#version "+n.glslVersion+`
`:"";if(n.isRawShaderMaterial){if(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(so).join(`
`),m.length>0)m+=`
`;if(f=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(so).join(`
`),f.length>0)f+=`
`}else m=[ig(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(so).join(`
`),f=[ig(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+d:"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.retroreflection?"#define USE_RETROREFLECTION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==gn?"#define TONE_MAPPING":"",n.toneMapping!==gn?Ye.tonemapping_pars_fragment:"",n.toneMapping!==gn?XE("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Ye.colorspace_pars_fragment,WE("linearToOutputTexel",n.outputColorSpace),JE(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(so).join(`
`);if(o=iu(o),o=eg(o,n),o=tg(o,n),a=iu(a),a=eg(a,n),a=tg(a,n),o=ng(o),a=ng(a),n.isRawShaderMaterial!==!0)T=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",n.glslVersion===Sc?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===Sc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f;let E=T+m+o,b=T+f+a,S=Zm(s,s.VERTEX_SHADER,E),A=Zm(s,s.FRAGMENT_SHADER,b);if(s.attachShader(x,S),s.attachShader(x,A),n.index0AttributeName!==void 0)s.bindAttribLocation(x,0,n.index0AttributeName);else if(n.hasPositionAttribute===!0)s.bindAttribLocation(x,0,"position");s.linkProgram(x);function y(P){if(e.debug.checkShaderErrors){let D=s.getProgramInfoLog(x)||"",N=s.getShaderInfoLog(S)||"",C=s.getShaderInfoLog(A)||"",B=D.trim(),k=N.trim(),G=C.trim(),Q=!0,W=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(Q=!1,typeof e.debug.onShaderError==="function")e.debug.onShaderError(s,x,S,A);else{let q=$m(s,S,"vertex"),ee=$m(s,A,"fragment");Be("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+B+`
`+q+`
`+ee)}else if(B!=="")ze("WebGLProgram: Program Info Log:",B);else if(k===""||G==="")W=!1;if(W)P.diagnostics={runnable:Q,programLog:B,vertexShader:{log:k,prefix:m},fragmentShader:{log:G,prefix:f}}}s.deleteShader(S),s.deleteShader(A),v=new ro(s,x),_=KE(s,x)}let v;this.getUniforms=function(){if(v===void 0)y(this);return v};let _;this.getAttributes=function(){if(_===void 0)y(this);return _};let z=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(z===!1)z=s.getProgramParameter(x,kE);return z},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=GE++,this.cacheKey=t,this.usedTimes=1,this.program=x,this.vertexShader=S,this.fragmentShader=A,this}var hT=0;class vg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);if(i.has(t)===!1)i.add(t),t.usedTimes++;if(i.has(n)===!1)i.add(n),n.usedTimes++;return this}remove(e){let t=this.materialCache.get(e);for(let n of t)if(n.usedTimes--,n.usedTimes===0)this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);if(n===void 0)n=new Set,t.set(e,n);return n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);if(n===void 0)n=new xg(e),t.set(e,n);return n}}class xg{constructor(e){this.id=hT++,this.code=e,this.usedTimes=0}}function pT(e){return e===ns||e===Ea||e===Ta}function fT(e,t,n,i,s,r){let o=new Pa,a=new vg,l=new Set,d=[],c=new Map,{logarithmicDepthBuffer:h,precision:u}=i,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){if(l.add(v),v===0)return"uv";return`uv${v}`}function x(v,_,z,P,D,N){let C=P.fog,B=D.geometry,k=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?P.environment:null,G=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,Q=t.get(v.envMap||k,G),W=!!Q&&Q.mapping===Jr?Q.image.height:null,q=p[v.type];if(v.precision!==null){if(u=i.getMaxPrecision(v.precision),u!==v.precision)ze("WebGLProgram.getParameters:",v.precision,"not supported, using",u,"instead.")}let ee=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,xe=ee!==void 0?ee.length:0,_e=0;if(B.morphAttributes.position!==void 0)_e=1;if(B.morphAttributes.normal!==void 0)_e=2;if(B.morphAttributes.color!==void 0)_e=3;let Ve,Fe,J,te;if(q){let gt=Jn[q];Ve=gt.vertexShader,Fe=gt.fragmentShader}else{Ve=v.vertexShader,Fe=v.fragmentShader;let gt=a.getVertexShaderStage(v),ot=a.getFragmentShaderStage(v);a.update(v,gt,ot),J=gt.id,te=ot.id}let se=e.getRenderTarget(),Re=e.state.buffers.depth.getReversed(),Pe=D.isInstancedMesh===!0,Ee=D.isBatchedMesh===!0,Rt=!!v.map,Ge=!!v.matcap,qe=!!Q,st=!!v.aoMap,$e=!!v.lightMap,Mt=!!v.bumpMap&&v.wireframe===!1,pt=!!v.normalMap,kt=!!v.displacementMap,Ct=!!v.emissiveMap,Lt=!!v.metalnessMap,L=!!v.roughnessMap,Ie=v.anisotropy>0,Ue=v.clearcoat>0,lt=v.dispersion>0,R=v.retroreflectivity>0,M=v.iridescence>0,F=v.sheen>0,j=v.transmission>0,ie=Ie&&!!v.anisotropyMap,oe=Ue&&!!v.clearcoatMap,ue=Ue&&!!v.clearcoatNormalMap,Y=Ue&&!!v.clearcoatRoughnessMap,Z=M&&!!v.iridescenceMap,ve=M&&!!v.iridescenceThicknessMap,Ae=F&&!!v.sheenColorMap,he=F&&!!v.sheenRoughnessMap,re=!!v.specularMap,De=!!v.specularColorMap,Ne=!!v.specularIntensityMap,rt=j&&!!v.transmissionMap,O=j&&!!v.thicknessMap,le=!!v.gradientMap,K=!!v.alphaMap,ce=v.alphaTest>0,be=!!v.alphaHash,ne=!!v.extensions,fe=gn;if(v.toneMapped){if(se===null||se.isXRRenderTarget===!0)fe=e.toneMapping}let We={shaderID:q,shaderType:v.type,shaderName:v.name,vertexShader:Ve,fragmentShader:Fe,defines:v.defines,customVertexShaderID:J,customFragmentShaderID:te,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:u,batching:Ee,batchingColor:Ee&&D._colorsTexture!==null,instancing:Pe,instancingColor:Pe&&D.instanceColor!==null,instancingMorph:Pe&&D.morphTexture!==null,outputColorSpace:se===null?e.outputColorSpace:se.isXRRenderTarget===!0?se.texture.colorSpace:Ze.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:Rt,matcap:Ge,envMap:qe,envMapMode:qe&&Q.mapping,envMapCubeUVHeight:W,aoMap:st,lightMap:$e,bumpMap:Mt,normalMap:pt,displacementMap:kt,emissiveMap:Ct,normalMapObjectSpace:pt&&v.normalMapType===Tm,normalMapTangentSpace:pt&&v.normalMapType===bc,packedNormalMap:pt&&v.normalMapType===bc&&pT(v.normalMap.format),metalnessMap:Lt,roughnessMap:L,anisotropy:Ie,anisotropyMap:ie,clearcoat:Ue,clearcoatMap:oe,clearcoatNormalMap:ue,clearcoatRoughnessMap:Y,dispersion:lt,retroreflection:R,iridescence:M,iridescenceMap:Z,iridescenceThicknessMap:ve,sheen:F,sheenColorMap:Ae,sheenRoughnessMap:he,specularMap:re,specularColorMap:De,specularIntensityMap:Ne,transmission:j,transmissionMap:rt,thicknessMap:O,gradientMap:le,opaque:v.transparent===!1&&v.blending===Nr&&v.alphaToCoverage===!1,alphaMap:K,alphaTest:ce,alphaHash:be,combine:v.combine,mapUv:Rt&&g(v.map.channel),aoMapUv:st&&g(v.aoMap.channel),lightMapUv:$e&&g(v.lightMap.channel),bumpMapUv:Mt&&g(v.bumpMap.channel),normalMapUv:pt&&g(v.normalMap.channel),displacementMapUv:kt&&g(v.displacementMap.channel),emissiveMapUv:Ct&&g(v.emissiveMap.channel),metalnessMapUv:Lt&&g(v.metalnessMap.channel),roughnessMapUv:L&&g(v.roughnessMap.channel),anisotropyMapUv:ie&&g(v.anisotropyMap.channel),clearcoatMapUv:oe&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:ue&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Y&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:Z&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:Ae&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:he&&g(v.sheenRoughnessMap.channel),specularMapUv:re&&g(v.specularMap.channel),specularColorMapUv:De&&g(v.specularColorMap.channel),specularIntensityMapUv:Ne&&g(v.specularIntensityMap.channel),transmissionMapUv:rt&&g(v.transmissionMap.channel),thicknessMapUv:O&&g(v.thicknessMap.channel),alphaMapUv:K&&g(v.alphaMap.channel),vertexTangents:!!B.attributes.tangent&&(pt||Ie),vertexNormals:!!B.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!B.attributes.uv&&(Rt||K),fog:!!C,useFog:v.fog===!0,fogExp2:!!C&&C.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||B.attributes.normal===void 0&&pt===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:Re,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:B.attributes.position!==void 0,morphTargets:B.morphAttributes.position!==void 0,morphNormals:B.morphAttributes.normal!==void 0,morphColors:B.morphAttributes.color!==void 0,morphTargetsCount:xe,morphTextureStride:_e,numSunLights:_.sun.length,numDirLights:_.directional.length,numPointLights:_.point.length,numSpotLights:_.spot.length,numSpotLightMaps:_.spotLightMap.length,numRectAreaLights:_.rectArea.length,numHemiLights:_.hemi.length,numSunLightShadows:_.sunShadowMap.length,numDirLightShadows:_.directionalShadowMap.length,numPointLightShadows:_.pointShadowMap.length,numSpotLightShadows:_.spotShadowMap.length,numSpotLightShadowsWithMaps:_.numSpotLightShadowsWithMaps,numLightProbes:_.numLightProbes,numLightProbeGrids:N.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:v.dithering,shadowMapEnabled:e.shadowMap.enabled&&z.length>0,shadowMapType:e.shadowMap.type,toneMapping:fe,decodeVideoTexture:Rt&&v.map.isVideoTexture===!0&&Ze.getTransfer(v.map.colorSpace)===ut,decodeVideoTextureEmissive:Ct&&v.emissiveMap.isVideoTexture===!0&&Ze.getTransfer(v.emissiveMap.colorSpace)===ut,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===cn,flipSided:v.side===dn,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ne&&v.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ne&&v.extensions.multiDraw===!0||Ee)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return We.vertexUv1s=l.has(1),We.vertexUv2s=l.has(2),We.vertexUv3s=l.has(3),l.clear(),We}function m(v){let _=[];if(v.shaderID)_.push(v.shaderID);else _.push(v.customVertexShaderID),_.push(v.customFragmentShaderID);if(v.defines!==void 0)for(let z in v.defines)_.push(z),_.push(v.defines[z]);if(v.isRawShaderMaterial===!1)f(_,v),T(_,v),_.push(e.outputColorSpace);return _.push(v.customProgramCacheKey),_.join()}function f(v,_){v.push(_.precision),v.push(_.outputColorSpace),v.push(_.envMapMode),v.push(_.envMapCubeUVHeight),v.push(_.mapUv),v.push(_.alphaMapUv),v.push(_.lightMapUv),v.push(_.aoMapUv),v.push(_.bumpMapUv),v.push(_.normalMapUv),v.push(_.displacementMapUv),v.push(_.emissiveMapUv),v.push(_.metalnessMapUv),v.push(_.roughnessMapUv),v.push(_.anisotropyMapUv),v.push(_.clearcoatMapUv),v.push(_.clearcoatNormalMapUv),v.push(_.clearcoatRoughnessMapUv),v.push(_.iridescenceMapUv),v.push(_.iridescenceThicknessMapUv),v.push(_.sheenColorMapUv),v.push(_.sheenRoughnessMapUv),v.push(_.specularMapUv),v.push(_.specularColorMapUv),v.push(_.specularIntensityMapUv),v.push(_.transmissionMapUv),v.push(_.thicknessMapUv),v.push(_.combine),v.push(_.fogExp2),v.push(_.sizeAttenuation),v.push(_.morphTargetsCount),v.push(_.morphAttributeCount),v.push(_.numSunLights),v.push(_.numDirLights),v.push(_.numPointLights),v.push(_.numSpotLights),v.push(_.numSpotLightMaps),v.push(_.numHemiLights),v.push(_.numRectAreaLights),v.push(_.numSunLightShadows),v.push(_.numDirLightShadows),v.push(_.numPointLightShadows),v.push(_.numSpotLightShadows),v.push(_.numSpotLightShadowsWithMaps),v.push(_.numLightProbes),v.push(_.shadowMapType),v.push(_.toneMapping),v.push(_.numClippingPlanes),v.push(_.numClipIntersection),v.push(_.depthPacking)}function T(v,_){if(o.disableAll(),_.instancing)o.enable(0);if(_.instancingColor)o.enable(1);if(_.instancingMorph)o.enable(2);if(_.matcap)o.enable(3);if(_.envMap)o.enable(4);if(_.normalMapObjectSpace)o.enable(5);if(_.normalMapTangentSpace)o.enable(6);if(_.clearcoat)o.enable(7);if(_.iridescence)o.enable(8);if(_.alphaTest)o.enable(9);if(_.vertexColors)o.enable(10);if(_.vertexAlphas)o.enable(11);if(_.vertexUv1s)o.enable(12);if(_.vertexUv2s)o.enable(13);if(_.vertexUv3s)o.enable(14);if(_.vertexTangents)o.enable(15);if(_.anisotropy)o.enable(16);if(_.alphaHash)o.enable(17);if(_.batching)o.enable(18);if(_.dispersion)o.enable(19);if(_.retroreflection)o.enable(24);if(_.batchingColor)o.enable(20);if(_.gradientMap)o.enable(21);if(_.packedNormalMap)o.enable(22);if(_.vertexNormals)o.enable(23);if(v.push(o.mask),o.disableAll(),_.fog)o.enable(0);if(_.useFog)o.enable(1);if(_.flatShading)o.enable(2);if(_.logarithmicDepthBuffer)o.enable(3);if(_.reversedDepthBuffer)o.enable(4);if(_.skinning)o.enable(5);if(_.morphTargets)o.enable(6);if(_.morphNormals)o.enable(7);if(_.morphColors)o.enable(8);if(_.premultipliedAlpha)o.enable(9);if(_.shadowMapEnabled)o.enable(10);if(_.doubleSided)o.enable(11);if(_.flipSided)o.enable(12);if(_.useDepthPacking)o.enable(13);if(_.dithering)o.enable(14);if(_.transmission)o.enable(15);if(_.sheen)o.enable(16);if(_.opaque)o.enable(17);if(_.pointsUvs)o.enable(18);if(_.decodeVideoTexture)o.enable(19);if(_.decodeVideoTextureEmissive)o.enable(20);if(_.alphaToCoverage)o.enable(21);if(_.numLightProbeGrids>0)o.enable(22);if(_.hasPositionAttribute)o.enable(23);v.push(o.mask)}function E(v){let _=p[v.type],z;if(_){let P=Jn[_];z=Vt.clone(P.uniforms)}else z=v.uniforms;return z}function b(v,_){let z=c.get(_);if(z!==void 0)++z.usedTimes;else z=new uT(e,_,v,s),d.push(z),c.set(_,z);return z}function S(v){if(--v.usedTimes===0){let _=d.indexOf(v);d[_]=d[d.length-1],d.pop(),c.delete(v.cacheKey),v.destroy()}}function A(v){a.remove(v)}function y(){a.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:E,acquireProgram:b,releaseProgram:S,releaseShaderCache:A,programs:d,dispose:y}}function mT(){let e=new WeakMap;function t(o){return e.has(o)}function n(o){let a=e.get(o);if(a===void 0)a={},e.set(o,a);return a}function i(o){e.delete(o)}function s(o,a,l){e.get(o)[a]=l}function r(){e=new WeakMap}return{has:t,get:n,remove:i,update:s,dispose:r}}function gT(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.material.id!==t.material.id)return e.material.id-t.material.id;else if(e.materialVariant!==t.materialVariant)return e.materialVariant-t.materialVariant;else if(e.z!==t.z)return e.z-t.z;else return e.id-t.id}function sg(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.z!==t.z)return t.z-e.z;else return e.id-t.id}function rg(){let e=[],t=0,n=[],i=[],s=[];function r(){t=0,n.length=0,i.length=0,s.length=0}function o(u){let p=0;if(u.isInstancedMesh)p+=2;if(u.isSkinnedMesh)p+=1;return p}function a(u,p,g,x,m,f){let T=e[t];if(T===void 0)T={id:u.id,object:u,geometry:p,material:g,materialVariant:o(u),groupOrder:x,renderOrder:u.renderOrder,z:m,group:f},e[t]=T;else T.id=u.id,T.object=u,T.geometry=p,T.material=g,T.materialVariant=o(u),T.groupOrder=x,T.renderOrder=u.renderOrder,T.z=m,T.group=f;return t++,T}function l(u,p,g,x,m,f,T){if(T.reversedDepth===!0)m=-m;let E=a(u,p,g,x,m,f);if(g.transmission>0)i.push(E);else if(g.transparent===!0)s.push(E);else n.push(E)}function d(u,p,g,x,m,f){let T=a(u,p,g,x,m,f);if(g.transmission>0)i.unshift(T);else if(g.transparent===!0)s.unshift(T);else n.unshift(T)}function c(u,p){if(n.length>1)n.sort(u||gT);if(i.length>1)i.sort(p||sg);if(s.length>1)s.sort(p||sg)}function h(){for(let u=t,p=e.length;u<p;u++){let g=e[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:s,init:r,push:l,unshift:d,finish:h,sort:c}}function vT(){let e=new WeakMap;function t(i,s){let r=e.get(i),o;if(r===void 0)o=new rg,e.set(i,[o]);else if(s>=r.length)o=new rg,r.push(o);else o=r[s];return o}function n(){e=new WeakMap}return{get:t,dispose:n}}function xT(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={direction:new I,color:new ae};break;case"SpotLight":n={position:new I,direction:new I,color:new ae,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new I,color:new ae,distance:0,decay:0};break;case"HemisphereLight":n={direction:new I,skyColor:new ae,groundColor:new ae};break;case"RectAreaLight":n={color:new ae,position:new I,halfWidth:new I,halfHeight:new I};break}return e[t.id]=n,n}}}function bT(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ce};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ce};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ce,shadowCameraNear:1,shadowCameraFar:1000};break}return e[t.id]=n,n}}}var yT=0;function _T(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function ST(e){let t=new xT,n=bT(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let d=0;d<9;d++)i.probe.push(new I);let s=new I,r=new Je,o=new Je;function a(d){let c=0,h=0,u=0;for(let D=0;D<9;D++)i.probe[D].set(0,0,0);let p=0,g=0,x=0,m=0,f=0,T=0,E=0,b=0,S=0,A=0,y=0,v=0,_=0,z=0;d.sort(_T);for(let D=0,N=d.length;D<N;D++){let C=d[D],{color:B,intensity:k,distance:G}=C,Q=null;if(C.shadow&&C.shadow.map)if(C.shadow.map.texture.format===ns)Q=C.shadow.map.texture;else Q=C.shadow.map.depthTexture||C.shadow.map.texture;if(C.isAmbientLight)c+=B.r*k,h+=B.g*k,u+=B.b*k;else if(C.isLightProbe){for(let W=0;W<9;W++)i.probe[W].addScaledVector(C.sh.coefficients[W],k);z++}else if(C.isSunLight){let W=t.get(C);if(W.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let q=C.shadow,ee=n.get(C);ee.shadowIntensity=q.intensity,ee.shadowBias=q.bias,ee.shadowNormalBias=q.normalBias,ee.shadowRadius=q.radius,ee.shadowMapSize.copy(q.mapSize).multiply(q.getFrameExtents()),i.sunShadow[g]=ee,i.sunShadowMap[g]=Q;let xe=q.getViewportCount();for(let _e=0;_e<xe;_e++)i.sunShadowMatrix[x+_e]=q.getMatrix(_e),i.sunShadowCascade[x+_e]=q._cascadeData[_e];x+=xe,g++}i.sun[p]=W,p++}else if(C.isDirectionalLight){let W=t.get(C);if(W.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let q=C.shadow,ee=n.get(C);ee.shadowIntensity=q.intensity,ee.shadowBias=q.bias,ee.shadowNormalBias=q.normalBias,ee.shadowRadius=q.radius,ee.shadowMapSize=q.mapSize,i.directionalShadow[m]=ee,i.directionalShadowMap[m]=Q,i.directionalShadowMatrix[m]=C.shadow.matrix,S++}i.directional[m]=W,m++}else if(C.isSpotLight){let W=t.get(C);W.position.setFromMatrixPosition(C.matrixWorld),W.color.copy(B).multiplyScalar(k),W.distance=G,W.coneCos=Math.cos(C.angle),W.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),W.decay=C.decay,i.spot[T]=W;let q=C.shadow;if(C.map){if(i.spotLightMap[v]=C.map,v++,q.updateMatrices(C),C.castShadow)_++}if(i.spotLightMatrix[T]=q.matrix,C.castShadow){let ee=n.get(C);ee.shadowIntensity=q.intensity,ee.shadowBias=q.bias,ee.shadowNormalBias=q.normalBias,ee.shadowRadius=q.radius,ee.shadowMapSize=q.mapSize,i.spotShadow[T]=ee,i.spotShadowMap[T]=Q,y++}T++}else if(C.isRectAreaLight){let W=t.get(C);W.color.copy(B).multiplyScalar(k),W.halfWidth.set(C.width*0.5,0,0),W.halfHeight.set(0,C.height*0.5,0),i.rectArea[E]=W,E++}else if(C.isPointLight){let W=t.get(C);if(W.color.copy(C.color).multiplyScalar(C.intensity),W.distance=C.distance,W.decay=C.decay,C.castShadow){let q=C.shadow,ee=n.get(C);ee.shadowIntensity=q.intensity,ee.shadowBias=q.bias,ee.shadowNormalBias=q.normalBias,ee.shadowRadius=q.radius,ee.shadowMapSize=q.mapSize,ee.shadowCameraNear=q.camera.near,ee.shadowCameraFar=q.camera.far,i.pointShadow[f]=ee,i.pointShadowMap[f]=Q,i.pointShadowMatrix[f]=C.shadow.matrix,A++}i.point[f]=W,f++}else if(C.isHemisphereLight){let W=t.get(C);W.skyColor.copy(C.color).multiplyScalar(k),W.groundColor.copy(C.groundColor).multiplyScalar(k),i.hemi[b]=W,b++}}if(E>0)if(e.has("OES_texture_float_linear")===!0)i.rectAreaLTC1=de.LTC_FLOAT_1,i.rectAreaLTC2=de.LTC_FLOAT_2;else i.rectAreaLTC1=de.LTC_HALF_1,i.rectAreaLTC2=de.LTC_HALF_2;i.ambient[0]=c,i.ambient[1]=h,i.ambient[2]=u;let P=i.hash;if(P.sunLength!==p||P.directionalLength!==m||P.pointLength!==f||P.spotLength!==T||P.rectAreaLength!==E||P.hemiLength!==b||P.numSunShadows!==g||P.numDirectionalShadows!==S||P.numPointShadows!==A||P.numSpotShadows!==y||P.numSpotMaps!==v||P.numLightProbes!==z)i.sun.length=p,i.directional.length=m,i.spot.length=T,i.rectArea.length=E,i.point.length=f,i.hemi.length=b,i.sunShadow.length=g,i.sunShadowMap.length=g,i.sunShadowMatrix.length=x,i.sunShadowCascade.length=x,i.directionalShadow.length=S,i.directionalShadowMap.length=S,i.directionalShadowMatrix.length=S,i.pointShadow.length=A,i.pointShadowMap.length=A,i.pointShadowMatrix.length=A,i.spotShadow.length=y,i.spotShadowMap.length=y,i.spotLightMatrix.length=y+v-_,i.spotLightMap.length=v,i.numSpotLightShadowsWithMaps=_,i.numLightProbes=z,P.sunLength=p,P.directionalLength=m,P.pointLength=f,P.spotLength=T,P.rectAreaLength=E,P.hemiLength=b,P.numSunShadows=g,P.numDirectionalShadows=S,P.numPointShadows=A,P.numSpotShadows=y,P.numSpotMaps=v,P.numLightProbes=z,i.version=yT++}function l(d,c){let h=0,u=0,p=0,g=0,x=0,m=0,f=c.matrixWorldInverse;for(let T=0,E=d.length;T<E;T++){let b=d[T];if(b.isSunLight){let S=i.sun[h];S.direction.setFromMatrixPosition(b.matrixWorld),S.direction.transformDirection(f),h++}else if(b.isDirectionalLight){let S=i.directional[u];S.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(f),u++}else if(b.isSpotLight){let S=i.spot[g];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(f),S.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(f),g++}else if(b.isRectAreaLight){let S=i.rectArea[x];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(f),o.identity(),r.copy(b.matrixWorld),r.premultiply(f),o.extractRotation(r),S.halfWidth.set(b.width*0.5,0,0),S.halfHeight.set(0,b.height*0.5,0),S.halfWidth.applyMatrix4(o),S.halfHeight.applyMatrix4(o),x++}else if(b.isPointLight){let S=i.point[p];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(f),p++}else if(b.isHemisphereLight){let S=i.hemi[m];S.direction.setFromMatrixPosition(b.matrixWorld),S.direction.transformDirection(f),m++}}}return{setup:a,setupView:l,state:i}}function og(e){let t=new ST(e),n=[],i=[],s=[];function r(u){h.camera=u,n.length=0,i.length=0,s.length=0}function o(u){n.push(u)}function a(u){i.push(u)}function l(u){s.push(u)}function d(){t.setup(n)}function c(u){t.setupView(n,u)}let h={lightsArray:n,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:d,setupLightsView:c,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function MT(e){let t=new WeakMap;function n(s,r=0){let o=t.get(s),a;if(o===void 0)a=new og(e),t.set(s,[a]);else if(r>=o.length)a=new og(e),o.push(a);else a=o[r];return a}function i(){t=new WeakMap}return{get:n,dispose:i}}var wT=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ET=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,TT=[new I(1,0,0),new I(-1,0,0),new I(0,1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1)],AT=[new I(0,-1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1),new I(0,-1,0),new I(0,-1,0)],ag=new Je,io=new I,eu=new I;function RT(e,t,n){let i=new Fa,s=new Ce,r=new Ce,o=new Tt,a=new Pc,l=new Ic,d={},c=n.maxTextureSize,h={[Ks]:dn,[dn]:Ks,[cn]:cn},u=new He({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ce},radius:{value:4}},vertexShader:wT,fragmentShader:ET}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let g=new Qe;g.setAttribute("position",new _t(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let x=new nt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ur;let f=this.type;this.render=function(A,y,v){if(m.enabled===!1)return;if(m.autoUpdate===!1&&m.needsUpdate===!1)return;if(A.length===0)return;if(this.type===Gf)ze("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Ur;let _=e.getRenderTarget(),z=e.getActiveCubeFace(),P=e.getActiveMipmapLevel(),D=e.state;if(D.setBlending(Sn),D.buffers.depth.getReversed()===!0)D.buffers.color.setClear(0,0,0,0);else D.buffers.color.setClear(1,1,1,1);D.buffers.depth.setTest(!0),D.setScissorTest(!1);let N=f!==this.type;if(N)y.traverse(function(C){if(C.material)if(Array.isArray(C.material))C.material.forEach((B)=>B.needsUpdate=!0);else C.material.needsUpdate=!0});for(let C=0,B=A.length;C<B;C++){let k=A[C],G=k.shadow;if(G===void 0){ze("WebGLShadowMap:",k,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;s.copy(G.mapSize);let Q=G.getFrameExtents();if(s.multiply(Q),r.copy(G.mapSize),s.x>c||s.y>c){if(s.x>c)r.x=Math.floor(c/Q.x),s.x=r.x*Q.x,G.mapSize.x=r.x;if(s.y>c)r.y=Math.floor(c/Q.y),s.y=r.y*Q.y,G.mapSize.y=r.y}let W=e.state.buffers.depth.getReversed();if(G.camera._reversedDepth=W,G.map===null||N===!0){if(G.map!==null){if(G.map.depthTexture!==null)G.map.depthTexture.dispose(),G.map.depthTexture=null;G.map.dispose()}if(this.type===qs){if(k.isPointLight){ze("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}G.map=new St(s.x,s.y,{format:ns,type:zt,minFilter:qt,magFilter:qt,generateMipmaps:!1}),G.map.texture.name=k.name+".shadowMap",G.map.depthTexture=new os(s.x,s.y,zn),G.map.depthTexture.name=k.name+".shadowMapDepth",G.map.depthTexture.format=$i,G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=Yt,G.map.depthTexture.magFilter=Yt}else{if(k.isPointLight)G.map=new su(s.x),G.map.depthTexture=new Cc(s.x,Ri);else G.map=new St(s.x,s.y),G.map.depthTexture=new os(s.x,s.y,Ri);if(G.map.depthTexture.name=k.name+".shadowMap",G.map.depthTexture.format=$i,this.type===Ur)G.map.depthTexture.compareFunction=W?Ca:Ra,G.map.depthTexture.minFilter=qt,G.map.depthTexture.magFilter=qt;else G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=Yt,G.map.depthTexture.magFilter=Yt}G.camera.updateProjectionMatrix()}if(G.map.isWebGLCubeRenderTarget!==!0&&(G.map.width!==s.x||G.map.height!==s.y))G.map.setSize(s.x,s.y);let q=G.map.isWebGLCubeRenderTarget?6:G.getViewportCount();if(k.isPointLight!==!0)G.updateMatrices(k,v);for(let ee=0;ee<q;ee++){let xe=G.getCamera(ee);if(k.isPointLight){let{camera:_e,matrix:Ve}=G,Fe=k.distance||_e.far;if(Fe!==_e.far)_e.far=Fe,_e.updateProjectionMatrix();io.setFromMatrixPosition(k.matrixWorld),_e.position.copy(io),eu.copy(_e.position),eu.add(TT[ee]),_e.up.copy(AT[ee]),_e.lookAt(eu),_e.updateMatrixWorld(),Ve.makeTranslation(-io.x,-io.y,-io.z),ag.multiplyMatrices(_e.projectionMatrix,_e.matrixWorldInverse),G._frustum.setFromProjectionMatrix(ag,_e.coordinateSystem,_e.reversedDepth)}if(G.map.isWebGLCubeRenderTarget)e.setRenderTarget(G.map,ee),e.clear();else{if(ee===0)e.setRenderTarget(G.map),e.clear();let _e=G.getViewport(ee);o.set(r.x*_e.x,r.y*_e.y,r.x*_e.z,r.y*_e.w),D.viewport(o)}i=G.getFrustum(ee),b(y,v,xe,k,this.type)}if(G.isPointLightShadow!==!0&&this.type===qs)T(G,v);G.needsUpdate=!1}f=this.type,m.needsUpdate=!1,e.setRenderTarget(_,z,P)};function T(A,y){let v=t.update(x);if(u.defines.VSM_SAMPLES!==A.blurSamples)u.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0;if(A.mapPass===null)A.mapPass=new St(s.x,s.y,{format:ns,type:zt});else if(A.mapPass.width!==A.map.width||A.mapPass.height!==A.map.height)A.mapPass.setSize(A.map.width,A.map.height);u.uniforms.shadow_pass.value=A.map.depthTexture,u.uniforms.resolution.value.set(A.map.width,A.map.height),u.uniforms.radius.value=A.radius,e.setRenderTarget(A.mapPass),e.clear(),e.renderBufferDirect(y,null,v,u,x,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value.set(A.map.width,A.map.height),p.uniforms.radius.value=A.radius,e.setRenderTarget(A.map),e.clear(),e.renderBufferDirect(y,null,v,p,x,null)}function E(A,y,v,_){let z=null,P=v.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(P!==void 0)z=P;else if(z=v.isPointLight===!0?l:a,e.localClippingEnabled&&y.clipShadows===!0&&Array.isArray(y.clippingPlanes)&&y.clippingPlanes.length!==0||y.displacementMap&&y.displacementScale!==0||y.alphaMap&&y.alphaTest>0||y.map&&y.alphaTest>0||y.alphaToCoverage===!0){let D=z.uuid,N=y.uuid,C=d[D];if(C===void 0)C={},d[D]=C;let B=C[N];if(B===void 0)B=z.clone(),C[N]=B,y.addEventListener("dispose",S);z=B}if(z.visible=y.visible,z.wireframe=y.wireframe,_===qs)z.side=y.shadowSide!==null?y.shadowSide:y.side;else z.side=y.shadowSide!==null?y.shadowSide:h[y.side];if(z.alphaMap=y.alphaMap,z.alphaTest=y.alphaToCoverage===!0?0.5:y.alphaTest,z.map=y.map,z.clipShadows=y.clipShadows,z.clippingPlanes=y.clippingPlanes,z.clipIntersection=y.clipIntersection,z.displacementMap=y.displacementMap,z.displacementScale=y.displacementScale,z.displacementBias=y.displacementBias,z.wireframeLinewidth=y.wireframeLinewidth,z.linewidth=y.linewidth,v.isPointLight===!0&&z.isMeshDistanceMaterial===!0){let D=e.properties.get(z);D.light=v}return z}function b(A,y,v,_,z){if(A.visible===!1)return;if(A.layers.test(y.layers)&&(A.isMesh||A.isLine||A.isPoints)){if((A.castShadow||A.receiveShadow&&z===qs)&&(!A.frustumCulled||A.intersectsFrustum(i))){A.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,A.matrixWorld);let N=t.update(A),C=A.material;if(Array.isArray(C)){let B=N.groups;for(let k=0,G=B.length;k<G;k++){let Q=B[k],W=C[Q.materialIndex];if(W&&W.visible){let q=E(A,W,_,z);A.onBeforeShadow(e,A,y,v,N,q,Q),e.renderBufferDirect(v,null,N,q,A,Q),A.onAfterShadow(e,A,y,v,N,q,Q)}}}else if(C.visible){let B=E(A,C,_,z);A.onBeforeShadow(e,A,y,v,N,B,null),e.renderBufferDirect(v,null,N,B,A,null),A.onAfterShadow(e,A,y,v,N,B,null)}}}let D=A.children;for(let N=0,C=D.length;N<C;N++)b(D[N],y,v,_,z)}function S(A){A.target.removeEventListener("dispose",S);for(let v in d){let _=d[v],z=A.target.uuid;if(z in _)_[z].dispose(),delete _[z]}}}function CT(e,t){function n(){let O=!1,le=new Tt,K=null,ce=new Tt(0,0,0,0);return{setMask:function(be){if(K!==be&&!O)e.colorMask(be,be,be,be),K=be},setLocked:function(be){O=be},setClear:function(be,ne,fe,We,gt){if(gt===!0)be*=We,ne*=We,fe*=We;if(le.set(be,ne,fe,We),ce.equals(le)===!1)e.clearColor(be,ne,fe,We),ce.copy(le)},reset:function(){O=!1,K=null,ce.set(-1,0,0,0)}}}function i(){let O=!1,le=!1,K=null,ce=null,be=null;return{setReversed:function(ne){if(le!==ne){let fe=t.get("EXT_clip_control");if(ne)fe.clipControlEXT(fe.LOWER_LEFT_EXT,fe.ZERO_TO_ONE_EXT);else fe.clipControlEXT(fe.LOWER_LEFT_EXT,fe.NEGATIVE_ONE_TO_ONE_EXT);le=ne;let We=be;be=null,this.setClear(We)}},getReversed:function(){return le},setTest:function(ne){if(ne)se(e.DEPTH_TEST);else Re(e.DEPTH_TEST)},setMask:function(ne){if(K!==ne&&!O)e.depthMask(ne),K=ne},setFunc:function(ne){if(le)ne=Um[ne];if(ce!==ne){switch(ne){case lm:e.depthFunc(e.NEVER);break;case dm:e.depthFunc(e.ALWAYS);break;case cm:e.depthFunc(e.LESS);break;case Br:e.depthFunc(e.LEQUAL);break;case um:e.depthFunc(e.EQUAL);break;case hm:e.depthFunc(e.GEQUAL);break;case ga:e.depthFunc(e.GREATER);break;case pm:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ce=ne}},setLocked:function(ne){O=ne},setClear:function(ne){if(be!==ne){if(be=ne,le)ne=1-ne;e.clearDepth(ne)}},reset:function(){O=!1,K=null,ce=null,be=null,le=!1}}}function s(){let O=!1,le=null,K=null,ce=null,be=null,ne=null,fe=null,We=null,gt=null;return{setTest:function(ot){if(!O)if(ot)se(e.STENCIL_TEST);else Re(e.STENCIL_TEST)},setMask:function(ot){if(le!==ot&&!O)e.stencilMask(ot),le=ot},setFunc:function(ot,Bn,Zn){if(K!==ot||ce!==Bn||be!==Zn)e.stencilFunc(ot,Bn,Zn),K=ot,ce=Bn,be=Zn},setOp:function(ot,Bn,Zn){if(ne!==ot||fe!==Bn||We!==Zn)e.stencilOp(ot,Bn,Zn),ne=ot,fe=Bn,We=Zn},setLocked:function(ot){O=ot},setClear:function(ot){if(gt!==ot)e.clearStencil(ot),gt=ot},reset:function(){O=!1,le=null,K=null,ce=null,be=null,ne=null,fe=null,We=null,gt=null}}}let r=new n,o=new i,a=new s,l=new WeakMap,d=new WeakMap,c={},h={},u={},p=new WeakMap,g=[],x=null,m=!1,f=null,T=null,E=null,b=null,S=null,A=null,y=null,v=new ae(0,0,0),_=0,z=!1,P=null,D=null,N=null,C=null,B=null,k=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),G=!1,Q=0,W=e.getParameter(e.VERSION);if(W.indexOf("WebGL")!==-1)Q=parseFloat(/^WebGL (\d)/.exec(W)[1]),G=Q>=1;else if(W.indexOf("OpenGL ES")!==-1)Q=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),G=Q>=2;let q=null,ee={},xe=e.getParameter(e.SCISSOR_BOX),_e=e.getParameter(e.VIEWPORT),Ve=new Tt().fromArray(xe),Fe=new Tt().fromArray(_e);function J(O,le,K,ce){let be=new Uint8Array(4),ne=e.createTexture();e.bindTexture(O,ne),e.texParameteri(O,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(O,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let fe=0;fe<K;fe++)if(O===e.TEXTURE_3D||O===e.TEXTURE_2D_ARRAY)e.texImage3D(le,0,e.RGBA,1,1,ce,0,e.RGBA,e.UNSIGNED_BYTE,be);else e.texImage2D(le+fe,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,be);return ne}let te={};te[e.TEXTURE_2D]=J(e.TEXTURE_2D,e.TEXTURE_2D,1),te[e.TEXTURE_CUBE_MAP]=J(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),te[e.TEXTURE_2D_ARRAY]=J(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),te[e.TEXTURE_3D]=J(e.TEXTURE_3D,e.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),se(e.DEPTH_TEST),o.setFunc(Br),Mt(!1),pt(zd),se(e.CULL_FACE),st(Sn);function se(O){if(c[O]!==!0)e.enable(O),c[O]=!0}function Re(O){if(c[O]!==!1)e.disable(O),c[O]=!1}function Pe(O,le){if(u[O]!==le){if(e.bindFramebuffer(O,le),u[O]=le,O===e.DRAW_FRAMEBUFFER)u[e.FRAMEBUFFER]=le;if(O===e.FRAMEBUFFER)u[e.DRAW_FRAMEBUFFER]=le;return!0}return!1}function Ee(O,le){let K=g,ce=!1;if(O){if(K=p.get(le),K===void 0)K=[],p.set(le,K);let be=O.textures;if(K.length!==be.length||K[0]!==e.COLOR_ATTACHMENT0){for(let ne=0,fe=be.length;ne<fe;ne++)K[ne]=e.COLOR_ATTACHMENT0+ne;K.length=be.length,ce=!0}}else if(K[0]!==e.BACK)K[0]=e.BACK,ce=!0;if(ce)e.drawBuffers(K)}function Rt(O){if(x!==O)return e.useProgram(O),x=O,!0;return!1}let Ge={[Zs]:e.FUNC_ADD,[Vf]:e.FUNC_SUBTRACT,[Wf]:e.FUNC_REVERSE_SUBTRACT};Ge[jf]=e.MIN,Ge[Xf]=e.MAX;let qe={[Jf]:e.ZERO,[Yf]:e.ONE,[qf]:e.SRC_COLOR,[Zf]:e.SRC_ALPHA,[im]:e.SRC_ALPHA_SATURATE,[tm]:e.DST_COLOR,[$f]:e.DST_ALPHA,[Kf]:e.ONE_MINUS_SRC_COLOR,[Qf]:e.ONE_MINUS_SRC_ALPHA,[nm]:e.ONE_MINUS_DST_COLOR,[em]:e.ONE_MINUS_DST_ALPHA,[sm]:e.CONSTANT_COLOR,[rm]:e.ONE_MINUS_CONSTANT_COLOR,[om]:e.CONSTANT_ALPHA,[am]:e.ONE_MINUS_CONSTANT_ALPHA};function st(O,le,K,ce,be,ne,fe,We,gt,ot){if(O===Sn){if(m===!0)Re(e.BLEND),m=!1;return}if(m===!1)se(e.BLEND),m=!0;if(O!==Hf){if(O!==f||ot!==z){if(T!==Zs||S!==Zs)e.blendEquation(e.FUNC_ADD),T=Zs,S=Zs;if(ot)switch(O){case Nr:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Or:e.blendFunc(e.ONE,e.ONE);break;case Fd:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Ud:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:Be("WebGLState: Invalid blending: ",O);break}else switch(O){case Nr:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Or:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case Fd:Be("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Ud:Be("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Be("WebGLState: Invalid blending: ",O);break}E=null,b=null,A=null,y=null,v.set(0,0,0),_=0,f=O,z=ot}return}if(be=be||le,ne=ne||K,fe=fe||ce,le!==T||be!==S)e.blendEquationSeparate(Ge[le],Ge[be]),T=le,S=be;if(K!==E||ce!==b||ne!==A||fe!==y)e.blendFuncSeparate(qe[K],qe[ce],qe[ne],qe[fe]),E=K,b=ce,A=ne,y=fe;if(We.equals(v)===!1||gt!==_)e.blendColor(We.r,We.g,We.b,gt),v.copy(We),_=gt;f=O,z=!1}function $e(O,le){O.side===cn?Re(e.CULL_FACE):se(e.CULL_FACE);let K=O.side===dn;if(le)K=!K;Mt(K),O.blending===Nr&&O.transparent===!1?st(Sn):st(O.blending,O.blendEquation,O.blendSrc,O.blendDst,O.blendEquationAlpha,O.blendSrcAlpha,O.blendDstAlpha,O.blendColor,O.blendAlpha,O.premultipliedAlpha),o.setFunc(O.depthFunc),o.setTest(O.depthTest),o.setMask(O.depthWrite),r.setMask(O.colorWrite);let ce=O.stencilWrite;if(a.setTest(ce),ce)a.setMask(O.stencilWriteMask),a.setFunc(O.stencilFunc,O.stencilRef,O.stencilFuncMask),a.setOp(O.stencilFail,O.stencilZFail,O.stencilZPass);Ct(O.polygonOffset,O.polygonOffsetFactor,O.polygonOffsetUnits),O.alphaToCoverage===!0?se(e.SAMPLE_ALPHA_TO_COVERAGE):Re(e.SAMPLE_ALPHA_TO_COVERAGE)}function Mt(O){if(P!==O){if(O)e.frontFace(e.CW);else e.frontFace(e.CCW);P=O}}function pt(O){if(O!==Bf){if(se(e.CULL_FACE),O!==D)if(O===zd)e.cullFace(e.BACK);else if(O===kf)e.cullFace(e.FRONT);else e.cullFace(e.FRONT_AND_BACK)}else Re(e.CULL_FACE);D=O}function kt(O){if(O!==N){if(G)e.lineWidth(O);N=O}}function Ct(O,le,K){if(O){if(se(e.POLYGON_OFFSET_FILL),C!==le||B!==K){if(C=le,B=K,o.getReversed())le=-le;e.polygonOffset(le,K)}}else Re(e.POLYGON_OFFSET_FILL)}function Lt(O){if(O)se(e.SCISSOR_TEST);else Re(e.SCISSOR_TEST)}function L(O){if(O===void 0)O=e.TEXTURE0+k-1;if(q!==O)e.activeTexture(O),q=O}function Ie(O,le,K){if(K===void 0)if(q===null)K=e.TEXTURE0+k-1;else K=q;let ce=ee[K];if(ce===void 0)ce={type:void 0,texture:void 0},ee[K]=ce;if(ce.type!==O||ce.texture!==le){if(q!==K)e.activeTexture(K),q=K;e.bindTexture(O,le||te[O]),ce.type=O,ce.texture=le}}function Ue(){let O=ee[q];if(O!==void 0&&O.type!==void 0)e.bindTexture(O.type,null),O.type=void 0,O.texture=void 0}function lt(){try{e.compressedTexImage2D(...arguments)}catch(O){Be("WebGLState:",O)}}function R(){try{e.compressedTexImage3D(...arguments)}catch(O){Be("WebGLState:",O)}}function M(){try{e.texSubImage2D(...arguments)}catch(O){Be("WebGLState:",O)}}function F(){try{e.texSubImage3D(...arguments)}catch(O){Be("WebGLState:",O)}}function j(){try{e.compressedTexSubImage2D(...arguments)}catch(O){Be("WebGLState:",O)}}function ie(){try{e.compressedTexSubImage3D(...arguments)}catch(O){Be("WebGLState:",O)}}function oe(){try{e.texStorage2D(...arguments)}catch(O){Be("WebGLState:",O)}}function ue(){try{e.texStorage3D(...arguments)}catch(O){Be("WebGLState:",O)}}function Y(){try{e.texImage2D(...arguments)}catch(O){Be("WebGLState:",O)}}function Z(){try{e.texImage3D(...arguments)}catch(O){Be("WebGLState:",O)}}function ve(O){if(h[O]!==void 0)return h[O];else return e.getParameter(O)}function Ae(O,le){if(h[O]!==le)e.pixelStorei(O,le),h[O]=le}function he(O){if(Ve.equals(O)===!1)e.scissor(O.x,O.y,O.z,O.w),Ve.copy(O)}function re(O){if(Fe.equals(O)===!1)e.viewport(O.x,O.y,O.z,O.w),Fe.copy(O)}function De(O,le){let K=d.get(le);if(K===void 0)K=new WeakMap,d.set(le,K);let ce=K.get(O);if(ce===void 0)ce=e.getUniformBlockIndex(le,O.name),K.set(O,ce)}function Ne(O,le){let ce=d.get(le).get(O);if(l.get(le)!==ce)e.uniformBlockBinding(le,ce,O.__bindingPointIndex),l.set(le,ce)}function rt(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),c={},h={},q=null,ee={},u={},p=new WeakMap,g=[],x=null,m=!1,f=null,T=null,E=null,b=null,S=null,A=null,y=null,v=new ae(0,0,0),_=0,z=!1,P=null,D=null,N=null,C=null,B=null,Ve.set(0,0,e.canvas.width,e.canvas.height),Fe.set(0,0,e.canvas.width,e.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:se,disable:Re,bindFramebuffer:Pe,drawBuffers:Ee,useProgram:Rt,setBlending:st,setMaterial:$e,setFlipSided:Mt,setCullFace:pt,setLineWidth:kt,setPolygonOffset:Ct,setScissorTest:Lt,activeTexture:L,bindTexture:Ie,unbindTexture:Ue,compressedTexImage2D:lt,compressedTexImage3D:R,texImage2D:Y,texImage3D:Z,pixelStorei:Ae,getParameter:ve,updateUBOMapping:De,uniformBlockBinding:Ne,texStorage2D:oe,texStorage3D:ue,texSubImage2D:M,texSubImage3D:F,compressedTexSubImage2D:j,compressedTexSubImage3D:ie,scissor:he,viewport:re,reset:rt}}function LT(e,t,n,i,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),d=new Ce,c=new WeakMap,h=new Set,u,p=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(R){}function x(R,M){return g?new OffscreenCanvas(R,M):zr("canvas")}function m(R,M,F){let j=1,ie=lt(R);if(ie.width>F||ie.height>F)j=F/Math.max(ie.width,ie.height);if(j<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let oe=Math.floor(j*ie.width),ue=Math.floor(j*ie.height);if(u===void 0)u=x(oe,ue);let Y=M?x(oe,ue):u;return Y.width=oe,Y.height=ue,Y.getContext("2d").drawImage(R,0,0,oe,ue),ze("WebGLRenderer: Texture has been resized from ("+ie.width+"x"+ie.height+") to ("+oe+"x"+ue+")."),Y}else{if("data"in R)ze("WebGLRenderer: Image in DataTexture is too big ("+ie.width+"x"+ie.height+").");return R}return R}function f(R){return R.generateMipmaps}function T(R){e.generateMipmap(R)}function E(R){if(R.isWebGLCubeRenderTarget)return e.TEXTURE_CUBE_MAP;if(R.isWebGL3DRenderTarget)return e.TEXTURE_3D;if(R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture)return e.TEXTURE_2D_ARRAY;return e.TEXTURE_2D}function b(R,M,F,j,ie,oe=!1){if(R!==null){if(e[R]!==void 0)return e[R];ze("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let ue;if(j){if(ue=t.get("EXT_texture_norm16"),!ue)ze("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension")}let Y=M;if(M===e.RED){if(F===e.FLOAT)Y=e.R32F;if(F===e.HALF_FLOAT)Y=e.R16F;if(F===e.UNSIGNED_BYTE)Y=e.R8;if(F===e.UNSIGNED_SHORT&&ue)Y=ue.R16_EXT;if(F===e.SHORT&&ue)Y=ue.R16_SNORM_EXT}if(M===e.RED_INTEGER){if(F===e.UNSIGNED_BYTE)Y=e.R8UI;if(F===e.UNSIGNED_SHORT)Y=e.R16UI;if(F===e.UNSIGNED_INT)Y=e.R32UI;if(F===e.BYTE)Y=e.R8I;if(F===e.SHORT)Y=e.R16I;if(F===e.INT)Y=e.R32I}if(M===e.RG){if(F===e.FLOAT)Y=e.RG32F;if(F===e.HALF_FLOAT)Y=e.RG16F;if(F===e.UNSIGNED_BYTE)Y=e.RG8;if(F===e.UNSIGNED_SHORT&&ue)Y=ue.RG16_EXT;if(F===e.SHORT&&ue)Y=ue.RG16_SNORM_EXT}if(M===e.RG_INTEGER){if(F===e.UNSIGNED_BYTE)Y=e.RG8UI;if(F===e.UNSIGNED_SHORT)Y=e.RG16UI;if(F===e.UNSIGNED_INT)Y=e.RG32UI;if(F===e.BYTE)Y=e.RG8I;if(F===e.SHORT)Y=e.RG16I;if(F===e.INT)Y=e.RG32I}if(M===e.RGB_INTEGER){if(F===e.UNSIGNED_BYTE)Y=e.RGB8UI;if(F===e.UNSIGNED_SHORT)Y=e.RGB16UI;if(F===e.UNSIGNED_INT)Y=e.RGB32UI;if(F===e.BYTE)Y=e.RGB8I;if(F===e.SHORT)Y=e.RGB16I;if(F===e.INT)Y=e.RGB32I}if(M===e.RGBA_INTEGER){if(F===e.UNSIGNED_BYTE)Y=e.RGBA8UI;if(F===e.UNSIGNED_SHORT)Y=e.RGBA16UI;if(F===e.UNSIGNED_INT)Y=e.RGBA32UI;if(F===e.BYTE)Y=e.RGBA8I;if(F===e.SHORT)Y=e.RGBA16I;if(F===e.INT)Y=e.RGBA32I}if(M===e.RGB){if(F===e.UNSIGNED_SHORT&&ue)Y=ue.RGB16_EXT;if(F===e.SHORT&&ue)Y=ue.RGB16_SNORM_EXT;if(F===e.UNSIGNED_INT_5_9_9_9_REV)Y=e.RGB9_E5;if(F===e.UNSIGNED_INT_10F_11F_11F_REV)Y=e.R11F_G11F_B10F}if(M===e.RGBA){let Z=oe?_c:Ze.getTransfer(ie);if(F===e.FLOAT)Y=e.RGBA32F;if(F===e.HALF_FLOAT)Y=e.RGBA16F;if(F===e.UNSIGNED_BYTE)Y=Z===ut?e.SRGB8_ALPHA8:e.RGBA8;if(F===e.UNSIGNED_SHORT&&ue)Y=ue.RGBA16_EXT;if(F===e.SHORT&&ue)Y=ue.RGBA16_SNORM_EXT;if(F===e.UNSIGNED_SHORT_4_4_4_4)Y=e.RGBA4;if(F===e.UNSIGNED_SHORT_5_5_5_1)Y=e.RGB5_A1}if(Y===e.R16F||Y===e.R32F||Y===e.RG16F||Y===e.RG32F||Y===e.RGBA16F||Y===e.RGBA32F)t.get("EXT_color_buffer_float");return Y}function S(R,M){let F;if(R){if(M===null||M===Ri||M===$s)F=e.DEPTH24_STENCIL8;else if(M===zn)F=e.DEPTH32F_STENCIL8;else if(M===qr)F=e.DEPTH24_STENCIL8,ze("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(M===null||M===Ri||M===$s)F=e.DEPTH_COMPONENT24;else if(M===zn)F=e.DEPTH_COMPONENT32F;else if(M===qr)F=e.DEPTH_COMPONENT16;return F}function A(R,M){if(f(R)===!0||R.isFramebufferTexture&&R.minFilter!==Yt&&R.minFilter!==qt)return Math.log2(Math.max(M.width,M.height))+1;else if(R.mipmaps!==void 0&&R.mipmaps.length>0)return R.mipmaps.length;else if(R.isCompressedTexture&&Array.isArray(R.image))return M.mipmaps.length;else return 1}function y(R){let M=R.target;if(M.removeEventListener("dispose",y),_(M),M.isVideoTexture)c.delete(M);if(M.isHTMLTexture)h.delete(M)}function v(R){let M=R.target;M.removeEventListener("dispose",v),P(M)}function _(R){let M=i.get(R);if(M.__webglInit===void 0)return;let F=R.source,j=p.get(F);if(j){let ie=j[M.__cacheKey];if(ie.usedTimes--,ie.usedTimes===0)z(R);if(Object.keys(j).length===0)p.delete(F)}i.remove(R)}function z(R){let M=i.get(R);e.deleteTexture(M.__webglTexture);let F=R.source,j=p.get(F);delete j[M.__cacheKey],o.memory.textures--}function P(R){let M=i.get(R);if(R.depthTexture)R.depthTexture.dispose(),i.remove(R.depthTexture);if(R.isWebGLCubeRenderTarget)for(let j=0;j<6;j++){if(Array.isArray(M.__webglFramebuffer[j]))for(let ie=0;ie<M.__webglFramebuffer[j].length;ie++)e.deleteFramebuffer(M.__webglFramebuffer[j][ie]);else e.deleteFramebuffer(M.__webglFramebuffer[j]);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer[j])}else{if(Array.isArray(M.__webglFramebuffer))for(let j=0;j<M.__webglFramebuffer.length;j++)e.deleteFramebuffer(M.__webglFramebuffer[j]);else e.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer);if(M.__webglMultisampledFramebuffer)e.deleteFramebuffer(M.__webglMultisampledFramebuffer);if(M.__webglColorRenderbuffer){for(let j=0;j<M.__webglColorRenderbuffer.length;j++)if(M.__webglColorRenderbuffer[j])e.deleteRenderbuffer(M.__webglColorRenderbuffer[j])}if(M.__webglDepthRenderbuffer)e.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let F=R.textures;for(let j=0,ie=F.length;j<ie;j++){let oe=i.get(F[j]);if(oe.__webglTexture)e.deleteTexture(oe.__webglTexture),o.memory.textures--;i.remove(F[j])}i.remove(R)}let D=0;function N(){D=0}function C(){return D}function B(R){D=R}function k(){let R=D;if(R>=s.maxTextures)ze("WebGLTextures: Trying to use "+(R+1)+" texture units while this GPU supports only "+s.maxTextures);return D+=1,R}function G(R){let M=[];return M.push(R.wrapS),M.push(R.wrapT),M.push(R.wrapR||0),M.push(R.magFilter),M.push(R.minFilter),M.push(R.anisotropy),M.push(R.internalFormat),M.push(R.format),M.push(R.type),M.push(R.generateMipmaps),M.push(R.premultiplyAlpha),M.push(R.flipY),M.push(R.unpackAlignment),M.push(R.colorSpace),M.join()}function Q(R,M){let F=i.get(R);if(R.isVideoTexture)Ie(R);if(R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&F.__version!==R.version){let j=R.image;if(j===null)ze("WebGLRenderer: Texture marked for update but no image data found.");else if(j.complete===!1)ze("WebGLRenderer: Texture marked for update but image is incomplete");else{Re(F,R,M);return}}else if(R.isExternalTexture)F.__webglTexture=R.sourceTexture?R.sourceTexture:null;n.bindTexture(e.TEXTURE_2D,F.__webglTexture,e.TEXTURE0+M)}function W(R,M){let F=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&F.__version!==R.version){Re(F,R,M);return}else if(R.isExternalTexture)F.__webglTexture=R.sourceTexture?R.sourceTexture:null;n.bindTexture(e.TEXTURE_2D_ARRAY,F.__webglTexture,e.TEXTURE0+M)}function q(R,M){let F=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&F.__version!==R.version){Re(F,R,M);return}n.bindTexture(e.TEXTURE_3D,F.__webglTexture,e.TEXTURE0+M)}function ee(R,M){let F=i.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&F.__version!==R.version){Pe(F,R,M);return}n.bindTexture(e.TEXTURE_CUBE_MAP,F.__webglTexture,e.TEXTURE0+M)}let xe={[vm]:e.REPEAT,[ba]:e.CLAMP_TO_EDGE,[xm]:e.MIRRORED_REPEAT},_e={[Yt]:e.NEAREST,[bm]:e.NEAREST_MIPMAP_NEAREST,[Yr]:e.NEAREST_MIPMAP_LINEAR,[qt]:e.LINEAR,[ya]:e.LINEAR_MIPMAP_NEAREST,[Qi]:e.LINEAR_MIPMAP_LINEAR},Ve={[Am]:e.NEVER,[Im]:e.ALWAYS,[Rm]:e.LESS,[Ra]:e.LEQUAL,[Cm]:e.EQUAL,[Ca]:e.GEQUAL,[Lm]:e.GREATER,[Pm]:e.NOTEQUAL};function Fe(R,M){if(M.type===zn&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===qt||M.magFilter===ya||M.magFilter===Yr||M.magFilter===Qi||M.minFilter===qt||M.minFilter===ya||M.minFilter===Yr||M.minFilter===Qi))ze("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if(e.texParameteri(R,e.TEXTURE_WRAP_S,xe[M.wrapS]),e.texParameteri(R,e.TEXTURE_WRAP_T,xe[M.wrapT]),R===e.TEXTURE_3D||R===e.TEXTURE_2D_ARRAY)e.texParameteri(R,e.TEXTURE_WRAP_R,xe[M.wrapR]);if(e.texParameteri(R,e.TEXTURE_MAG_FILTER,_e[M.magFilter]),e.texParameteri(R,e.TEXTURE_MIN_FILTER,_e[M.minFilter]),M.compareFunction)e.texParameteri(R,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(R,e.TEXTURE_COMPARE_FUNC,Ve[M.compareFunction]);if(t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===Yt)return;if(M.minFilter!==Yr&&M.minFilter!==Qi)return;if(M.type===zn&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){let F=t.get("EXT_texture_filter_anisotropic");e.texParameterf(R,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,s.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function J(R,M){let F=!1;if(R.__webglInit===void 0)R.__webglInit=!0,M.addEventListener("dispose",y);let j=M.source,ie=p.get(j);if(ie===void 0)ie={},p.set(j,ie);let oe=G(M);if(oe!==R.__cacheKey){if(ie[oe]===void 0)ie[oe]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,F=!0;ie[oe].usedTimes++;let ue=ie[R.__cacheKey];if(ue!==void 0){if(ie[R.__cacheKey].usedTimes--,ue.usedTimes===0)z(M)}R.__cacheKey=oe,R.__webglTexture=ie[oe].texture}return F}function te(R,M,F){return Math.floor(Math.floor(R/F)/M)}function se(R,M,F,j){let oe=R.updateRanges;if(oe.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,M.width,M.height,F,j,M.data);else{oe.sort((Ae,he)=>Ae.start-he.start);let ue=0;for(let Ae=1;Ae<oe.length;Ae++){let he=oe[ue],re=oe[Ae],De=he.start+he.count,Ne=te(re.start,M.width,4),rt=te(he.start,M.width,4);if(re.start<=De+1&&Ne===rt&&te(re.start+re.count-1,M.width,4)===Ne)he.count=Math.max(he.count,re.start+re.count-he.start);else++ue,oe[ue]=re}oe.length=ue+1;let Y=n.getParameter(e.UNPACK_ROW_LENGTH),Z=n.getParameter(e.UNPACK_SKIP_PIXELS),ve=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,M.width);for(let Ae=0,he=oe.length;Ae<he;Ae++){let re=oe[Ae],De=Math.floor(re.start/4),Ne=Math.ceil(re.count/4),rt=De%M.width,O=Math.floor(De/M.width),le=Ne,K=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,rt),n.pixelStorei(e.UNPACK_SKIP_ROWS,O),n.texSubImage2D(e.TEXTURE_2D,0,rt,O,le,1,F,j,M.data)}R.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Y),n.pixelStorei(e.UNPACK_SKIP_PIXELS,Z),n.pixelStorei(e.UNPACK_SKIP_ROWS,ve)}}function Re(R,M,F){let j=e.TEXTURE_2D;if(M.isDataArrayTexture||M.isCompressedArrayTexture)j=e.TEXTURE_2D_ARRAY;if(M.isData3DTexture)j=e.TEXTURE_3D;let ie=J(R,M),oe=M.source;n.bindTexture(j,R.__webglTexture,e.TEXTURE0+F);let ue=i.get(oe);if(oe.version!==ue.__version||ie===!0){if(n.activeTexture(e.TEXTURE0+F),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let K=Ze.getPrimaries(Ze.workingColorSpace),ce=M.colorSpace===is?null:Ze.getPrimaries(M.colorSpace),be=M.colorSpace===is||K===ce?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,be)}n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment);let Z=m(M.image,!1,s.maxTextureSize);Z=Ue(M,Z);let ve=r.convert(M.format,M.colorSpace),Ae=r.convert(M.type),he=b(M.internalFormat,ve,Ae,M.normalized,M.colorSpace,M.isVideoTexture);Fe(j,M);let re,De=M.mipmaps,Ne=M.isVideoTexture!==!0,rt=ue.__version===void 0||ie===!0,O=oe.dataReady,le=A(M,Z);if(M.isDepthTexture){if(he=S(M.format===es,M.type),rt)if(Ne)n.texStorage2D(e.TEXTURE_2D,1,he,Z.width,Z.height);else n.texImage2D(e.TEXTURE_2D,0,he,Z.width,Z.height,0,ve,Ae,null)}else if(M.isDataTexture)if(De.length>0){if(Ne&&rt)n.texStorage2D(e.TEXTURE_2D,le,he,De[0].width,De[0].height);for(let K=0,ce=De.length;K<ce;K++)if(re=De[K],Ne){if(O)n.texSubImage2D(e.TEXTURE_2D,K,0,0,re.width,re.height,ve,Ae,re.data)}else n.texImage2D(e.TEXTURE_2D,K,he,re.width,re.height,0,ve,Ae,re.data);M.generateMipmaps=!1}else if(Ne){if(rt)n.texStorage2D(e.TEXTURE_2D,le,he,Z.width,Z.height);if(O)se(M,Z,ve,Ae)}else n.texImage2D(e.TEXTURE_2D,0,he,Z.width,Z.height,0,ve,Ae,Z.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){if(Ne&&rt)n.texStorage3D(e.TEXTURE_2D_ARRAY,le,he,De[0].width,De[0].height,Z.depth);for(let K=0,ce=De.length;K<ce;K++)if(re=De[K],M.format!==jn)if(ve!==null)if(Ne){if(O)if(M.layerUpdates.size>0){let be=Yc(re.width,re.height,M.format,M.type);for(let ne of M.layerUpdates){let fe=re.data.subarray(ne*be/re.data.BYTES_PER_ELEMENT,(ne+1)*be/re.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,ne,re.width,re.height,1,ve,fe)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,re.width,re.height,Z.depth,ve,re.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,K,he,re.width,re.height,Z.depth,0,re.data,0,0);else ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Ne){if(O)n.texSubImage3D(e.TEXTURE_2D_ARRAY,K,0,0,0,re.width,re.height,Z.depth,ve,Ae,re.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,K,he,re.width,re.height,Z.depth,0,ve,Ae,re.data);if(M.layerUpdates.size>0)M.clearLayerUpdates()}else{if(Ne&&rt)n.texStorage2D(e.TEXTURE_2D,le,he,De[0].width,De[0].height);for(let K=0,ce=De.length;K<ce;K++)if(re=De[K],M.format!==jn)if(ve!==null)if(Ne){if(O)n.compressedTexSubImage2D(e.TEXTURE_2D,K,0,0,re.width,re.height,ve,re.data)}else n.compressedTexImage2D(e.TEXTURE_2D,K,he,re.width,re.height,0,re.data);else ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Ne){if(O)n.texSubImage2D(e.TEXTURE_2D,K,0,0,re.width,re.height,ve,Ae,re.data)}else n.texImage2D(e.TEXTURE_2D,K,he,re.width,re.height,0,ve,Ae,re.data)}else if(M.isDataArrayTexture)if(Ne){if(rt)n.texStorage3D(e.TEXTURE_2D_ARRAY,le,he,Z.width,Z.height,Z.depth);if(O)if(M.layerUpdates.size>0){let K=Yc(Z.width,Z.height,M.format,M.type);for(let ce of M.layerUpdates){let be=Z.data.subarray(ce*K/Z.data.BYTES_PER_ELEMENT,(ce+1)*K/Z.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ce,Z.width,Z.height,1,ve,Ae,be)}M.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,Z.width,Z.height,Z.depth,ve,Ae,Z.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,he,Z.width,Z.height,Z.depth,0,ve,Ae,Z.data);else if(M.isData3DTexture)if(Ne){if(rt)n.texStorage3D(e.TEXTURE_3D,le,he,Z.width,Z.height,Z.depth);if(O)n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,Z.width,Z.height,Z.depth,ve,Ae,Z.data)}else n.texImage3D(e.TEXTURE_3D,0,he,Z.width,Z.height,Z.depth,0,ve,Ae,Z.data);else if(M.isFramebufferTexture){if(rt)if(Ne)n.texStorage2D(e.TEXTURE_2D,le,he,Z.width,Z.height);else{let K=Z.width,ce=Z.height;for(let be=0;be<le;be++)n.texImage2D(e.TEXTURE_2D,be,he,K,ce,0,ve,Ae,null),K>>=1,ce>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in e){let K=e.canvas;if(!K.hasAttribute("layoutsubtree"))K.setAttribute("layoutsubtree","true");if(Z.parentNode!==K){K.appendChild(Z),h.add(M),K.onpaint=(ce)=>{let be=ce.changedElements;for(let ne of h)if(be.includes(ne.image))ne.needsUpdate=!0},K.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,Z);else{let{RGBA:be,RGBA:ne,UNSIGNED_BYTE:fe}=e;e.texElementImage2D(e.TEXTURE_2D,0,be,ne,fe,Z)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(De.length>0){if(Ne&&rt){let K=lt(De[0]);n.texStorage2D(e.TEXTURE_2D,le,he,K.width,K.height)}for(let K=0,ce=De.length;K<ce;K++)if(re=De[K],Ne){if(O)n.texSubImage2D(e.TEXTURE_2D,K,0,0,ve,Ae,re)}else n.texImage2D(e.TEXTURE_2D,K,he,ve,Ae,re);M.generateMipmaps=!1}else if(Ne){if(rt){let K=lt(Z);n.texStorage2D(e.TEXTURE_2D,le,he,K.width,K.height)}if(O)n.texSubImage2D(e.TEXTURE_2D,0,0,0,ve,Ae,Z)}else n.texImage2D(e.TEXTURE_2D,0,he,ve,Ae,Z);if(f(M))T(j);if(ue.__version=oe.version,M.onUpdate)M.onUpdate(M)}R.__version=M.version}function Pe(R,M,F){if(M.image.length!==6)return;let j=J(R,M),ie=M.source;n.bindTexture(e.TEXTURE_CUBE_MAP,R.__webglTexture,e.TEXTURE0+F);let oe=i.get(ie);if(ie.version!==oe.__version||j===!0){n.activeTexture(e.TEXTURE0+F);let ue=Ze.getPrimaries(Ze.workingColorSpace),Y=M.colorSpace===is?null:Ze.getPrimaries(M.colorSpace),Z=M.colorSpace===is||ue===Y?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,Z);let ve=M.isCompressedTexture||M.image[0].isCompressedTexture,Ae=M.image[0]&&M.image[0].isDataTexture,he=[];for(let ne=0;ne<6;ne++){if(!ve&&!Ae)he[ne]=m(M.image[ne],!0,s.maxCubemapSize);else he[ne]=Ae?M.image[ne].image:M.image[ne];he[ne]=Ue(M,he[ne])}let re=he[0],De=r.convert(M.format,M.colorSpace),Ne=r.convert(M.type),rt=b(M.internalFormat,De,Ne,M.normalized,M.colorSpace),O=M.isVideoTexture!==!0,le=oe.__version===void 0||j===!0,K=ie.dataReady,ce=A(M,re);Fe(e.TEXTURE_CUBE_MAP,M);let be;if(ve){if(O&&le)n.texStorage2D(e.TEXTURE_CUBE_MAP,ce,rt,re.width,re.height);for(let ne=0;ne<6;ne++){be=he[ne].mipmaps;for(let fe=0;fe<be.length;fe++){let We=be[fe];if(M.format!==jn)if(De!==null)if(O){if(K)n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe,0,0,We.width,We.height,De,We.data)}else n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe,rt,We.width,We.height,0,We.data);else ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(O){if(K)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe,0,0,We.width,We.height,De,Ne,We.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe,rt,We.width,We.height,0,De,Ne,We.data)}}}else{if(be=M.mipmaps,O&&le){if(be.length>0)ce++;let ne=lt(he[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ce,rt,ne.width,ne.height)}for(let ne=0;ne<6;ne++)if(Ae){if(O){if(K)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,he[ne].width,he[ne].height,De,Ne,he[ne].data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,rt,he[ne].width,he[ne].height,0,De,Ne,he[ne].data);for(let fe=0;fe<be.length;fe++){let gt=be[fe].image[ne].image;if(O){if(K)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe+1,0,0,gt.width,gt.height,De,Ne,gt.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe+1,rt,gt.width,gt.height,0,De,Ne,gt.data)}}else{if(O){if(K)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,De,Ne,he[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,rt,De,Ne,he[ne]);for(let fe=0;fe<be.length;fe++){let We=be[fe];if(O){if(K)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe+1,0,0,De,Ne,We.image[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,fe+1,rt,De,Ne,We.image[ne])}}}if(f(M))T(e.TEXTURE_CUBE_MAP);if(oe.__version=ie.version,M.onUpdate)M.onUpdate(M)}R.__version=M.version}function Ee(R,M,F,j,ie,oe){let ue=r.convert(F.format,F.colorSpace),Y=r.convert(F.type),Z=b(F.internalFormat,ue,Y,F.normalized,F.colorSpace),ve=i.get(M),Ae=i.get(F);if(Ae.__renderTarget=M,!ve.__hasExternalTextures){let he=Math.max(1,M.width>>oe),re=Math.max(1,M.height>>oe);if(ie===e.TEXTURE_3D||ie===e.TEXTURE_2D_ARRAY)n.texImage3D(ie,oe,Z,he,re,M.depth,0,ue,Y,null);else n.texImage2D(ie,oe,Z,he,re,0,ue,Y,null)}if(n.bindFramebuffer(e.FRAMEBUFFER,R),L(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,j,ie,Ae.__webglTexture,0,Lt(M));else if(ie===e.TEXTURE_2D||ie>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&ie<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)e.framebufferTexture2D(e.FRAMEBUFFER,j,ie,Ae.__webglTexture,oe);n.bindFramebuffer(e.FRAMEBUFFER,null)}function Rt(R,M,F){if(e.bindRenderbuffer(e.RENDERBUFFER,R),M.depthBuffer){let j=M.depthTexture,ie=j&&j.isDepthTexture?j.type:null,oe=S(M.stencilBuffer,ie),ue=M.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(L(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Lt(M),oe,M.width,M.height);else if(F)e.renderbufferStorageMultisample(e.RENDERBUFFER,Lt(M),oe,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,oe,M.width,M.height);e.framebufferRenderbuffer(e.FRAMEBUFFER,ue,e.RENDERBUFFER,R)}else{let j=M.textures;for(let ie=0;ie<j.length;ie++){let oe=j[ie],ue=r.convert(oe.format,oe.colorSpace),Y=r.convert(oe.type),Z=b(oe.internalFormat,ue,Y,oe.normalized,oe.colorSpace);if(L(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Lt(M),Z,M.width,M.height);else if(F)e.renderbufferStorageMultisample(e.RENDERBUFFER,Lt(M),Z,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,Z,M.width,M.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Ge(R,M,F){let j=M.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,R),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ie=i.get(M.depthTexture);if(ie.__renderTarget=M,!ie.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0;if(j){if(ie.__webglInit===void 0)ie.__webglInit=!0,M.depthTexture.addEventListener("dispose",y);if(ie.__webglTexture===void 0){ie.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,ie.__webglTexture),Fe(e.TEXTURE_CUBE_MAP,M.depthTexture);let ve=r.convert(M.depthTexture.format),Ae=r.convert(M.depthTexture.type),he;if(M.depthTexture.format===$i)he=e.DEPTH_COMPONENT24;else if(M.depthTexture.format===es)he=e.DEPTH24_STENCIL8;for(let re=0;re<6;re++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,he,M.width,M.height,0,ve,Ae,null)}}else Q(M.depthTexture,0);let oe=ie.__webglTexture,ue=Lt(M),Y=j?e.TEXTURE_CUBE_MAP_POSITIVE_X+F:e.TEXTURE_2D,Z=M.depthTexture.format===es?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(M.depthTexture.format===$i)if(L(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,Z,Y,oe,0,ue);else e.framebufferTexture2D(e.FRAMEBUFFER,Z,Y,oe,0);else if(M.depthTexture.format===es)if(L(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,Z,Y,oe,0,ue);else e.framebufferTexture2D(e.FRAMEBUFFER,Z,Y,oe,0);else throw Error("THREE.WebGLTextures: Unknown depthTexture format.")}function qe(R){let M=i.get(R),F=R.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==R.depthTexture){let j=R.depthTexture;if(M.__depthDisposeCallback)M.__depthDisposeCallback();if(j){let ie=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,j.removeEventListener("dispose",ie)};j.addEventListener("dispose",ie),M.__depthDisposeCallback=ie}M.__boundDepthTexture=j}if(R.depthTexture&&!M.__autoAllocateDepthBuffer)if(F)for(let j=0;j<6;j++)Ge(M.__webglFramebuffer[j],R,j);else{let j=R.texture.mipmaps;if(j&&j.length>0)Ge(M.__webglFramebuffer[0],R,0);else Ge(M.__webglFramebuffer,R,0)}else if(F){M.__webglDepthbuffer=[];for(let j=0;j<6;j++)if(n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[j]),M.__webglDepthbuffer[j]===void 0)M.__webglDepthbuffer[j]=e.createRenderbuffer(),Rt(M.__webglDepthbuffer[j],R,!1);else{let ie=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,oe=M.__webglDepthbuffer[j];e.bindRenderbuffer(e.RENDERBUFFER,oe),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,oe)}}else{let j=R.texture.mipmaps;if(j&&j.length>0)n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[0]);else n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer);if(M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=e.createRenderbuffer(),Rt(M.__webglDepthbuffer,R,!1);else{let ie=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,oe=M.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,oe),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,oe)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function st(R,M,F){let j=i.get(R);if(M!==void 0)Ee(j.__webglFramebuffer,R,R.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0);if(F!==void 0)qe(R)}function $e(R){let M=R.texture,F=i.get(R),j=i.get(M);R.addEventListener("dispose",v);let ie=R.textures,oe=R.isWebGLCubeRenderTarget===!0,ue=ie.length>1;if(!ue){if(j.__webglTexture===void 0)j.__webglTexture=e.createTexture();j.__version=M.version,o.memory.textures++}if(oe){F.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(M.mipmaps&&M.mipmaps.length>0){F.__webglFramebuffer[Y]=[];for(let Z=0;Z<M.mipmaps.length;Z++)F.__webglFramebuffer[Y][Z]=e.createFramebuffer()}else F.__webglFramebuffer[Y]=e.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){F.__webglFramebuffer=[];for(let Y=0;Y<M.mipmaps.length;Y++)F.__webglFramebuffer[Y]=e.createFramebuffer()}else F.__webglFramebuffer=e.createFramebuffer();if(ue)for(let Y=0,Z=ie.length;Y<Z;Y++){let ve=i.get(ie[Y]);if(ve.__webglTexture===void 0)ve.__webglTexture=e.createTexture(),o.memory.textures++}if(R.samples>0&&L(R)===!1){F.__webglMultisampledFramebuffer=e.createFramebuffer(),F.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let Y=0;Y<ie.length;Y++){let Z=ie[Y];F.__webglColorRenderbuffer[Y]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,F.__webglColorRenderbuffer[Y]);let ve=r.convert(Z.format,Z.colorSpace),Ae=r.convert(Z.type),he=b(Z.internalFormat,ve,Ae,Z.normalized,Z.colorSpace,R.isXRRenderTarget===!0),re=Lt(R);e.renderbufferStorageMultisample(e.RENDERBUFFER,re,he,R.width,R.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Y,e.RENDERBUFFER,F.__webglColorRenderbuffer[Y])}if(e.bindRenderbuffer(e.RENDERBUFFER,null),R.depthBuffer)F.__webglDepthRenderbuffer=e.createRenderbuffer(),Rt(F.__webglDepthRenderbuffer,R,!0);n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(oe){n.bindTexture(e.TEXTURE_CUBE_MAP,j.__webglTexture),Fe(e.TEXTURE_CUBE_MAP,M);for(let Y=0;Y<6;Y++)if(M.mipmaps&&M.mipmaps.length>0)for(let Z=0;Z<M.mipmaps.length;Z++)Ee(F.__webglFramebuffer[Y][Z],R,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Y,Z);else Ee(F.__webglFramebuffer[Y],R,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);if(f(M))T(e.TEXTURE_CUBE_MAP);n.unbindTexture()}else if(ue){for(let Y=0,Z=ie.length;Y<Z;Y++){let ve=ie[Y],Ae=i.get(ve),he=e.TEXTURE_2D;if(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)he=R.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(he,Ae.__webglTexture),Fe(he,ve),Ee(F.__webglFramebuffer,R,ve,e.COLOR_ATTACHMENT0+Y,he,0),f(ve))T(he)}n.unbindTexture()}else{let Y=e.TEXTURE_2D;if(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)Y=R.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(Y,j.__webglTexture),Fe(Y,M),M.mipmaps&&M.mipmaps.length>0)for(let Z=0;Z<M.mipmaps.length;Z++)Ee(F.__webglFramebuffer[Z],R,M,e.COLOR_ATTACHMENT0,Y,Z);else Ee(F.__webglFramebuffer,R,M,e.COLOR_ATTACHMENT0,Y,0);if(f(M))T(Y);n.unbindTexture()}if(R.depthBuffer)qe(R)}function Mt(R){let M=R.textures;for(let F=0,j=M.length;F<j;F++){let ie=M[F];if(f(ie)){let oe=E(R),ue=i.get(ie).__webglTexture;n.bindTexture(oe,ue),T(oe),n.unbindTexture()}}}let pt=[],kt=[];function Ct(R){if(R.samples>0){if(L(R)===!1){let{textures:M,width:F,height:j}=R,ie=e.COLOR_BUFFER_BIT,oe=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ue=i.get(R),Y=M.length>1;if(Y)for(let ve=0;ve<M.length;ve++)n.bindFramebuffer(e.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,ue.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,ue.__webglMultisampledFramebuffer);let Z=R.texture.mipmaps;if(Z&&Z.length>0)n.bindFramebuffer(e.DRAW_FRAMEBUFFER,ue.__webglFramebuffer[0]);else n.bindFramebuffer(e.DRAW_FRAMEBUFFER,ue.__webglFramebuffer);for(let ve=0;ve<M.length;ve++){if(R.resolveDepthBuffer){if(R.depthBuffer)ie|=e.DEPTH_BUFFER_BIT;if(R.stencilBuffer&&R.resolveStencilBuffer)ie|=e.STENCIL_BUFFER_BIT}if(Y){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,ue.__webglColorRenderbuffer[ve]);let Ae=i.get(M[ve]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Ae,0)}if(e.blitFramebuffer(0,0,F,j,0,0,F,j,ie,e.NEAREST),l===!0){if(pt.length=0,kt.length=0,pt.push(e.COLOR_ATTACHMENT0+ve),R.depthBuffer&&R.storeMultisampledDepthBuffer===!1)pt.push(oe),kt.push(oe),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,kt);e.invalidateFramebuffer(e.READ_FRAMEBUFFER,pt)}}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Y)for(let ve=0;ve<M.length;ve++){n.bindFramebuffer(e.FRAMEBUFFER,ue.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,ue.__webglColorRenderbuffer[ve]);let Ae=i.get(M[ve]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,ue.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,Ae,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,ue.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&l){let M=R.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[M])}}}function Lt(R){return Math.min(s.maxSamples,R.samples)}function L(R){let M=i.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function Ie(R){let M=o.render.frame;if(c.get(R)!==M)c.set(R,M),R.update()}function Ue(R,M){let{colorSpace:F,format:j,type:ie}=R;if(R.isCompressedTexture===!0||R.isVideoTexture===!0)return M;if(F!==yc&&F!==is)if(Ze.getTransfer(F)===ut){if(j!==jn||ie!==Kt)ze("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else Be("WebGLTextures: Unsupported texture color space:",F);return M}function lt(R){if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement)d.width=R.naturalWidth||R.width,d.height=R.naturalHeight||R.height;else if(typeof VideoFrame<"u"&&R instanceof VideoFrame)d.width=R.displayWidth,d.height=R.displayHeight;else d.width=R.width,d.height=R.height;return d}this.allocateTextureUnit=k,this.resetTextureUnits=N,this.getTextureUnits=C,this.setTextureUnits=B,this.setTexture2D=Q,this.setTexture2DArray=W,this.setTexture3D=q,this.setTextureCube=ee,this.rebindTextures=st,this.setupRenderTarget=$e,this.updateRenderTargetMipmap=Mt,this.updateMultisampleRenderTarget=Ct,this.setupDepthRenderbuffer=qe,this.setupFrameBufferTexture=Ee,this.useMultisampledRTT=L,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function PT(e,t){function n(i,s=is){let r,o=Ze.getTransfer(s);if(i===Kt)return e.UNSIGNED_BYTE;if(i===Od)return e.UNSIGNED_SHORT_4_4_4_4;if(i===Bd)return e.UNSIGNED_SHORT_5_5_5_1;if(i===Sm)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===Mm)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===ym)return e.BYTE;if(i===_m)return e.SHORT;if(i===qr)return e.UNSIGNED_SHORT;if(i===Nd)return e.INT;if(i===Ri)return e.UNSIGNED_INT;if(i===zn)return e.FLOAT;if(i===zt)return e.HALF_FLOAT;if(i===wm)return e.ALPHA;if(i===Em)return e.RGB;if(i===jn)return e.RGBA;if(i===$i)return e.DEPTH_COMPONENT;if(i===es)return e.DEPTH_STENCIL;if(i===ts)return e.RED;if(i===kd)return e.RED_INTEGER;if(i===ns)return e.RG;if(i===Gd)return e.RG_INTEGER;if(i===Hd)return e.RGBA_INTEGER;if(i===_a||i===Sa||i===Ma||i===wa)if(o===ut)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===_a)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Sa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ma)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===wa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===_a)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Sa)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ma)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===wa)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Vd||i===Wd||i===jd||i===Xd)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Vd)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Wd)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===jd)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Xd)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Jd||i===Yd||i===qd||i===Kd||i===Zd||i===Ea||i===Qd)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Jd||i===Yd)return o===ut?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===qd)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===Kd)return r.COMPRESSED_R11_EAC;if(i===Zd)return r.COMPRESSED_SIGNED_R11_EAC;if(i===Ea)return r.COMPRESSED_RG11_EAC;if(i===Qd)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===$d||i===ec||i===tc||i===nc||i===ic||i===sc||i===rc||i===oc||i===ac||i===lc||i===dc||i===cc||i===uc||i===hc)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(i===$d)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===ec)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===tc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===nc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===ic)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===sc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===rc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===oc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ac)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===lc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===dc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===cc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===uc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===hc)return o===ut?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===pc||i===fc||i===mc)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(i===pc)return o===ut?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===fc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===mc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===gc||i===vc||i===Ta||i===xc)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(i===gc)return r.COMPRESSED_RED_RGTC1_EXT;if(i===vc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Ta)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===xc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(i===$s)return e.UNSIGNED_INT_24_8;return e[i]!==void 0?e[i]:null}return{convert:n}}var IT=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,DT=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class bg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Ba(e.texture);if(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)this.depthNear=e.depthNear,this.depthFar=e.depthFar;this.texture=n}}getMesh(e){if(this.texture!==null){if(this.mesh===null){let t=e.cameras[0].viewport,n=new He({vertexShader:IT,fragmentShader:DT,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new nt(new as(20,20),n)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class yg extends ai{constructor(e,t){super();let n=this,i=null,s=1,r=null,o="local-floor",a=1,l=null,d=null,c=null,h=null,u=null,p=null,g=typeof XRWebGLBinding<"u",x=new bg,m={},f=t.getContextAttributes(),T=null,E=null,b=[],S=[],A=new Ce,y=null,v=null,_=new on;_.viewport=new Tt;let z=new on;z.viewport=new Tt;let P=[_,z],D=new Wc,N=null,C=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(J){let te=b[J];if(te===void 0)te=new Zr,b[J]=te;return te.getTargetRaySpace()},this.getControllerGrip=function(J){let te=b[J];if(te===void 0)te=new Zr,b[J]=te;return te.getGripSpace()},this.getHand=function(J){let te=b[J];if(te===void 0)te=new Zr,b[J]=te;return te.getHandSpace()};function B(J){let te=S.indexOf(J.inputSource);if(te===-1)return;let se=b[te];if(se!==void 0)se.update(J.inputSource,J.frame,l||r),se.dispatchEvent({type:J.type,data:J.inputSource})}function k(){i.removeEventListener("select",B),i.removeEventListener("selectstart",B),i.removeEventListener("selectend",B),i.removeEventListener("squeeze",B),i.removeEventListener("squeezestart",B),i.removeEventListener("squeezeend",B),i.removeEventListener("end",k),i.removeEventListener("inputsourceschange",G);for(let J=0;J<b.length;J++){let te=S[J];if(te===null)continue;S[J]=null,b[J].disconnect(te)}N=null,C=null,x.reset();for(let J in m)delete m[J];if(e.setRenderTarget(T),u=null,h=null,c=null,i=null,E=null,Fe.stop(),n.isPresenting=!1,e.setPixelRatio(y),e.setSize(A.width,A.height,!1),v!==null){let J=v.camera;J.fov=v.fov,J.zoom=v.zoom,J.updateProjectionMatrix(),v=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(J){if(s=J,n.isPresenting===!0)ze("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(J){if(o=J,n.isPresenting===!0)ze("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||r},this.setReferenceSpace=function(J){l=J},this.getBaseLayer=function(){return h!==null?h:u},this.getBinding=function(){if(c===null&&g)c=new XRWebGLBinding(i,t);return c},this.getFrame=function(){return p},this.getSession=function(){return i},this.setSession=async function(J){if(i=J,i!==null){if(T=e.getRenderTarget(),i.addEventListener("select",B),i.addEventListener("selectstart",B),i.addEventListener("selectend",B),i.addEventListener("squeeze",B),i.addEventListener("squeezestart",B),i.addEventListener("squeezeend",B),i.addEventListener("end",k),i.addEventListener("inputsourceschange",G),f.xrCompatible!==!0)await t.makeXRCompatible();if(y=e.getPixelRatio(),e.getSize(A),!(g&&("createProjectionLayer"in XRWebGLBinding.prototype))){let se={antialias:f.antialias,alpha:!0,depth:f.depth,stencil:f.stencil,framebufferScaleFactor:s};u=new XRWebGLLayer(i,t,se),i.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),E=new St(u.framebufferWidth,u.framebufferHeight,{format:jn,type:Kt,colorSpace:e.outputColorSpace,stencilBuffer:f.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let se=null,Re=null,Pe=null;if(f.depth)Pe=f.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,se=f.stencil?es:$i,Re=f.stencil?$s:Ri;let Ee={colorFormat:t.RGBA8,depthFormat:Pe,scaleFactor:s};c=this.getBinding(),h=c.createProjectionLayer(Ee),i.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),E=new St(h.textureWidth,h.textureHeight,{format:jn,type:Kt,depthTexture:new os(h.textureWidth,h.textureHeight,Re,void 0,void 0,void 0,void 0,void 0,void 0,se),stencilBuffer:f.stencil,colorSpace:e.outputColorSpace,samples:f.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1,storeMultisampledDepthBuffer:h.ignoreDepthValues===!1,storeMultisampledStencilBuffer:h.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(a),l=null,r=await i.requestReferenceSpace(o),Fe.setContext(i),Fe.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return x.getDepthTexture()};function G(J){for(let te=0;te<J.removed.length;te++){let se=J.removed[te],Re=S.indexOf(se);if(Re>=0)S[Re]=null,b[Re].disconnect(se)}for(let te=0;te<J.added.length;te++){let se=J.added[te],Re=S.indexOf(se);if(Re===-1){for(let Ee=0;Ee<b.length;Ee++)if(Ee>=S.length){S.push(se),Re=Ee;break}else if(S[Ee]===null){S[Ee]=se,Re=Ee;break}if(Re===-1)break}let Pe=b[Re];if(Pe)Pe.connect(se)}}let Q=new I,W=new I;function q(J,te,se){Q.setFromMatrixPosition(te.matrixWorld),W.setFromMatrixPosition(se.matrixWorld);let Re=Q.distanceTo(W),Pe=te.projectionMatrix.elements,Ee=se.projectionMatrix.elements,Rt=Pe[14]/(Pe[10]-1),Ge=Pe[14]/(Pe[10]+1),qe=(Pe[9]+1)/Pe[5],st=(Pe[9]-1)/Pe[5],$e=(Pe[8]-1)/Pe[0],Mt=(Ee[8]+1)/Ee[0],pt=Rt*$e,kt=Rt*Mt,Ct=Re/(-$e+Mt),Lt=Ct*-$e;if(te.matrixWorld.decompose(J.position,J.quaternion,J.scale),J.translateX(Lt),J.translateZ(Ct),J.matrixWorld.compose(J.position,J.quaternion,J.scale),J.matrixWorldInverse.copy(J.matrixWorld).invert(),Pe[10]===-1)J.projectionMatrix.copy(te.projectionMatrix),J.projectionMatrixInverse.copy(te.projectionMatrixInverse);else{let L=Rt+Ct,Ie=Ge+Ct,Ue=pt-Lt,lt=kt+(Re-Lt),R=qe*Ge/Ie*L,M=st*Ge/Ie*L;J.projectionMatrix.makePerspective(Ue,lt,R,M,L,Ie),J.projectionMatrixInverse.copy(J.projectionMatrix).invert()}}function ee(J,te){if(te===null)J.matrixWorld.copy(J.matrix);else J.matrixWorld.multiplyMatrices(te.matrixWorld,J.matrix);J.matrixWorldInverse.copy(J.matrixWorld).invert()}this.updateCamera=function(J){if(i===null)return;let{near:te,far:se}=J;if(x.texture!==null){if(x.depthNear>0)te=x.depthNear;if(x.depthFar>0)se=x.depthFar}if(D.near=z.near=_.near=te,D.far=z.far=_.far=se,N!==D.near||C!==D.far)i.updateRenderState({depthNear:D.near,depthFar:D.far}),N=D.near,C=D.far;D.layers.mask=J.layers.mask|6,_.layers.mask=D.layers.mask&-5,z.layers.mask=D.layers.mask&-3;let Re=J.parent,Pe=D.cameras;ee(D,Re);for(let Ee=0;Ee<Pe.length;Ee++)ee(Pe[Ee],Re);if(Pe.length===2)q(D,_,z);else D.projectionMatrix.copy(_.projectionMatrix);if(v===null&&J.isPerspectiveCamera)v={camera:J,fov:J.fov,zoom:J.zoom};xe(J,D,Re)};function xe(J,te,se){if(se===null)J.matrix.copy(te.matrixWorld);else J.matrix.copy(se.matrixWorld),J.matrix.invert(),J.matrix.multiply(te.matrixWorld);if(J.matrix.decompose(J.position,J.quaternion,J.scale),J.updateMatrixWorld(!0),J.projectionMatrix.copy(te.projectionMatrix),J.projectionMatrixInverse.copy(te.projectionMatrixInverse),J.isPerspectiveCamera)J.fov=Ys*2*Math.atan(1/J.projectionMatrix.elements[5]),J.zoom=1}this.getCamera=function(){return D},this.getFoveation=function(){if(h===null&&u===null)return;return a},this.setFoveation=function(J){if(a=J,h!==null)h.fixedFoveation=J;if(u!==null&&u.fixedFoveation!==void 0)u.fixedFoveation=J},this.hasDepthSensing=function(){return x.texture!==null},this.getDepthSensingMesh=function(){return x.getMesh(D)},this.getCameraTexture=function(J){return m[J]};let _e=null;function Ve(J,te){if(d=te.getViewerPose(l||r),p=te,d!==null){let se=d.views;if(u!==null)e.setRenderTargetFramebuffer(E,u.framebuffer),e.setRenderTarget(E);let Re=!1;if(se.length!==D.cameras.length)D.cameras.length=0,Re=!0;for(let Ge=0;Ge<se.length;Ge++){let qe=se[Ge],st=null;if(u!==null)st=u.getViewport(qe);else{let Mt=c.getViewSubImage(h,qe);if(st=Mt.viewport,Ge===0)e.setRenderTargetTextures(E,Mt.colorTexture,Mt.depthStencilTexture),e.setRenderTarget(E)}let $e=P[Ge];if($e===void 0)$e=new on,$e.layers.enable(Ge),$e.viewport=new Tt,P[Ge]=$e;if($e.matrix.fromArray(qe.transform.matrix),$e.matrix.decompose($e.position,$e.quaternion,$e.scale),$e.projectionMatrix.fromArray(qe.projectionMatrix),$e.projectionMatrixInverse.copy($e.projectionMatrix).invert(),$e.viewport.set(st.x,st.y,st.width,st.height),Ge===0)D.matrix.copy($e.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale);if(Re===!0)D.cameras.push($e)}let Pe=i.enabledFeatures;if(Pe&&Pe.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){c=n.getBinding();let Ge=c.getDepthInformation(se[0]);if(Ge&&Ge.isValid&&Ge.texture)x.init(Ge,i.renderState)}if(Pe&&Pe.includes("camera-access")&&g){e.state.unbindTexture(),c=n.getBinding();for(let Ge=0;Ge<se.length;Ge++){let qe=se[Ge].camera;if(qe){let st=m[qe];if(!st)st=new Ba,m[qe]=st;let $e=c.getCameraImage(qe);st.sourceTexture=$e}}}}for(let se=0;se<b.length;se++){let Re=S[se],Pe=b[se];if(Re!==null&&Pe!==void 0)Pe.update(Re,te,l||r)}if(_e)_e(J,te);if(te.detectedPlanes)n.dispatchEvent({type:"planesdetected",data:te});p=null}let Fe=new lg;Fe.setAnimationLoop(Ve),this.setAnimationLoop=function(J){_e=J},this.dispose=function(){}}}var zT=new Je,_g=new ke;_g.set(-1,0,0,0,1,0,0,0,1);function FT(e,t){function n(m,f){if(m.matrixAutoUpdate===!0)m.updateMatrix();f.value.copy(m.matrix)}function i(m,f){if(f.color.getRGB(m.fogColor.value,Lc(e)),f.isFog)m.fogNear.value=f.near,m.fogFar.value=f.far;else if(f.isFogExp2)m.fogDensity.value=f.density}function s(m,f,T,E,b){if(f.isNodeMaterial)f.uniformsNeedUpdate=!1;else if(f.isMeshBasicMaterial)r(m,f);else if(f.isMeshLambertMaterial){if(r(m,f),f.envMap)m.envMapIntensity.value=f.envMapIntensity}else if(f.isMeshToonMaterial)r(m,f),h(m,f);else if(f.isMeshPhongMaterial){if(r(m,f),c(m,f),f.envMap)m.envMapIntensity.value=f.envMapIntensity}else if(f.isMeshStandardMaterial){if(r(m,f),u(m,f),f.isMeshPhysicalMaterial)p(m,f,b)}else if(f.isMeshMatcapMaterial)r(m,f),g(m,f);else if(f.isMeshDepthMaterial)r(m,f);else if(f.isMeshDistanceMaterial)r(m,f),x(m,f);else if(f.isMeshNormalMaterial)r(m,f);else if(f.isLineBasicMaterial){if(o(m,f),f.isLineDashedMaterial)a(m,f)}else if(f.isPointsMaterial)l(m,f,T,E);else if(f.isSpriteMaterial)d(m,f);else if(f.isShadowMaterial)m.color.value.copy(f.color),m.opacity.value=f.opacity;else if(f.isShaderMaterial)f.uniformsNeedUpdate=!1}function r(m,f){if(m.opacity.value=f.opacity,f.color)m.diffuse.value.copy(f.color);if(f.emissive)m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity);if(f.map)m.map.value=f.map,n(f.map,m.mapTransform);if(f.alphaMap)m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform);if(f.bumpMap){if(m.bumpMap.value=f.bumpMap,n(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===dn)m.bumpScale.value*=-1}if(f.normalMap){if(m.normalMap.value=f.normalMap,n(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===dn)m.normalScale.value.negate()}if(f.displacementMap)m.displacementMap.value=f.displacementMap,n(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias;if(f.emissiveMap)m.emissiveMap.value=f.emissiveMap,n(f.emissiveMap,m.emissiveMapTransform);if(f.specularMap)m.specularMap.value=f.specularMap,n(f.specularMap,m.specularMapTransform);if(f.alphaTest>0)m.alphaTest.value=f.alphaTest;let T=t.get(f),{envMap:E,envMapRotation:b}=T;if(E){if(m.envMap.value=E,m.envMapRotation.value.setFromMatrix4(zT.makeRotationFromEuler(b)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1)m.envMapRotation.value.premultiply(_g);m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio}if(f.lightMap)m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,n(f.lightMap,m.lightMapTransform);if(f.aoMap)m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,n(f.aoMap,m.aoMapTransform)}function o(m,f){if(m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map)m.map.value=f.map,n(f.map,m.mapTransform)}function a(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,T,E){if(m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*T,m.scale.value=E*0.5,f.map)m.map.value=f.map,n(f.map,m.uvTransform);if(f.alphaMap)m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform);if(f.alphaTest>0)m.alphaTest.value=f.alphaTest}function d(m,f){if(m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map)m.map.value=f.map,n(f.map,m.mapTransform);if(f.alphaMap)m.alphaMap.value=f.alphaMap,n(f.alphaMap,m.alphaMapTransform);if(f.alphaTest>0)m.alphaTest.value=f.alphaTest}function c(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,0.0001)}function h(m,f){if(f.gradientMap)m.gradientMap.value=f.gradientMap}function u(m,f){if(m.metalness.value=f.metalness,f.metalnessMap)m.metalnessMap.value=f.metalnessMap,n(f.metalnessMap,m.metalnessMapTransform);if(m.roughness.value=f.roughness,f.roughnessMap)m.roughnessMap.value=f.roughnessMap,n(f.roughnessMap,m.roughnessMapTransform);if(f.envMap)m.envMapIntensity.value=f.envMapIntensity}function p(m,f,T){if(m.ior.value=f.ior,f.sheen>0){if(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap)m.sheenColorMap.value=f.sheenColorMap,n(f.sheenColorMap,m.sheenColorMapTransform);if(f.sheenRoughnessMap)m.sheenRoughnessMap.value=f.sheenRoughnessMap,n(f.sheenRoughnessMap,m.sheenRoughnessMapTransform)}if(f.clearcoat>0){if(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap)m.clearcoatMap.value=f.clearcoatMap,n(f.clearcoatMap,m.clearcoatMapTransform);if(f.clearcoatRoughnessMap)m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,n(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform);if(f.clearcoatNormalMap){if(m.clearcoatNormalMap.value=f.clearcoatNormalMap,n(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===dn)m.clearcoatNormalScale.value.negate()}}if(f.dispersion>0)m.dispersion.value=f.dispersion;if(f.retroreflectivity>0)m.retroreflectivity.value=f.retroreflectivity;if(f.iridescence>0){if(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap)m.iridescenceMap.value=f.iridescenceMap,n(f.iridescenceMap,m.iridescenceMapTransform);if(f.iridescenceThicknessMap)m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,n(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform)}if(f.transmission>0){if(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=T.texture,m.transmissionSamplerSize.value.set(T.width,T.height),f.transmissionMap)m.transmissionMap.value=f.transmissionMap,n(f.transmissionMap,m.transmissionMapTransform);if(m.thickness.value=f.thickness,f.thicknessMap)m.thicknessMap.value=f.thicknessMap,n(f.thicknessMap,m.thicknessMapTransform);m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)}if(f.anisotropy>0){if(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap)m.anisotropyMap.value=f.anisotropyMap,n(f.anisotropyMap,m.anisotropyMapTransform)}if(m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap)m.specularColorMap.value=f.specularColorMap,n(f.specularColorMap,m.specularColorMapTransform);if(f.specularIntensityMap)m.specularIntensityMap.value=f.specularIntensityMap,n(f.specularIntensityMap,m.specularIntensityMapTransform)}function g(m,f){if(f.matcap)m.matcap.value=f.matcap}function x(m,f){let T=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(T.matrixWorld),m.nearDistance.value=T.shadow.camera.near,m.farDistance.value=T.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function UT(e,t,n,i){let s={},r={},o=[],a=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(b,S){let A=S.program;i.uniformBlockBinding(b,A)}function d(b,S){let A=s[b.id];if(A===void 0)m(b),A=c(b),s[b.id]=A,b.addEventListener("dispose",T);let y=S.program;i.updateUBOMapping(b,y);let v=t.render.frame;if(r[b.id]!==v)u(b),r[b.id]=v}function c(b){let S=h();b.__bindingPointIndex=S;let A=e.createBuffer(),{__size:y,usage:v}=b;return e.bindBuffer(e.UNIFORM_BUFFER,A),e.bufferData(e.UNIFORM_BUFFER,y,v),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,S,A),A}function h(){for(let b=0;b<a;b++)if(o.indexOf(b)===-1)return o.push(b),b;return Be("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(b){let S=s[b.id],{uniforms:A,__cache:y}=b;e.bindBuffer(e.UNIFORM_BUFFER,S);for(let v=0,_=A.length;v<_;v++){let z=A[v];if(Array.isArray(z))for(let P=0,D=z.length;P<D;P++)p(z[P],v,P,y);else p(z,v,0,y)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(b,S,A,y){if(x(b,S,A,y)===!0){let{__offset:v,value:_}=b;if(Array.isArray(_)){let z=0;for(let P=0;P<_.length;P++){let D=_[P],N=f(D);if(g(D,b.__data,z),typeof D!=="number"&&typeof D!=="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D))z+=N.storage/Float32Array.BYTES_PER_ELEMENT}}else g(_,b.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,v,b.__data)}}function g(b,S,A){if(typeof b==="number"||typeof b==="boolean")S[0]=b;else if(b.isMatrix3)S[0]=b.elements[0],S[1]=b.elements[1],S[2]=b.elements[2],S[3]=0,S[4]=b.elements[3],S[5]=b.elements[4],S[6]=b.elements[5],S[7]=0,S[8]=b.elements[6],S[9]=b.elements[7],S[10]=b.elements[8],S[11]=0;else if(ArrayBuffer.isView(b))S.set(new b.constructor(b.buffer,b.byteOffset,S.length));else b.toArray(S,A)}function x(b,S,A,y){let v=b.value,_=S+"_"+A;if(y[_]===void 0){if(typeof v==="number"||typeof v==="boolean")y[_]=v;else if(ArrayBuffer.isView(v))y[_]=v.slice();else y[_]=v.clone();return!0}else{let z=y[_];if(typeof v==="number"||typeof v==="boolean"){if(z!==v)return y[_]=v,!0}else if(ArrayBuffer.isView(v))return!0;else if(z.equals(v)===!1)return z.copy(v),!0}return!1}function m(b){let S=b.uniforms,A=0,y=16;for(let _=0,z=S.length;_<z;_++){let P=Array.isArray(S[_])?S[_]:[S[_]];for(let D=0,N=P.length;D<N;D++){let C=P[D],B=Array.isArray(C.value)?C.value:[C.value];for(let k=0,G=B.length;k<G;k++){let Q=B[k],W=f(Q),q=A%y,ee=q%W.boundary,xe=q+ee;if(A+=ee,xe!==0&&y-xe<W.storage)A+=y-xe;C.__data=new Float32Array(W.storage/Float32Array.BYTES_PER_ELEMENT),C.__offset=A,A+=W.storage}}}let v=A%y;if(v>0)A+=y-v;return b.__size=A,b.__cache={},this}function f(b){let S={boundary:0,storage:0};if(typeof b==="number"||typeof b==="boolean")S.boundary=4,S.storage=4;else if(b.isVector2)S.boundary=8,S.storage=8;else if(b.isVector3||b.isColor)S.boundary=16,S.storage=12;else if(b.isVector4)S.boundary=16,S.storage=16;else if(b.isMatrix3)S.boundary=48,S.storage=48;else if(b.isMatrix4)S.boundary=64,S.storage=64;else if(b.isTexture)ze("WebGLRenderer: Texture samplers can not be part of an uniforms group.");else if(ArrayBuffer.isView(b))S.boundary=16,S.storage=b.byteLength;else ze("WebGLRenderer: Unsupported uniform value type.",b);return S}function T(b){let S=b.target;S.removeEventListener("dispose",T);let A=o.indexOf(S.__bindingPointIndex);o.splice(A,1),e.deleteBuffer(s[S.id]),delete s[S.id],delete r[S.id]}function E(){for(let b in s)e.deleteBuffer(s[b]);o=[],s={},r={}}return{bind:l,update:d,dispose:E}}var NT=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Xn=null;function OT(){if(Xn===null)Xn=new di(NT,16,16,ns,zt),Xn.name="DFG_LUT",Xn.minFilter=qt,Xn.magFilter=qt,Xn.wrapS=ba,Xn.wrapT=ba,Xn.generateMipmaps=!1,Xn.needsUpdate=!0;return Xn}class ru{constructor(e={}){let{canvas:t=Dm(),context:n=null,depth:i=!0,stencil:s=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:a=!0,preserveDrawingBuffer:l=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:c=!1,reversedDepthBuffer:h=!1,outputBufferType:u=Kt}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=r;let g=u,x=new Set([Hd,Gd,kd]),m=new Set([Kt,Ri,qr,$s,Od,Bd]),f=new Uint32Array(4),T=new Int32Array(4),E=new I,b=null,S=null,A=[],y=[],v=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=gn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let _=this,z=!1,P=null,D=null,N=null,C=null;this._outputColorSpace=Aa;let B=0,k=0,G=null,Q=-1,W=null,q=new Tt,ee=new Tt,xe=null,_e=new ae(0),Ve=0,{width:Fe,height:J}=t,te=1,se=null,Re=null,Pe=new Tt(0,0,Fe,J),Ee=new Tt(0,0,Fe,J),Rt=!1,Ge=new Fa,qe=!1,st=!1,$e=new Je,Mt=new I,pt=new Tt,kt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ct=!1;function Lt(){return G===null?te:1}let L=n;function Ie(w,U){return t.getContext(w,U)}let Ue,lt,R,M,F,j,ie,oe,ue,Y,Z,ve,Ae,he,re,De,Ne,rt,O,le,K,ce,be;try{let w={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:d,failIfMajorPerformanceCaveat:c};if("setAttribute"in t)t.setAttribute("data-engine",`three.js r${Of}`);if(t.addEventListener("webglcontextlost",We,!1),t.addEventListener("webglcontextrestored",gt,!1),t.addEventListener("webglcontextcreationerror",ot,!1),L===null){if(L=Ie("webgl2",w),L===null)if(Ie("webgl2"))throw Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.");else throw Error("THREE.WebGLRenderer: Error creating WebGL context.")}ne()}catch(w){throw t.removeEventListener("webglcontextlost",We,!1),t.removeEventListener("webglcontextrestored",gt,!1),t.removeEventListener("webglcontextcreationerror",ot,!1),Be("WebGLRenderer: "+w.message),w}function ne(){if(Ue=new jw(L),Ue.init(),K=new PT(L,Ue),lt=new Fw(L,Ue,e,K),R=new CT(L,Ue),lt.reversedDepthBuffer&&h)R.buffers.depth.setReversed(!0);D=L.createFramebuffer(),N=L.createFramebuffer(),C=L.createFramebuffer(),M=new Yw(L),F=new mT,j=new LT(L,Ue,R,F,lt,K,M),ie=new Ww(_),oe=new K_(L),ce=new Dw(L,oe),ue=new Xw(L,oe,M,ce),Y=new Kw(L,ue,oe,ce,M),rt=new qw(L,lt,j),re=new Uw(F),Z=new fT(_,ie,Ue,lt,ce,re),ve=new FT(_,F),Ae=new vT,he=new MT(Ue),Ne=new Iw(_,ie,R,Y,p,a),De=new RT(_,Y,lt),be=new UT(L,M,lt,R),O=new zw(L,Ue,M),le=new Jw(L,Ue,M),M.programs=Z.programs,_.capabilities=lt,_.extensions=Ue,_.properties=F,_.renderLists=Ae,_.shadowMap=De,_.state=R,_.info=M}if(g!==Kt)v=new Qw(g,t.width,t.height,o,i,s);let fe=new yg(_,L);this.xr=fe,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let w=Ue.get("WEBGL_lose_context");if(w)w.loseContext()},this.forceContextRestore=function(){let w=Ue.get("WEBGL_lose_context");if(w)w.restoreContext()},this.getPixelRatio=function(){return te},this.setPixelRatio=function(w){if(w===void 0)return;te=w,this.setSize(Fe,J,!1)},this.getSize=function(w){return w.set(Fe,J)},this.setSize=function(w,U,X=!0){if(fe.isPresenting){ze("WebGLRenderer: Can't change size while VR device is presenting.");return}if(Fe=w,J=U,t.width=Math.floor(w*te),t.height=Math.floor(U*te),X===!0)t.style.width=w+"px",t.style.height=U+"px";if(v!==null)v.setSize(t.width,t.height);this.setViewport(0,0,w,U)},this.getDrawingBufferSize=function(w){return w.set(Fe*te,J*te).floor()},this.setDrawingBufferSize=function(w,U,X){Fe=w,J=U,te=X,t.width=Math.floor(w*X),t.height=Math.floor(U*X),this.setViewport(0,0,w,U)},this.setEffects=function(w){if(g===Kt){Be("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let U=0;U<w.length;U++)if(w[U].isOutputPass===!0){ze("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}v.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(q)},this.getViewport=function(w){return w.copy(Pe)},this.setViewport=function(w,U,X,H){if(w.isVector4)Pe.set(w.x,w.y,w.z,w.w);else Pe.set(w,U,X,H);R.viewport(q.copy(Pe).multiplyScalar(te).round())},this.getScissor=function(w){return w.copy(Ee)},this.setScissor=function(w,U,X,H){if(w.isVector4)Ee.set(w.x,w.y,w.z,w.w);else Ee.set(w,U,X,H);R.scissor(ee.copy(Ee).multiplyScalar(te).round())},this.getScissorTest=function(){return Rt},this.setScissorTest=function(w){R.setScissorTest(Rt=w)},this.setOpaqueSort=function(w){se=w},this.setTransparentSort=function(w){Re=w},this.getClearColor=function(w){return w.copy(Ne.getClearColor())},this.setClearColor=function(){Ne.setClearColor(...arguments)},this.getClearAlpha=function(){return Ne.getClearAlpha()},this.setClearAlpha=function(){Ne.setClearAlpha(...arguments)},this.clear=function(w=!0,U=!0,X=!0){let H=0;if(w){let V=!1;if(G!==null){let ge=G.texture.format;V=x.has(ge)}if(V){let ge=G.texture.type,Se=m.has(ge),me=Ne.getClearColor(),Me=Ne.getClearAlpha(),{r:Te,g:Xe,b:et}=me;if(Se)f[0]=Te,f[1]=Xe,f[2]=et,f[3]=Me,L.clearBufferuiv(L.COLOR,0,f);else T[0]=Te,T[1]=Xe,T[2]=et,T[3]=Me,L.clearBufferiv(L.COLOR,0,T)}else H|=L.COLOR_BUFFER_BIT}if(U)H|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0);if(X)H|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);if(H!==0)L.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),P=w},this.dispose=function(){t.removeEventListener("webglcontextlost",We,!1),t.removeEventListener("webglcontextrestored",gt,!1),t.removeEventListener("webglcontextcreationerror",ot,!1),Ne.dispose(),Ae.dispose(),he.dispose(),F.dispose(),ie.dispose(),Y.dispose(),ce.dispose(),be.dispose(),Z.dispose(),fe.dispose(),fe.removeEventListener("sessionstart",Up),fe.removeEventListener("sessionend",Np),Wi.stop()};function We(w){w.preventDefault(),Fr("WebGLRenderer: Context Lost."),z=!0}function gt(){Fr("WebGLRenderer: Context Restored."),z=!1;let w=M.autoReset,U=De.enabled,X=De.autoUpdate,H=De.needsUpdate,V=De.type;ne(),M.autoReset=w,De.enabled=U,De.autoUpdate=X,De.needsUpdate=H,De.type=V}function ot(w){Be("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Bn(w){let U=w.target;U.removeEventListener("dispose",Bn),Zn(U)}function Zn(w){vy(w),F.remove(w)}function vy(w){let U=F.get(w).programs;if(U!==void 0){if(U.forEach(function(X){Z.releaseProgram(X)}),w.isShaderMaterial)Z.releaseShaderCache(w)}}this.renderBufferDirect=function(w,U,X,H,V,ge){if(U===null)U=kt;let Se=V.isMesh&&V.matrixWorld.determinantAffine()<0,me=yy(w,U,X,H,V);R.setMaterial(H,Se);let Me=X.index,Te=1;if(H.wireframe===!0){if(Me=ue.getWireframeAttribute(X),Me===void 0)return;Te=2}let Xe=X.drawRange,et=X.attributes.position,we=Xe.start*Te,at=(Xe.start+Xe.count)*Te;if(ge!==null)we=Math.max(we,ge.start*Te),at=Math.min(at,(ge.start+ge.count)*Te);if(Me!==null)we=Math.max(we,0),at=Math.min(at,Me.count);else if(et!==void 0&&et!==null)we=Math.max(we,0),at=Math.min(at,et.count);let Ft=at-we;if(Ft<0||Ft===1/0)return;ce.setup(V,H,me,X,Me);let yt,ft=O;if(Me!==null)yt=oe.get(Me),ft=le,ft.setIndex(yt);if(V.isMesh)if(H.wireframe===!0)R.setLineWidth(H.wireframeLinewidth*Lt()),ft.setMode(L.LINES);else ft.setMode(L.TRIANGLES);else if(V.isLine){let Wt=H.linewidth;if(Wt===void 0)Wt=1;if(R.setLineWidth(Wt*Lt()),V.isLineSegments)ft.setMode(L.LINES);else if(V.isLineLoop)ft.setMode(L.LINE_LOOP);else ft.setMode(L.LINE_STRIP)}else if(V.isPoints)ft.setMode(L.POINTS);else if(V.isSprite)ft.setMode(L.TRIANGLES);if(V.isBatchedMesh)if(!Ue.get("WEBGL_multi_draw")){let{_multiDrawStarts:Wt,_multiDrawCounts:ye,_multiDrawCount:sn}=V,it=Me?oe.get(Me).bytesPerElement:1,bn=F.get(H).currentProgram.getUniforms();for(let kn=0;kn<sn;kn++)bn.setValue(L,"_gl_DrawID",kn),ft.render(Wt[kn]/it,ye[kn])}else ft.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else if(V.isInstancedMesh)ft.renderInstances(we,Ft,V.count);else if(X.isInstancedBufferGeometry){let Wt=X._maxInstanceCount!==void 0?X._maxInstanceCount:1/0,ye=Math.min(X.instanceCount,Wt);ft.renderInstances(we,Ft,ye)}else ft.render(we,Ft)};function Fp(w,U,X,H){if(P!==null&&w.isNodeMaterial)P.setObject(H,w);if(qe===!0)re.setState(w,X,!1);if(w.transparent===!0&&w.side===cn&&w.forceSinglePass===!1)w.side=dn,w.needsUpdate=!0,Oo(w,U,H),w.side=Ks,w.needsUpdate=!0,Oo(w,U,H),w.side=cn;else Oo(w,U,H)}this.compile=function(w,U,X=null){if(X===null)X=w;if(P!==null)P.renderStart(w,U,X);if(S=he.get(X),S.init(U),y.push(S),X.traverseVisible(function(V){if(V.isLight&&V.layers.test(U.layers)){if(S.pushLight(V),V.castShadow)S.pushShadow(V)}}),w!==X)w.traverseVisible(function(V){if(V.isLight&&V.layers.test(U.layers)){if(S.pushLight(V),V.castShadow)S.pushShadow(V)}});if(S.setupLights(),P!==null)P.updateLights(S.state.lightsArray);if(st=this.localClippingEnabled,qe=re.init(this.clippingPlanes,st),qe===!0)re.setGlobalState(this.clippingPlanes,U);if(P!==null)De.render(S.state.shadowsArray,X,U);let H=new Set;if(w.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;let ge=V.material;if(ge)if(Array.isArray(ge))for(let Se=0;Se<ge.length;Se++){let me=ge[Se];Fp(me,X,U,V),H.add(me)}else Fp(ge,X,U,V),H.add(ge)}),S=y.pop(),P!==null)P.renderEnd();return H},this.compileAsync=function(w,U,X=null){let H=this.compile(w,U,X);return new Promise((V)=>{function ge(){if(H.forEach(function(Se){let Me=F.get(Se).currentProgram;if(Me===void 0||Me.isReady())H.delete(Se)}),H.size===0){V(w);return}setTimeout(ge,10)}if(Ue.get("KHR_parallel_shader_compile")!==null)ge();else setTimeout(ge,10)})};let sd=null;function xy(w){if(sd)sd(w)}function Up(){Wi.stop()}function Np(){Wi.start()}let Wi=new lg;if(Wi.setAnimationLoop(xy),typeof self<"u")Wi.setContext(self);this.setAnimationLoop=function(w){sd=w,fe.setAnimationLoop(w),w===null?Wi.stop():Wi.start()},fe.addEventListener("sessionstart",Up),fe.addEventListener("sessionend",Np),this.render=function(w,U){if(U!==void 0&&U.isCamera!==!0){Be("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(z===!0)return;if(P!==null)P.renderStart(w,U);let X=fe.enabled===!0&&fe.isPresenting===!0,H=v!==null&&(G===null||X)&&v.begin(_,G);if(w.matrixWorldAutoUpdate===!0)w.updateMatrixWorld();if(U.parent===null&&U.matrixWorldAutoUpdate===!0)U.updateMatrixWorld();if(fe.enabled===!0&&fe.isPresenting===!0&&(v===null||v.isCompositing()===!1)){if(fe.cameraAutoUpdate===!0)fe.updateCamera(U);U=fe.getCamera()}if(w.isScene===!0)w.onBeforeRender(_,w,U,G);if(S=he.get(w,y.length),S.init(U),S.state.textureUnits=j.getTextureUnits(),y.push(S),$e.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),Ge.setFromProjectionMatrix($e,Mc,U.reversedDepth),st=this.localClippingEnabled,qe=re.init(this.clippingPlanes,st),b=Ae.get(w,A.length),b.init(),A.push(b),fe.enabled===!0&&fe.isPresenting===!0){let Se=_.xr.getDepthSensingMesh();if(Se!==null)rd(Se,U,-1/0,_.sortObjects)}if(rd(w,U,0,_.sortObjects),b.finish(),P!==null)P.updateLights(S.state.lightsArray);if(_.sortObjects===!0)b.sort(se,Re);if(Ct=fe.enabled===!1||fe.isPresenting===!1||fe.hasDepthSensing()===!1,Ct)Ne.addToRenderList(b,w);if(this.info.render.frame++,this.info.autoReset===!0)this.info.reset();if(qe===!0)re.beginShadows();let V=S.state.shadowsArray;if(De.render(V,w,U),qe===!0)re.endShadows();if((H&&v.hasRenderPass())===!1){let Se=b.opaque,me=b.transmissive;if(S.setupLights(),U.isArrayCamera){let Me=U.cameras;if(me.length>0)for(let Te=0,Xe=Me.length;Te<Xe;Te++){let et=Me[Te];Bp(Se,me,w,et)}if(Ct)Ne.render(w);for(let Te=0,Xe=Me.length;Te<Xe;Te++){let et=Me[Te];Op(b,w,et,et.viewport)}}else{if(me.length>0)Bp(Se,me,w,U);if(Ct)Ne.render(w);Op(b,w,U)}}if(G!==null&&k===0)j.updateMultisampleRenderTarget(G),j.updateRenderTargetMipmap(G);if(H)v.end(_);if(w.isScene===!0)w.onAfterRender(_,w,U);if(ce.resetDefaultState(),Q=-1,W=null,y.pop(),y.length>0){if(S=y[y.length-1],j.setTextureUnits(S.state.textureUnits),qe===!0)re.setGlobalState(_.clippingPlanes,S.state.camera)}else S=null;if(A.pop(),A.length>0)b=A[A.length-1];else b=null;if(P!==null)P.renderEnd()};function rd(w,U,X,H){if(w.visible===!1)return;if(w.layers.test(U.layers)){if(w.isGroup)X=w.renderOrder;else if(w.isLOD){if(w.autoUpdate===!0)w.update(U)}else if(w.isLightProbeGrid)S.pushLightProbeGrid(w);else if(w.isLight){if(S.pushLight(w),w.castShadow)S.pushShadow(w)}else if(w.isSprite){if(!w.frustumCulled||w.intersectsFrustum(Ge)){if(H)pt.setFromMatrixPosition(w.matrixWorld).applyMatrix4($e);let Se=Y.update(w),me=w.material;if(me.visible)b.push(w,Se,me,X,pt.z,null,U)}}else if(w.isMesh||w.isLine||w.isPoints){if(!w.frustumCulled||w.intersectsFrustum(Ge)){let Se=Y.update(w),me=w.material;if(H){if(w.boundingSphere!==void 0){if(w.boundingSphere===null)w.computeBoundingSphere();pt.copy(w.boundingSphere.center)}else{if(Se.boundingSphere===null)Se.computeBoundingSphere();pt.copy(Se.boundingSphere.center)}pt.applyMatrix4(w.matrixWorld).applyMatrix4($e)}if(Array.isArray(me)){let Me=Se.groups;for(let Te=0,Xe=Me.length;Te<Xe;Te++){let et=Me[Te],we=me[et.materialIndex];if(we&&we.visible)b.push(w,Se,we,X,pt.z,et,U)}}else if(me.visible)b.push(w,Se,me,X,pt.z,null,U)}}}let ge=w.children;for(let Se=0,me=ge.length;Se<me;Se++)rd(ge[Se],U,X,H)}function Op(w,U,X,H){let{opaque:V,transmissive:ge,transparent:Se}=w;if(S.setupLightsView(X),qe===!0)re.setGlobalState(_.clippingPlanes,X);if(H)R.viewport(q.copy(H));if(V.length>0)No(V,U,X);if(ge.length>0)No(ge,U,X);if(Se.length>0)No(Se,U,X);R.buffers.depth.setTest(!0),R.buffers.depth.setMask(!0),R.buffers.color.setMask(!0),R.setPolygonOffset(!1)}function Bp(w,U,X,H){if((X.isScene===!0?X.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[H.id]===void 0){let we=Ue.has("EXT_color_buffer_half_float")||Ue.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[H.id]=new St(1,1,{generateMipmaps:!0,type:we?zt:Kt,minFilter:Qi,samples:Math.max(4,lt.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ze.workingColorSpace})}let ge=S.state.transmissionRenderTarget[H.id],Se=H.viewport||q;ge.setSize(Se.z*_.transmissionResolutionScale,Se.w*_.transmissionResolutionScale);let me=_.getRenderTarget(),Me=_.getActiveCubeFace(),Te=_.getActiveMipmapLevel();if(_.setRenderTarget(ge),_.getClearColor(_e),Ve=_.getClearAlpha(),Ve<1)_.setClearColor(16777215,0.5);if(_.clear(),Ct)Ne.render(X);let Xe=_.toneMapping;_.toneMapping=gn;let et=H.viewport;if(H.viewport!==void 0)H.viewport=void 0;if(S.setupLightsView(H),qe===!0)re.setGlobalState(_.clippingPlanes,H);if(No(w,X,H),j.updateMultisampleRenderTarget(ge),j.updateRenderTargetMipmap(ge),Ue.has("WEBGL_multisampled_render_to_texture")===!1){let we=!1;for(let at=0,Ft=U.length;at<Ft;at++){let yt=U[at],{object:ft,geometry:Wt,material:ye,group:sn}=yt;if(ye.side===cn&&ft.layers.test(H.layers)){let it=ye.side;ye.side=dn,ye.needsUpdate=!0,kp(ft,X,H,Wt,ye,sn),ye.side=it,ye.needsUpdate=!0,we=!0}}if(we===!0)j.updateMultisampleRenderTarget(ge),j.updateRenderTargetMipmap(ge)}if(_.setRenderTarget(me,Me,Te),_.setClearColor(_e,Ve),et!==void 0)H.viewport=et;_.toneMapping=Xe}function No(w,U,X){let H=U.isScene===!0?U.overrideMaterial:null;for(let V=0,ge=w.length;V<ge;V++){let Se=w[V],{object:me,geometry:Me,group:Te}=Se,Xe=Se.material;if(Xe.allowOverride===!0&&H!==null)Xe=H;if(me.layers.test(X.layers))kp(me,U,X,Me,Xe,Te)}}function kp(w,U,X,H,V,ge){if(P!==null&&V.isNodeMaterial)P.setObject(w,V);if(w.onBeforeRender(_,U,X,H,V,ge),w.modelViewMatrix.multiplyMatrices(X.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),V.onBeforeRender(_,U,X,H,w,ge),V.transparent===!0&&V.side===cn&&V.forceSinglePass===!1)V.side=dn,V.needsUpdate=!0,_.renderBufferDirect(X,U,H,V,w,ge),V.side=Ks,V.needsUpdate=!0,_.renderBufferDirect(X,U,H,V,w,ge),V.side=cn;else _.renderBufferDirect(X,U,H,V,w,ge);w.onAfterRender(_,U,X,H,V,ge)}function Oo(w,U,X){if(U.isScene!==!0)U=kt;let H=F.get(w),V=S.state.lights,ge=S.state.shadowsArray,Se=V.state.version,me=Z.getParameters(w,V.state,ge,U,X,S.state.lightProbeGridArray),Me=Z.getProgramCacheKey(me),Te=H.programs;H.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?U.environment:null,H.fog=U.fog;let Xe=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;if(H.envMap=ie.get(w.envMap||H.environment,Xe),H.envMapRotation=H.environment!==null&&w.envMap===null?U.environmentRotation:w.envMapRotation,Te===void 0)w.addEventListener("dispose",Bn),Te=new Map,H.programs=Te;let et=Te.get(Me);if(et!==void 0){if(H.currentProgram===et&&H.lightsStateVersion===Se)return Hp(w,me),et}else{if(me.uniforms=Z.getUniforms(w),P!==null&&w.isNodeMaterial)P.build(w,X,me);w.onBeforeCompile(me,_),et=Z.acquireProgram(me,Me),Te.set(Me,et),H.uniforms=me.uniforms}let we=H.uniforms;if(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)we.clippingPlanes=re.uniform;if(Hp(w,me),H.needsLights=Sy(w),H.lightsStateVersion=Se,H.needsLights)we.ambientLightColor.value=V.state.ambient,we.lightProbe.value=V.state.probe,we.sunLights.value=V.state.sun,we.sunLightShadows.value=V.state.sunShadow,we.directionalLights.value=V.state.directional,we.directionalLightShadows.value=V.state.directionalShadow,we.spotLights.value=V.state.spot,we.spotLightShadows.value=V.state.spotShadow,we.rectAreaLights.value=V.state.rectArea,we.ltc_1.value=V.state.rectAreaLTC1,we.ltc_2.value=V.state.rectAreaLTC2,we.pointLights.value=V.state.point,we.pointLightShadows.value=V.state.pointShadow,we.hemisphereLights.value=V.state.hemi,we.sunShadowMatrix.value=V.state.sunShadowMatrix,we.sunShadowCascade.value=V.state.sunShadowCascade,we.directionalShadowMatrix.value=V.state.directionalShadowMatrix,we.spotLightMatrix.value=V.state.spotLightMatrix,we.spotLightMap.value=V.state.spotLightMap,we.pointShadowMatrix.value=V.state.pointShadowMatrix;return H.lightProbeGrid=S.state.lightProbeGridArray.length>0,H.currentProgram=et,H.uniformsList=null,et}function Gp(w){if(w.uniformsList===null){let U=w.currentProgram.getUniforms();w.uniformsList=ro.seqWithValue(U.seq,w.uniforms)}return w.uniformsList}function Hp(w,U){let X=F.get(w);X.outputColorSpace=U.outputColorSpace,X.batching=U.batching,X.batchingColor=U.batchingColor,X.instancing=U.instancing,X.instancingColor=U.instancingColor,X.instancingMorph=U.instancingMorph,X.skinning=U.skinning,X.morphTargets=U.morphTargets,X.morphNormals=U.morphNormals,X.morphColors=U.morphColors,X.morphTargetsCount=U.morphTargetsCount,X.numClippingPlanes=U.numClippingPlanes,X.numIntersection=U.numClipIntersection,X.vertexAlphas=U.vertexAlphas,X.vertexTangents=U.vertexTangents,X.toneMapping=U.toneMapping}function by(w,U){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;E.setFromMatrixPosition(U.matrixWorld);for(let X=0,H=w.length;X<H;X++){let V=w[X];if(V.texture!==null&&V.boundingBox.containsPoint(E))return V}return null}function yy(w,U,X,H,V){if(U.isScene!==!0)U=kt;j.resetTextureUnits();let ge=U.fog,Se=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?U.environment:null,me=G===null?_.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:Ze.workingColorSpace,Me=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,Te=ie.get(H.envMap||Se,Me),Xe=H.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,et=!!X.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),we=!!X.morphAttributes.position,at=!!X.morphAttributes.normal,Ft=!!X.morphAttributes.color,yt=gn;if(H.toneMapped){if(G===null||G.isXRRenderTarget===!0)yt=_.toneMapping}let ft=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,Wt=ft!==void 0?ft.length:0,ye=F.get(H),sn=S.state.lights;if(qe===!0){if(st===!0||w!==W){let vt=w===W&&H.id===Q;re.setState(H,w,vt)}}let it=!1;if(H.version===ye.__version){if(ye.needsLights&&ye.lightsStateVersion!==sn.state.version)it=!0;else if(ye.outputColorSpace!==me)it=!0;else if(V.isBatchedMesh&&ye.batching===!1)it=!0;else if(!V.isBatchedMesh&&ye.batching===!0)it=!0;else if(V.isBatchedMesh&&ye.batchingColor===!0&&V._colorsTexture===null)it=!0;else if(V.isBatchedMesh&&ye.batchingColor===!1&&V._colorsTexture!==null)it=!0;else if(V.isInstancedMesh&&ye.instancing===!1)it=!0;else if(!V.isInstancedMesh&&ye.instancing===!0)it=!0;else if(V.isSkinnedMesh&&ye.skinning===!1)it=!0;else if(!V.isSkinnedMesh&&ye.skinning===!0)it=!0;else if(V.isInstancedMesh&&ye.instancingColor===!0&&V.instanceColor===null)it=!0;else if(V.isInstancedMesh&&ye.instancingColor===!1&&V.instanceColor!==null)it=!0;else if(V.isInstancedMesh&&ye.instancingMorph===!0&&V.morphTexture===null)it=!0;else if(V.isInstancedMesh&&ye.instancingMorph===!1&&V.morphTexture!==null)it=!0;else if(ye.envMap!==Te)it=!0;else if(H.fog===!0&&ye.fog!==ge)it=!0;else if(ye.numClippingPlanes!==void 0&&(ye.numClippingPlanes!==re.numPlanes||ye.numIntersection!==re.numIntersection))it=!0;else if(ye.vertexAlphas!==Xe)it=!0;else if(ye.vertexTangents!==et)it=!0;else if(ye.morphTargets!==we)it=!0;else if(ye.morphNormals!==at)it=!0;else if(ye.morphColors!==Ft)it=!0;else if(ye.toneMapping!==yt)it=!0;else if(ye.morphTargetsCount!==Wt)it=!0;else if(!!ye.lightProbeGrid!==S.state.lightProbeGridArray.length>0)it=!0}else it=!0,ye.__version=H.version;let bn=ye.currentProgram;if(it===!0){if(bn=Oo(H,U,V),P&&H.isNodeMaterial)P.onUpdateProgram(H,bn,ye)}let kn=!1,xi=!1,As=!1,ht=bn.getUniforms(),Dt=ye.uniforms;if(R.useProgram(bn.program))kn=!0,xi=!0,As=!0;if(H.id!==Q)Q=H.id,xi=!0;if(ye.needsLights){let vt=by(S.state.lightProbeGridArray,V);if(ye.lightProbeGrid!==vt)ye.lightProbeGrid=vt,xi=!0}if(kn||W!==w){if(R.buffers.depth.getReversed()&&w.reversedDepth!==!0)w._reversedDepth=!0,w.updateProjectionMatrix();ht.setValue(L,"projectionMatrix",w.projectionMatrix),ht.setValue(L,"viewMatrix",w.matrixWorldInverse);let yi=ht.map.cameraPosition;if(yi!==void 0)yi.setValue(L,Mt.setFromMatrixPosition(w.matrixWorld));if(lt.logarithmicDepthBuffer)ht.setValue(L,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2));if(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)ht.setValue(L,"isOrthographic",w.isOrthographicCamera===!0);if(W!==w)W=w,xi=!0,As=!0}if(ye.needsLights){if(sn.state.sunShadowMap.length>0)ht.setValue(L,"sunShadowMap",sn.state.sunShadowMap,j);if(sn.state.directionalShadowMap.length>0)ht.setValue(L,"directionalShadowMap",sn.state.directionalShadowMap,j);if(sn.state.spotShadowMap.length>0)ht.setValue(L,"spotShadowMap",sn.state.spotShadowMap,j);if(sn.state.pointShadowMap.length>0)ht.setValue(L,"pointShadowMap",sn.state.pointShadowMap,j)}if(V.isSkinnedMesh){ht.setOptional(L,V,"bindMatrix"),ht.setOptional(L,V,"bindMatrixInverse");let vt=V.skeleton;if(vt){if(vt.boneTexture===null)vt.computeBoneTexture();ht.setValue(L,"boneTexture",vt.boneTexture,j)}}if(V.isBatchedMesh){if(ht.setOptional(L,V,"batchingTexture"),ht.setValue(L,"batchingTexture",V._matricesTexture,j),ht.setOptional(L,V,"batchingIdTexture"),ht.setValue(L,"batchingIdTexture",V._indirectTexture,j),ht.setOptional(L,V,"batchingColorTexture"),V._colorsTexture!==null)ht.setValue(L,"batchingColorTexture",V._colorsTexture,j)}let bi=X.morphAttributes;if(bi.position!==void 0||bi.normal!==void 0||bi.color!==void 0)rt.update(V,X,bn);if(xi||ye.receiveShadow!==V.receiveShadow)ye.receiveShadow=V.receiveShadow,ht.setValue(L,"receiveShadow",V.receiveShadow);if((H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&U.environment!==null)Dt.envMapIntensity.value=U.environmentIntensity;if(Dt.dfgLUT!==void 0)Dt.dfgLUT.value=OT();if(xi){if(ht.setValue(L,"toneMappingExposure",_.toneMappingExposure),ye.needsLights)_y(Dt,As);if(ge&&H.fog===!0)ve.refreshFogUniforms(Dt,ge);if(ve.refreshMaterialUniforms(Dt,H,te,J,S.state.transmissionRenderTarget[w.id]),ye.needsLights&&ye.lightProbeGrid){let vt=ye.lightProbeGrid;Dt.probesSH.value=vt.texture,Dt.probesMin.value.copy(vt.boundingBox.min),Dt.probesMax.value.copy(vt.boundingBox.max),Dt.probesResolution.value.copy(vt.resolution)}ro.upload(L,Gp(ye),Dt,j)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0)ro.upload(L,Gp(ye),Dt,j),H.uniformsNeedUpdate=!1;if(H.isSpriteMaterial)ht.setValue(L,"center",V.center);if(ht.setValue(L,"modelViewMatrix",V.modelViewMatrix),ht.setValue(L,"normalMatrix",V.normalMatrix),ht.setValue(L,"modelMatrix",V.matrixWorld),H.uniformsGroups!==void 0){let vt=H.uniformsGroups;for(let yi=0,Rs=vt.length;yi<Rs;yi++){let Wp=vt[yi];be.update(Wp,bn),be.bind(Wp,bn)}}return bn}function _y(w,U){w.ambientLightColor.needsUpdate=U,w.lightProbe.needsUpdate=U,w.sunLights.needsUpdate=U,w.sunLightShadows.needsUpdate=U,w.directionalLights.needsUpdate=U,w.directionalLightShadows.needsUpdate=U,w.pointLights.needsUpdate=U,w.pointLightShadows.needsUpdate=U,w.spotLights.needsUpdate=U,w.spotLightShadows.needsUpdate=U,w.rectAreaLights.needsUpdate=U,w.hemisphereLights.needsUpdate=U}function Sy(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return B},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(w,U,X){let H=F.get(w);if(H.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1)H.__useRenderToTexture=!1;F.get(w.texture).__webglTexture=U,F.get(w.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:X,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,U){let X=F.get(w);X.__webglFramebuffer=U,X.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(w,U=0,X=0){G=w,B=U,k=X;let H=null,V=!1,ge=!1;if(w){let me=F.get(w);if(me.__useDefaultFramebuffer!==void 0){R.bindFramebuffer(L.FRAMEBUFFER,me.__webglFramebuffer),q.copy(w.viewport),ee.copy(w.scissor),xe=w.scissorTest,R.viewport(q),R.scissor(ee),R.setScissorTest(xe),Q=-1;return}else if(me.__webglFramebuffer===void 0)j.setupRenderTarget(w);else if(me.__hasExternalTextures)j.rebindTextures(w,F.get(w.texture).__webglTexture,F.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let Xe=w.depthTexture;if(me.__boundDepthTexture!==Xe){if(Xe!==null&&F.has(Xe)&&(w.width!==Xe.image.width||w.height!==Xe.image.height))throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");j.setupDepthRenderbuffer(w)}}let Me=w.texture;if(Me.isData3DTexture||Me.isDataArrayTexture||Me.isCompressedArrayTexture)ge=!0;let Te=F.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget){if(Array.isArray(Te[U]))H=Te[U][X];else H=Te[U];V=!0}else if(w.samples>0&&j.useMultisampledRTT(w)===!1)H=F.get(w).__webglMultisampledFramebuffer;else if(Array.isArray(Te))H=Te[X];else H=Te;q.copy(w.viewport),ee.copy(w.scissor),xe=w.scissorTest}else q.copy(Pe).multiplyScalar(te).floor(),ee.copy(Ee).multiplyScalar(te).floor(),xe=Rt;if(X!==0)H=D;if(R.bindFramebuffer(L.FRAMEBUFFER,H))R.drawBuffers(w,H);if(R.viewport(q),R.scissor(ee),R.setScissorTest(xe),V){let me=F.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+U,me.__webglTexture,X)}else if(ge){let me=U;for(let Me=0;Me<w.textures.length;Me++){let Te=F.get(w.textures[Me]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+Me,Te.__webglTexture,X,me)}}else if(w!==null&&X!==0){let me=F.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,me.__webglTexture,X)}Q=-1};function Vp(w){let U=F.get(w);if(U.__readFormat!==w.format||U.__readType!==w.type)U.__readFormat=w.format,U.__readType=w.type,U.__formatReadable=lt.textureFormatReadable(w.format),U.__typeReadable=lt.textureTypeReadable(w.type);return U}if(this.readRenderTargetPixels=function(w,U,X,H,V,ge,Se,me=0){if(!(w&&w.isWebGLRenderTarget)){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Me=F.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Se!==void 0)Me=Me[Se];if(Me){R.bindFramebuffer(L.FRAMEBUFFER,Me);try{let Te=w.textures[me],{format:Xe,type:et}=Te;if(w.textures.length>1)L.readBuffer(L.COLOR_ATTACHMENT0+me);let we=Vp(Te);if(we.__formatReadable===!1){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(we.__typeReadable===!1){Be("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(U>=0&&U<=w.width-H&&(X>=0&&X<=w.height-V))L.readPixels(U,X,H,V,K.convert(Xe),K.convert(et),ge)}finally{let Te=G!==null?F.get(G).__webglFramebuffer:null;R.bindFramebuffer(L.FRAMEBUFFER,Te)}}},this.readRenderTargetPixelsAsync=async function(w,U,X,H,V,ge,Se,me=0){if(!(w&&w.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Me=F.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Se!==void 0)Me=Me[Se];if(Me)if(U>=0&&U<=w.width-H&&(X>=0&&X<=w.height-V)){R.bindFramebuffer(L.FRAMEBUFFER,Me);let Te=w.textures[me],{format:Xe,type:et}=Te;if(w.textures.length>1)L.readBuffer(L.COLOR_ATTACHMENT0+me);let we=Vp(Te);if(we.__formatReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(we.__typeReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let at=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,at),L.bufferData(L.PIXEL_PACK_BUFFER,ge.byteLength,L.STREAM_READ),L.readPixels(U,X,H,V,K.convert(Xe),K.convert(et),0),L.bindBuffer(L.PIXEL_PACK_BUFFER,null);let Ft=G!==null?F.get(G).__webglFramebuffer:null;R.bindFramebuffer(L.FRAMEBUFFER,Ft);let yt=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Fm(L,yt,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,at),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,ge),L.bindBuffer(L.PIXEL_PACK_BUFFER,null),L.deleteBuffer(at),L.deleteSync(yt),ge}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,U=null,X=0){let H=Math.pow(2,-X),V=Math.floor(w.image.width*H),ge=Math.floor(w.image.height*H),Se=U!==null?U.x:0,me=U!==null?U.y:0;j.setTexture2D(w,0),L.copyTexSubImage2D(L.TEXTURE_2D,X,0,0,Se,me,V,ge),R.unbindTexture()},this.copyTextureToTexture=function(w,U,X=null,H=null,V=0,ge=0){let Se,me,Me,Te,Xe,et,we,at,Ft,yt=w.isCompressedTexture?w.mipmaps[ge]:w.image;if(X!==null)Se=X.max.x-X.min.x,me=X.max.y-X.min.y,Me=X.isBox3?X.max.z-X.min.z:1,Te=X.min.x,Xe=X.min.y,et=X.isBox3?X.min.z:0;else{let Dt=Math.pow(2,-V);if(Se=Math.floor(yt.width*Dt),me=Math.floor(yt.height*Dt),w.isDataArrayTexture)Me=yt.depth;else if(w.isData3DTexture)Me=Math.floor(yt.depth*Dt);else Me=1;Te=0,Xe=0,et=0}if(H!==null)we=H.x,at=H.y,Ft=H.z;else we=0,at=0,Ft=0;let ft=K.convert(U.format),Wt=K.convert(U.type),ye;if(U.isData3DTexture)j.setTexture3D(U,0),ye=L.TEXTURE_3D;else if(U.isDataArrayTexture||U.isCompressedArrayTexture)j.setTexture2DArray(U,0),ye=L.TEXTURE_2D_ARRAY;else j.setTexture2D(U,0),ye=L.TEXTURE_2D;R.activeTexture(L.TEXTURE0),R.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,U.flipY),R.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),R.pixelStorei(L.UNPACK_ALIGNMENT,U.unpackAlignment);let sn=R.getParameter(L.UNPACK_ROW_LENGTH),it=R.getParameter(L.UNPACK_IMAGE_HEIGHT),bn=R.getParameter(L.UNPACK_SKIP_PIXELS),kn=R.getParameter(L.UNPACK_SKIP_ROWS),xi=R.getParameter(L.UNPACK_SKIP_IMAGES);R.pixelStorei(L.UNPACK_ROW_LENGTH,yt.width),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,yt.height),R.pixelStorei(L.UNPACK_SKIP_PIXELS,Te),R.pixelStorei(L.UNPACK_SKIP_ROWS,Xe),R.pixelStorei(L.UNPACK_SKIP_IMAGES,et);let As=w.isDataArrayTexture||w.isData3DTexture,ht=U.isDataArrayTexture||U.isData3DTexture;if(w.isDepthTexture){let Dt=F.get(w),bi=F.get(U),vt=F.get(Dt.__renderTarget),yi=F.get(bi.__renderTarget);R.bindFramebuffer(L.READ_FRAMEBUFFER,vt.__webglFramebuffer),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,yi.__webglFramebuffer);for(let Rs=0;Rs<Me;Rs++){if(As)L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,F.get(w).__webglTexture,V,et+Rs),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,F.get(U).__webglTexture,ge,Ft+Rs);L.blitFramebuffer(Te,Xe,Se,me,we,at,Se,me,L.DEPTH_BUFFER_BIT,L.NEAREST)}R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(V!==0||w.isRenderTargetTexture||F.has(w)){let Dt=F.get(w),bi=F.get(U);R.bindFramebuffer(L.READ_FRAMEBUFFER,N),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,C);for(let vt=0;vt<Me;vt++){if(As)L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Dt.__webglTexture,V,et+vt);else L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Dt.__webglTexture,V);if(ht)L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,bi.__webglTexture,ge,Ft+vt);else L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,bi.__webglTexture,ge);if(V!==0)L.blitFramebuffer(Te,Xe,Se,me,we,at,Se,me,L.COLOR_BUFFER_BIT,L.NEAREST);else if(ht)L.copyTexSubImage3D(ye,ge,we,at,Ft+vt,Te,Xe,Se,me);else L.copyTexSubImage2D(ye,ge,we,at,Te,Xe,Se,me)}R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(ht)if(w.isDataTexture||w.isData3DTexture)L.texSubImage3D(ye,ge,we,at,Ft,Se,me,Me,ft,Wt,yt.data);else if(U.isCompressedArrayTexture)L.compressedTexSubImage3D(ye,ge,we,at,Ft,Se,me,Me,ft,yt.data);else L.texSubImage3D(ye,ge,we,at,Ft,Se,me,Me,ft,Wt,yt);else if(w.isDataTexture)L.texSubImage2D(L.TEXTURE_2D,ge,we,at,Se,me,ft,Wt,yt.data);else if(w.isCompressedTexture)L.compressedTexSubImage2D(L.TEXTURE_2D,ge,we,at,yt.width,yt.height,ft,yt.data);else L.texSubImage2D(L.TEXTURE_2D,ge,we,at,Se,me,ft,Wt,yt);if(R.pixelStorei(L.UNPACK_ROW_LENGTH,sn),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,it),R.pixelStorei(L.UNPACK_SKIP_PIXELS,bn),R.pixelStorei(L.UNPACK_SKIP_ROWS,kn),R.pixelStorei(L.UNPACK_SKIP_IMAGES,xi),ge===0&&U.generateMipmaps)L.generateMipmap(ye);R.unbindTexture()},this.initRenderTarget=function(w){if(F.get(w).__webglFramebuffer===void 0)j.setupRenderTarget(w)},this.initTexture=function(w){if(w.isCubeTexture)j.setTextureCube(w,0);else if(w.isData3DTexture)j.setTexture3D(w,0);else if(w.isDataArrayTexture||w.isCompressedArrayTexture)j.setTexture2DArray(w,0);else j.setTexture2D(w,0);R.unbindTexture()},this.resetState=function(){B=0,k=0,G=null,R.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Mc}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ze._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ze._getUnpackColorSpace()}}function oo(e){return Gn(e)}var mt={cube:{sizes:[5,20,50,100],default:20},snake:{startLength:3,growPerApple:1},speed:{startStepMs:1080,minStepMs:360,stepMsPerApple:24,boostFactor:1.5,boostFactors:[1.5,2,3,4],minEffectiveStepMs:60},shop:{coinPerApple:1,defaultBoost:1.5,defaultArenaSize:20,maxTemporaryGames:50,defaults:{balance:0,owned:["boost-1.5","palette-neon","palette-contrast","snake-classic","apple-diamond","compass-default","arena-20","density-1","pace-1"],equipped:{boost:"boost-1.5",palette:"palette-neon",snakeSkin:"snake-classic",appleSkin:"apple-diamond",compassSkin:"compass-default",arenaSize:"arena-20",obstacles:"density-1",pace:"pace-1"}},items:[{id:"boost-1.5",kind:"boost",price:0,payload:{factor:1.5}},{id:"boost-2",kind:"boost",price:40,payload:{factor:2}},{id:"boost-3",kind:"boost",price:100,payload:{factor:3}},{id:"boost-4",kind:"boost",price:250,payload:{factor:4}},{id:"boost-soon",kind:"comingSoon",price:0,payload:{slot:"boost"}},{id:"score-perm-1.25",kind:"scoreMultPermanent",price:80,payload:{mult:1.25}},{id:"score-perm-1.5",kind:"scoreMultPermanent",price:240,payload:{mult:1.5}},{id:"score-temp-2",kind:"scoreMultTemporary",price:60,payload:{mult:2},games:5},{id:"score-temp-3",kind:"scoreMultTemporary",price:150,payload:{mult:3},games:5},{id:"score-temp-5",kind:"scoreMultTemporary",price:200,payload:{mult:5},games:3},{id:"mult-soon",kind:"comingSoon",price:0,payload:{slot:"mult"}},{id:"palette-neon",kind:"palette",price:0,payload:{palette:"neon"}},{id:"palette-contrast",kind:"palette",price:0,payload:{palette:"contrast"}},{id:"palette-synthwave",kind:"palette",price:250,payload:{palette:"synthwave"}},{id:"palette-ice",kind:"palette",price:250,payload:{palette:"ice"}},{id:"palette-terminal",kind:"palette",price:250,payload:{palette:"terminal"}},{id:"palette-soon",kind:"comingSoon",price:0,payload:{slot:"palette"}},{id:"snake-classic",kind:"snakeSkin",price:0,payload:{skin:"classic"}},{id:"snake-tail-guides",kind:"snakeSkin",price:100,payload:{skin:"tailGuides"}},{id:"snake-soon",kind:"comingSoon",price:0,payload:{slot:"snakeSkin"}},{id:"apple-diamond",kind:"appleSkin",price:0,payload:{skin:"diamond"}},{id:"apple-orb",kind:"appleSkin",price:15,payload:{skin:"orb"}},{id:"apple-star",kind:"appleSkin",price:30,payload:{skin:"star"}},{id:"apple-soon",kind:"comingSoon",price:0,payload:{slot:"appleSkin"}},{id:"compass-default",kind:"compassSkin",price:0,payload:{skin:"default"}},{id:"compass-chevron",kind:"compassSkin",price:20,payload:{skin:"chevron"}},{id:"compass-ring",kind:"compassSkin",price:50,payload:{skin:"ring"}},{id:"compass-soon",kind:"comingSoon",price:0,payload:{slot:"compassSkin"}},{id:"arena-5",kind:"arenaSize",price:120,payload:{size:5}},{id:"arena-20",kind:"arenaSize",price:0,payload:{size:20}},{id:"arena-50",kind:"arenaSize",price:80,payload:{size:50}},{id:"arena-100",kind:"arenaSize",price:200,payload:{size:100}},{id:"arena-soon",kind:"comingSoon",price:0,payload:{slot:"arenaSize"}},{id:"density-0",kind:"obstacleDensity",price:300,payload:{density:0}},{id:"density-0.25",kind:"obstacleDensity",price:60,payload:{density:0.25}},{id:"density-0.5",kind:"obstacleDensity",price:40,payload:{density:0.5}},{id:"density-1",kind:"obstacleDensity",price:0,payload:{density:1}},{id:"density-2",kind:"obstacleDensity",price:40,payload:{density:2}},{id:"density-soon",kind:"comingSoon",price:0,payload:{slot:"obstacles"}},{id:"pace-1.5",kind:"pace",price:30,payload:{scale:1.5}},{id:"pace-1",kind:"pace",price:0,payload:{scale:1}},{id:"pace-0.75",kind:"pace",price:50,payload:{scale:0.75}},{id:"pace-0.5",kind:"pace",price:100,payload:{scale:0.5}},{id:"pace-soon",kind:"comingSoon",price:0,payload:{slot:"pace"}}]},obstacles:{density:0.03,stickiness:0.6,clearRadius:4,wallMargin:1},camera:{glitchMs:180,followDistance:6,followHeight:3.6,lateralOffset:1.05,lookAheadDistance:10,lookDownOffset:1.5,modeSwitchMs:1400,zoomMin:0.5,zoomMax:2,zoomWheelPerPx:0.0012,zoomPinchGain:1,zoomFollowMs:120,free:{flySpeed:12,orbitRadPerPx:0.006,wheelStep:0.12,minDistance:1.5,maxDistance:200,pitchLimitDeg:88,startDistanceFactor:1.6,startYawDeg:35,startPitchDeg:28,fovDeg:50,near:0.1,farFactor:8},plane:{visibleCells:20,marginCells:1,fovDeg:20,raise:0.1,revealShare:0.45}},hints:{latticeAt:"corners",latticeStep:4,compassHideDist:1.5,compassFullDist:3},headSignal:{dangerHorizon:2,riseMs:50,fallMs:400,goalScale:0.88},snakeView:{bodyScale:0.75},demo:{afterSteps:5},plane:{appleMaxSteps:4},loop:{maxFrameMs:100},frozenView:{settleMs:350,sizePollMs:250},minimap:{windowCells:20,levelWindowCells:10},quality:{autoMediumFromMegapixels:2.5,autoLowFromMegapixels:6,autoWeakGpu:"medium",strongGpuPattern:"nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|radeon r9|apple|adreno|mali|powervr|immortalis",msaaGpuPattern:"nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|radeon r9",notMsaaGpuPattern:"intel|vega|apple|adreno|mali|powervr|immortalis|xclipse|videocore|tegra|swiftshader|llvmpipe|software",msaaNeedsFinePointer:!0,levels:{high:{megapixelCap:0,msaa:4,msaaGpuOnly:!0,bloom:"full"},medium:{megapixelCap:0,msaa:0,smaa:!0,bloom:"full"},low:{megapixelCap:1.5,msaa:0,bloom:"off"}}},fog:{density:0.06,defaultOn:!0},boostHint:{showAfterMs:600,visibleMs:4000},layout:{fullscreenBottomReservePx:80},input:{defaultScheme:"taps",swipeMinPx:24,tiltRadPerPx:0.005,twoFingerLockPx:10,stick:{sizeVmin:24,sizeMinPx:88,sizeMaxPx:112,deadZone:0.2,curve:1.5,maxRadPerSec:1.2,tapMaxMs:250}},leaderboard:{size:3,nameLength:3,alphabet:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",defaultName:"AAA",legacyName:"---",minScore:1,repeatDelayMs:350,repeatMs:110},sound:{music:{volume:0.15,loopStartSec:8,loopEndSec:96,bufferSampleRate:24000,fadeMs:400},sfx:{volume:0.5},blips:{eat:{wave:"sawtooth",freqFrom:440,freqTo:880,sweepMs:90,attackMs:2,decayMs:120,gain:0.6,combo:!0},click:{wave:"square",freqFrom:600,freqTo:900,sweepMs:40,attackMs:2,decayMs:50,gain:0.25,combo:!1},tick:{wave:"triangle",freqFrom:760,freqTo:520,sweepMs:30,attackMs:1,decayMs:110,gain:0.26,combo:!1,speed:{slowStepMs:1080,fastStepMs:180,fastGain:0.5,skipBelowStepMs:300,skipEvery:2,jitterCents:70,minGapMs:90}},death:{wave:"sawtooth",freqFrom:330,freqTo:32,sweepMs:1000,attackMs:4,decayMs:1150,gain:0.85,combo:!1,layer:{wave:"square",ratio:0.5,gain:0.4},noise:{gain:0.7,decayMs:650,filterFrom:7000,filterTo:180}}},combo:{semitonesPerApple:1,maxSemitones:12},defaults:{musicOn:!0,sfxOn:!0}},palettes:{glow:{headIdle:0.94,headGoal:1.02,dangerFar:1.08,dangerNear:1.16,apple:0.65,body:0.84,bodyTail:0.8,edge:0.86,obstacleLine:0.82,headEnd:0.88,headEndSegments:3,headEndNearLuminance:0.78,headEndNearFromCells:1.5,headEndNearToCells:3.5,maxBoost:6},glowOverrides:{neon:{obstacleLine:0.66},contrast:{obstacleLine:0.72},synthwave:{obstacleLine:0.72}},sets:{neon:{background:"#02030a",fog:"#1e223a",body:"#3dffa6",tail:"#18c4ff",head:"#fff27a",apple:"#f01050",dangerFar:"#fd7500",dangerNear:"#ff2010",rayDanger:"#ff5a30",obstacle:"#8f5cff",edge:"#1fb6ff",grid:"#2a8cff",mark:"#d9b84a",wall:"#6fe3ff"},contrast:{background:"#03060c",fog:"#1c2236",body:"#56b4e9",tail:"#3d8bff",head:"#fff090",apple:"#f0e442",dangerFar:"#e84400",dangerNear:"#ff1e97",rayDanger:"#f26a1c",obstacle:"#7a6cff",edge:"#2f8cff",grid:"#2a70d0",mark:"#d9b84a",wall:"#8fd0ff"},synthwave:{background:"#0a0418",fog:"#261846",body:"#ff4fd8",tail:"#8b44ff",head:"#ffe680",apple:"#2ee9ff",dangerFar:"#ffb020",dangerNear:"#ff2a2a",rayDanger:"#ff6a22",obstacle:"#4d6bff",edge:"#ff3df2",grid:"#8a4dff",mark:"#ffd9a8",wall:"#ff9ff0"},ice:{background:"#030812",fog:"#1a2a44",body:"#7df9ff",tail:"#3d7bff",head:"#ffe680",apple:"#ff28d8",dangerFar:"#ffb000",dangerNear:"#ff2233",rayDanger:"#ff6a1a",obstacle:"#86a7e4",edge:"#5ecbff",grid:"#3d9bff",mark:"#d9c9a0",wall:"#b0f0ff"},terminal:{background:"#030a05",fog:"#143024",body:"#2effa0",tail:"#00bf84",head:"#ebe5fe",apple:"#e936ff",dangerFar:"#ffb000",dangerNear:"#ff2a1a",rayDanger:"#ff6a1a",obstacle:"#8092f0",edge:"#1fbf8a",grid:"#17936b",mark:"#d6d6a0",wall:"#8ffcc8"}}}};function Sg(e,t,n){let i=t?.[n];return i===void 0?e:{...e,...i}}function ou(e){return e<=0.04045?e/12.92:Math.pow((e+0.055)/1.055,2.4)}function kT(e){let t=parseInt(e.slice(1),16);return[ou((t>>16&255)/255),ou((t>>8&255)/255),ou((t&255)/255)]}var GT=0.2126,HT=0.7152,VT=0.0722;function Ja(e,t,n){return GT*e+HT*t+VT*n}function WT(e){return Ja(e[0],e[1],e[2])}function Ii(e,t,n){let i=WT(kT(e));return i<=0.000001?n:Math.min(n,t/i)}function Mg(e,t){return{headIdle:Ii(e.head,t.headIdle,t.maxBoost),headGoal:Ii(e.apple,t.headGoal,t.maxBoost),dangerFar:Ii(e.dangerFar,t.dangerFar,t.maxBoost),dangerNear:Ii(e.dangerNear,t.dangerNear,t.maxBoost),apple:Ii(e.apple,t.apple,t.maxBoost),body:Ii(e.body,t.body,t.maxBoost),edge:Ii(e.edge,t.edge,t.maxBoost),obstacleLine:Ii(e.obstacle,t.obstacleLine,t.maxBoost)}}var au="neon",ao=new ae,wg=new ae;function Eg(){return new ss(wg,0)}function Ya(){return Vt.merge([de.fog])}var Tg=`
uniform float fogDensity;
float fogVisibility(float viewDepth) {
  return exp(-fogDensity * fogDensity * viewDepth * viewDepth);
}
`,lo=new ae,Ag=0.0025,Rg=0.045,Cg=0.12,lu=new ae,Lg=0.12,Pg=0.2,co=new ae,uo=new ae,Fn=new ae,du=0.84,cu=0.8,uu=0.9,hu=3,qa=5,pu=0.6,fu=1.5,mu=3.5,$t=new ae,gu=2.5,Ig=0.6,Dg=1.35,vu=new ae,ho=new ae,zg=0.1,Fg=0.3,Ka=new ae,xu=0.4,ui=new ae,bu=0.22,yu=new ae,Ug=0.95,_u=0.6,Ng=0.35,Og=0.3,Bg=0.7,kg=0.5,ms=0.9,Za=0.85,ar=0.95,Gg=0.48,Hg=0.2,po=new ae,Vg=0.5,Qa=0.7,Wg=$t,Su=3,Mu=new ae,wu=new ae,jg=0.3,Eu=jg,Xg=0.85,Jg=1,Yg=0.65,qg=0.8,Kg=0.08,Zg=0.75,Qg=0.13,$g=0.45,e0=new ae(1,1,1),t0=0.9,n0=0.9,i0=0.72,s0=0.75,r0=0.4,o0=0.38,a0=0.3,l0=0.9,Tu=new ae,d0=0.4,c0=0.7;function jT(e,t){let n=Mg(e,t);ao.set(e.background),wg.set(e.fog),Ka.set(e.background),lo.set(e.edge).multiplyScalar(n.edge),lu.set(e.mark),co.set(e.body),uo.set(e.tail),Fn.set(e.head),du=t.body,cu=t.bodyTail,uu=t.headEnd,hu=t.headEndSegments,qa=t.maxBoost,pu=t.headEndNearLuminance,fu=t.headEndNearFromCells,mu=t.headEndNearToCells,$t.set(e.apple),gu=n.apple,vu.set(e.obstacle).multiplyScalar(n.obstacleLine),Eu=jg/n.obstacleLine,ho.set(e.grid),ui.set(e.edge),yu.set(e.wall),Tu.set(e.obstacle),po.set(e.rayDanger),Qa=n.headIdle,Su=n.headGoal,Mu.set(e.dangerFar).multiplyScalar(n.dangerFar),wu.set(e.dangerNear).multiplyScalar(n.dangerNear)}function Au(e,t){let n=e??mt.palettes,i=t!==void 0&&n.sets[t]!==void 0?t:au,s=n.sets[i];if(s===void 0)return au;return jT(s,Sg(n.glow,n.glowOverrides,i)),i}Au(mt.palettes,au);var XT=["classic","tailGuides"],JT=["diamond","orb","star"],YT=["default","chevron","ring"],$a={palette:"neon",snakeSkin:"classic",appleSkin:"diamond",compassSkin:"default"};function Ru(e,t,n){return t!==void 0&&e.includes(t)?t:n}function u0(e){return{palette:e?.palette??$a.palette,snakeSkin:Ru(XT,e?.snakeSkin,$a.snakeSkin),appleSkin:Ru(JT,e?.appleSkin,$a.appleSkin),compassSkin:Ru(YT,e?.compassSkin,$a.compassSkin)}}function h0(e){let t=e.camera;return{followDistance:t.followDistance??2,followHeight:t.followHeight??1,lateralOffset:t.lateralOffset??0.7,lookAheadDistance:t.lookAheadDistance??10,lookDownOffset:t.lookDownOffset??1.5,modeSwitchMs:t.modeSwitchMs??1400,planeVisibleCells:t.plane.visibleCells,planeMarginCells:t.plane.marginCells,planeFovDeg:t.plane.fovDeg,planeRaise:t.plane.raise,planeRevealShare:t.plane.revealShare}}function p0(e,t,n){let i=Math.min(e,n.planeVisibleCells)+n.planeMarginCells,s=Math.tan(n.planeFovDeg*Math.PI/360)*Math.min(t,1),r=Math.floor(e/2)-(e-1)/2;return i/2/s+r}var Cu=55,Lu=0.1,qT=4,KT=0.495,f0=1e6,fo=1000,mo=0.001,ZT=!0,QT=130,$T=22,eA=0.35,tA=0.5,el=1,nA=90,m0=0.0001,iA=0.0001,sA=120,It={yaw:0,pitch:0,zoom:1};function g0(){It.yaw=0,It.pitch=0,It.zoom=1}class Pu{camera;settings;aspect=1;size=-1;center=new I;offset=new I;basis=new Je;lookM=new Je;tmpRight=new I;tmpUp=new I;tmpDepth=new I;planeQ=new Pt;glitchRequested=!1;mode="plane";flying=!1;flightElapsed=0;flightMidDone=!1;flightFromPos=new I;flightFromQ=new Pt;flightToPos=new I;flightToQ=new Pt;fPos=new I;fAim=new I;fHead=new I;headT=new I;fUp=new I(0,1,0);posT=new I;aimT=new I;upT=new I;fwdT=new I;tmpV=new I;tiltYaw=0;tiltPitch=0;zoom=1;zoomFollowMs;zoomMax;tiltPivot=new I;tiltAxis=new I;tiltQ=new Pt;tiltQ2=new Pt;freeAmount=0;reveal=0;layerReach=f0;fullFar=1000;projFov=NaN;projAspect=NaN;projRaise=NaN;constructor(e){this.settings=h0(e);let t=e.camera;this.zoomFollowMs=t.zoomFollowMs??sA,this.zoomMax=Math.max(1,t.zoomMax??1),this.camera=new on(this.mode==="plane"?this.settings.planeFovDeg:Cu,this.aspect,Lu,1000)}resize(e,t){if(this.aspect=e>0&&t>0?e/t:1,this.camera.aspect=this.aspect,this.size>0)this.updateFar();this.camera.updateProjectionMatrix()}syncImmediate(e){if(this.applySize(e),this.resetTurn(),this.mode=oo(e),this.endFlightFov(),this.readTarget(e,this.planeQ),this.mode==="free")this.computeFreeTargets(e),this.fPos.copy(this.posT),this.fAim.copy(this.aimT),this.fUp.copy(this.upT),this.freeAmount=1,this.reveal=1,this.placeFree();else this.freeAmount=0,this.reveal=0,this.placePlane();this.applyProjection(e)}resetTurn(){this.glitchRequested=!1,this.flying=!1,this.flightElapsed=0,this.endFlightFov()}consumeGlitchRequest(){let e=this.glitchRequested;return this.glitchRequested=!1,e}setTilt(e,t){It.yaw=Ke.clamp(e,-el,el),It.pitch=Ke.clamp(t,-el,el)}update(e,t){if(Et(t)!==this.size)this.applySize(t);let n=oo(t);if(this.flying?n!==this.flightTo:n!==this.mode)this.startFlight(n);if(this.flying)this.updateFlight(e,t);else if(this.mode==="free")this.updateFree(e,t);else this.updatePlane(e,t);this.applyUserCamera(e),this.applyProjection(t)}applyUserCamera(e){let t=1-Math.exp(-e/nA),n=this.mode==="plane"&&!this.flying;this.tiltYaw+=((n?0:It.yaw)-this.tiltYaw)*t,this.tiltPitch+=((n?0:It.pitch)-this.tiltPitch)*t;let i=1-Math.exp(-e/Math.max(1,this.zoomFollowMs));this.zoom+=(It.zoom-this.zoom)*i;let s=Math.abs(this.tiltYaw)>=m0||Math.abs(this.tiltPitch)>=m0,r=Math.abs(this.zoom-1)>=iA;if(!s&&!r)return;if(this.tiltPivot.copy(this.fHead).lerp(this.center,1-this.freeAmount),this.tmpV.copy(this.camera.position).sub(this.tiltPivot),s){let o=this.camera.quaternion;this.tiltAxis.set(0,1,0).applyQuaternion(o),this.tiltQ.setFromAxisAngle(this.tiltAxis,this.tiltYaw),this.tiltAxis.set(1,0,0).applyQuaternion(o),this.tiltQ2.setFromAxisAngle(this.tiltAxis,this.tiltPitch),this.tiltQ.multiply(this.tiltQ2),this.tmpV.applyQuaternion(this.tiltQ),o.premultiply(this.tiltQ)}if(r)this.tmpV.multiplyScalar(this.zoom);this.camera.position.copy(this.tiltPivot).add(this.tmpV)}updatePlane(e,t){this.readTarget(t,this.planeQ),this.freeAmount=0,this.reveal=0,this.placePlane()}readTarget(e,t){let n=pn(e);this.tmpRight.set(n.right.x,n.right.y,n.right.z),this.tmpUp.set(n.up.x,n.up.y,n.up.z),this.tmpDepth.set(n.depth.x,n.depth.y,n.depth.z),this.basis.makeBasis(this.tmpRight,this.tmpUp,this.tmpDepth),t.setFromRotationMatrix(this.basis)}placePlane(){this.camera.quaternion.copy(this.planeQ),this.offset.set(0,0,this.planeDistance()).applyQuaternion(this.planeQ),this.camera.position.copy(this.center).add(this.offset)}computeFreeTargets(e){let t=pn(e),n=wt(e);this.fwdT.set(-t.depth.x,-t.depth.y,-t.depth.z),this.upT.set(t.up.x,t.up.y,t.up.z),this.tmpRight.set(t.right.x,t.right.y,t.right.z),this.posT.set(n.x,n.y,n.z).addScaledVector(this.fwdT,-this.settings.followDistance).addScaledVector(this.tmpRight,this.settings.lateralOffset).addScaledVector(this.upT,this.settings.followHeight),this.aimT.set(n.x,n.y,n.z).addScaledVector(this.fwdT,this.settings.lookAheadDistance).addScaledVector(this.upT,-this.settings.lookDownOffset),this.headT.set(n.x,n.y,n.z)}updateFree(e,t){if(this.computeFreeTargets(t),ZT){let n=1-Math.exp(-e/QT);this.fPos.lerp(this.posT,n),this.fAim.lerp(this.aimT,n),this.fUp.lerp(this.upT,n).normalize(),this.fHead.lerp(this.headT,n)}else this.fPos.copy(this.posT),this.fAim.copy(this.aimT),this.fUp.copy(this.upT),this.fHead.copy(this.headT);this.freeAmount=1,this.placeFree()}placeFree(){this.camera.position.copy(this.fPos),this.lookM.lookAt(this.fPos,this.fAim,this.fUp),this.camera.quaternion.setFromRotationMatrix(this.lookM)}flightTo="plane";startFlight(e){this.flightFromPos.copy(this.camera.position),this.flightFromQ.copy(this.camera.quaternion),this.flightTo=e,this.flying=!0,this.flightElapsed=0,this.flightMidDone=!1,this.glitchRequested=!0}updateFlight(e,t){this.flightElapsed+=e;let n=Math.min(this.flightElapsed/Math.max(1,this.settings.modeSwitchMs),1),i=Ke.smootherstep(n,0,1);if(this.flightTo==="free")this.computeFreeTargets(t),this.fPos.copy(this.posT),this.fAim.copy(this.aimT),this.fUp.copy(this.upT),this.flightToPos.copy(this.posT),this.lookM.lookAt(this.posT,this.aimT,this.upT),this.flightToQ.setFromRotationMatrix(this.lookM),this.freeAmount=i;else this.readTarget(t,this.flightToQ),this.offset.set(0,0,this.planeDistance()).applyQuaternion(this.flightToQ),this.flightToPos.copy(this.center).add(this.offset),this.freeAmount=1-i;let s=Ke.smoothstep(n,0,Math.max(0.001,this.settings.planeRevealShare));this.reveal=this.flightTo==="free"?s:1-s,this.camera.position.lerpVectors(this.flightFromPos,this.flightToPos,i);let r=Math.sin(Math.PI*n)*this.size*eA;if(this.tmpV.set(1,0,0).applyQuaternion(this.flightToQ),this.camera.position.addScaledVector(this.tmpV,r),this.camera.quaternion.slerpQuaternions(this.flightFromQ,this.flightToQ,i),this.camera.fov=Ke.lerp(this.settings.planeFovDeg,Cu,this.freeAmount)+$T*Math.sin(Math.PI*n),!this.flightMidDone&&n>=tA)this.flightMidDone=!0,this.glitchRequested=!0;if(n>=1)if(this.flying=!1,this.mode=this.flightTo,this.endFlightFov(),this.mode==="plane")this.planeQ.copy(this.flightToQ),this.freeAmount=0,this.reveal=0,this.placePlane();else this.freeAmount=1,this.reveal=1,this.placeFree()}endFlightFov(){this.camera.fov=this.mode==="plane"?this.settings.planeFovDeg:Cu}applySize(e){this.size=Et(e);let t=(this.size-1)/2;this.center.set(t,t,t),this.updateFar(),this.endFlightFov(),this.applyProjection(e)}updateFar(){this.fullFar=this.size*qT+this.planeDistance()*this.zoomMax}planeDistance(){return p0(this.size,this.aspect,this.settings)}applyProjection(e){let t=Lu,n=this.fullFar;if(this.layerReach=f0,this.reveal<1){let r=wt(e),o=this.camera;this.tmpV.set(0,0,-1).applyQuaternion(o.quaternion);let a=(r.x-o.position.x)*this.tmpV.x+(r.y-o.position.y)*this.tmpV.y+(r.z-o.position.z)*this.tmpV.z,l=KT+this.reveal*this.size;if(this.layerReach=l,t=Math.max(Lu,a-l),n=Math.min(this.fullFar,a+l),n<=t)n=t+mo}let i=this.camera,s=this.aspect<1?this.settings.planeRaise*(1-this.freeAmount):0;if(Math.abs(i.near-t)>mo||Math.abs(i.far-n)>mo||this.projFov!==i.fov||this.projAspect!==i.aspect||Math.abs(this.projRaise-s)>mo){if(i.near=t,i.far=n,this.projFov=i.fov,this.projAspect=i.aspect,this.projRaise=s,s>mo)i.setViewOffset(fo*i.aspect,fo,0,s*fo,fo*i.aspect,fo);else i.clearViewOffset();i.updateProjectionMatrix()}}}var go=Math.PI/180;function v0(e){return new URLSearchParams(e).get("camera")==="free"}function x0(){return{tx:0,ty:0,tz:0,yaw:0,pitch:0,dist:1}}function tl(e,t,n){return e<t?t:e>n?n:e}function nl(e,t,n){let i=(t-1)/2;e.tx=i,e.ty=i,e.tz=i,e.yaw=n.startYawDeg*go,e.pitch=tl(n.startPitchDeg*go,-n.pitchLimitDeg*go,n.pitchLimitDeg*go),e.dist=tl(t*n.startDistanceFactor,n.minDistance,n.maxDistance)}function b0(e,t){let n=Math.cos(e.pitch);t.x=e.tx+e.dist*Math.sin(e.yaw)*n,t.y=e.ty+e.dist*Math.sin(e.pitch),t.z=e.tz+e.dist*Math.cos(e.yaw)*n}function y0(e,t,n,i){let s=i.pitchLimitDeg*go;e.yaw-=t*i.orbitRadPerPx,e.pitch=tl(e.pitch+n*i.orbitRadPerPx,-s,s)}function _0(e,t,n){e.dist=tl(e.dist*Math.pow(1+n.wheelStep,t/100),n.minDistance,n.maxDistance)}function S0(e,t,n,i,s,r){if(t===0&&n===0&&i===0)return;let o=Math.sqrt(t*t+n*n+i*i),a=r.flySpeed*s/1000/o,l=Math.cos(e.pitch),d=-Math.sin(e.yaw)*l,c=-Math.sin(e.pitch),h=-Math.cos(e.yaw)*l,u=Math.cos(e.yaw),p=-Math.sin(e.yaw);e.tx+=(d*t+u*n)*a,e.ty+=(c*t+i)*a,e.tz+=(h*t+p*n)*a}function M0(e,t,n,i){e.tx=t,e.ty=n,e.tz=i}var hi={forward:"KeyI",back:"KeyK",left:"KeyJ",right:"KeyL",down:"KeyU",up:"KeyO",focusHead:"KeyF",resetView:"KeyC",toggleHud:"KeyH"},rA="free-camera-hud-style",Iu="free-camera-hud-off",oA="#hud, #pad, #boost, #boost-hint, #stick, #pause-btn, #cam-reset";function w0(e,t,n){let i=x0();nl(i,n,t);let s={x:0,y:0,z:0},r=n,o=!1,a=!1,l=!1,d=0,c=0,h=0,u=0,p=0,g=0,x=0,m=0,f=document.createElement("style");f.id=rA,f.textContent=`html.${Iu} :is(${oA}) { display: none !important; }`,document.head.appendChild(f);function T(N){o=N,document.documentElement.classList.toggle(Iu,N)}function E(N){let C=N.target;return C!==null&&(C.tagName==="INPUT"||C.tagName==="TEXTAREA")}function b(N){if(N.ctrlKey||N.metaKey||N.altKey||E(N))return;if(A(N.code,!0)){N.preventDefault();return}if(N.repeat)return;if(N.code===hi.focusHead)a=!0;else if(N.code===hi.resetView)nl(i,r,t);else if(N.code===hi.toggleHud)T(!o)}function S(N){A(N.code,!1)}function A(N,C){let B=C?1:0;switch(N){case hi.forward:return h=B,!0;case hi.back:return u=B,!0;case hi.left:return p=B,!0;case hi.right:return g=B,!0;case hi.down:return x=B,!0;case hi.up:return m=B,!0;default:return!1}}function y(){h=u=p=g=x=m=0,l=!1}function v(N){N.stopImmediatePropagation(),N.preventDefault(),l=!0,d=N.clientX,c=N.clientY,e.setPointerCapture(N.pointerId)}function _(N){if(!l)return;N.stopImmediatePropagation(),y0(i,N.clientX-d,N.clientY-c,t),d=N.clientX,c=N.clientY}function z(N){if(!l)return;N.stopImmediatePropagation(),l=!1}function P(N){N.stopImmediatePropagation(),N.preventDefault(),_0(i,N.deltaY,t)}function D(N){N.preventDefault()}return window.addEventListener("keydown",b),window.addEventListener("keyup",S),window.addEventListener("blur",y),e.addEventListener("pointerdown",v,!0),e.addEventListener("pointermove",_,!0),e.addEventListener("pointerup",z,!0),e.addEventListener("pointercancel",z,!0),e.addEventListener("wheel",P,{capture:!0,passive:!1}),e.addEventListener("contextmenu",D,!0),{get hudHidden(){return o},apply(N,C,B){let k=C.size;if(k!==r)r=k,nl(i,k,t);if(a){a=!1;let G=wt(C);M0(i,G.x,G.y,G.z)}S0(i,h-u,g-p,m-x,B,t),b0(i,s),N.position.set(s.x,s.y,s.z),N.lookAt(i.tx,i.ty,i.tz),N.fov=t.fovDeg,N.near=t.near,N.far=r*t.farFactor+i.dist,N.clearViewOffset(),N.updateProjectionMatrix()},dispose(){window.removeEventListener("keydown",b),window.removeEventListener("keyup",S),window.removeEventListener("blur",y),e.removeEventListener("pointerdown",v,!0),e.removeEventListener("pointermove",_,!0),e.removeEventListener("pointerup",z,!0),e.removeEventListener("pointercancel",z,!0),e.removeEventListener("wheel",P,!0),e.removeEventListener("contextmenu",D,!0),f.remove(),document.documentElement.classList.remove(Iu)}}}var lr={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class en{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var aA=new Pi(-1,1,1,-1,0,1);class E0 extends Qe{constructor(){super();this.setAttribute("position",new Oe([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new Oe([0,2,0,0,2,0],2))}}var lA=new E0;class Un{constructor(e){this._mesh=new nt(lA,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,aA)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Du extends en{constructor(e,t="tDiffuse"){super();if(this.textureID=t,this.uniforms=null,this.material=null,e instanceof He)this.uniforms=e.uniforms,this.material=e;else if(e)this.uniforms=Vt.clone(e.uniforms),this.material=new He({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader});this._fsQuad=new Un(this.material)}render(e,t,n){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=n.texture;if(this._fsQuad.material=this.material,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class il extends en{constructor(e,t){super();this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),s=e.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let r,o;if(this.inverse)r=0,o=1;else r=1,o=0;if(s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),s.buffers.stencil.setFunc(i.ALWAYS,r,4294967295),s.buffers.stencil.setClear(o),s.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear)e.clear();if(e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear)e.clear();e.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(i.EQUAL,1,4294967295),s.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),s.buffers.stencil.setLocked(!0)}}class zu extends en{constructor(){super();this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Fu{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new Ce);this._width=n.width,this._height=n.height,t=new St(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:zt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Du(lr),this.copyPass.material.blending=Sn,this.timer=new Ha}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);if(t!==-1)this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){if(this.timer.update(),e===void 0)e=this.timer.getDelta();let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,s=this.passes.length;i<s;i++){let r=this.passes[i];if(r.enabled===!1)continue;if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let o=this.renderer.getContext(),a=this.renderer.state.buffers.stencil;a.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),a.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}if(il!==void 0){if(r instanceof il)n=!0;else if(r instanceof zu)n=!1}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Ce);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class Uu extends en{constructor(e,t,n=null,i=null,s=null){super();this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new ae}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let s,r;if(this.overrideMaterial!==null)r=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha());if(this.clearAlpha!==null)s=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)e.clearDepth();if(e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);if(e.render(this.scene,this.camera),this.clearColor!==null)e.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)e.setClearAlpha(s);if(this.overrideMaterial!==null)this.scene.overrideMaterial=r;e.autoClear=i}}var T0={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new ae(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class gs extends en{constructor(e,t=1,n,i){super();this.strength=t,this.radius=n,this.threshold=i,this.resolution=e!==void 0?new Ce(e.x,e.y):new Ce(256,256),this.clearColor=new ae(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),r=Math.round(this.resolution.y/2);this.renderTargetBright=new St(s,r,{type:zt,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let d=0;d<this.nMips;d++){let c=new St(s,r,{type:zt,depthBuffer:!1});c.texture.name="UnrealBloomPass.h"+d,c.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(c);let h=new St(s,r,{type:zt,depthBuffer:!1});h.texture.name="UnrealBloomPass.v"+d,h.texture.generateMipmaps=!1,this.renderTargetsVertical.push(h),s=Math.round(s/2),r=Math.round(r/2)}let o=T0;this.highPassUniforms=Vt.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new He({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let a=[6,10,14,18,22];s=Math.round(this.resolution.x/2),r=Math.round(this.resolution.y/2);for(let d=0;d<this.nMips;d++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(a[d])),this.separableBlurMaterials[d].uniforms.invSize.value=new Ce(1/s,1/r),s=Math.round(s/2),r=Math.round(r/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let l=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new I(1,1,1),new I(1,1,1),new I(1,1,1),new I(1,1,1),new I(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Vt.clone(lr.uniforms),this.blendMaterial=new He({uniforms:this.copyUniforms,vertexShader:lr.vertexShader,fragmentShader:lr.fragmentShader,premultipliedAlpha:!0,blending:Or,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new ae,this._oldClearAlpha=1,this._basic=new At,this._fsQuad=new Un(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(n,i);for(let s=0;s<this.nMips;s++)this.renderTargetsHorizontal[s].setSize(n,i),this.renderTargetsVertical[s].setSize(n,i),this.separableBlurMaterials[s].uniforms.invSize.value=new Ce(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(e,t,n,i,s){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let r=e.autoClear;if(e.autoClear=!1,e.setClearColor(this.clearColor,0),s)e.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e);this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let a=0;a<this.nMips;a++)this._fsQuad.material=this.separableBlurMaterials[a],this.separableBlurMaterials[a].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[a].uniforms.direction.value=gs.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[a]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[a].uniforms.colorTexture.value=this.renderTargetsHorizontal[a].texture,this.separableBlurMaterials[a].uniforms.direction.value=gs.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[a]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[a];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s)e.state.buffers.stencil.setTest(!0);if(this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else e.setRenderTarget(n),this._fsQuad.render(e);e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=r}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(0.39894*Math.exp(-0.5*r*r/(n*n))/n);let i=[],s=[];for(let r=1;r<e;r+=2){let o=t[r],a=r+1<e?t[r+1]:0,l=o+a;i.push((r*o+(r+1)*a)/l),s.push(l)}return new He({defines:{KERNEL_PAIRS:i.length},uniforms:{colorTexture:{value:null},invSize:{value:new Ce(0.5,0.5)},direction:{value:new Ce(0.5,0.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:i},gaussianWeights:{value:s}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new He({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}gs.BlurDirectionX=new Ce(1,0);gs.BlurDirectionY=new Ce(0,1);var sl={name:"DigitalGlitch",uniforms:{tDiffuse:{value:null},tDisp:{value:null},byp:{value:0},amount:{value:0.08},angle:{value:0.02},seed:{value:0.02},seed_x:{value:0.02},seed_y:{value:0.02},distortion_x:{value:0.5},distortion_y:{value:0.6},col_s:{value:0.05}},vertexShader:`

		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		uniform int byp; //should we apply the glitch ?

		uniform sampler2D tDiffuse;
		uniform sampler2D tDisp;

		uniform float amount;
		uniform float angle;
		uniform float seed;
		uniform float seed_x;
		uniform float seed_y;
		uniform float distortion_x;
		uniform float distortion_y;
		uniform float col_s;

		varying vec2 vUv;


		float rand(vec2 co){
			return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}

		void main() {
			if(byp<1) {
				vec2 p = vUv;
				float xs = floor(gl_FragCoord.x / 0.5);
				float ys = floor(gl_FragCoord.y / 0.5);
				//based on staffantans glitch shader for unity https://github.com/staffantan/unityglitch
				float disp = texture2D(tDisp, p*seed*seed).r;
				if(p.y<distortion_x+col_s && p.y>distortion_x-col_s*seed) {
					if(seed_x>0.){
						p.y = 1. - (p.y + distortion_y);
					}
					else {
						p.y = distortion_y;
					}
				}
				if(p.x<distortion_y+col_s && p.x>distortion_y-col_s*seed) {
					if(seed_y>0.){
						p.x=distortion_x;
					}
					else {
						p.x = 1. - (p.x + distortion_x);
					}
				}
				p.x+=disp*seed_x*(seed/5.);
				p.y+=disp*seed_y*(seed/5.);
				//base from RGB shift shader
				vec2 offset = amount * vec2( cos(angle), sin(angle));
				vec4 cr = texture2D(tDiffuse, p + offset);
				vec4 cga = texture2D(tDiffuse, p);
				vec4 cb = texture2D(tDiffuse, p - offset);
				gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
				//add noise
				vec4 snow = 200.*amount*vec4(rand(vec2(xs * seed,ys * seed*50.))*0.2);
				gl_FragColor = gl_FragColor+ snow;
			}
			else {
				gl_FragColor=texture2D (tDiffuse, vUv);
			}
		}`};class Nu extends en{constructor(e=64){super();this.uniforms=Vt.clone(sl.uniforms),this.material=new He({uniforms:this.uniforms,vertexShader:sl.vertexShader,fragmentShader:sl.fragmentShader}),this.goWild=!1,this._heightMap=this._generateHeightmap(e),this.uniforms.tDisp.value=this._heightMap,this._fsQuad=new Un(this.material),this._curF=0,this._randX=0,this._generateTrigger()}render(e,t,n){if(this.uniforms.tDiffuse.value=n.texture,this.uniforms.seed.value=Math.random(),this.uniforms.byp.value=0,this._curF%this._randX==0||this.goWild==!0)this.uniforms.amount.value=Math.random()/30,this.uniforms.angle.value=Ke.randFloat(-Math.PI,Math.PI),this.uniforms.seed_x.value=Ke.randFloat(-1,1),this.uniforms.seed_y.value=Ke.randFloat(-1,1),this.uniforms.distortion_x.value=Ke.randFloat(0,1),this.uniforms.distortion_y.value=Ke.randFloat(0,1),this._curF=0,this._generateTrigger();else if(this._curF%this._randX<this._randX/5)this.uniforms.amount.value=Math.random()/90,this.uniforms.angle.value=Ke.randFloat(-Math.PI,Math.PI),this.uniforms.distortion_x.value=Ke.randFloat(0,1),this.uniforms.distortion_y.value=Ke.randFloat(0,1),this.uniforms.seed_x.value=Ke.randFloat(-0.3,0.3),this.uniforms.seed_y.value=Ke.randFloat(-0.3,0.3);else if(this.goWild==!1)this.uniforms.byp.value=1;if(this._curF++,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear();this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._heightMap.dispose(),this._fsQuad.dispose()}_generateTrigger(){this._randX=Ke.randInt(120,240)}_generateHeightmap(e){let t=new Float32Array(e*e),n=e*e;for(let s=0;s<n;s++){let r=Ke.randFloat(0,1);t[s]=r}let i=new di(t,e,e,ts,zn);return i.needsUpdate=!0,i}}var vo={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class Ou extends en{constructor(){super();this.isOutputPass=!0,this.uniforms=Vt.clone(vo.uniforms),this.material=new to({name:vo.name,uniforms:this.uniforms,vertexShader:vo.vertexShader,fragmentShader:vo.fragmentShader}),this._fsQuad=new Un(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){if(this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping){if(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ze.getTransfer(this._outputColorSpace)===ut)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===kr)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===Gr)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===Hr)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===Vr)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===jr)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===Xr)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===Wr)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}var xo={name:"SMAAEdgesShader",defines:{SMAA_THRESHOLD:"0.1"},uniforms:{tDiffuse:{value:null},resolution:{value:new Ce(0.0009765625,0.001953125)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		void SMAAEdgeDetectionVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAAEdgeDetectionVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {
			vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );

			// Calculate color deltas:
			vec4 delta;
			vec3 C = texture2D( colorTex, texcoord ).rgb;

			vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;
			vec3 t = abs( C - Cleft );
			delta.x = max( max( t.r, t.g ), t.b );

			vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;
			t = abs( C - Ctop );
			delta.y = max( max( t.r, t.g ), t.b );

			// We do the usual threshold:
			vec2 edges = step( threshold, delta.xy );

			// Then discard if there is no edge:
			if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )
				discard;

			// Calculate right and bottom deltas:
			vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;
			t = abs( C - Cright );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;
			t = abs( C - Cbottom );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the maximum delta in the direct neighborhood:
			float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );

			// Calculate left-left and top-top deltas:
			vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;
			t = abs( C - Cleftleft );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;
			t = abs( C - Ctoptop );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the final maximum delta:
			maxDelta = max( max( maxDelta, delta.z ), delta.w );

			// Local contrast adaptation in action:
			edges.xy *= step( 0.5 * maxDelta, delta.xy );

			return vec4( edges, 0.0, 0.0 );
		}

		void main() {

			gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );

		}`},bo={name:"SMAAWeightsShader",defines:{SMAA_MAX_SEARCH_STEPS:"8",SMAA_AREATEX_MAX_DISTANCE:"16",SMAA_AREATEX_PIXEL_SIZE:"( 1.0 / vec2( 160.0, 560.0 ) )",SMAA_AREATEX_SUBTEX_SIZE:"( 1.0 / 7.0 )"},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new Ce(0.0009765625,0.001953125)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];
		varying vec2 vPixcoord;

		void SMAABlendingWeightCalculationVS( vec2 texcoord ) {
			vPixcoord = texcoord / resolution;

			// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 ); // WebGL port note: Changed sign in Y and W components
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 ); // WebGL port note: Changed sign in Y and W components

			// And these for the searches, they indicate the ends of the loops:
			vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );

		}

		void main() {

			vUv = uv;

			SMAABlendingWeightCalculationVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )

		uniform sampler2D tDiffuse;
		uniform sampler2D tArea;
		uniform sampler2D tSearch;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[3];
		varying vec2 vPixcoord;

		#if __VERSION__ == 100
		vec2 round( vec2 x ) {
			return sign( x ) * floor( abs( x ) + 0.5 );
		}
		#endif

		float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {
			// Not required if searchTex accesses are set to point:
			// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
			// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
			//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
			e.r = bias + e.r * scale;
			return 255.0 * texture2D( searchTex, e, 0.0 ).r;
		}

		float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			/**
				* @PSEUDO_GATHER4
				* This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
				* sample between edge, thus fetching four edges in a row.
				* Sampling with different offsets in each direction allows to disambiguate
				* which edges are active from the four fetched ones.
				*/
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			// We correct the previous (-0.25, -0.125) offset we applied:
			texcoord.x += 0.25 * resolution.x;

			// The searches are bias by 1, so adjust the coords accordingly:
			texcoord.x += resolution.x;

			// Disambiguate the length added by the last step:
			texcoord.x += 2.0 * resolution.x; // Undo last step
			texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);

			return texcoord.x;
		}

		float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			texcoord.x -= 0.25 * resolution.x;
			texcoord.x -= resolution.x;
			texcoord.x -= 2.0 * resolution.x;
			texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );

			return texcoord.x;
		}

		float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y -= 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y; // WebGL port note: Changed sign
			texcoord.y -= 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y += 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y; // WebGL port note: Changed sign
			texcoord.y += 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {
			// Rounding prevents precision errors of bilinear filtering:
			vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;

			// We do a scale and bias for mapping to texel space:
			texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );

			// Move to proper place, according to the subpixel offset:
			texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

			return texture2D( areaTex, texcoord, 0.0 ).rg;
		}

		vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {
			vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );

			vec2 e = texture2D( edgesTex, texcoord ).rg;

			if ( e.g > 0.0 ) { // Edge at north
				vec2 d;

				// Find the distance to the left:
				vec2 coords;
				coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );
				coords.y = offset[ 1 ].y; // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
				d.x = coords.x;

				// Now fetch the left crossing edges, two at a time using bilinear
				// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
				// discern what value each edge has:
				float e1 = texture2D( edgesTex, coords, 0.0 ).r;

				// Find the distance to the right:
				coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );
				d.y = coords.x;

				// We want the distances to be in pixel units (doing this here allow to
				// better interleave arithmetic and memory accesses):
				d = d / resolution.x - pixcoord.x;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the right crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;

				// Ok, we know how this pattern looks like, now it is time for getting
				// the actual area:
				weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );
			}

			if ( e.r > 0.0 ) { // Edge at west
				vec2 d;

				// Find the distance to the top:
				vec2 coords;

				coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );
				coords.x = offset[ 0 ].x; // offset[1].x = texcoord.x - 0.25 * resolution.x;
				d.x = coords.y;

				// Fetch the top crossing edges:
				float e1 = texture2D( edgesTex, coords, 0.0 ).g;

				// Find the distance to the bottom:
				coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );
				d.y = coords.y;

				// We want the distances to be in pixel units:
				d = d / resolution.y - pixcoord.y;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the bottom crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;

				// Get the area for this direction:
				weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );
			}

			return weights;
		}

		void main() {

			gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );

		}`},rl={name:"SMAABlendShader",uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new Ce(0.0009765625,0.001953125)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		void SMAANeighborhoodBlendingVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAANeighborhoodBlendingVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform sampler2D tColor;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {
			// Fetch the blending weights for current pixel:
			vec4 a;
			a.xz = texture2D( blendTex, texcoord ).xz;
			a.y = texture2D( blendTex, offset[ 1 ].zw ).g;
			a.w = texture2D( blendTex, offset[ 1 ].xy ).a;

			// Is there any blending weight with a value greater than 0.0?
			if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {
				return texture2D( colorTex, texcoord, 0.0 );
			} else {
				// Up to 4 lines can be crossing a pixel (one through each edge). We
				// favor blending by choosing the line with the maximum weight for each
				// direction:
				vec2 offset;
				offset.x = a.a > a.b ? a.a : -a.b; // left vs. right
				offset.y = a.g > a.r ? -a.g : a.r; // top vs. bottom // WebGL port note: Changed signs

				// Then we go in the direction that has the maximum weight:
				if ( abs( offset.x ) > abs( offset.y )) { // horizontal vs. vertical
					offset.y = 0.0;
				} else {
					offset.x = 0.0;
				}

				// Fetch the opposite color and lerp by hand:
				vec4 C = texture2D( colorTex, texcoord, 0.0 );
				texcoord += sign( offset ) * resolution;
				vec4 Cop = texture2D( colorTex, texcoord, 0.0 );
				float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );

				// WebGL port note: Added gamma correction
				C.xyz = pow(C.xyz, vec3(2.2));
				Cop.xyz = pow(Cop.xyz, vec3(2.2));
				vec4 mixed = mix(C, Cop, s);
				mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));

				return mixed;
			}
		}

		void main() {

			gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );

		}`};class Bu extends en{constructor(){super();this._edgesRT=new St(1,1,{depthBuffer:!1,type:zt}),this._edgesRT.texture.name="SMAAPass.edges",this._weightsRT=new St(1,1,{depthBuffer:!1,type:zt}),this._weightsRT.texture.name="SMAAPass.weights";let e=this,t=new Image;t.src=this._getAreaTexture(),t.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new Nt,this._areaTexture.name="SMAAPass.area",this._areaTexture.image=t,this._areaTexture.minFilter=qt,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let n=new Image;n.src=this._getSearchTexture(),n.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new Nt,this._searchTexture.name="SMAAPass.search",this._searchTexture.image=n,this._searchTexture.magFilter=Yt,this._searchTexture.minFilter=Yt,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=Vt.clone(xo.uniforms),this._materialEdges=new He({defines:Object.assign({},xo.defines),uniforms:this._uniformsEdges,vertexShader:xo.vertexShader,fragmentShader:xo.fragmentShader}),this._uniformsWeights=Vt.clone(bo.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new He({defines:Object.assign({},bo.defines),uniforms:this._uniformsWeights,vertexShader:bo.vertexShader,fragmentShader:bo.fragmentShader}),this._uniformsBlend=Vt.clone(rl.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new He({uniforms:this._uniformsBlend,vertexShader:rl.vertexShader,fragmentShader:rl.fragmentShader}),this._fsQuad=new Un(null)}render(e,t,n){if(this._uniformsEdges.tDiffuse.value=n.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear)e.clear();if(this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear)e.clear();if(this._fsQuad.render(e),this._uniformsBlend.tColor.value=n.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear();this._fsQuad.render(e)}}setSize(e,t){this._edgesRT.setSize(e,t),this._weightsRT.setSize(e,t),this._materialEdges.uniforms.resolution.value.set(1/e,1/t),this._materialWeights.uniforms.resolution.value.set(1/e,1/t),this._materialBlend.uniforms.resolution.value.set(1/e,1/t)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return"data:image/png;base64,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"}_getSearchTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII="}}var dA=4;class ku{renderer;composer;renderPass;bloomPass;glitchPass;outputPass;glitchDurationMs;glitchElapsed=0;glitchActive=!1;msaaTarget=null;aa;smaaPass=null;reducedMotion=typeof window<"u"&&typeof window.matchMedia==="function"?window.matchMedia("(prefers-reduced-motion: reduce)"):null;onReducedMotionChange=()=>{if(this.reducedMotion?.matches)this.glitchActive=!1,this.glitchPass.enabled=!1};bloomOn=!0;bloomScale=1;scene;camera;width;height;pixelRatio;constructor(e,t,n,i,s,r,o={samples:dA,byteTarget:!1,resolveDepth:!0,smaa:!1}){this.renderer=e;this.glitchDurationMs=i.camera.glitchMs,this.scene=t,this.camera=n,this.width=s,this.height=r,this.pixelRatio=e.getPixelRatio(),this.aa={...o},this.build(),this.reducedMotion?.addEventListener("change",this.onReducedMotionChange)}build(){let e=this.renderer,t;this.msaaTarget=null;let n=this.aa.smaa?0:this.aa.samples;if(n>0){let i=this.pixelRatio;t=new St(Math.max(1,Math.floor(this.width*i)),Math.max(1,Math.floor(this.height*i)),{type:this.aa.byteTarget?Kt:zt,colorSpace:this.aa.byteTarget?Aa:void 0,samples:n,resolveDepthBuffer:this.aa.resolveDepth,storeMultisampledDepthBuffer:this.aa.resolveDepth})}if(this.composer=new Fu(e,t),n>0)this.msaaTarget=this.composer.readBuffer,this.composer.writeBuffer.samples=0;if(this.renderPass=new Uu(this.scene,this.camera),this.composer.addPass(this.renderPass),this.bloomPass=new gs(new Ce(this.width,this.height),Qg,$g,Zg),this.bloomPass.enabled=this.bloomOn,this.composer.addPass(this.bloomPass),this.glitchPass=new Nu,this.glitchPass.goWild=!0,this.glitchPass.enabled=!1,this.glitchActive=!1,this.composer.addPass(this.glitchPass),this.outputPass=new Ou,this.composer.addPass(this.outputPass),this.smaaPass=null,this.aa.smaa)this.smaaPass=new Bu,this.composer.addPass(this.smaaPass);this.composer.setPixelRatio(this.pixelRatio),this.composer.setSize(this.width,this.height),this.applyBloomSize()}applyBloomSize(){if(this.bloomScale===1)return;let e=this.pixelRatio*this.bloomScale;this.bloomPass.setSize(Math.max(2,Math.floor(this.width*e)),Math.max(2,Math.floor(this.height*e)))}teardown(){this.renderPass.dispose(),this.bloomPass.dispose(),this.glitchPass.dispose(),this.outputPass.dispose(),this.smaaPass?.dispose(),this.composer.dispose()}setAa(e){let t=this.aa;if(t.samples===e.samples&&t.byteTarget===e.byteTarget&&t.resolveDepth===e.resolveDepth&&t.smaa===e.smaa)return;this.aa={...e},this.teardown(),this.build()}aaLabel(){let e=this.aa;if(e.smaa)return"SMAA";if(e.samples<=0)return"off";return`MSAA${e.samples} ${e.byteTarget?"8bit":"half"}${e.resolveDepth?"":" nodepthresolve"}`}setBloomScale(e){if(e===this.bloomScale)return;this.bloomScale=e,this.composer.setSize(this.width,this.height),this.applyBloomSize()}setBloom(e){this.bloomOn=e,this.bloomPass.enabled=e}attach(e,t,n){this.scene=e,this.camera=t,this.renderPass.scene=e,this.renderPass.camera=t,this.glitchDurationMs=n.camera.glitchMs,this.glitchActive=!1,this.glitchPass.enabled=!1}detach(){this.glitchActive=!1,this.glitchPass.enabled=!1}resize(e,t,n){this.width=e,this.height=t,this.pixelRatio=n,this.composer.setPixelRatio(n),this.composer.setSize(e,t),this.applyBloomSize()}triggerGlitch(){if(this.reducedMotion?.matches)return;this.glitchActive=!0,this.glitchElapsed=0,this.glitchPass.enabled=!0}render(e){if(this.glitchActive){if(this.glitchElapsed+=e,this.glitchElapsed>=this.glitchDurationMs)this.glitchActive=!1,this.glitchPass.enabled=!1}if(this.composer.render(e/1000),this.msaaTarget&&this.composer.readBuffer!==this.msaaTarget)this.composer.swapBuffers()}dispose(){this.reducedMotion?.removeEventListener("change",this.onReducedMotionChange),this.teardown()}}var A0=!0,cA=20,Hu=0.6,Vu=12,Wu=40,ju=2.5,R0=0.5,uA=1.5,C0=0.03,hA=0.7,Gu=12,Xu=`
attribute float aMajor;
varying float vMajor;
varying float vDist;
void main() {
  vMajor = aMajor;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDist = distance(world.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`,Ju=`
uniform vec3 uColor;
uniform float uMinor;
uniform float uMajor;
uniform float uFalloff;
uniform float uFloor;
uniform float uNearFade;
varying float vMajor;
varying float vDist;
void main() {
  float base = mix(uMinor, uMajor, vMajor);
  float depthFade = uFloor + (1.0 - uFloor) * exp(-vDist / uFalloff);
  float nearFade = smoothstep(0.0, uNearFade, vDist);
  gl_FragColor = vec4(uColor, base * depthFade * nearFade);
}
`;class Yu{scene;edges=[];edgeGeometry=null;edgeMaterial=null;marks=[];markPos=[];markMaterial=null;markHalf=R0;markX=NaN;markY=NaN;markZ=NaN;currentSize=-1;flat=!1;constructor(e){this.scene=e}setSize(e){if(e===this.currentSize)return;if(this.currentSize=e,this.disposeAll(),this.buildEdges(e),A0)this.buildMarks(e);this.flat=!1}buildEdges(e){let t=Math.min(Cg,Math.max(Rg,e*Ag)),n=e+t,i=new Zt(1,1,1),s=new At({color:lo,fog:!1});this.edgeGeometry=i,this.edgeMaterial=s;let r=-0.5,o=e-0.5;for(let a=0;a<3;a++){let l=(a+1)%3,d=(a+2)%3;for(let c=0;c<2;c++)for(let h=0;h<2;h++){let u=new nt(i,s),p=[t,t,t];p[a]=n,u.scale.set(p[0],p[1],p[2]);let g=[0,0,0];g[a]=(e-1)/2,g[l]=c===0?r:o,g[d]=h===0?r:o,u.position.set(g[0],g[1],g[2]),u.frustumCulled=!1,this.edges.push(u),this.scene.add(u)}}}buildMarks(e){this.markHalf=e<=cA?R0:uA;let t=new He({uniforms:{uColor:{value:lu},uMinor:{value:Lg},uMajor:{value:Pg},uFalloff:{value:Math.min(Wu,Math.max(Vu,e*Hu))},uFloor:{value:hA},uNearFade:{value:ju}},vertexShader:Xu,fragmentShader:Ju,transparent:!0,depthWrite:!1});this.markMaterial=t;let n=new Float32Array(Gu);for(let i=4;i<Gu;i++)n[i]=1;for(let i=0;i<6;i++){let s=new Float32Array(Gu*3),r=new Qe;r.setAttribute("position",new Oe(s,3)),r.setAttribute("aMajor",new Oe(n,1));let o=new wn(r,t);o.frustumCulled=!1,o.renderOrder=1,this.marks.push(o),this.markPos.push(s),this.scene.add(o)}this.markX=NaN}writeMark(e,t,n,i,s){let r=this.markPos[e],o=(t+1)%3,a=(t+2)%3,l=-0.5,d=this.currentSize-0.5,c=n===0?-0.5+C0:d-C0,h=this.markHalf,u=0;for(let g=0;g<6;g++){let x,m,f,T;switch(g){case 0:x=-0.5,m=s,f=d,T=s;break;case 1:x=i,m=-0.5,f=i,T=d;break;case 2:x=i-h,m=s-h,f=i+h,T=s-h;break;case 3:x=i+h,m=s-h,f=i+h,T=s+h;break;case 4:x=i+h,m=s+h,f=i-h,T=s+h;break;default:x=i-h,m=s+h,f=i-h,T=s-h;break}for(let E=0;E<2;E++)r[u+t]=c,r[u+o]=E===0?x:f,r[u+a]=E===0?m:T,u+=3}let p=this.marks[e].geometry.getAttribute("position");p.needsUpdate=!0}update(e,t,n,i,s,r,o,a){if(a!==this.flat){this.flat=a;for(let c=0;c<this.edges.length;c++)this.edges[c].visible=!a;if(a)for(let c=0;c<this.marks.length;c++)this.marks[c].visible=!1}if(a)return;if(this.edges.length===0||!A0)return;let l=this.currentSize-0.5,d=i<0.5;for(let c=0;c<3;c++){let h=c===0?e:c===1?t:n,u=!(d&&h<-0.5),p=!(d&&h>l);this.marks[c*2].visible=u,this.marks[c*2+1].visible=p}if(s!==this.markX||r!==this.markY||o!==this.markZ){this.markX=s,this.markY=r,this.markZ=o;for(let c=0;c<3;c++){let h=c===0?r:c===1?o:s,u=c===0?o:c===1?s:r;this.writeMark(c*2,c,0,h,u),this.writeMark(c*2+1,c,1,h,u)}}}disposeAll(){for(let e of this.edges)this.scene.remove(e);this.edges.length=0,this.edgeGeometry?.dispose(),this.edgeGeometry=null,this.edgeMaterial?.dispose(),this.edgeMaterial=null;for(let e of this.marks)this.scene.remove(e),e.geometry.dispose();this.marks.length=0,this.markPos.length=0,this.markMaterial?.dispose(),this.markMaterial=null}dispose(){this.disposeAll(),this.currentSize=-1}}class Di{scene;geometry;material;_mesh;constructor(e,t,n,i){this.scene=e,this.geometry=t,this.material=n,this._mesh=this.createMesh(Math.max(1,i)),this.scene.add(this._mesh)}get mesh(){return this._mesh}get capacity(){return this._mesh.instanceMatrix.count}ensureCapacity(e){if(e<=this.capacity)return;let t=Math.max(e,this.capacity*2),n=this.createMesh(t);this.scene.remove(this._mesh),this._mesh.dispose(),this._mesh=n,this.scene.add(this._mesh)}setCount(e){this._mesh.count=e}setInstance(e,t,n){this._mesh.setMatrixAt(e,t),this._mesh.setColorAt(e,n)}markDirty(){if(this._mesh.instanceMatrix.needsUpdate=!0,this._mesh.instanceColor)this._mesh.instanceColor.needsUpdate=!0}dispose(){this.scene.remove(this._mesh),this._mesh.dispose(),this.geometry.dispose(),this.material.dispose()}createMesh(e){let t=new tr(this.geometry,this.material,e);return t.count=0,t.frustumCulled=!1,t}}var L0=0.09,pA=0.55,P0=0.6,I0=3,fA=0.17,mA=0.42,gA=8,vA=1.8,xA=0.000001;class qu{links;arrows;m=new Je;q=new Pt;pos=new I;dir=new I;scl=new I;color=new ae;zAxis=new I(0,0,1);white=new ae(1,1,1);constructor(e){this.links=new Di(e,new Zt(1,1,1),new At,8);let t=new ci(fA,mA,gA,1);t.rotateX(Math.PI/2),this.arrows=new Di(e,t,new At,I0)}ensureCapacity(e){this.links.ensureCapacity(Math.max(1,e-1))}update(e,t,n,i,s,r,o,a){let l=Math.max(0,e-1);this.links.setCount(l);let d=Math.max(0,l-I0);this.arrows.setCount(Math.max(0,l-d));for(let c=0;c<l;c++){let h=t[c],u=n[c],p=i[c],g=t[c+1],x=n[c+1],m=i[c+1];this.dir.set(h-g,u-x,p-m);let f=this.dir.length(),T=Math.min(s[c],s[c+1]);if(this.color.setRGB(r[c+1],o[c+1],a[c+1]).lerp(this.white,pA),f<xA){this.m.makeScale(0,0,0),this.links.mesh.setMatrixAt(c,this.m),this.links.mesh.setColorAt(c,this.color);continue}if(this.dir.divideScalar(f),this.q.setFromUnitVectors(this.zAxis,this.dir),this.pos.set((h+g)/2,(u+x)/2,(p+m)/2),this.scl.set(L0*T,L0*T,f),this.m.compose(this.pos,this.q,this.scl),this.links.mesh.setMatrixAt(c,this.m),this.links.mesh.setColorAt(c,this.color.multiplyScalar(P0)),c>=d){this.scl.set(T,T,T),this.m.compose(this.pos,this.q,this.scl);let E=c-d;this.arrows.mesh.setMatrixAt(E,this.m),this.arrows.mesh.setColorAt(E,this.color.multiplyScalar(vA/P0))}}this.links.markDirty(),this.arrows.markDirty()}dispose(){this.links.dispose(),this.arrows.dispose()}}function ol(e,t=!1){let n=e[0].index!==null,i=new Set(Object.keys(e[0].attributes)),s=new Set(Object.keys(e[0].morphAttributes)),r={},o={},a=e[0].morphTargetsRelative,l=new Qe,d=0;for(let c=0;c<e.length;++c){let h=e[c],u=0;if(n!==(h.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let p in h.attributes){if(!i.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+'. All geometries must have compatible attributes; make sure "'+p+'" attribute exists among all geometries, or in none of them.'),null;if(r[p]===void 0)r[p]=[];r[p].push(h.attributes[p]),u++}if(u!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". Make sure all geometries have the same number of attributes."),null;if(a!==h.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let p in h.morphAttributes){if(!s.has(p))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+".  .morphAttributes must be consistent throughout all geometries."),null;if(o[p]===void 0)o[p]=[];o[p].push(h.morphAttributes[p])}if(t){let p;if(n)p=h.index.count;else if(h.attributes.position!==void 0)p=h.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+c+". The geometry must have either an index or a position attribute"),null;l.addGroup(d,p,c),d+=p}}if(n){let c=0,h=[];for(let u=0;u<e.length;++u){let p=e[u].index;for(let g=0;g<p.count;++g)h.push(p.getX(g)+c);c+=e[u].attributes.position.count}l.setIndex(h)}for(let c in r){let h=D0(r[c]);if(!h)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+c+" attribute."),null;l.setAttribute(c,h)}for(let c in o){let h=o[c][0].length;if(h===0)continue;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[c]=[];for(let u=0;u<h;++u){let p=[];for(let x=0;x<o[c].length;++x)p.push(o[c][x][u]);let g=D0(p);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+c+" morphAttribute."),null;l.morphAttributes[c].push(g)}}return l}function D0(e){let t,n,i,s=-1,r=0;for(let d=0;d<e.length;++d){let c=e[d];if(t===void 0)t=c.array.constructor;if(t!==c.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(n===void 0)n=c.itemSize;if(n!==c.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0)i=c.normalized;if(i!==c.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1)s=c.gpuType;if(s!==c.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=c.count*n}let o=new t(r),a=new _t(o,n,i),l=0;for(let d=0;d<e.length;++d){let c=e[d];if(c.isInterleavedBufferAttribute){let h=l/n;for(let u=0,p=c.count;u<p;u++)for(let g=0;g<n;g++){let x=c.getComponent(u,g);a.setComponent(u+h,g,x)}}else o.set(c.array,l);l+=c.count*n}if(s!==void 0)a.gpuType=s;return a}function yo(e){let t=[],n=[-e,e];for(let i of n)for(let s of n)t.push(-e,i,s,e,i,s),t.push(i,-e,s,i,e,s),t.push(i,s,-e,i,s,e);return t}function al(e,t,n){let i=[],s=(r)=>{let o=r/t*Math.PI*2,a=Math.cos(o)*e,l=Math.sin(o)*e;return n===0?[0,a,l]:n===1?[a,0,l]:[a,l,0]};for(let r=0;r<t;r++){let o=s(r),a=s(r+1);i.push(o[0],o[1],o[2],a[0],a[1],a[2])}return i}function z0(e){let t=(i)=>[[i*e,i*e,i*e],[i*e,-i*e,-i*e],[-i*e,i*e,-i*e],[-i*e,-i*e,i*e]],n=[];for(let i of[1,-1]){let s=t(i);for(let r=0;r<4;r++)for(let o=r+1;o<4;o++)n.push(...s[r],...s[o])}return n}function F0(e){let t=new Pt().setFromUnitVectors(new I(1,1,1).normalize(),new I(0,0,1)),n=new I,i=[];for(let s=0;s+2<e.length;s+=3)n.set(e[s],e[s+1],e[s+2]).applyQuaternion(t),i.push(n.x,n.y,n.z);return i}function _o(e,t){let n=[],i=new I,s=new I,r=new I,o=new I,a=new Pt,l=new Je,d=new I(1,1,1),c=new I(0,0,1);for(let u=0;u+5<e.length;u+=6){i.set(e[u],e[u+1],e[u+2]),s.set(e[u+3],e[u+4],e[u+5]),r.subVectors(s,i);let p=r.length();r.divideScalar(p),o.addVectors(i,s).multiplyScalar(0.5),a.setFromUnitVectors(c,r),l.compose(o,a,d);let g=new Zt(t,t,p+t);g.applyMatrix4(l),g.deleteAttribute("uv"),g.deleteAttribute("normal"),n.push(g)}let h=ol(n,!1);for(let u of n)u.dispose();return h}var U0=0.86,bA=0.4,N0=0.1,yA=0.05,O0=1600,B0=1100,_A=0.06,SA=0.08,MA=0.9,wA=1.5,EA=0.1;function TA(e=mt.snakeView){return e.bodyScale}var AA=TA();function RA(e,t,n){return(1+e)*Ke.lerp(1,n,t)}class Ku{pool;matrix=new Je;color=new ae;denom=1;px=new Float32Array(0);py=new Float32Array(0);pz=new Float32Array(0);gx=new Float32Array(0);gy=new Float32Array(0);gz=new Float32Array(0);gk=new Float32Array(0);cr=new Float32Array(0);cg=new Float32Array(0);cb=new Float32Array(0);guides;headMesh;headMaterial;headDir=new I(1,0,0);signalCfg;sigState=null;sigStep=-1;sigHx=0;sigHy=0;sigHz=0;sigAx=-1;sigAy=-1;sigAz=-1;crashIn=0;goal=!1;goalAmount=0;dangerAmount=0;nearAmount=0;reducedMotion=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;lastElapsed=-1;headColor=new ae;tint=new ae;get direction(){return this.headDir}headX=0;headY=0;headZ=0;camX=0;camY=0;camZ=0;fadeAmount=0;fogK=0;fogLum=0;collect=(e,t,n,i)=>{this.px[i]=e,this.py[i]=t,this.pz[i]=n};ensureBuffers(e){if(this.px.length>=e)return;let t=Math.max(e,this.px.length*2,8);this.px=new Float32Array(t),this.py=new Float32Array(t),this.pz=new Float32Array(t),this.gx=new Float32Array(t),this.gy=new Float32Array(t),this.gz=new Float32Array(t),this.gk=new Float32Array(t),this.cr=new Float32Array(t),this.cg=new Float32Array(t),this.cb=new Float32Array(t)}place(e,t,n){let i=e+1<t?e+1:e,s=this.px[i]+(this.px[e]-this.px[i])*n,r=this.py[i]+(this.py[e]-this.py[i])*n,o=this.pz[i]+(this.pz[e]-this.pz[i])*n;if(this.gx[e]=s,this.gy[e]=r,this.gz[e]=o,this.gk[e]=1,e===0){this.headX=s,this.headY=r,this.headZ=o;return}let a=AA,l=e<=hu,d=s-this.camX,c=r-this.camY,h=o-this.camZ,u=Math.sqrt(d*d+c*c+h*h);if(this.fadeAmount>0){let E=Ke.smoothstep(u,MA,wA);a*=Ke.lerp(1,Ke.lerp(EA,1,E),this.fadeAmount)}this.gk[e]=a;let p=e-1;this.matrix.makeScale(a,a,a).setPosition(s,r,o),this.pool.mesh.setMatrixAt(p,this.matrix),this.color.copy(co);let g=e/this.denom;if(!l)this.color.lerp(uo,g);let x=l?Ke.lerp(pu,uu,Ke.smoothstep(u,fu,mu)):Ke.lerp(du,cu,g),m=1-Math.exp(-this.fogK*u*u),f=Math.max(0,(x-m*this.fogLum)/Math.max(1-m,0.02)),T=Ja(this.color.r,this.color.g,this.color.b);this.color.multiplyScalar(T>0.000001?Math.min(qa,f/T):qa),this.cr[e]=this.color.r,this.cg[e]=this.color.g,this.cb[e]=this.color.b,this.pool.mesh.setColorAt(p,this.color)}constructor(e,t=mt.headSignal,n="classic"){this.signalCfg=t,this.guides=n==="tailGuides"?new qu(e):null;let i=_o(yo(U0/2),N0),s=new At;this.pool=new Di(e,i,s,8);let r=_o(yo(U0/2),N0);this.headMaterial=new At({color:Fn.clone().multiplyScalar(Qa),fog:!1}),this.headMesh=new nt(r,this.headMaterial),this.headMesh.frustumCulled=!1,e.add(this.headMesh),this.scene=e}scene;ensureCapacity(e){this.pool.ensureCapacity(Math.max(1,ln(e)-1)),this.guides?.ensureCapacity(ln(e))}update(e,t,n,i,s){let r=ln(e);this.pool.setCount(Math.max(0,r-1)),this.denom=Math.max(1,r-1),this.camX=t,this.camY=n,this.camZ=i,this.fadeAmount=s;let o=this.scene.fog;if(o instanceof ss)this.fogK=o.density*o.density,this.fogLum=Ja(o.color.r,o.color.g,o.color.b);else this.fogK=0;this.ensureBuffers(r),_i(e,this.collect);let a=Ke.smoothstep(rf(e),0,bA);for(let d=0;d<r;d++)this.place(d,r,a);this.pool.markDirty(),this.guides?.update(r,this.gx,this.gy,this.gz,this.gk,this.cr,this.cg,this.cb);let l=Vo(e);this.headDir.set(l.x,l.y,l.z),this.updateSignals(e,l.x,l.y,l.z),this.headMesh.position.set(this.headX,this.headY,this.headZ)}updateSignals(e,t,n,i){let s=e.apple;if(e!==this.sigState||e.stepCount!==this.sigStep||t!==this.sigHx||n!==this.sigHy||i!==this.sigHz||s.x!==this.sigAx||s.y!==this.sigAy||s.z!==this.sigAz){this.sigState=e,this.sigStep=e.stepCount,this.sigHx=t,this.sigHy=n,this.sigHz=i,this.sigAx=s.x,this.sigAy=s.y,this.sigAz=s.z;let m=this.signalCfg.dangerHorizon;this.crashIn=af(e,m),this.goal=this.crashIn===0&&lf(e)}let r=$n(e),o=this.lastElapsed<0?0:Math.max(0,r-this.lastElapsed);this.lastElapsed=r;let a=o/Math.max(1,this.signalCfg.riseMs),l=o/Math.max(1,this.signalCfg.fallMs),d=this.crashIn>0;this.dangerAmount=d?Math.min(1,this.dangerAmount+a):Math.max(0,this.dangerAmount-l);let c=this.goal&&!d;this.goalAmount=c?Math.min(1,this.goalAmount+a):Math.max(0,this.goalAmount-l),this.nearAmount=this.crashIn===1?Math.min(1,this.nearAmount+a):Math.max(0,this.nearAmount-l);let h=this.reducedMotion!==null&&this.reducedMotion.matches,u=h?0:Math.sin(r%O0/O0*Math.PI*2),p=h?0:Math.sin(r%B0/B0*Math.PI*2),g=Ke.lerp(yA*u,_A*p,this.dangerAmount);this.headMesh.scale.setScalar(RA(g,this.goalAmount,this.signalCfg.goalScale));let x=this.headColor.copy(Fn).multiplyScalar(Qa);if(this.goalAmount>0)x.lerp(this.tint.copy(Wg).multiplyScalar(Su),this.goalAmount);if(this.dangerAmount>0)this.tint.copy(Mu).lerp(wu,this.nearAmount).multiplyScalar(1+SA*p),x.lerp(this.tint,this.dangerAmount);this.headMaterial.color.copy(x)}dispose(){this.pool.dispose(),this.guides?.dispose(),this.scene.remove(this.headMesh),this.headMesh.geometry.dispose(),this.headMaterial.dispose()}}function Zu(e,t,n){let i=(p,g,x)=>p+t*(g+t*x),s=(p,g,x)=>p>=0&&g>=0&&x>=0&&p<t&&g<t&&x<t&&e.has(i(p,g,x)),r=[],o=[],a=new Set,l=2*t+3,d=[0,0,0],c=[0,0,0],h=[0,0,0],u=[0,0,0];for(let p of e){d[0]=p%t,d[1]=Math.floor(p/t)%t,d[2]=Math.floor(p/(t*t));for(let g=0;g<6;g++){let x=g>>1,m=g&1?-1:1;if(h[0]=h[1]=h[2]=0,h[x]=m,s(d[0]+h[0],d[1]+h[1],d[2]+h[2]))continue;let f=0,T=1;for(let E=1;E<=2;E++){let b=(x+E)%3;for(let S=1;S>=-1;S-=2){u[0]=u[1]=u[2]=0,u[b]=S;let A=d[0]+u[0],y=d[1]+u[1],v=d[2]+u[2],_=s(A+h[0],y+h[1],v+h[2]),z=s(A,y,v)?_?2:1:_?2:0;f+=z*T,T*=3}}r.push(d[0],d[1],d[2],g+6*f);for(let E=1;E<=2;E++){let b=(x+E)%3,S=3-x-b;for(let A=-1;A<=1;A+=2){u[0]=u[1]=u[2]=0,u[b]=A;let y=d[0]+u[0],v=d[1]+u[1],_=d[2]+u[2];if(s(y,v,_)&&!s(y+h[0],v+h[1],_+h[2]))continue;let z=2*d[0]+h[0]+u[0],P=2*d[1]+h[1]+u[1],D=2*d[2]+h[2]+u[2],N=((z+1)*l+(P+1))*l+(D+1);if(a.has(N))continue;a.add(N),c[0]=d[0]+(h[0]+u[0])*n,c[1]=d[1]+(h[1]+u[1])*n,c[2]=d[2]+(h[2]+u[2])*n,o.push(c[0],c[1],c[2],S)}}}}return{faces:new Float32Array(r),edges:new Float32Array(o),faceCount:r.length/4,edgeCount:o.length/4}}function k0(e,t,n,i,s){return Math.floor(e/i)+s*(Math.floor(t/i)+s*Math.floor(n/i))}function Qu(e,t,n,i,s,r){let o=Math.max(1,Math.ceil(s/r)),a=o*o*o,l=new Int32Array(a+1),d=new Int32Array(a+1),c=new Int32Array(t),h=new Int32Array(i);for(let y=0;y<t;y++){let v=k0(e[y*4],e[y*4+1],e[y*4+2],r,o);c[y]=v,l[v+1]++}for(let y=0;y<i;y++){let v=k0(Math.round(n[y*4]),Math.round(n[y*4+1]),Math.round(n[y*4+2]),r,o);h[y]=v,d[v+1]++}for(let y=0;y<a;y++)l[y+1]+=l[y],d[y+1]+=d[y];let u=new Float32Array(t*4),p=new Float32Array(i*4),g=l.slice(0,a),x=d.slice(0,a),m=new Float32Array(a).fill(1/0),f=new Float32Array(a).fill(1/0),T=new Float32Array(a).fill(1/0),E=new Float32Array(a).fill(-1/0),b=new Float32Array(a).fill(-1/0),S=new Float32Array(a).fill(-1/0);for(let y=0;y<t;y++){let v=c[y],_=g[v]++*4,z=e[y*4],P=e[y*4+1],D=e[y*4+2];if(u[_]=z,u[_+1]=P,u[_+2]=D,u[_+3]=e[y*4+3],z<m[v])m[v]=z;if(P<f[v])f[v]=P;if(D<T[v])T[v]=D;if(z>E[v])E[v]=z;if(P>b[v])b[v]=P;if(D>S[v])S[v]=D}for(let y=0;y<i;y++){let v=h[y],_=x[v]++*4;p[_]=n[y*4],p[_+1]=n[y*4+1],p[_+2]=n[y*4+2],p[_+3]=n[y*4+3];let z=Math.round(n[y*4]),P=Math.round(n[y*4+1]),D=Math.round(n[y*4+2]);if(z<m[v])m[v]=z;if(P<f[v])f[v]=P;if(D<T[v])T[v]=D;if(z>E[v])E[v]=z;if(P>b[v])b[v]=P;if(D>S[v])S[v]=D}let A=[];for(let y=0;y<a;y++){let v=l[y+1]-l[y],_=d[y+1]-d[y];if(v===0&&_===0)continue;let z=E[y]-m[y],P=b[y]-f[y],D=S[y]-T[y];A.push({faces:u.subarray(l[y]*4,l[y+1]*4),faceCount:v,edges:p.subarray(d[y]*4,d[y+1]*4),edgeCount:_,cx:(m[y]+E[y])/2,cy:(f[y]+b[y])/2,cz:(T[y]+S[y])/2,radius:Math.sqrt(z*z+P*P+D*D)/2+Math.sqrt(3)/2+2})}return A}var CA=0.98,G0=2.2,LA=0.04,PA=0.15,IA=1.5,J0=`
uniform float uHalf;
uniform vec3 uHead;
#include <fog_pars_vertex>
`,$u=`
attribute vec3 aCenter;
attribute float aAxis;
attribute float aId;
uniform sampler2D uGhostTex;
uniform float uTexW;
uniform vec3 uDepthAxis;
uniform float uFree;
uniform float uLayerReach;
uniform float uEdgeGhostAlpha;
uniform float uGhostPass;   // 0 - opaque pass (solid edges, write depth), 1 - transparent (edges of fading cubes)
varying float vAlpha;
uniform vec2 uRes;
uniform float uMinPx;
uniform float uWorldW;
uniform float uDepthK;
${J0}
void main() {
  // Ghost level of the owner cell (same as for faces): edges of fading cubes fade with the faces,
  // otherwise all the cube's edges show through a transparent face, including the back side.
  // Flat opening: only the head's layer is drawn (uLayerReach is about half a cell); the reveal widens it, in the game it is huge.
  // Done per cell here rather than by the camera's clipping planes: this shader clamps edge ribbons that reach the near plane onto it
  // (so they are not eaten close to the camera), which would draw the edges of nearer layers instead of dropping them.
  float layerDist = dot(floor(aCenter + 0.5) - uHead, uDepthAxis);
  if (abs(layerDist) > uLayerReach) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  int id = int(aId + 0.5);
  int wtex = int(uTexW);
  int row = id / wtex;
  float g = texelFetch(uGhostTex, ivec2(id - row * wtex, row), 0).r;
  float front = step(0.5, layerDist);
  g = max(g, front * (1.0 - uFree));
  // Same split as for the faces: a solid cube's edges go in the opaque pass, a fading one's in the transparent pass.
  if ((g > 0.001) != (uGhostPass > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  vAlpha = mix(1.0, uEdgeGhostAlpha, g);
  vec3 dirv = aAxis < 0.5 ? vec3(1.0, 0.0, 0.0) : (aAxis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  // Ends sit at the true outline corners (uHalf), not at the cell boundary (0.5): otherwise each end sticks out past the footprint.
  // The joint of corners and adjacent segments is covered by an extension of half the ribbon width (below).
  vec3 wa = aCenter - uHalf * dirv;
  vec3 wb = aCenter + uHalf * dirv;
  vec4 ca = projectionMatrix * (viewMatrix * vec4(wa, 1.0));
  vec4 cb = projectionMatrix * (viewMatrix * vec4(wb, 1.0));
  const float NEAR_W = 0.05;
  const float EDGE_END_EXT = 0.5; // end extension in fractions of half-width: covers the joint but does not stick out like a whisker
  if (ca.w < NEAR_W && cb.w < NEAR_W) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 ca0 = ca;
  if (ca.w < NEAR_W) ca = mix(ca, cb, (NEAR_W - ca.w) / (cb.w - ca.w));
  if (cb.w < NEAR_W) cb = mix(cb, ca0, (NEAR_W - cb.w) / (ca0.w - cb.w));
  vec2 half_ = 0.5 * uRes;
  vec2 sa = ca.xy / ca.w * half_;
  vec2 sb = cb.xy / cb.w * half_;
  vec2 d = sb - sa;
  float dl = length(d);
  d = dl > 1e-4 ? d / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  bool atB = position.x > 0.0;
  vec4 c = atB ? cb : ca;
  vec2 sc = atB ? sb : sa;
  float wpx = max(uMinPx, uWorldW * projectionMatrix[1][1] * half_.y / c.w);
  vec2 sp = sc + d * ((atB ? 0.5 : -0.5) * wpx * EDGE_END_EXT) + nrm * (position.y * 0.5 * wpx);
  // The edge lies on the seam of faces, but the ribbon is wider than a line: half of it ends up "inside" the cube or behind a
  // face that, at a concave bend or a grazing corner, is nearer to the camera in depth, and the depth test
  // eats the ribbon. polygonOffset depends on the slope of the face polygons and does not help across the ribbon width,
  // so the ribbon is shifted toward the camera by a view-space depth proportional to its width
  // in the world (uDepthK widths): far away the world width is larger, and the margin grows with it.
  float bias = uDepthK * wpx * c.w / (half_.y * projectionMatrix[1][1]);
  float wv = max(c.w - bias, 0.02);
  float zc = max((c.z + projectionMatrix[2][2] * bias) / wv, -1.0) * c.w;
  gl_Position = vec4(sp / half_ * c.w, zc, c.w);
  vec4 mvPosition = viewMatrix * vec4(atB ? wb : wa, 1.0);
  #include <fog_vertex>
}
`,eh=`
uniform vec3 uColor;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor, vAlpha);
  #include <fog_fragment>
}
`,th=`
attribute vec3 aCell;
attribute float aFace;
attribute float aId;
uniform sampler2D uGhostTex;
uniform float uTexW;
uniform vec3 uDepthAxis;
uniform float uFree;
uniform float uLayerReach;
uniform float uGhostPass;   // 0 - opaque pass, 1 - transparent
uniform float uGhostAlpha;
uniform vec3 uShade;        // brightness multipliers per axis x, y, z
uniform float uNegShade;
varying float vShade;
varying float vAlpha;
${J0}
// Face rim overhang from the cell center: convex - uHalf, flat - 0.5, concave - 1 - uHalf.
float reachOf(float st) {
  return st < 0.5 ? uHalf : (st < 1.5 ? 0.5 : 1.0 - uHalf);
}
void main() {
  // Flat opening: only the head's layer is drawn, see uLayerReach in the edge shader.
  float layerDist = dot(aCell - uHead, uDepthAxis);
  if (abs(layerDist) > uLayerReach) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vShade = 0.0;
    vAlpha = 0.0;
    return;
  }
  int id = int(aId + 0.5);
  int w = int(uTexW);
  int row = id / w;
  float g = texelFetch(uGhostTex, ivec2(id - row * w, row), 0).r;
  float front = step(0.5, layerDist);
  g = max(g, front * (1.0 - uFree));
  bool isGhost = g > 0.001;
  if (isGhost != (uGhostPass > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vShade = 0.0;
    vAlpha = 0.0;
    return;
  }
  // aFace = face + 6 * (four rim states in base 3), see obstacle-shell.ts.
  float code = floor((aFace + 0.5) / 6.0);
  float face = aFace - 6.0 * code;
  float a = floor(face * 0.5);
  float s = mod(face, 2.0) < 0.5 ? 1.0 : -1.0;
  vec3 e0 = a < 0.5 ? vec3(1.0, 0.0, 0.0) : (a < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 e1 = a < 0.5 ? vec3(0.0, 1.0, 0.0) : (a < 1.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
  vec3 e2 = a < 0.5 ? vec3(0.0, 0.0, 1.0) : (a < 1.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
  // Face plane at uHalf from the center; rims extend toward the neighbour (see reachOf) so that
  // adjacent cubes join without a gap. wu - the sign along e1 in the world (mirrored for s < 0).
  float wu = s * position.x;
  float wv = position.y;
  float r1 = reachOf(wu > 0.0 ? mod(code, 3.0) : mod(floor(code / 3.0), 3.0));
  float r2 = reachOf(wv > 0.0 ? mod(floor(code / 9.0), 3.0) : floor(code / 27.0));
  vec3 world = aCell + uHalf * s * e0 + wu * r1 * e1 + wv * r2 * e2;
  vShade = (a < 0.5 ? uShade.x : (a < 1.5 ? uShade.y : uShade.z)) * (s > 0.0 ? 1.0 : uNegShade);
  vAlpha = mix(1.0, uGhostAlpha, g);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,nh=`
uniform vec3 uColor;
uniform float uFaceK;
varying float vShade;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor * (uFaceK * vShade), vAlpha);
  #include <fog_fragment>
}
`,H0=1,V0=1,DA=0.5,zA=24,W0=2048,FA=140,vs=256,j0=25,So=0.001,UA=1,NA=3,X0=So/2,ll=[0,1,2,0,2,3],OA=!1;class ih{scene;res=new Ce(1,1);material=null;ghostEdgeMaterial=null;faceMaterials=[];chunks=[];chunkOfCell=new Int32Array(0);flatMeshes=[];flatGeometries=[];flatMaterials=[];flatTex=null;solid=new Set;solidSize=1;cellId=new Int32Array(0);ghostLevel=new Float32Array(0);stamp=new Int32Array(0);inActive=new Uint8Array(0);active=new Int32Array(W0);activeCount=0;frameNo=0;ghostTex=null;ghostBytes=new Uint8Array(0);uHead=new I;uDepthAxis=new I;frameUniforms={uDepthAxis:{value:this.uDepthAxis},uFree:{value:1},uLayerReach:{value:1e6}};shellFaces=0;shellEdges=0;get chunkCount(){return this.chunks.length}get ghostCells(){return this.activeCount}constructor(e){this.scene=e}rebuild(e){this.disposeLines();let t=Et(e);this.solidSize=t,this.solid.clear(),wr(e,(b,S,A)=>{this.solid.add(b+t*(S+t*A))});let n=CA/2,i=Zu(this.solid,t,n);this.shellFaces=i.faceCount,this.shellEdges=i.edgeCount;let s=Qu(i.faces,i.faceCount,i.edges,i.edgeCount,t,j0>0?j0:t),r={...Ya(),uColor:{value:vu},uHead:{value:this.uHead},uHalf:{value:n}},o=t*t*t;this.cellId=new Int32Array(o).fill(-1);let a=[],l=[],d=0;for(let b=0;b<s.length;b++){let S=s[b],A=new Float32Array(S.faceCount);for(let y=0;y<S.faceCount;y++){let v=S.faces[y*4]+t*(S.faces[y*4+1]+t*S.faces[y*4+2]),_=this.cellId[v];if(_<0)_=d++,this.cellId[v]=_,l.push(b);A[y]=_}a.push(A)}this.chunkOfCell=Int32Array.from(l),this.ghostLevel=new Float32Array(d),this.stamp=new Int32Array(d).fill(-1),this.inActive=new Uint8Array(d),this.activeCount=0;let c=Math.max(1,Math.ceil(d/vs));this.ghostBytes=new Uint8Array(vs*c);let h=new di(this.ghostBytes,vs,c,ts,Kt);h.minFilter=Yt,h.magFilter=Yt,h.generateMipmaps=!1,h.needsUpdate=!0,this.ghostTex=h;let u={...r,uRes:{value:this.res},uMinPx:{value:G0},uWorldW:{value:LA},uDepthK:{value:IA},uDepthAxis:this.frameUniforms.uDepthAxis,uFree:this.frameUniforms.uFree,uLayerReach:this.frameUniforms.uLayerReach,uGhostTex:{value:h},uTexW:{value:vs},uEdgeGhostAlpha:{value:PA}};this.material=new He({uniforms:{...u,uGhostPass:{value:0}},vertexShader:$u,fragmentShader:eh,fog:!0,side:cn}),this.ghostEdgeMaterial=new He({uniforms:{...u,uGhostPass:{value:1}},vertexShader:$u,fragmentShader:eh,fog:!0,side:cn,transparent:!0,depthWrite:!1});let p=u.uMinPx,g=(b)=>{b.getDrawingBufferSize(this.res),p.value=G0*b.getPixelRatio()},x={...r,uDepthAxis:this.frameUniforms.uDepthAxis,uFree:this.frameUniforms.uFree,uLayerReach:this.frameUniforms.uLayerReach,uGhostTex:{value:h},uTexW:{value:vs},uGhostAlpha:{value:Kg},uShade:{value:new I(Xg,Jg,Yg)},uNegShade:{value:qg},uFaceK:{value:Eu}},m=new He({uniforms:{...x,uGhostPass:{value:0}},vertexShader:th,fragmentShader:nh,fog:!0,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1}),f=new He({uniforms:{...x,uGhostPass:{value:1}},vertexShader:th,fragmentShader:nh,fog:!0,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1});this.faceMaterials=[m,f];let T=new Oe([-0.5,-1,0,0.5,-1,0,0.5,1,0,-0.5,1,0],3),E=new Oe([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3);for(let b=0;b<s.length;b++){let S=s[b],A=new Mn(new I(S.cx,S.cy,S.cz),S.radius),y=[],v=new hs;v.setAttribute("position",T),v.setIndex(new _t(new Uint16Array(ll),1));let _=new ps(S.edges,4);v.setAttribute("aCenter",new vn(_,3,0)),v.setAttribute("aAxis",new vn(_,1,3));let z=new Float32Array(S.edgeCount);for(let G=0;G<S.edgeCount;G++){let Q=Math.round(S.edges[G*4]),W=Math.round(S.edges[G*4+1]),q=Math.round(S.edges[G*4+2]);z[G]=this.cellId[Q+t*(W+t*q)]}v.setAttribute("aId",new Wn(z,1)),v.instanceCount=S.edgeCount,v.boundingSphere=A;let P=new nt(v,this.material);P.renderOrder=b*So+X0,P.onBeforeRender=g;let D=new nt(v,this.ghostEdgeMaterial);D.renderOrder=NA+b*So,D.onBeforeRender=g,y.push(v);let N=new hs;N.setAttribute("position",E),N.setIndex(new _t(new Uint16Array(ll),1));let C=new ps(S.faces,4);N.setAttribute("aCell",new vn(C,3,0)),N.setAttribute("aFace",new vn(C,1,3)),N.setAttribute("aId",new Wn(a[b],1)),N.instanceCount=S.faceCount,N.boundingSphere=A;let B=new nt(N,m);B.renderOrder=b*So;let k=new nt(N,f);k.renderOrder=UA+b*So,y.push(N),this.scene.add(P,D,B,k),this.chunks.push({edges:P,ghostEdges:D,opaque:B,ghost:k,geometries:y,active:0})}if(Gn(e)==="plane")this.buildFlat(e,t,n,u,x,g)}buildFlat(e,t,n,i,s,r){let o=sf(e).depth,a=wt(e),l=Math.abs(o.x),d=Math.abs(o.y),c=Math.abs(o.z),h=l*a.x+d*a.y+c*a.z,u=new Set;if(wr(e,(b,S,A)=>{if(l*b+d*S+c*A===h)u.add(b+t*(S+t*A))}),u.size===0)return;let p=Zu(u,t,n),g=Qu(p.faces,p.faceCount,p.edges,p.edgeCount,t,t),x=new di(new Uint8Array(vs),vs,1,ts,Kt);x.minFilter=Yt,x.magFilter=Yt,x.generateMipmaps=!1,x.needsUpdate=!0,this.flatTex=x;let m=new He({uniforms:{...i,uGhostTex:{value:x},uGhostPass:{value:0}},vertexShader:$u,fragmentShader:eh,fog:!0,side:cn}),f=new He({uniforms:{...s,uGhostTex:{value:x},uGhostPass:{value:0}},vertexShader:th,fragmentShader:nh,fog:!0,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1});this.flatMaterials=[m,f];let T=new Oe([-0.5,-1,0,0.5,-1,0,0.5,1,0,-0.5,1,0],3),E=new Oe([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3);for(let b of g){let S=new Mn(new I(b.cx,b.cy,b.cz),b.radius),A=new hs;A.setAttribute("position",T),A.setIndex(new _t(new Uint16Array(ll),1));let y=new ps(b.edges,4);A.setAttribute("aCenter",new vn(y,3,0)),A.setAttribute("aAxis",new vn(y,1,3)),A.setAttribute("aId",new Wn(new Float32Array(b.edgeCount),1)),A.instanceCount=b.edgeCount,A.boundingSphere=S;let v=new nt(A,m);v.renderOrder=X0,v.onBeforeRender=r;let _=new hs;_.setAttribute("position",E),_.setIndex(new _t(new Uint16Array(ll),1));let z=new ps(b.faces,4);_.setAttribute("aCell",new vn(z,3,0)),_.setAttribute("aFace",new vn(z,1,3)),_.setAttribute("aId",new Wn(new Float32Array(b.faceCount),1)),_.instanceCount=b.faceCount,_.boundingSphere=S;let P=new nt(_,f);this.scene.add(v,P),this.flatMeshes.push(v,P),this.flatGeometries.push(A,_)}}update(e,t,n,i,s,r,o,a,l,d,c,h){if(!this.ghostTex)return;this.uHead.set(s,r,o),this.uDepthAxis.set(a,l,d),this.frameUniforms.uFree.value=c,this.frameUniforms.uLayerReach.value=h,this.frameNo++;let u=this.solidSize,p=this.frameNo;if(c>0.5){let T=t-s,E=n-r,b=i-o,S=Math.sqrt(T*T+E*E+b*b);if(S>V0){let A=T/S,y=E/S,v=b/S,_=Math.min(S,zA),z=H0*H0;for(let P=V0;P<=_;P+=DA){let D=s+A*P,N=r+y*P,C=o+v*P,B=Math.round(D),k=Math.round(N),G=Math.round(C);for(let Q=-1;Q<=1;Q++){let W=G+Q;if(W<0||W>=u)continue;let q=W-C;for(let ee=-1;ee<=1;ee++){let xe=k+ee;if(xe<0||xe>=u)continue;let _e=xe-N;for(let Ve=-1;Ve<=1;Ve++){let Fe=B+Ve;if(Fe<0||Fe>=u)continue;let J=Fe-D;if(J*J+_e*_e+q*q>z)continue;let te=this.cellId[Fe+u*(xe+u*W)];if(te<0||this.stamp[te]===p)continue;if(this.stamp[te]=p,this.inActive[te]===0&&this.activeCount<W0)this.inActive[te]=1,this.active[this.activeCount++]=te,this.chunks[this.chunkOfCell[te]].active++}}}}}}let g=1-Math.exp(-e/FA),x=!1;for(let T=0;T<this.activeCount;){let E=this.active[T],b=this.stamp[E]===p?1:0,S=this.ghostLevel[E]+(b-this.ghostLevel[E])*g;if(b===0&&S<0.004)S=0;else if(b===1&&S>0.996)S=1;this.ghostLevel[E]=S;let A=Math.round(S*255);if(this.ghostBytes[E]!==A)this.ghostBytes[E]=A,x=!0;if(S===0&&b===0)this.inActive[E]=0,this.chunks[this.chunkOfCell[E]].active--,this.active[T]=this.active[--this.activeCount];else T++}if(x)this.ghostTex.needsUpdate=!0;let m=OA||c<1,f=h<1&&this.flatMeshes.length>0;for(let T=0;T<this.flatMeshes.length;T++)this.flatMeshes[T].visible=f;for(let T=0;T<this.chunks.length;T++){let E=this.chunks[T];E.edges.visible=!f,E.opaque.visible=!f,E.ghost.visible=!f&&(m||E.active>0),E.ghostEdges.visible=E.ghost.visible}}isSolid=(e,t,n)=>this.solid.has(e+this.solidSize*(t+this.solidSize*n));disposeLines(){for(let e of this.chunks){this.scene.remove(e.edges,e.ghostEdges,e.opaque,e.ghost);for(let t of e.geometries)t.dispose()}this.chunks=[],this.scene.remove(...this.flatMeshes);for(let e of this.flatGeometries)e.dispose();for(let e of this.flatMaterials)e.dispose();this.flatTex?.dispose(),this.flatMeshes=[],this.flatGeometries=[],this.flatMaterials=[],this.flatTex=null,this.chunkOfCell=new Int32Array(0),this.material?.dispose(),this.material=null,this.ghostEdgeMaterial?.dispose(),this.ghostEdgeMaterial=null;for(let e of this.faceMaterials)e.dispose();this.faceMaterials=[],this.ghostTex?.dispose(),this.ghostTex=null,this.activeCount=0}dispose(){this.disposeLines()}}var oh=0.72,BA=0.11,kA=0.1,sh=oh/2*1.15,rh=20,Y0=700;function GA(e){switch(e){case"orb":return[...al(sh,rh,0),...al(sh,rh,1),...al(sh,rh,2)];case"star":return F0(z0(oh/2));default:return yo(oh/2)}}class ah{scene;mesh;material;constructor(e,t="diamond"){this.scene=e;let n=_o(GA(t),BA);this.material=new At({color:$t.clone(),fog:!1}),this.mesh=new nt(n,this.material),this.scene.add(this.mesh)}update(e){let t=Cn(e);this.mesh.position.set(t.x,t.y,t.z);let n=$n(e)%Y0/Y0*Math.PI*2,i=0.5-0.5*Math.cos(n),s=Ke.lerp(Ig,Dg,i);this.material.color.copy($t).multiplyScalar(s*gu);let r=1+kA*i;this.mesh.scale.setScalar(r)}dispose(){this.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.material.dispose()}}var $0=!0,lh=0.55,HA=0.55,VA=0.26,q0=0.1,WA=0.5,jA=160,XA=90,JA=1.5,YA=3,qA=0.95,KA=0.9,K0=35,ZA=0.7,QA=0.02,dl=20,$A=3,e1=0.27,Z0=0.34,t1=0.29,n1=0.3,i1=0.06,s1=-0.2,r1=0.2,Q0=0.6;function o1(e){let t=[];if(e==="chevron")for(let i=0;i<$A;i++){let s=new ci(e1,Z0,dl,1);s.translate(0,0.5-Z0/2-i*t1,0),t.push(s)}else if(e==="ring"){let i=new ci(r1,Q0,dl,1);i.translate(0,0.5-Q0/2,0);let s=new eo(n1,i1,10,28);s.rotateX(Math.PI/2),s.translate(0,s1,0),t.push(i,s)}else{let i=WA,s=1-i,r=new ci(VA,i,dl,1);r.translate(0,0.5-i/2,0);let o=new ir(q0,q0,s,dl,1);o.translate(0,-0.5+s/2,0),t.push(r,o)}let n=ol(t,!1);for(let i of t)i.dispose();return n}var a1=`
varying vec3 vN;
uniform float uSquash;
void main() {
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Depth toward the near plane: on top of the scene, but the arrow's faces stay distinguishable from each other.
  gl_Position.z = -gl_Position.w + (gl_Position.z + gl_Position.w) * uSquash;
}
`,l1=`
varying vec3 vN;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uShading;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // Light from behind the camera's left shoulder, from above + a rim on the edges (separates the shape from the background).
  float l = clamp(dot(n, normalize(vec3(-0.5, 0.7, 0.5))), 0.0, 1.0);
  float shade = mix(1.0, 0.16 + 0.9 * l, uShading);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0) * 0.25 * uShading;
  gl_FragColor = vec4(uColor * (shade + rim), uOpacity);
}
`;function d1(e,t,n,i){return qA*Ke.smoothstep(e,t,n)*Ke.smoothstep(i,0,1)}class dh{scene;mesh;material;opacityU={value:0};dir=new I(1,0,0);target=new I;pos=new I;up=new I;fwd=new I;perp=new I;draw=new I;axisY=new I(0,1,0);quat=new Pt;minCos=Math.cos(Ke.degToRad(K0));minSin=Math.sin(Ke.degToRad(K0));ready=!1;hideDist;fullDist;constructor(e,t,n="default"){this.scene=e,this.hideDist=t?.compassHideDist??JA,this.fullDist=t?.compassFullDist??YA;let i=o1(n);this.material=new He({uniforms:{uColor:{value:new ae().copy($t).multiplyScalar(KA)},uOpacity:this.opacityU,uShading:{value:ZA},uSquash:{value:QA}},vertexShader:a1,fragmentShader:l1,transparent:!0,depthTest:!0,depthWrite:!0}),this.mesh=new nt(i,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=10,this.mesh.visible=!1,this.mesh.scale.setScalar(HA),this.scene.add(this.mesh)}reset(){this.ready=!1}update(e,t,n,i){let s=wt(e),r=Cn(e);this.target.set(r.x-s.x,r.y-s.y,r.z-s.z);let o=this.target.length(),a=d1(o,this.hideDist,this.fullDist,i);if(a<=0.003||o<0.000001){this.mesh.visible=!1,this.ready=!1;return}this.target.divideScalar(o),t.updateMatrixWorld();let l=t.matrixWorld.elements;this.up.set(l[4],l[5],l[6]),this.fwd.set(-l[8],-l[9],-l[10]);let d=s.x+this.up.x*lh,c=s.y+this.up.y*lh,h=s.z+this.up.z*lh,u=this.ready?1-Math.exp(-n/XA):1;this.pos.x+=(d-this.pos.x)*u,this.pos.y+=(c-this.pos.y)*u,this.pos.z+=(h-this.pos.z)*u;let p=this.ready?1-Math.exp(-n/jA):1;if(this.dir.lerp(this.target,p),this.dir.lengthSq()<0.01)this.dir.copy(this.target);this.dir.normalize(),this.ready=!0,this.draw.copy(this.dir);let g=this.dir.dot(this.fwd);if(Math.abs(g)>this.minCos){if(this.perp.copy(this.dir).addScaledVector(this.fwd,-g),this.perp.lengthSq()<0.000001)this.perp.copy(this.up);this.perp.normalize();let x=g>0?1:-1;this.draw.copy(this.fwd).multiplyScalar(x*this.minCos).addScaledVector(this.perp,this.minSin)}this.quat.setFromUnitVectors(this.axisY,this.draw),this.mesh.quaternion.copy(this.quat),this.mesh.position.copy(this.pos),this.opacityU.value=a,this.mesh.visible=!0}dispose(){this.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.material.dispose()}}var iv=18,sv=5,c1=0.86,ch=0.11,cl=0.4,rv=1.5,u1=0.75,ov=Math.ceil(iv/rv),h1=0.5,ev=0.025,uh=0.98,hh=0.03,ph=0.515,fh=0.02,mh=2,tv=0.12,nv=900,p1=0.5,av=4,Mo=ov+12+4+av*(4+Math.ceil(sv/mh)*4)+16;class gh{pool;matrix=new Je;color=new ae;n=0;body=new Map;bodyHeadKey=-1;bodyLen=-1;bodySize=1;collectSegment=(e,t,n,i)=>{this.body.set(e+this.bodySize*(t+this.bodySize*n),i)};hitKind=0;hitX=0;hitY=0;hitZ=0;freeCells=0;sideDirs=new Int8Array(av*3);sides;constructor(e,t=!0){this.sides=t,this.pool=new Di(e,new Zt(1,1,1),new At,Mo);for(let n=0;n<Mo;n++)this.pool.mesh.setColorAt(n,this.color.setRGB(0,0,0))}update(e,t,n,i,s){let r=Et(e),o=wt(e);this.refreshBody(e,r,o.x,o.y,o.z);let a=pn(e);if(Gn(e)==="free")t=-a.depth.x,n=-a.depth.y,i=-a.depth.z;t=Math.round(t),n=Math.round(n),i=Math.round(i),this.n=0;let d=$n(e)%nv/nv*Math.PI*2;this.trace(e,r,o.x,o.y,o.z,t,n,i,iv,s);let c=this.freeCells,h=this.hitKind,u=this.hitX,p=this.hitY,g=this.hitZ,x=c+0.5;for(let f=0,T=u1;f<ov&&T+cl/2<=x;f++,T+=rv){let E=this.rayBrightness(T,d);this.color.setRGB(E,E,E),this.dash(o.x+t*T,o.y+n*T,o.z+i*T,t,n,i)}if(h===2||h===3)this.setDanger(),this.plate(u-t*ph,p-n*ph,g-i*ph,t,n);else if(h===1){this.setDanger();let f=o.x+t*c+t*(0.5-fh),T=o.y+n*c+n*(0.5-fh),E=o.z+i*c+i*(0.5-fh);this.plate(f,T,E,t,n)}let m=!this.sides?0:this.collectSides(a.right,a.up,t,n,i);for(let f=0;f<m;f++){let T=this.sideDirs[f*3],E=this.sideDirs[f*3+1],b=this.sideDirs[f*3+2];this.trace(e,r,o.x,o.y,o.z,T,E,b,sv,s);let S=this.freeCells;if(S<=0)continue;let A=Hg;this.color.setRGB(A,A,A);let y=c1*h1/2,v=0.5+S/2;this.rails(o.x+T*v,o.y+E*v,o.z+b*v,y,ev,T,E,S);for(let _=mh;_<=S;_+=mh)this.ring(o.x+T*_,o.y+E*_,o.z+b*_,y,ev,T,E)}this.pool.setCount(this.n),this.pool.markDirty()}dash(e,t,n,i,s,r){let o=this.n;if(o>=Mo)return;this.matrix.makeScale(i!==0?cl:ch,s!==0?cl:ch,r!==0?cl:ch).setPosition(e,t,n),this.pool.mesh.setMatrixAt(o,this.matrix),this.pool.mesh.setColorAt(o,this.color),this.n=o+1}rayBrightness(e,t){let n=1-tv+tv*Math.sin(t-e*p1);return Gg*n}setDanger(){this.color.copy(po).multiplyScalar(Vg)}collectSides(e,t,n,i,s){let r=0;for(let o=0;o<2;o++){let a=o===0?e:t;if(Math.abs(a.x*n+a.y*i+a.z*s)>0.5)continue;for(let l=-1;l<=1;l+=2)this.sideDirs[r*3]=Math.round(a.x)*l,this.sideDirs[r*3+1]=Math.round(a.y)*l,this.sideDirs[r*3+2]=Math.round(a.z)*l,r++}return r}refreshBody(e,t,n,i,s){let r=ln(e),o=n+t*(i+t*s);if(o===this.bodyHeadKey&&r===this.bodyLen&&t===this.bodySize)return;this.bodyHeadKey=o,this.bodyLen=r,this.bodySize=t,this.body.clear(),_i(e,this.collectSegment)}trace(e,t,n,i,s,r,o,a,l,d){let c=Cn(e),h=this.bodyLen;this.hitKind=0,this.freeCells=l;for(let u=1;u<=l;u++){let p=n+r*u,g=i+o*u,x=s+a*u,m=0;if(p<0||g<0||x<0||p>=t||g>=t||x>=t)m=1;else if(d(p,g,x))m=2;else if(p===c.x&&g===c.y&&x===c.z)m=4;else{let f=this.body.get(p+t*(g+t*x));if(f!==void 0&&f<h-u)m=3}if(m!==0){this.hitKind=m,this.hitX=p,this.hitY=g,this.hitZ=x,this.freeCells=u-1;return}}}beam(e,t,n,i,s,r){let o=this.n;if(o>=Mo)return;this.matrix.makeScale(e===0?s:r,e===1?s:r,e===2?s:r).setPosition(t,n,i),this.pool.mesh.setMatrixAt(o,this.matrix),this.pool.mesh.setColorAt(o,this.color),this.n=o+1}plate(e,t,n,i,s){let r=this.n;if(r>=Mo)return;let o=i!==0?0:s!==0?1:2;this.matrix.makeScale(o===0?hh:uh,o===1?hh:uh,o===2?hh:uh).setPosition(e,t,n),this.pool.mesh.setMatrixAt(r,this.matrix),this.pool.mesh.setColorAt(r,this.color),this.n=r+1}rails(e,t,n,i,s,r,o,a){let l=r!==0?0:o!==0?1:2,d=(l+1)%3,c=(l+2)%3;for(let h=-1;h<=1;h+=2)for(let u=-1;u<=1;u+=2)this.beamAt(l,d,c,h*i,u*i,e,t,n,a,s)}ring(e,t,n,i,s,r,o){let a=r!==0?0:o!==0?1:2,l=(a+1)%3,d=(a+2)%3,c=2*i+s;for(let h=-1;h<=1;h+=2)this.beamAt(l,a,d,0,h*i,e,t,n,c,s),this.beamAt(d,a,l,0,h*i,e,t,n,c,s)}beamAt(e,t,n,i,s,r,o,a,l,d){let c=r,h=o,u=a;if(t===0)c+=i;else if(t===1)h+=i;else u+=i;if(n===0)c+=s;else if(n===1)h+=s;else u+=s;this.beam(e,c,h,u,l,d)}dispose(){this.pool.dispose()}}var lv=8,dv=4,cv=18,f1=0.12,m1=3,g1=9,v1=0.25,uv=`
${Tg}
uniform vec3 uHead;
uniform vec3 uDir;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDepth;
uniform vec3 uAnchor;
uniform float uFreeAmt;
uniform float uSize;
uniform float uPxScale;
uniform float uMaxPx;
uniform float uSpacing;
uniform float uLo;
uniform float uCenters;
uniform float uLatR;
uniform float uBehind;
uniform float uAhead;
uniform float uBaseSize;
uniform float uMinPx;
uniform float uBaseAlpha;
uniform float uStub;
uniform vec3 uBaseColor;
varying vec3 vColor;
varying float vAlpha;

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vAlpha = 0.0;
  vColor = vec3(0.0);
}

bool inCube(vec3 w) {
  float hi = uSize + uLo - 1.0 + 0.02;
  float lo = uLo - 0.01;
  return !(w.x < lo || w.y < lo || w.z < lo || w.x > hi || w.y > hi || w.z > hi);
}

// Node (ia, ib, if) - integer indices from the anchor along (A, B, dir): world position.
vec3 nodeWorld(vec3 idx) {
  return uAnchor + (idx.x * uA + idx.y * uB + idx.z * uDir) * uSpacing;
}

// Node alpha: window around the head, depth layer in plane mode, edge fade. 0 - hidden.
float nodeAlpha(vec3 world, float viewLen) {
  vec3 off = world - uHead;
  float f = dot(off, uDir);
  float lat = max(abs(dot(off, uA)), abs(dot(off, uB)));
  if (lat > uLatR || f < -uBehind || f > uAhead) return 0.0;
  // At centers: the head and the cells behind it along the axis are occupied by the snake, no dots there.
  if (uCenters > 0.5 && lat < 0.25 && f < 0.25) return 0.0;
  float dd = dot(off, uDepth);
  float hs = 0.5 * uSpacing;
  float layer = mix(step(-hs + 0.001, dd) * step(dd, hs + 0.001), 1.0, uFreeAmt);
  float edge = (1.0 - smoothstep(uLatR - 2.0, uLatR, lat))
    * smoothstep(-uBehind, -uBehind + 2.0, f)
    * (1.0 - smoothstep(uAhead - 4.0, uAhead, f));
  float nearFade = smoothstep(0.8, 2.2, viewLen);
  return uBaseAlpha * edge * layer * nearFade;
}
`,x1=`
${uv}
void main() {
  vec3 world = nodeWorld(position);
  if (!inCube(world)) { hide(); return; }
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float a = nodeAlpha(world, length(mv.xyz)) * fogVisibility(-mv.z);
  if (a <= 0.0) { hide(); return; }
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  gl_PointSize = clamp(uBaseSize * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001), uMinPx, uMaxPx);
  vAlpha = a;
  vColor = uBaseColor;
}
`,b1=`
${uv}
attribute vec2 aStub;
void main() {
  vec3 world = nodeWorld(position);
  int ax = int(aStub.x + 0.5);
  vec3 axis = vec3(float(ax == 0) - float(ax == 1), float(ax == 2) - float(ax == 3), float(ax == 4) - float(ax == 5));
  // Along the screen depth the stub grows from zero together with freeAmount.
  float len = uStub * mix(1.0 - abs(dot(axis, uDepth)), 1.0, uFreeAmt);
  vec3 tip = world + axis * len;
  if (!inCube(world) || !inCube(tip) || len < 0.001) { hide(); return; }
  vec3 w = aStub.y > 0.5 ? tip : world;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vec4 mvNode = viewMatrix * vec4(world, 1.0);
  float a = nodeAlpha(world, length(mvNode.xyz)) * fogVisibility(-mvNode.z);
  if (a <= 0.0) { hide(); return; }
  gl_Position = projectionMatrix * mv;
  vAlpha = a;
  vColor = uBaseColor;
}
`,y1=`
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.55, 1.0, d);
  if (vAlpha * soft < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`,_1=`
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;class vh{scene;lattice;stubs;material;stubMaterial;spacing;centers;uHead=new I;uDir=new I;uA=new I;uB=new I;uDepth=new I;uAnchor=new I;constructor(e,t){this.scene=e,this.spacing=Math.max(1,Math.round(t.hints.latticeStep)),this.centers=t.hints.latticeAt==="centers";let n=this.centers,i=this.spacing,s=Math.ceil(lv/i)+1,r=Math.ceil(dv/i)+1,o=Math.ceil(cv/i)+1,a=2*s+1,l=r+o+1,d=a*a*l,c=new Float32Array(d*3),h=new Float32Array(d*12*3),u=new Float32Array(d*12*2),p=0,g=0,x=0;for(let E=-s;E<=s;E++)for(let b=-s;b<=s;b++)for(let S=-r;S<=o;S++){c[p++]=E,c[p++]=b,c[p++]=S;for(let A=0;A<6;A++)for(let y=0;y<2;y++)h[g++]=E,h[g++]=b,h[g++]=S,u[x++]=A,u[x++]=y}let m=new Qe;m.setAttribute("position",new Oe(c,3));let f={uHead:{value:this.uHead},uDir:{value:this.uDir},uA:{value:this.uA},uB:{value:this.uB},uDepth:{value:this.uDepth},uAnchor:{value:this.uAnchor},uFreeAmt:{value:0},uSize:{value:1},uPxScale:{value:400},uMaxPx:{value:g1},uSpacing:{value:i},uLo:{value:n?0:-0.5},uCenters:{value:n?1:0},uLatR:{value:lv},uBehind:{value:dv},uAhead:{value:cv},uBaseSize:{value:f1},uMinPx:{value:m1},uBaseAlpha:{value:t0},uBaseColor:{value:e0},uStub:{value:v1},...Ya()};this.material=new He({uniforms:f,vertexShader:x1,fragmentShader:y1,fog:!0,transparent:!0,depthWrite:!1}),this.lattice=new rs(m,this.material),this.lattice.frustumCulled=!1,this.scene.add(this.lattice);let T=new Qe;T.setAttribute("position",new Oe(h,3)),T.setAttribute("aStub",new Oe(u,2)),this.stubMaterial=new He({uniforms:f,vertexShader:b1,fragmentShader:_1,fog:!0,transparent:!0,depthWrite:!1}),this.stubs=new wn(T,this.stubMaterial),this.stubs.frustumCulled=!1,this.scene.add(this.stubs)}setViewportHeight(e){this.material.uniforms.uPxScale.value=e*0.5}update(e,t,n,i,s,r,o,a,l,d,c){let h=this.spacing;this.uHead.set(t,n,i),this.uDir.set(s,r,o);let u=this.centers?0:0.5;this.uAnchor.set(Math.round((t+u)/h)*h-u,Math.round((n+u)/h)*h-u,Math.round((i+u)/h)*h-u);let p=s!==0?0:r!==0?1:2;if(this.uA.set(0,0,0),this.uB.set(0,0,0),p===0)this.uA.y=1,this.uB.z=1;else if(p===1)this.uA.z=1,this.uB.x=1;else this.uA.x=1,this.uB.y=1;this.uDepth.set(a,l,d);let g=this.material.uniforms;g.uFreeAmt.value=c,g.uSize.value=e}dispose(){this.scene.remove(this.lattice),this.lattice.geometry.dispose(),this.material.dispose(),this.scene.remove(this.stubs),this.stubs.geometry.dispose(),this.stubMaterial.dispose()}}class xh{hitKind=0;freeCells=0;body=new Map;bodyHeadKey=-1;bodyLen=-1;bodySize=1;collectSegment=(e,t,n,i)=>{this.body.set(e+this.bodySize*(t+this.bodySize*n),i)};refreshBody(e,t,n,i,s){let r=ln(e),o=n+t*(i+t*s);if(o===this.bodyHeadKey&&r===this.bodyLen&&t===this.bodySize)return;this.bodyHeadKey=o,this.bodyLen=r,this.bodySize=t,this.body.clear(),_i(e,this.collectSegment)}run(e,t,n,i,s,r){let o=Et(e),a=wt(e);this.refreshBody(e,o,a.x,a.y,a.z);let l=Cn(e),d=this.bodyLen;this.hitKind=0,this.freeCells=s;for(let c=1;c<=s;c++){let h=this.classify(o,l.x,l.y,l.z,d,a.x+t*c,a.y+n*c,a.z+i*c,c,r);if(h!==0){this.hitKind=h,this.freeCells=c-1;return}}}kindAt(e,t,n,i,s,r){let o=Cn(e);return this.classify(Et(e),o.x,o.y,o.z,this.bodyLen,t,n,i,s,r)}classify(e,t,n,i,s,r,o,a,l,d){if(r<0||o<0||a<0||r>=e||o>=e||a>=e)return 1;if(d(r,o,a))return 2;if(r===t&&o===n&&a===i)return 4;let c=this.body.get(r+e*(o+e*a));if(c!==void 0&&c<s-l)return 3;return 0}}var S1=0,hv=1,bh=2,dr=10,M1=0.42,w1=60,E1=9,T1=10,A1=1.3,R1=0.86,C1=0.2,L1=`
attribute float aKind;   // 0 forward, 1 sideways, 2 cannot, -1 do not draw
attribute float aFar;    // 1 is the second cell from the head
attribute vec3 aDir;     // unit step from the head to the cell (world axes)
uniform float uPxScale;
uniform float uSize;
uniform float uMaxPx;
uniform float uFarSize;
uniform float uFarAlpha;
uniform float uArrowMinPx;
uniform float uBlockedMinPx;
uniform float uBlockedSizeK;
uniform float uDepthBias;
uniform float uPassAlpha;
uniform vec3 uForwardColor;
uniform vec3 uSideColor;
uniform vec3 uBlockedColor;
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
void main() {
  if (aKind < -0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    return;
  }
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  // Depth for the test: a point on the line of sight closer to the camera by uDepthBias (xy/w same as clip).
  float mvLen = max(length(mv.xyz), 1e-4);
  gl_Position = projectionMatrix * vec4(mv.xyz * (max(mvLen - uDepthBias, 0.05) / mvLen), 1.0);
  // Screen direction of the step: projection of the cell and of the cell + half a step along aDir.
  vec4 clip2 = projectionMatrix * (mv + viewMatrix * vec4(aDir * 0.5, 0.0));
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vec2 sd = (clip2.xy / max(clip2.w, 0.001) - clip.xy / max(clip.w, 0.001)) * vec2(aspect, 1.0);
  float sdLen = length(sd);
  // Relation to the "sideways" half-step (there the projection is full): 1 is sideways, 0 is end-on.
  float side = sdLen / max(0.5 * projectionMatrix[1][1] / max(clip.w, 0.001), 1e-5);
  vDir = sdLen > 1e-6 ? sd / sdLen : vec2(0.0, 1.0);
  vArrow = smoothstep(0.12, 0.35, side);
  float farK = aFar > 0.5 ? uFarSize : 1.0;
  float blocked = aKind > 1.5 ? 1.0 : 0.0;
  vBlocked = blocked;
  float sz = uSize * farK * mix(1.0, uBlockedSizeK, blocked) * uPxScale * projectionMatrix[1][1] / max(clip.w, 0.001);
  gl_PointSize = clamp(sz, mix(uArrowMinPx, uBlockedMinPx, blocked), uMaxPx);
  float nearFade = smoothstep(0.5, 1.5, length(mv.xyz));
  vColor = aKind > 1.5 ? uBlockedColor : (aKind > 0.5 ? uSideColor : uForwardColor);
  vAlpha = nearFade * (aFar > 0.5 ? uFarAlpha : 1.0) * uPassAlpha;
}
`,P1=`
varying vec3 vColor;
varying float vAlpha;
varying float vBlocked;
varying vec2 vDir;
varying float vArrow;
uniform float uCrossHalf;
uniform float uCrossWidth;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float shape;
  if (vBlocked > 0.5) {
    // Cross: distance to the diagonals, clipped by a square.
    float d = min(abs(p.x - p.y), abs(p.x + p.y)) * 0.70710678;
    float box = max(abs(p.x), abs(p.y));
    shape = (1.0 - smoothstep(uCrossWidth * 0.6, uCrossWidth, d)) * (1.0 - smoothstep(uCrossHalf - 0.1, uCrossHalf, box));
  } else {
    // Free cell: an arrow along vDir (in the sprite y is down, convert to y up),
    // end-on it is a disc.
    vec2 q = vec2(p.x, -p.y);
    float u = dot(q, vDir) + 0.1;
    float v = dot(q, vec2(-vDir.y, vDir.x));
    float shaft = max(abs(v) - 0.17, abs(u + 0.25) - 0.55);
    float tip = max(abs(v) - (0.95 - u) * 0.85, 0.05 - u);
    float dArrow = min(shaft, tip);
    float arrow = 1.0 - smoothstep(0.0, 0.1, dArrow);
    float disc = 1.0 - smoothstep(0.6, 1.0, length(p));
    shape = mix(disc, arrow, vArrow);
  }
  float a = shape * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;class yh{scene;points;hidden;material;hiddenMaterial;pos;kind;far;dir;trace;n=0;constructor(e,t){this.scene=e,this.trace=t;let n=new Qe;this.pos=new _t(new Float32Array(dr*3),3),this.kind=new _t(new Float32Array(dr).fill(-1),1),this.far=new _t(new Float32Array(dr),1),this.dir=new _t(new Float32Array(dr*3),3),n.setAttribute("position",this.pos),n.setAttribute("aKind",this.kind),n.setAttribute("aFar",this.far),n.setAttribute("aDir",this.dir);let i=(o)=>new ae(o,o,o),s={uPxScale:{value:400},uSize:{value:M1},uMaxPx:{value:w1},uFarSize:{value:r0},uFarAlpha:{value:o0},uArrowMinPx:{value:T1},uBlockedMinPx:{value:E1},uBlockedSizeK:{value:A1},uDepthBias:{value:l0},uCrossHalf:{value:R1},uCrossWidth:{value:C1},uForwardColor:{value:i(n0)},uSideColor:{value:i(i0)},uBlockedColor:{value:po.clone().multiplyScalar(s0)}},r=(o,a)=>new He({uniforms:{...s,uPassAlpha:{value:o}},vertexShader:L1,fragmentShader:P1,transparent:!0,depthWrite:!1,depthTest:!0,depthFunc:a});this.material=r(1,Br),this.hiddenMaterial=r(a0,ga),this.points=new rs(n,this.material),this.points.frustumCulled=!1,this.points.renderOrder=2,this.hidden=new rs(n,this.hiddenMaterial),this.hidden.frustumCulled=!1,this.hidden.renderOrder=2,this.scene.add(this.points,this.hidden)}setViewportHeight(e){this.material.uniforms.uPxScale.value=e*0.5}update(e,t,n,i,s){let r=wt(e),o=pn(e);this.n=0,this.putPair(e,r.x,r.y,r.z,t,n,i,0,s);for(let a=0;a<3;a++){let l=a===0?o.right:a===1?o.up:o.depth,d=Math.round(l.x),c=Math.round(l.y),h=Math.round(l.z);if(Math.abs(d*t+c*n+h*i)>0)continue;this.putPair(e,r.x,r.y,r.z,d,c,h,1,s),this.putPair(e,r.x,r.y,r.z,-d,-c,-h,1,s)}for(let a=this.n;a<dr;a++)this.kind.setX(a,-1);this.kind.needsUpdate=!0,this.pos.needsUpdate=!0,this.far.needsUpdate=!0,this.dir.needsUpdate=!0}putPair(e,t,n,i,s,r,o,a,l){let d=this.put(e,t,n,i,s,r,o,1,a,l,!1);if(d===bh)return;this.put(e,t,n,i,s,r,o,2,a,l,d===hv)}put(e,t,n,i,s,r,o,a,l,d,c){if(this.n>=dr)return bh;let h=this.trace.kindAt(e,t+s*a,n+r*a,i+o*a,a,d),u=h===1,p=c||u||h===2||h===3?2:l,g=u?a-0.5:a,x=this.n;return this.pos.setXYZ(x,t+s*g,n+r*g,i+o*g),this.kind.setX(x,p),this.far.setX(x,a>1?1:0),this.dir.setXYZ(x,s,r,o),this.n++,u?bh:p===2?hv:S1}dispose(){this.scene.remove(this.points,this.hidden),this.points.geometry.dispose(),this.material.dispose(),this.hiddenMaterial.dispose()}}var I1=!0,D1=!0,z1=!1,F1=!0;class pv{ray;lattice;near;trace=new xh;constructor(e,t){this.ray=D1?new gh(e,z1):null,this.lattice=I1?new vh(e,t):null,this.near=F1?new yh(e,this.trace):null}setViewportHeight(e){this.lattice?.setViewportHeight(e),this.near?.setViewportHeight(e)}update(e,t,n,i,s,r){let o=pn(e);if(Gn(e)==="free")t=-o.depth.x,n=-o.depth.y,i=-o.depth.z;t=Math.round(t),n=Math.round(n),i=Math.round(i);let a=Math.round(o.depth.x),l=Math.round(o.depth.y),d=Math.round(o.depth.z),c=wt(e);if(this.ray?.update(e,t,n,i,s),this.lattice?.update(Et(e),c.x,c.y,c.z,t,n,i,a,l,d,r),this.near)this.trace.run(e,t,n,i,1,s),this.near.update(e,t,n,i,s)}dispose(){this.ray?.dispose(),this.lattice?.dispose(),this.near?.dispose()}}function fv(e,t){return new pv(e,t)}var U1=20,N1=5,O1=5,B1=0.12;class _h{scene;walls=[];material=null;currentSize=-1;constructor(e){this.scene=e}setSize(e){if(e===this.currentSize)return;this.currentSize=e,this.disposeAll();let t=e<=U1?1:N1,n=Math.floor(e/t)+1,i=-0.5,s=e-0.5;this.material=new He({uniforms:{uColor:{value:ho},uMinor:{value:zg},uMajor:{value:Fg},uFalloff:{value:Math.min(Wu,Math.max(Vu,e*Hu))},uFloor:{value:B1},uNearFade:{value:ju}},vertexShader:Xu,fragmentShader:Ju,transparent:!0,depthWrite:!1});let r=n*2*2;for(let o=0;o<3;o++){let a=(o+1)%3,l=(o+2)%3;for(let d=0;d<2;d++){let c=new Float32Array(r*3),h=new Float32Array(r),u=d===0?i:s,p=0,g=0;for(let f=0;f<n;f++){let T=i+f*t,E=f%O1===0?1:0;c[p+o]=u,c[p+a]=T,c[p+l]=i,p+=3,c[p+o]=u,c[p+a]=T,c[p+l]=s,p+=3,c[p+o]=u,c[p+a]=i,c[p+l]=T,p+=3,c[p+o]=u,c[p+a]=s,c[p+l]=T,p+=3,h[g++]=E,h[g++]=E,h[g++]=E,h[g++]=E}let x=new Qe;x.setAttribute("position",new Oe(c,3)),x.setAttribute("aMajor",new Oe(h,1));let m=new wn(x,this.material);m.frustumCulled=!1,this.walls.push(m),this.scene.add(m)}}}update(e,t,n,i,s){if(this.walls.length===0)return;if(s){for(let a=0;a<this.walls.length;a++)this.walls[a].visible=!1;return}let r=this.currentSize-0.5,o=i<0.5;for(let a=0;a<3;a++){let l=a===0?e:a===1?t:n;this.walls[a*2].visible=!(o&&l<-0.5),this.walls[a*2+1].visible=!(o&&l>r)}}disposeAll(){for(let e of this.walls)this.scene.remove(e),e.geometry.dispose();this.walls.length=0,this.material?.dispose(),this.material=null}dispose(){this.disposeAll(),this.currentSize=-1}}var k1=0.22,G1=0.4,H1=5,V1=0.12,mv=1,W1=0.46,j1=0.3;class Sh{scene;lines=[];lineMaterials=[];border=[];borderGeometry=null;borderMaterial=null;lineBase=[];shown=!0;lastReveal=-1;constructor(e,t){this.scene=e;let n=t.size,i=t.frame.depth,s=Math.abs(i.x)>0.5?0:Math.abs(i.y)>0.5?1:2,r=(s===0?i.x:s===1?i.y:i.z)>0?1:-1,o=wt(t),a=s===0?o.x:s===1?o.y:o.z,l=(s+1)%3,d=(s+2)%3,c=-0.5,h=n-0.5,u=[],p=[],g=(S,A,y,v)=>{let _=[0,0,0],z=[0,0,0];if(_[s]=v,z[s]=v,y)_[l]=A,_[d]=c,z[l]=A,z[d]=h;else _[l]=c,_[d]=A,z[l]=h,z[d]=A;S.push(_[0],_[1],_[2],z[0],z[1],z[2])},x=a-r*W1;for(let S=1;S<n;S++){let A=c+S,y=S%H1===0?p:u;g(y,A,!0,x),g(y,A,!1,x)}for(let[S,A]of[[u,k1],[p,G1]]){if(S.length===0)continue;let y=new Qe;y.setAttribute("position",new Oe(S,3));let v=new Li({color:ho.clone(),transparent:!0,opacity:A,depthWrite:!1,fog:!1}),_=new wn(y,v);_.frustumCulled=!1,this.lines.push(_),this.lineMaterials.push(v),this.lineBase.push(A),e.add(_)}let m=new Zt(1,1,1),f=new At({color:new ae().copy(lo),transparent:!0,opacity:mv,fog:!1});this.borderGeometry=m,this.borderMaterial=f;let T=V1,E=n+T,b=a-r*j1;for(let S=0;S<2;S++){let A=S===0?l:d,y=S===0?d:l;for(let v=0;v<2;v++){let _=new nt(m,f),z=[T,T,T];z[A]=E,_.scale.set(z[0],z[1],z[2]);let P=[0,0,0];P[s]=b,P[A]=(n-1)/2,P[y]=v===0?c:h,_.position.set(P[0],P[1],P[2]),_.frustumCulled=!1,this.border.push(_),e.add(_)}}}update(e){if(e===this.lastReveal)return;this.lastReveal=e;let t=e<1;if(t!==this.shown){this.shown=t;for(let i=0;i<this.lines.length;i++)this.lines[i].visible=t;for(let i=0;i<this.border.length;i++)this.border[i].visible=t}if(!t)return;let n=1-e;for(let i=0;i<this.lineMaterials.length;i++)this.lineMaterials[i].opacity=this.lineBase[i]*n;if(this.borderMaterial)this.borderMaterial.opacity=mv*n}dispose(){for(let e of this.lines)this.scene.remove(e),e.geometry.dispose();for(let e of this.lineMaterials)e.dispose();for(let e of this.border)this.scene.remove(e);this.borderGeometry?.dispose(),this.borderMaterial?.dispose(),this.lines.length=0,this.lineMaterials.length=0,this.border.length=0}}function wo(e,t){return Math.min(e,t)}function ul(e,t,n){let i=Math.max(0,t-n),s=e-Math.floor(n/2);return s<0?0:s>i?i:s}function hl(e,t,n){return e>=t&&e<t+n}function Mh(e,t,n){let i=e-t;return i<0?0:i>n-1?n-1:i}function pl(e){return e<=0}function fl(e,t,n){return e+t>=n}function wh(e,t,n){return(e-t+0.5)/n}function gv(e,t){return e%t===0}function Eh(e,t){return(e+0.5)/t}var X1=0.52,J1=170,Y1=380,q1=0.26,K1=12,vv=48,Z1=1.8,Yn=3.2,xv=0.9,bv=0.9,Q1=0.35,ml=0.9,yv=0.16,_v=0.8,Sv=1.6,$1=5,Mv=1.6,wv=1,Ev=1.35,Th=0.7,gl=0.4,vl=1.8,Eo=1.35,eR=0.55,Tv=2.2,cr=0.5,Av=0.3,tR=0.55,nR=0.8,iR=1.4,sR=200,rR=0.5,oR=0.5,aR=5,Rv=0.3,lR=1,dR=0.2,Cv=0.9,Lv=1.8,Ah=1.2,cR=0.5,uR=0.02,hR=6;function Pv(e){let t=[],n=[],i=(r,o,a,l)=>{let d=a-r,c=l-o,h=Math.hypot(d,c),u=-c/h*(Av/2),p=d/h*(Av/2),g=t.length/3;t.push(r+u,o+p,0,r-u,o-p,0,a-u,l-p,0,a+u,l+p,0),n.push(g,g+1,g+2,g,g+2,g+3)};for(let r=0;r<4;r++){let o=r*Math.PI/2,a=Math.cos(o),l=Math.sin(o),d=-l,c=a;for(let h=0;h<2;h++){let u=tR+h*nR,p=e?u+cr:u,g=e?u:u+cr,x=a*p,m=l*p;i(x,m,a*g+d*cr,l*g+c*cr),i(x,m,a*g-d*cr,l*g-c*cr)}}let s=new Qe;return s.setAttribute("position",new Oe(t,3)),s.setIndex(n),s}class Rh{scene=new er;camera=new Pi(-1,1,1,-1,-1,1);layers=[];geometries=[];disposables=[];bgTop;bgStrip;borderTop;borderStrip;stripTrack;levelHead;levelApple;levelArrow;troughLine;troughHead;troughApple;tickMinor;tickMajor;walls;labels;obstacles;body;obstacleCount=0;bodyCount=0;bodyDenom=1;bodyLen=-1;obstacleKey=-1;obstaclesDirty=!0;tmpMatrix=new Je;tmpColor=new ae;headTri;headDot;appleHere;appleRing;appleArrow;appleLeg;appleLegCap;headChevIn;headChevOut;pulseT0=-1e9;windowCells;levelWindowCells;levelLen=1;cellH=1;size=-1;len=1;stripX0=0;mainX=0;troughX=0;sx=0;sz=0;hy=0;sy=0;screenW=1;screenH=1;panelW=0;panelH=0;constructor(e,t){this.windowCells=Math.max(1,Math.floor(e)),this.levelWindowCells=Math.max(2,Math.floor(t));let n=this.windowCells*this.windowCells,i=new as(1,1),s=new Qe;s.setAttribute("position",new Oe([0,0.6,0,-0.45,-0.4,0,0.45,-0.4,0],3));let r=new Qe;r.setAttribute("position",new Oe([-0.5,-0.5,0,0.5,-0.5,0,0.5,0.5,0,-0.5,0.5,0],3));let o=new nr(1,4),a=new $r(eR,1,4,1),l=new nr(0.5,12),d=Pv(!1),c=Pv(!0);this.geometries.push(i,s,r,o,a,l,d,c),this.bgTop=this.mesh(i,Ka,xu,0),this.bgStrip=this.mesh(i,Ka,xu,0),this.borderTop=this.loop(r,ui,bu,1),this.borderStrip=this.loop(r,ui,bu,1),this.stripTrack=this.mesh(i,ui,Ng,1),this.walls=this.instanced(i,yu,Ug,hR,5),this.obstacles=this.instanced(i,Tu,d0,n,1);for(let u=0;u<n;u++)this.obstacles.setColorAt(u,this.tmpColor.setRGB(1,1,1));this.body=this.instanced(i,new ae(1,1,1),c0,n,2),this.body.setColorAt(0,this.tmpColor.setRGB(1,1,1)),this.appleRing=this.mesh(a,$t,ar,3),this.appleHere=this.mesh(o,$t,Za,3),this.appleArrow=this.mesh(s,$t,ar,4),this.headDot=this.mesh(l,Fn,ms,5),this.headTri=this.mesh(s,Fn,ms,6),this.headChevIn=this.mesh(d,Fn,ms,6),this.headChevOut=this.mesh(c,Fn,ms,6),this.appleLeg=this.mesh(i,$t,ar,3),this.appleLegCap=this.mesh(i,$t,ar,3),this.levelHead=this.mesh(i,Fn,ms,5),this.levelApple=this.mesh(o,$t,Za,6),this.levelArrow=this.mesh(s,$t,ar,6),this.troughLine=this.mesh(i,ui,kg,2),this.troughHead=this.mesh(l,Fn,ms,5),this.troughApple=this.mesh(l,$t,Za,6),this.tickMinor=this.instanced(i,ui,Og,this.levelWindowCells+1,2),this.tickMajor=this.instanced(i,ui,Bg,this.levelWindowCells+1,2);let h=new Li({color:ui,transparent:!0,opacity:_u,depthTest:!1,depthWrite:!1});this.disposables.push(h),this.layers.push({material:h,base:_u}),this.labels=new wn(new Qe,h),this.labels.renderOrder=1,this.labels.frustumCulled=!1,this.scene.add(this.labels)}mesh(e,t,n,i){let s=new At({color:t,transparent:!0,opacity:n,depthTest:!1,depthWrite:!1});this.disposables.push(s),this.layers.push({material:s,base:n});let r=new nt(e,s);return r.renderOrder=i,r.frustumCulled=!1,this.scene.add(r),r}instanced(e,t,n,i,s){let r=new At({color:t,transparent:!0,opacity:n,depthTest:!1,depthWrite:!1});this.disposables.push(r),this.layers.push({material:r,base:n});let o=new tr(e,r,i);return o.count=0,o.renderOrder=s,o.frustumCulled=!1,this.scene.add(o),o}loop(e,t,n,i){let s=new Li({color:t,transparent:!0,opacity:n,depthTest:!1,depthWrite:!1});this.disposables.push(s),this.layers.push({material:s,base:n});let r=new Na(e,s);return r.renderOrder=i,r.frustumCulled=!1,this.scene.add(r),r}invalidate(){this.obstaclesDirty=!0}putCell(e,t,n,i){this.tmpMatrix.makeScale(Cv,Cv,1).setPosition(n,i,0),e.setMatrixAt(t,this.tmpMatrix)}writeObstacle=(e,t,n)=>{if(t!==this.hy)return;let i=this.len,s=e-this.sx,r=n-this.sz;if(s<0||s>=i||r<0||r>=i)return;if(this.obstacleCount<this.obstacles.instanceMatrix.count)this.putCell(this.obstacles,this.obstacleCount++,s+0.5,r+0.5)};writeBody=(e,t,n,i)=>{if(i===0||t!==this.hy)return;let s=this.len,r=e-this.sx,o=n-this.sz;if(r<0||r>=s||o<0||o>=s)return;if(this.bodyCount<this.body.instanceMatrix.count)this.tmpColor.copy(co).lerp(uo,i/this.bodyDenom),this.body.setColorAt(this.bodyCount,this.tmpColor),this.putCell(this.body,this.bodyCount++,r+0.5,o+0.5)};putWall(e,t,n,i,s){return this.tmpMatrix.makeScale(i,s,1).setPosition(t,n,0),this.walls.setMatrixAt(e,this.tmpMatrix),e+1}putMapWalls(e,t,n){let i=this.len,s=Th;if(pl(t))e=this.putWall(e,-s/2,i/2,s,i+2*s);if(fl(t,i,this.size))e=this.putWall(e,i+s/2,i/2,s,i+2*s);if(pl(n))e=this.putWall(e,i/2,-s/2,i+2*s,s);if(fl(n,i,this.size))e=this.putWall(e,i/2,i+s/2,i+2*s,s);return e}refresh(e,t,n,i){let s=Et(e);if(this.len=wo(s,this.windowCells),this.hy=n,this.sx=ul(t,s,this.windowCells),this.sz=ul(i,s,this.windowCells),this.levelLen=wo(s,this.levelWindowCells),this.sy=ul(n,s,this.levelWindowCells),this.obstacleCount=0,wr(e,this.writeObstacle),this.obstacles.count=this.obstacleCount,this.obstacles.instanceMatrix.needsUpdate=!0,this.bodyCount=0,this.bodyLen=ln(e),this.bodyDenom=Math.max(1,this.bodyLen-1),_i(e,this.writeBody),this.body.count=this.bodyCount,this.body.instanceMatrix.needsUpdate=!0,this.body.instanceColor)this.body.instanceColor.needsUpdate=!0;let r=this.putMapWalls(0,this.sx,this.sz),o=Th,a=this.stripX0+Yn/2;if(pl(this.sy))r=this.putWall(r,a,-o/2,Yn+2*o,o);if(fl(this.sy,this.levelLen,s))r=this.putWall(r,a,this.len+o/2,Yn+2*o,o);this.walls.count=r,this.walls.instanceMatrix.needsUpdate=!0,this.putTicks(s)}putTicks(e){let t=0,n=0,i=this.cellH;for(let s=this.sy+1;s<this.sy+this.levelLen;s++){if(s<=0||s>=e)continue;let r=(s-this.sy)*i;if(gv(s,$1))this.tmpMatrix.makeScale(Sv,yv,1).setPosition(this.stripX0+Sv/2,r,0),this.tickMajor.setMatrixAt(n++,this.tmpMatrix);else this.tmpMatrix.makeScale(_v,yv,1).setPosition(this.stripX0+_v/2,r,0),this.tickMinor.setMatrixAt(t++,this.tmpMatrix)}this.tickMinor.count=t,this.tickMajor.count=n,this.tickMinor.instanceMatrix.needsUpdate=!0,this.tickMajor.instanceMatrix.needsUpdate=!0}placeApple(e,t,n,i,s,r){let o=this.len,a=this.appleHere,l=this.appleRing,d=this.appleArrow,c=hl(e,n,o)&&hl(t,i,o),h=Mh(e,n,o)+0.5,u=Mh(t,i,o)+0.5;a.visible=c&&s,l.visible=c&&!s,d.visible=!c;let p=this.appleLeg,g=this.appleLegCap,x=0,m=1;if(c&&!s){m=r>0?1:-1;let f=u+m*Eo,T=(m>0?o-f:f)-dR;if(x=Math.min(Math.abs(r)*oR,aR,T),x>0)p.position.set(h,f+m*x/2,0),p.scale.set(Rv,x,1),g.position.set(h,f+m*x,0),g.scale.set(lR,Rv,1)}if(p.visible=x>0,g.visible=x>0,c)(s?a:l).position.set(h,u,0);else{d.position.set(h,u,0);let f=(o-1)/2;d.rotation.z=Math.atan2(-(e-n-f),t-i-f)}}placeHead(e,t,n,i,s){let r=this.headTri,o=this.headDot,a=this.headChevIn,l=this.headChevOut,d=n!==0||i!==0;if(r.visible=d,l.visible=!d&&s>0,a.visible=!d&&s<0,o.visible=!d&&s===0,r.position.set(e,t,0),o.position.set(e,t,0),a.position.set(e,t,0),l.position.set(e,t,0),d)r.rotation.z=Math.atan2(-n,i);let c=1-(performance.now()-this.pulseT0)/sR,h=iR*(c>0?1+rR*c*c:1);a.scale.set(h,h,1),l.scale.set(h,h,1)}setSize(e){if(e===this.size)return;this.size=e;let t=wo(e,this.windowCells);this.len=t,this.stripX0=t+Z1,this.levelLen=wo(e,this.levelWindowCells),this.cellH=t/this.levelLen;let n=Th,i=t+n+0.5;this.camera.left=-n-gl,this.camera.right=this.stripX0+Yn+n+gl,this.camera.bottom=-n-gl,this.camera.top=i+Lv+gl,this.camera.updateProjectionMatrix();let s=this.stripX0+Yn/2,r=Yn-bv,o=this.stripX0+r/2,a=this.stripX0+Yn-bv/2;this.bgTop.position.set(t/2,t/2,0),this.bgTop.scale.set(t+2*n,t+2*n,1),this.bgStrip.position.set(s,t/2,0),this.bgStrip.scale.set(Yn+2*n,t+2*n,1),this.borderTop.position.set(t/2,t/2,0),this.borderTop.scale.set(t,t,1),this.borderStrip.position.set(s,t/2,0),this.borderStrip.scale.set(Yn,t,1),this.stripTrack.position.set(o,t/2,0),this.stripTrack.scale.set(xv*0.25,t,1),this.levelHead.scale.set(r,xv,1),this.levelApple.scale.set(Ev,Ev,1),this.levelArrow.scale.set(Mv,Mv,1),this.troughLine.position.set(a,t/2,0),this.troughLine.scale.set(Q1,t,1),this.troughHead.scale.set(ml,ml,1),this.troughApple.scale.set(ml,ml,1),this.mainX=o,this.troughX=a,this.headTri.scale.set(vl,vl,1),this.headDot.scale.set(vl*0.8,vl*0.8,1),this.appleHere.scale.set(Eo,Eo,1),this.appleRing.scale.set(Eo,Eo,1),this.appleArrow.scale.set(Tv,Tv,1),this.buildLabels(i),this.obstacleKey=-1,this.layout()}labelSegs=[];buildLabels(e){this.labelSegs.length=0,this.pushLetter("X",0,e),this.pushLetter("Z",Ah+cR,e),this.pushLetter("Y",this.stripX0+(Yn-Ah)/2,e),this.labels.geometry.dispose();let t=new Qe;t.setAttribute("position",new Oe(this.labelSegs,3)),this.labels.geometry=t}pushLetter(e,t,n){let i=Ah,s=Lv,r=(o,a,l,d)=>{this.labelSegs.push(t+o*i,n+a*s,0,t+l*i,n+d*s,0)};if(e==="X")r(0,0,1,1),r(0,1,1,0);else if(e==="Z")r(0,1,1,1),r(1,1,0,0),r(0,0,1,0);else r(0,1,0.5,0.5),r(1,1,0.5,0.5),r(0.5,0.5,0.5,0)}get bottomCssPx(){return vv+this.panelH}resize(e,t){this.screenW=e,this.screenH=t,this.layout()}layout(){if(this.size<0)return;let e=this.camera.right-this.camera.left,t=this.camera.top-this.camera.bottom,n=Math.min(Y1,Math.max(J1,this.screenW*X1)),i=this.screenH*q1;if(n*t/e>i)n=i*e/t;this.panelW=n,this.panelH=n*t/e}render(e,t,n){if(n<uR||this.size<0)return;let i=Et(t),s=wt(t),r=Cn(t),o=pn(t),a=s.x+i*(s.y+i*s.z);if(this.obstaclesDirty||a!==this.obstacleKey||ln(t)!==this.bodyLen)this.obstaclesDirty=!1,this.obstacleKey=a,this.pulseT0=performance.now(),this.refresh(t,s.x,s.y,s.z);let l=this.sx,d=this.sz;this.placeHead(s.x-l+0.5,s.z-d+0.5,-o.depth.x,-o.depth.z,-o.depth.y),this.placeApple(r.x,r.z,l,d,r.y===s.y,r.y-s.y);let c=this.mainX,h=this.sy,u=this.levelLen;this.levelHead.position.set(c,wh(s.y,h,u)*this.len,0);let p=hl(r.y,h,u);if(this.levelApple.visible=p,this.levelArrow.visible=!p,p)this.levelApple.position.set(c,wh(r.y,h,u)*this.len,0);else{let T=r.y>=h+u;this.levelArrow.position.set(c,T?this.len-wv:wv,0),this.levelArrow.rotation.z=T?0:Math.PI}this.troughHead.position.set(this.troughX,Eh(s.y,i)*this.len,0),this.troughApple.position.set(this.troughX,Eh(r.y,i)*this.len,0);for(let T=0;T<this.layers.length;T++){let E=this.layers[T];E.material.opacity=E.base*n}let g=this.screenH,x=K1,m=g-vv-this.panelH,f=e.autoClear;e.autoClear=!1,e.setScissorTest(!0),e.setScissor(x,m,this.panelW,this.panelH),e.setViewport(x,m,this.panelW,this.panelH),e.render(this.scene,this.camera),e.setScissorTest(!1),e.setViewport(0,0,this.screenW,this.screenH),e.autoClear=f}dispose(){for(let e of this.geometries)e.dispose();this.labels.geometry.dispose();for(let e of this.disposables)e.dispose();this.geometries.length=0,this.disposables.length=0,this.layers.length=0}}var Fi=[{id:"msaa4",label:"MSAA4",samples:4,byteTarget:!1,resolveDepth:!0,smaa:!1},{id:"msaa2",label:"MSAA2",samples:2,byteTarget:!1,resolveDepth:!0,smaa:!1},{id:"msaa4-8bit",label:"MSAA4 8bit",samples:4,byteTarget:!0,resolveDepth:!0,smaa:!1},{id:"msaa4-nodepth",label:"MSAA4 no depth resolve",samples:4,byteTarget:!1,resolveDepth:!1,smaa:!1},{id:"msaa4-8bit-nodepth",label:"MSAA4 8bit no depth resolve",samples:4,byteTarget:!0,resolveDepth:!1,smaa:!1},{id:"smaa",label:"SMAA",samples:0,byteTarget:!1,resolveDepth:!0,smaa:!0},{id:"off",label:"off",samples:0,byteTarget:!1,resolveDepth:!0,smaa:!1}],Ch=[0,4,2.5,1.5],Iv=2,pe={msaa:Fi[0].samples,aaByte:!1,aaDepthResolve:!0,smaa:!1,bloom:!0,bloomScale:1,megapixelCap:Ch[0],fog:!0,miniMap:!0,statsOn:!1};function xl(){return{drawCalls:0,triangles:0,bufferW:0,bufferH:0,pixelRatio:1,devicePixelRatio:1,arena:0,snakeLength:0,aaLabel:"",miniMapBottomPx:0}}function bl(e){return e==="high"||e==="medium"||e==="low"}function Lh(e,t){let n=e.msaaGpuOnly===!0&&!t&&e.msaa>0;pe.megapixelCap=e.megapixelCap,pe.msaa=n?0:e.msaa,pe.aaByte=e.aaByte??!1,pe.aaDepthResolve=e.aaDepthResolve??!0,pe.smaa=n||(e.smaa??!1),pe.bloom=e.bloom!=="off",pe.bloomScale=e.bloom==="half"?0.5:1}function Dv(e,t,n){let i=Math.min(n>0?n:1,2);return e*i*t*i/1e6}function zv(e){pe.msaa=e.samples,pe.aaByte=e.byteTarget,pe.aaDepthResolve=e.resolveDepth,pe.smaa=e.smaa}function yl(){return{samples:pe.smaa?0:pe.msaa,byteTarget:pe.aaByte,resolveDepth:pe.aaDepthResolve,smaa:pe.smaa}}function Ph(){for(let e of Fi)if(e.smaa===pe.smaa&&e.samples===(pe.smaa?0:pe.msaa)&&e.byteTarget===pe.aaByte&&e.resolveDepth===pe.aaDepthResolve)return e;return null}function pR(e,t,n){if(n.msaaNeedsFinePointer&&!t)return!1;if(e==="")return!1;if(new RegExp(n.notMsaaGpuPattern,"i").test(e))return!1;return new RegExp(n.msaaGpuPattern,"i").test(e)}var fR=/swiftshader|llvmpipe|software|softpipe|microsoft basic render|basic render driver/i;function mR(e,t){if(e==="")return"unknown";if(fR.test(e))return"software";if(new RegExp(t.strongGpuPattern,"i").test(e))return"strong";return"weak"}var zi=null;function Fv(){if(zi!==null)return zi;zi="";try{if(typeof document>"u")return zi;let e=document.createElement("canvas"),t=e.getContext("webgl2")??e.getContext("webgl");if(t===null)return zi;let n=t.getExtension("WEBGL_debug_renderer_info");if(n!==null)zi=String(t.getParameter(n.UNMASKED_RENDERER_WEBGL));t.getExtension("WEBGL_lose_context")?.loseContext()}catch{zi=""}return zi}function Uv(){if(typeof window>"u"||typeof window.matchMedia!=="function")return!1;return window.matchMedia("(pointer: fine)").matches}function gR(e){let t=mR(Fv(),e);if(t==="unknown")return Uv()?"weak":"strong";return t}function Nv(e,t,n=gR(t)){if(e>=t.autoLowFromMegapixels||n==="software")return"low";if(n==="weak")return t.autoWeakGpu;if(e>=t.autoMediumFromMegapixels)return"medium";return"high"}if(typeof location<"u"&&/[?&]perf\b/.test(location.search))globalThis.__perf=pe;function Ov(e){return pR(Fv(),Uv(),e)}var vR=["EXT_color_buffer_float","EXT_color_buffer_half_float","OES_texture_float_linear","OES_texture_half_float_linear","EXT_disjoint_timer_query_webgl2","KHR_parallel_shader_compile","WEBGL_debug_renderer_info"],Bv=/swiftshader|llvmpipe|software|softpipe|microsoft basic render|basic render driver/i;function kv(e){let t=typeof WebGL2RenderingContext<"u"&&e instanceof WebGL2RenderingContext,n=e.getExtension("WEBGL_debug_renderer_info"),i=String(e.getParameter(e.RENDERER)),s=n!==null?String(e.getParameter(n.UNMASKED_RENDERER_WEBGL)):`(unmasked unavailable) ${i}`,r=n!==null?String(e.getParameter(n.UNMASKED_VENDOR_WEBGL)):String(e.getParameter(e.VENDOR)),o=e.getSupportedExtensions()??[],a=[];for(let l of vR)a.push(`${l}=${o.includes(l)?"yes":"no"}`);return{gpuRenderer:s,gpuVendor:r,glRenderer:i,glVersion:String(e.getParameter(e.VERSION)),shadingLanguage:String(e.getParameter(e.SHADING_LANGUAGE_VERSION)),webglVersion:t?2:1,maxSamples:t?Number(e.getParameter(e.MAX_SAMPLES)):0,maxTextureSize:Number(e.getParameter(e.MAX_TEXTURE_SIZE)),extensions:a.join(" "),software:Bv.test(s)||Bv.test(i)}}function Gv(e,t){let n=navigator;return{startedAt:new Date().toISOString(),...e,userAgent:n.userAgent,platform:n.platform,cores:n.hardwareConcurrency||0,memoryGb:n.deviceMemory??0,windowW:window.innerWidth,windowH:window.innerHeight,screenW:screen.width,screenH:screen.height,devicePixelRatio:window.devicePixelRatio||1,...t}}function Ih(e,t){let n=Math.min(window.devicePixelRatio||1,Iv);if(pe.megapixelCap>0)n=Math.min(n,Math.sqrt(pe.megapixelCap*1e6/Math.max(1,e*t)));return n}var pi=null;function xR(e){if(pi&&pi.canvas===e)return pi;bR();let t=new ru({canvas:e,antialias:!1,alpha:!1});return t.setPixelRatio(Ih(e.clientWidth||e.width||1,e.clientHeight||e.height||1)),t.toneMapping=gn,t.setClearColor(ao,1),e.addEventListener("webglcontextrestored",()=>t.setClearColor(ao,1)),pi={canvas:e,renderer:t,postFx:null},pi}function bR(){if(!pi)return;pi.postFx?.dispose(),pi.renderer.dispose(),pi=null}function Hv(e,t,n,i){let s=u0(i);Au(t.palettes,s.palette);let r=xR(e),o=r.renderer;o.setClearColor(ao,1);let a=new er,l=new Pu(t),d=v0(location.search)?w0(e,t.camera.free,Et(n)):null,c=new Yu(a),h=new _h(a),u=oo(n)==="plane"?new Sh(a,n):null,p=new Rh(t.minimap.windowCells,t.minimap.levelWindowCells),g=new Ku(a,void 0,s.snakeSkin),x=new ih(a),m=new ah(a,s.appleSkin),f=Eg();a.fog=f;let T=t.fog.defaultOn,E=$0?new dh(a,t.hints,s.compassSkin):null,b=fv(a,t),S=e.clientWidth||e.width||1,A=e.clientHeight||e.height||1,y=Ih(S,A);if(y!==o.getPixelRatio())o.setPixelRatio(y);o.setSize(S,A,!1),l.resize(S,A),p.resize(S,A),b.setViewportHeight?.(A*o.getPixelRatio());let v=r.postFx;if(v)v.attach(a,l.camera,t),v.setAa(yl()),v.setBloomScale(pe.bloomScale),v.resize(S,A,o.getPixelRatio());else v=new ku(o,a,l.camera,t,S,A,yl()),r.postFx=v;let _=v;_.setBloomScale(pe.bloomScale),_.setBloom(pe.bloom),o.info.autoReset=!pe.statsOn;function z(C){g.ensureCapacity(C),l.resetTurn(),l.syncImmediate(C);let B=l.camera.position;g.update(C,B.x,B.y,B.z,l.freeAmount)}function P(C){c.setSize(Et(C)),h.setSize(Et(C)),p.setSize(Et(C)),p.invalidate(),x.rebuild(C),E?.reset(),z(C)}P(n);let D=!0,N=!1;return{resize(C,B){let k=Ih(C,B);if(k!==o.getPixelRatio())o.setPixelRatio(k);o.setSize(C,B,!1),l.resize(C,B),p.resize(C,B),b.setViewportHeight?.(B*o.getPixelRatio()),_.resize(C,B,k)},setCameraTilt(C,B){l.setTilt(C,B)},setFogOn(C){T=C},applyPerf(C,B){_.setAa(yl()),_.setBloomScale(pe.bloomScale),_.setBloom(pe.bloom),o.info.autoReset=!pe.statsOn,this.resize(C,B)},gpuInfo(){return kv(o.getContext())},readPerf(C){let B=o.info.render;C.drawCalls=B.calls,C.triangles=B.triangles,C.bufferW=e.width,C.bufferH=e.height,C.pixelRatio=o.getPixelRatio(),C.aaLabel=_.aaLabel(),C.devicePixelRatio=window.devicePixelRatio||1,C.miniMapBottomPx=p.bottomCssPx},handle(C,B){switch(C.type){case"started":if(D)D=!1,z(B);else P(B);break;case"moved":case"ate":g.ensureCapacity(B);break;default:break}},render(C,B){if(pe.statsOn)o.info.reset();if(l.update(B,C),d!==null)d.apply(l.camera,C,B);if(l.consumeGlitchRequest())_.triggerGlitch();let k=l.camera.position;g.update(C,k.x,k.y,k.z,l.freeAmount);let G=wt(C),Q=pn(C);x.update(B,k.x,k.y,k.z,G.x,G.y,G.z,Q.depth.x,Q.depth.y,Q.depth.z,l.freeAmount,l.layerReach);let W=g.direction;b.update(C,W.x,W.y,W.z,x.isSolid,l.freeAmount),f.density=T&&pe.fog&&d===null?t.fog.density*Ke.smoothstep(l.freeAmount,0,1):0,m.update(C),E?.update(C,l.camera,B,l.freeAmount);let q=l.reveal<=0;if(c.update(k.x,k.y,k.z,l.freeAmount,G.x,G.y,G.z,q),h.update(k.x,k.y,k.z,l.freeAmount,q),u?.update(l.reveal),_.render(B),pe.miniMap&&(d===null||!d.hudHidden))p.render(o,C,l.freeAmount)},dispose(){if(N)return;N=!0,d?.dispose(),_.detach(),c.dispose(),h.dispose(),u?.dispose(),p.dispose(),g.dispose(),x.dispose(),m.dispose(),E?.dispose(),b.dispose()}}}var yR=220,_R=1000,SR=0.4,MR=33.4,wR=`
#perf-panel{position:fixed;left:max(6px,env(safe-area-inset-left));top:60px;z-index:20;width:214px;box-sizing:border-box;
padding:5px 6px;background:rgba(5,6,10,.72);border:1px solid rgba(57,255,224,.45);border-radius:6px;color:#9ff;
font:10.5px/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#perf-panel.hidden{display:none}
#perf-panel pre{margin:0;font:inherit;white-space:pre;color:inherit}
#perf-panel .row{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
#perf-panel button{font:inherit;color:#9ff;background:rgba(57,255,224,.10);border:1px solid rgba(57,255,224,.5);border-radius:4px;
padding:3px 5px;min-height:24px;cursor:pointer;touch-action:manipulation}
#perf-panel button.off{color:#f88;border-color:rgba(255,120,120,.6);background:rgba(255,80,80,.10)}
#perf-panel button:active{background:rgba(57,255,224,.35)}
#perf-bench{position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:21;padding:8px 12px;max-width:92vw;text-align:center;
background:rgba(5,6,10,.85);border:1px solid #ff0;border-radius:8px;color:#ff0;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none}
#perf-bench.hidden{display:none}
#perf-result{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;background:rgba(5,6,10,.96);color:#9ff;font:13px ui-monospace,Menlo,Consolas,monospace}
#perf-result.hidden{display:none}
#perf-result textarea{flex:1;min-height:0;width:100%;box-sizing:border-box;background:#000;color:#9ff;border:1px solid rgba(57,255,224,.5);font:11px/1.3 ui-monospace,Menlo,Consolas,monospace;white-space:pre;overflow:auto;resize:none}
#perf-result .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#perf-result button{font:inherit;color:#9ff;background:rgba(57,255,224,.12);border:1px solid rgba(57,255,224,.6);border-radius:6px;padding:10px 16px;min-height:44px}
#perf-panel .hint{opacity:.55;margin-top:3px}
`;function Vv(e){let t=document.createElement("style");t.textContent=wR,document.head.appendChild(t);let n=document.createElement("div");n.id="perf-panel",n.className="hidden";let i=document.createElement("pre");i.textContent="...";let s=document.createElement("div");s.className="row";let r=document.createElement("div");r.className="hint",r.textContent="` hide  1-5 toggles  6 bench";let o=S("AA"),a=S("Bloom"),l=S("Cap"),d=S("Fog"),c=S("Map"),h=S("Run bench (6)");s.append(o,a,l,d,c,h),n.append(i,s,r),document.body.appendChild(n);let u=document.createElement("div");u.id="perf-bench",u.className="hidden",document.body.appendChild(u);let p=document.createElement("div");p.id="perf-result",p.className="hidden";let g=document.createElement("div");g.textContent="Benchmark finished. Press Copy and send the text (or Save file).";let x=document.createElement("textarea");x.readOnly=!0,x.spellcheck=!1;let m=document.createElement("div");m.className="bar";let f=S("Copy"),T=S("Save file"),E=S("Close"),b=document.createElement("span");m.append(f,T,E,b),p.append(g,x,m),document.body.appendChild(p);for(let L of["pointerdown","pointerup","touchstart","touchend"])p.addEventListener(L,(Ie)=>Ie.stopPropagation());for(let L of["pointerdown","pointerup","touchstart","touchend","contextmenu"])n.addEventListener(L,(Ie)=>Ie.stopPropagation());function S(L){let Ie=document.createElement("button");return Ie.type="button",Ie.tabIndex=-1,Ie.textContent=L,Ie}function A(L,Ie){let Ue=L.indexOf(Ie);return L[(Ue+1)%L.length]}function y(L){return L>0?String(L):"none"}function v(){return Ph()?.label??`custom(${pe.msaa}${pe.aaByte?" 8bit":""}${pe.smaa?" smaa":""})`}function _(){return pe.bloom?pe.bloomScale<1?"half":"on":"off"}function z(){o.textContent=`AA ${v()}`,o.classList.toggle("off",pe.msaa===0&&!pe.smaa),a.textContent=`Bloom ${_()}`,a.classList.toggle("off",!pe.bloom),l.textContent=`Cap ${y(pe.megapixelCap)}`,l.classList.toggle("off",pe.megapixelCap>0),d.textContent=`Fog ${pe.fog?"on":"off"}`,d.classList.toggle("off",!pe.fog),c.textContent=`Map ${pe.miniMap?"on":"off"}`,c.classList.toggle("off",!pe.miniMap)}function P(){if(Ve!==null&&Ve.running)return;z(),e.apply(),$e(),J=0}function D(){let L=Fi.indexOf(Ph()??Fi[Fi.length-1]);zv(Fi[(L+1)%Fi.length]),P()}function N(){pe.bloom=!pe.bloom,P()}function C(){pe.megapixelCap=A(Ch,pe.megapixelCap),P()}function B(){pe.fog=!pe.fog,P()}function k(){pe.miniMap=!pe.miniMap,P()}let G={Digit1:D,Digit2:N,Digit3:C,Digit4:B,Digit5:k};function Q(){if(Ve!==null&&Ve.running)return;e.startBench()}G.Digit6=Q;let W=[[h,Q],[o,D],[a,N],[l,C],[d,B],[c,k]];for(let[L,Ie]of W)L.addEventListener("click",()=>{Ie(),L.blur()});function q(L){if(navigator.clipboard!==void 0&&window.isSecureContext)return navigator.clipboard.writeText(L).then(()=>b.textContent="copied",()=>b.textContent=ee()?"copied":"copy failed: select the text and copy by hand"),!0;let Ie=ee();return b.textContent=Ie?"copied":"copy failed: select the text and copy by hand",Ie}function ee(){x.focus(),x.select();try{return document.execCommand("copy")}catch{return!1}}f.addEventListener("click",()=>q(x.value)),T.addEventListener("click",()=>{let L=new Blob([x.value],{type:"text/plain"}),Ie=URL.createObjectURL(L),Ue=document.createElement("a");Ue.href=Ie,Ue.download=`snake-bench-${new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")}.txt`,document.body.appendChild(Ue),Ue.click(),Ue.remove(),setTimeout(()=>URL.revokeObjectURL(Ie),1000),b.textContent="saved"}),E.addEventListener("click",()=>{p.classList.add("hidden"),e.resultClosed()}),window.addEventListener("keydown",(L)=>{if(!_e||L.repeat||L.ctrlKey||L.metaKey||L.altKey)return;let Ie=G[L.code];if(Ie===void 0)return;let Ue=L.target;if(Ue!==null&&(Ue.tagName==="INPUT"||Ue.tagName==="TEXTAREA"))return;Ie()});let xe=xl(),_e=!1,Ve=null,Fe=0,J=0,te=0,se=0,Re=0,Pe=0,Ee=0,Rt=0,Ge=0,qe=0,st=-1;function $e(){te=0,se=0,Re=0,Pe=0,Ee=0,Ge=0,qe=0,Fe=0}function Mt(L,Ie,Ue){return L.toFixed(Ue).padStart(Ie," ")}function pt(L,Ie,Ue){let{bufferW:lt,bufferH:R}=xe,M=lt*R/1e6,F=L>0?1000/L:0;i.textContent=`FPS ${Mt(Ee,5,1)}  worst ${Mt(F,5,1)}${L>MR?"!":" "}
frame ${Mt(Ie,5,1)} ms  max ${Mt(L,5,1)}
js    ${Mt(Ue,5,1)} ms (cpu)
draws ${xe.drawCalls}  tris ${xe.triangles}
buf ${lt}x${R}  ${M.toFixed(2)} MP
pixel ratio ${xe.pixelRatio.toFixed(2)} (device ${xe.devicePixelRatio.toFixed(2)})
arena ${xe.arena}^3  snake ${xe.snakeLength}
AA ${v()} bloom ${_()} cap ${y(pe.megapixelCap)}
fog ${pe.fog?"on":"off"} map ${pe.miniMap?"on":"off"}`}let kt=!1;function Ct(){n.classList.toggle("hidden",!(_e&&kt))}function Lt(L){if(L===_e)return;if(_e=L,pe.statsOn=L,Ct(),L)z(),$e(),J=0;e.apply()}return{beginFrame(L){if(!_e)return;if(Fe===0){Fe=L;return}let Ie=L-Fe;if(Fe=L,te++,se+=Ie,Ie>Pe)Pe=Ie;if(L-Rt>=_R)Rt=L,qe=Ge,Ge=0;if(Ie>Ge)Ge=Ie},endFrame(L){if(!_e)return;Re+=L;let Ie=Fe;if(Ie<J||te===0)return;J=Ie+yR;let Ue=se/te,lt=1000/Ue;if(Ee=Ee===0?lt:Ee+(lt-Ee)*SR,Ve!==null&&Ve.running){let F=Math.ceil(Ve.remainingMs(Fe)/1000);u.textContent=`BENCHMARK ${Ve.stageNumber}/${Ve.stageCount}: ${Ve.stageLabel}${Ve.measuring?"":" (warming up)"}
~${F} s left. Do not touch anything, the game is frozen on purpose.`,u.style.whiteSpace="pre-line"}e.sample(xe);let R=Ge>qe?Ge:qe;pt(R,Ue,Re/te);let M=Math.round(xe.miniMapBottomPx+6);if(M!==st&&M>0)st=M,n.style.top=`${M}px`;te=0,se=0,Re=0,Pe=0},toggle(){Lt(!_e)},refresh(){z()},setShown(L){if(L===kt)return;kt=L,Ct()},open(){Lt(!0)},setBench(L){Ve=L;let Ie=L!==null&&L.running;if(u.classList.toggle("hidden",!Ie),Ie)u.textContent="BENCHMARK starting...";h.disabled=Ie;for(let Ue of[o,a,l,d,c])Ue.disabled=Ie;z()},showResult(L){x.value=L,b.textContent="",p.classList.remove("hidden"),x.scrollTop=0},isOpen(){return _e}}}var Sl=5000,ER=2500,zh=700,TR=8,Dh=4096,Wv=18,jv=34,Fh=100,Uh=20240607;function Xv(e,t){let n=e.msaaGpuOnly===!0&&!t&&e.msaa>0;pe.msaa=n?0:e.msaa,pe.aaByte=e.aaByte,pe.aaDepthResolve=e.aaDepthResolve,pe.smaa=n||e.smaa,pe.bloom=e.bloom,pe.bloomScale=e.bloomScale,pe.megapixelCap=e.megapixelCap}function AR(e){if(e.smaa)return"SMAA";if(e.msaa===0)return"off";return`MSAA${e.msaa}${e.aaByte?" 8bit":""}${e.msaaGpuOnly?" on discrete GPUs, SMAA elsewhere":""}`}function _l(e,t){return{id:e,label:`quality ${e.replace("q-","")} (cap ${t.megapixelCap||"none"} MP, AA ${AR(t)}, bloom ${t.bloom})`,msaa:t.msaa,aaByte:t.aaByte??!1,aaDepthResolve:t.aaDepthResolve??!0,smaa:t.smaa??!1,bloom:t.bloom!=="off",bloomScale:t.bloom==="half"?0.5:1,megapixelCap:t.megapixelCap,msaaGpuOnly:t.msaaGpuOnly??!1}}function fi(e,t,n){return{id:e,label:t,msaa:0,aaByte:!1,aaDepthResolve:!0,smaa:!1,bloom:!0,bloomScale:1,megapixelCap:0,...n}}var Ui=[fi("as-is","as is (MSAA4 half-float target, bloom, no cap)",{msaa:4}),fi("no-aa","AA off (full res, full bloom)",{}),fi("no-bloom","bloom off (MSAA4 half)",{msaa:4,bloom:!1}),fi("no-aa-bloom","AA off + bloom off",{bloom:!1}),fi("aa4-8bit","MSAA4, 8-bit sRGB target",{msaa:4,aaByte:!0}),fi("aa2-8bit","MSAA2, 8-bit sRGB target",{msaa:2,aaByte:!0}),fi("aa4-nodepth","MSAA4 half, no depth resolve",{msaa:4,aaDepthResolve:!1}),fi("aa4-8bit-nodepth","MSAA4 8-bit, no depth resolve",{msaa:4,aaByte:!0,aaDepthResolve:!1}),fi("smaa","SMAA (post-process), full bloom",{smaa:!0}),_l("q-high",mt.quality.levels.high),_l("q-high-msaa",{...mt.quality.levels.high,msaaGpuOnly:!1}),_l("q-medium",mt.quality.levels.medium),_l("q-low",mt.quality.levels.low)];function Ml(e,t,n){if(t<=0)return 0;let i=Math.ceil(n/100*t)-1;if(i<0)i=0;if(i>t-1)i=t-1;return e[i]}function RR(e,t){if(t<=0)return{avg:0,median:0,p95:0,p99:0,min:0,max:0,over60:0,over30:0};let n=0,i=0,s=0;for(let o=0;o<t;o++){let a=e[o];if(n+=a,a>Wv)i++;if(a>jv)s++}let r=e.slice(0,t).sort();return{avg:n/t,median:Ml(r,t,50),p95:Ml(r,t,95),p99:Ml(r,t,99),min:r[0],max:r[t-1],over60:i,over30:s}}class Nh{hooks;phase="idle";stageIndex=-1;phaseEnd=0;settleFrames=0;lastNow=0;n=0;frames=new Float32Array(Dh);js=new Float32Array(Dh);results=[];snap;constructor(e,t){this.hooks=e;this.snap=t}get running(){return this.phase!=="idle"}get stageNumber(){return this.stageIndex+1}get stageCount(){return Ui.length}get stageLabel(){return this.stageIndex>=0&&this.stageIndex<Ui.length?Ui[this.stageIndex].label:""}get measuring(){return this.phase==="measure"}remainingMs(e){if(this.phase==="idle")return 0;let t=Math.max(0,this.phaseEnd-e),i=(Ui.length-this.stageIndex-1)*(zh+Sl);return this.phase==="settle"?t+Sl+i:t+i}start(e){this.results.length=0,this.stageIndex=0,this.enterSettle(e,ER),this.hooks.applyStage(Ui[0])}abort(e){if(this.phase==="idle")return;this.phase="idle",this.hooks.finished(this.results.slice(),e)}enterSettle(e,t){this.phase="settle",this.phaseEnd=e+t,this.settleFrames=0,this.lastNow=0}frame(e,t){if(this.phase==="idle")return;let n=this.lastNow===0?0:e-this.lastNow;if(this.lastNow=e,this.phase==="settle"){if(this.settleFrames++,e>=this.phaseEnd&&this.settleFrames>=TR)this.phase="measure",this.phaseEnd=e+Sl,this.n=0,this.lastNow=e;return}if(n>0&&this.n<Dh)this.frames[this.n]=n,this.js[this.n]=t,this.n++;if(e>=this.phaseEnd)this.finishStage(e)}finishStage(e){let t=Ui[this.stageIndex],n=RR(this.frames,this.n),i=0;for(let r=0;r<this.n;r++)i+=this.js[r];let s=this.js.slice(0,this.n).sort();if(this.hooks.sample(this.snap),this.results.push({stage:t,frames:this.n,avgMs:n.avg,medianMs:n.median,p95Ms:n.p95,p99Ms:n.p99,minMs:n.min,maxMs:n.max,over60:n.over60,over30:n.over30,jsAvgMs:this.n>0?i/this.n:0,jsP95Ms:Ml(s,this.n,95),drawCalls:this.snap.drawCalls,triangles:this.snap.triangles,bufferW:this.snap.bufferW,bufferH:this.snap.bufferH,pixelRatio:this.snap.pixelRatio,aaLabel:this.snap.aaLabel}),this.stageIndex++,this.stageIndex>=Ui.length){this.phase="idle",this.hooks.finished(this.results.slice(),null);return}this.enterSettle(e,zh),this.hooks.applyStage(Ui[this.stageIndex])}}function xs(e,t){return e.toFixed(1).padStart(t," ")}function Jv(e,t,n){let i=[];if(i.push("SNAKE BENCH v2"+(n!==null?` (INCOMPLETE: ${n})`:"")),i.push(`date: ${e.startedAt}`),i.push(`GPU: ${e.gpuRenderer}`),i.push(`GPU vendor: ${e.gpuVendor}`),e.software)i.push("WARNING: software rendering detected, the browser is NOT using the video card (check hardware acceleration)");i.push(`WebGL: ${e.glVersion} | GLSL: ${e.shadingLanguage} | maxSamples ${e.maxSamples} | maxTex ${e.maxTextureSize}`),i.push(`GL renderer (masked): ${e.glRenderer}`),i.push(`extensions: ${e.extensions}`),i.push(`browser: ${e.userAgent}`),i.push(`platform: ${e.platform} | cores ${e.cores} | mem ${e.memoryGb>0?e.memoryGb+" GB":"n/a"}`),i.push(`window ${e.windowW}x${e.windowH} css | screen ${e.screenW}x${e.screenH} | devicePixelRatio ${e.devicePixelRatio}`),i.push(`game quality setting at start: ${e.quality}`),i.push(`scene: arena ${e.arena}^3, snake ${e.snakeLength}, mode ${e.mode}, seed ${e.seed}, logic frozen, default camera`),i.push(`run: ${Sl/1000} s per stage, first ${zh} ms after each switch discarded; frame = requestAnimationFrame interval; over60 = >${Wv} ms, over30 = >${jv} ms; js = tick+render call CPU time`),i.push(""),i.push("stage              frames   avg   med   p95   p99   max  >60  >30   js  jsp95 draws    tris  buffer         MP   pr  vs-med");let s=t.length>0?t[0].medianMs:0;for(let r of t){let o=r.bufferW*r.bufferH/1e6,a=s>0?`${((r.medianMs-s)/s*100).toFixed(0)}%`.padStart(6," "):"     -";i.push(`${r.stage.id.padEnd(18," ")} ${String(r.frames).padStart(6," ")} ${xs(r.avgMs,5)} ${xs(r.medianMs,5)} ${xs(r.p95Ms,5)} ${xs(r.p99Ms,5)} ${xs(r.maxMs,5)} ${String(r.over60).padStart(4," ")} ${String(r.over30).padStart(4," ")} ${xs(r.jsAvgMs,4)} ${xs(r.jsP95Ms,5)} ${String(r.drawCalls).padStart(5," ")} ${String(r.triangles).padStart(7," ")}  ${`${r.bufferW}x${r.bufferH}`.padEnd(10," ")} ${o.toFixed(2).padStart(5," ")} ${r.pixelRatio.toFixed(2)} ${a}  [${r.aaLabel}]`)}return i.push('(all times in ms; vs-med = median frame time relative to "as-is", negative = faster)'),i.join(`
`)}function Yv(e,t,n){let i=Math.abs(e),s=Math.abs(t);if(i<n&&s<n)return null;if(i>s)return e>0?"right":"left";return t>0?"down":"up"}var To=1;function Ao(e,t,n,i){let s=e+t*n;if(s>i)return i;if(s<-i)return-i;return s}function qv(e,t,n){if(e==="mouse"){if(t!==0)return"tilt";return n>0?"ignore":"gesture"}return n>0?"tilt":"gesture"}function Kv(e){return e?1:2}var Oh=["left","right","up","down"];function Zv(e){if(e===void 0||!Oh.includes(e))return null;return e}function Bh(e){return e==="left"?"left":"right"}function Qv(e,t){return!e.has(t)}var wl=["ShiftLeft","ShiftRight","Space"];function kh(e){return wl.includes(e)}function ur(e){let t=new Set,n=!1;function i(){let s=t.size>0;if(s===n)return;n=s,e(n)}return{press(s){t.add(s),i()},release(s){t.delete(s),i()},releaseAll(){t.clear(),i()},isOn:()=>n}}var CR=0.0012,LR=1,PR=10,IR=16,DR=400;function $v(e){let{camera:t,input:n}=e;return{wheelPerPx:t.zoomWheelPerPx??CR,pinchGain:t.zoomPinchGain??LR,lockPx:n.twoFingerLockPx??PR}}function ex(e,t,n){let i=t===1?e*IR:t===2?e*DR:e;return Math.exp(i*n)}function tx(e,t,n){if(e<=0||t<=0)return 1;return Math.pow(e/t,n)}function nx(e,t,n){return e<t?t:e>n?n:e}function ix(e,t,n){if(e<n&&t<n)return"pending";if(Math.abs(t-e)<n/4)return"pending";return t>e?"zoom":"tilt"}function sx(e,t){let n=new Map,i=e.querySelectorAll("[data-pad]");function s(){for(let d of i)d.classList.remove("queued")}function r(d){let c=n.get(d);if(c===void 0)return;c.classList.remove("pressed"),n.delete(d)}function o(d){if(d.pointerType==="mouse"&&d.button!==0)return;let c=d.target?.closest("[data-pad]");if(c===null||c===void 0||!e.contains(c))return;if(d.preventDefault(),!Qv(new Set(n.keys()),d.pointerId))return;try{c.setPointerCapture(d.pointerId)}catch{}let h=Zv(c.dataset.pad);if(h===null)return;if(n.set(d.pointerId,c),c.classList.add("pressed"),s(),c.classList.add("queued"),t.onTurn(h),typeof navigator.vibrate==="function")navigator.vibrate(8)}function a(d){r(d.pointerId)}function l(d){d.preventDefault()}return e.addEventListener("pointerdown",o),e.addEventListener("pointerup",a),e.addEventListener("pointercancel",a),e.addEventListener("lostpointercapture",a),e.addEventListener("contextmenu",l),{clearQueued:s,detach(){e.removeEventListener("pointerdown",o),e.removeEventListener("pointerup",a),e.removeEventListener("pointercancel",a),e.removeEventListener("lostpointercapture",a),e.removeEventListener("contextmenu",l);for(let d of i)d.classList.remove("pressed","queued");n.clear()}}}function zR(e,t,n,i,s){let r=Math.hypot(e,t);if(n<=0||r===0){s.x=0,s.y=0;return}let o=Math.min(r/n,1);if(o<=i.deadZone){s.x=0,s.y=0;return}let a=Math.pow((o-i.deadZone)/(1-i.deadZone),i.curve);s.x=e/r*a,s.y=t/r*a}function FR(e,t,n){return e>=0&&e<=n.tapMaxMs&&t<=n.deadZone}function Gh(e,t,n){return e*t*n/1000}function rx(e,t,n,i){let s={x:0,y:0},r=null,o=0,a=0,l=1,d=0,c=0;function h(y,v){t.style.transform=`translate(${y}px, ${v}px)`}function u(y){let v=y.clientX-o,_=y.clientY-a,z=Math.hypot(v,_);if(z>l)v=v/z*l,_=_/z*l;let P=l>0?z/l:0;if(P>c)c=P;zR(v,_,l,n,s),h(v,_)}function p(){if(r!==null&&e.hasPointerCapture(r))try{e.releasePointerCapture(r)}catch{}r=null,s.x=0,s.y=0,h(0,0),e.classList.remove("active")}function g(y){if(y.pointerType==="mouse"&&y.button!==0)return;if(y.preventDefault(),r!==null)return;let v=e.getBoundingClientRect();if(o=v.left+v.width/2,a=v.top+v.height/2,l=(v.width-t.offsetWidth)/2,l<1)l=v.width/2;r=y.pointerId,d=y.timeStamp,c=0;try{e.setPointerCapture(y.pointerId)}catch{}e.classList.add("active"),u(y)}function x(y){if(y.pointerId!==r)return;u(y)}function m(y){if(y.pointerId!==r)return;let v=y.type==="pointerup"&&FR(y.timeStamp-d,c,n);if(p(),v)f(),i()}function f(){e.classList.remove("flash"),e.offsetWidth,e.classList.add("flash")}function T(){e.classList.remove("flash")}function E(y){y.preventDefault()}function b(y){y.preventDefault()}function S(){p()}function A(){if(document.hidden)p()}return e.addEventListener("animationend",T),e.addEventListener("pointerdown",g),e.addEventListener("pointermove",x),e.addEventListener("pointerup",m),e.addEventListener("pointercancel",m),e.addEventListener("lostpointercapture",m),e.addEventListener("contextmenu",E),e.addEventListener("touchstart",b,{passive:!1}),window.addEventListener("blur",S),document.addEventListener("visibilitychange",A),{state:s,release:p,detach(){e.removeEventListener("animationend",T),e.removeEventListener("pointerdown",g),e.removeEventListener("pointermove",x),e.removeEventListener("pointerup",m),e.removeEventListener("pointercancel",m),e.removeEventListener("lostpointercapture",m),e.removeEventListener("contextmenu",E),e.removeEventListener("touchstart",b),window.removeEventListener("blur",S),document.removeEventListener("visibilitychange",A),p()}}}function ox(e,t){let n=ur((h)=>{e.classList.toggle("pressed",h),t.onBoost?.(h)}),i=(h)=>`ptr:${h}`;function s(h){if(h.pointerType==="mouse"&&h.button!==0)return;h.preventDefault();try{e.setPointerCapture(h.pointerId)}catch{}n.press(i(h.pointerId))}function r(h){n.release(i(h.pointerId))}function o(h){h.preventDefault()}function a(h){h.preventDefault()}function l(h){n.release(i(h.pointerId))}function d(){n.releaseAll()}function c(){if(document.hidden)n.releaseAll()}return e.addEventListener("pointerdown",s),e.addEventListener("pointerup",r),e.addEventListener("pointercancel",r),e.addEventListener("lostpointercapture",r),e.addEventListener("contextmenu",o),e.addEventListener("touchstart",a,{passive:!1}),document.addEventListener("pointerup",l),document.addEventListener("pointercancel",l),window.addEventListener("blur",d),document.addEventListener("visibilitychange",c),{setActive(h){e.classList.toggle("boosting",h)},release:()=>n.releaseAll(),detach(){e.removeEventListener("pointerdown",s),e.removeEventListener("pointerup",r),e.removeEventListener("pointercancel",r),e.removeEventListener("lostpointercapture",r),e.removeEventListener("contextmenu",o),e.removeEventListener("touchstart",a),document.removeEventListener("pointerup",l),document.removeEventListener("pointercancel",l),window.removeEventListener("blur",d),document.removeEventListener("visibilitychange",c),n.releaseAll(),e.classList.remove("pressed","boosting")}}}var Hh={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",KeyW:"up",KeyS:"down",KeyA:"left",KeyD:"right"},Vh="Escape",Wh="KeyR";function UR(e){return Hh[e]??null}function ax(e){let t=ur((o)=>e.onBoost?.(o));function n(o){if(o.code===Vh){if(o.preventDefault(),!o.repeat)e.onPause?.();return}if(o.code===Wh){if(o.ctrlKey||o.metaKey||o.altKey)return;if(o.preventDefault(),!o.repeat)e.onCameraReset?.();return}if(kh(o.code)){if(o.ctrlKey||o.metaKey||o.altKey)return;if(o.preventDefault(),!o.repeat)t.press(o.code);return}if(o.ctrlKey||o.metaKey||o.altKey)return;let a=UR(o.code);if(a===null)return;if(o.preventDefault(),o.repeat)return;e.onTurn(a)}function i(o){if(kh(o.code))t.release(o.code)}function s(){t.releaseAll()}function r(){if(document.hidden)t.releaseAll()}return window.addEventListener("keydown",n),window.addEventListener("keyup",i),window.addEventListener("blur",s),document.addEventListener("visibilitychange",r),()=>{window.removeEventListener("keydown",n),window.removeEventListener("keyup",i),window.removeEventListener("blur",s),document.removeEventListener("visibilitychange",r),t.releaseAll()}}function lx(e,t,n,i){let s=null,r=new Map,o=!1,a=!1,l="tilt",d=0,c=0,h=0,u=0,p=0,g=0,x=n.input.tiltRadPerPx,m=$v(n);function f(){let k=0,G=0;for(let q of r.values())k+=q.x,G+=q.y;let Q=r.size||1;u=k/Q,p=G/Q;let W=0;for(let q of r.values())W+=Math.hypot(q.x-u,q.y-p);g=W/Q}function T(k){v(),o=!0,a=k,l=k?"tilt":"pending",f(),E()}function E(){d=u,c=p,h=g}function b(){o=!1}function S(k){if(!r.delete(k))return;if(!o)return;if(r.size<Kv(a))b();else f(),E()}let A=0,y=0;function v(){s=null}function _(k){let G=qv(k.pointerType,k.button,r.size);if(G==="ignore")return;if(r.set(k.pointerId,{x:k.clientX,y:k.clientY}),G==="tilt"){try{e.setPointerCapture(k.pointerId)}catch{}if(o)f(),E();else T(k.pointerType==="mouse");return}s=k.pointerId,A=k.clientX,y=k.clientY;try{e.setPointerCapture(k.pointerId)}catch{}}function z(k){let G=r.get(k.pointerId);if(G!==void 0)G.x=k.clientX,G.y=k.clientY;if(o){if(G===void 0)return;let W=u,q=p,ee=g;f();let xe=u-W,_e=p-q;if(l==="pending"){l=ix(Math.hypot(u-d,p-c),Math.abs(g-h),m.lockPx);return}if(l==="tilt")i.onCameraTiltBy?.(xe*x,_e*x);else i.onCameraZoomBy?.(tx(ee,g,m.pinchGain));return}if(k.pointerId!==s)return;if(t==="taps")return;let Q=Yv(k.clientX-A,k.clientY-y,n.input.swipeMinPx);if(Q===null)return;A=k.clientX,y=k.clientY,i.onTurn(Q)}function P(k){if(S(k.pointerId),k.pointerId!==s)return;if(v(),e.hasPointerCapture(k.pointerId))e.releasePointerCapture(k.pointerId)}function D(k){if(S(k.pointerId),k.pointerId===s)v()}function N(k){if(S(k.pointerId),k.pointerId===s)v()}function C(k){k.preventDefault()}function B(k){if(k.preventDefault(),k.deltaY===0)return;i.onCameraZoomBy?.(ex(k.deltaY,k.deltaMode,m.wheelPerPx))}return e.addEventListener("pointerdown",_),e.addEventListener("wheel",B,{passive:!1}),e.addEventListener("pointermove",z),e.addEventListener("pointerup",P),e.addEventListener("pointercancel",D),e.addEventListener("lostpointercapture",N),e.addEventListener("contextmenu",C),()=>{e.removeEventListener("pointerdown",_),e.removeEventListener("wheel",B),e.removeEventListener("pointermove",z),e.removeEventListener("pointerup",P),e.removeEventListener("pointercancel",D),e.removeEventListener("lostpointercapture",N),e.removeEventListener("contextmenu",C),v(),r.clear(),b()}}function dx(e,t,n,i){let s=lx(e,t,n,i),r=ax(i);return()=>{s(),r()}}function cx(e){return e==="taps"||e==="swipes"}function ux(e,t){if(cx(e))return e;return cx(t)?t:"taps"}function hx(e,t,n,i,s){let r=e.createGain();r.gain.value=s?i.volume:0,r.connect(t);let o=s,a=!1;function l(){r.gain.setTargetAtTime(o?i.volume:0,e.currentTime,i.fadeMs/3000)}async function d(){let c=await fetch(n);if(!c.ok)throw Error(`music: ${n} → HTTP ${c.status}`);let u=await new OfflineAudioContext(1,1,i.bufferSampleRate).decodeAudioData(await c.arrayBuffer()),p=e.createBufferSource();p.buffer=u,p.loop=!0,p.loopStart=i.loopStartSec,p.loopEnd=Math.min(i.loopEndSec,u.duration),p.connect(r),p.start(0)}return{start(){if(a)return;a=!0,d().catch((c)=>{console.error("music: failed to load",c)})},setOn(c){o=c,l()}}}function NR(e,t){if(t.semitonesPerApple<=0||e<=0)return 0;return Math.min(e*t.semitonesPerApple,t.maxSemitones)}function OR(e){return Math.pow(2,e/12)}function BR(e,t){let n=t.slowStepMs-t.fastStepMs;if(!(n>0)||e!==e)return 1;let i=Math.min(1,Math.max(0,(t.slowStepMs-e)/n));return 1+(t.fastGain-1)*i}function kR(e,t,n){if(n.skipBelowStepMs<=0||n.skipEvery<=1)return!0;if(e>=n.skipBelowStepMs)return!0;return t%n.skipEvery===0}function GR(e,t){if(t<=0)return 1;let n=Math.imul(e+1,2654435761);n^=n>>>15,n=Math.imul(n,2246822507),n^=n>>>13;let i=(n>>>0)/4294967296*2-1;return Math.pow(2,i*t/1200)}var El=0.0001,bs=0.001,HR=2;function px(e,t,n,i){let s=0,r=0,o=-1/0,a=null;function l(){if(a===null){let c=Math.ceil(e.sampleRate*HR);a=e.createBuffer(1,c,e.sampleRate);let h=a.getChannelData(0);for(let u=0;u<c;u++)h[u]=Math.random()*2-1}return a}function d(c,h){let u=n[c],p=u.combo?OR(NR(s,i)):1;if(u.combo)s++;let g=u.gain,x=e.currentTime,m=u.speed;if(m!==void 0&&h!==void 0){let y=r++;if(!kR(h,y,m))return;if((x-o)*1000<m.minGapMs)return;if(g=u.gain*BR(h,m),!(g>El))return;o=x,p*=GR(y,m.jitterCents)}let f=x+u.attackMs*bs,T=f+u.decayMs*bs,E=e.createOscillator();E.type=u.wave,E.frequency.setValueAtTime(u.freqFrom*p,x),E.frequency.exponentialRampToValueAtTime(u.freqTo*p,x+u.sweepMs*bs);let b=e.createGain();b.gain.setValueAtTime(El,x),b.gain.linearRampToValueAtTime(g,f),b.gain.exponentialRampToValueAtTime(El,T),E.connect(b),b.connect(t),E.onended=()=>{E.disconnect(),b.disconnect()},E.start(x),E.stop(T+0.02);let S=u.layer;if(S!==void 0){let y=e.createOscillator();y.type=S.wave,y.frequency.setValueAtTime(u.freqFrom*p*S.ratio,x),y.frequency.exponentialRampToValueAtTime(u.freqTo*p*S.ratio,x+u.sweepMs*bs);let v=e.createGain();v.gain.value=S.gain/u.gain,y.connect(v),v.connect(b),y.onended=()=>{y.disconnect(),v.disconnect()},y.start(x),y.stop(T+0.02)}let A=u.noise;if(A!==void 0){let y=e.createBufferSource();y.buffer=l();let v=e.createBiquadFilter();v.type="lowpass",v.frequency.setValueAtTime(A.filterFrom,x),v.frequency.exponentialRampToValueAtTime(A.filterTo,x+A.decayMs*bs);let _=e.createGain();_.gain.setValueAtTime(A.gain,x),_.gain.exponentialRampToValueAtTime(El,x+A.decayMs*bs),y.connect(v),v.connect(_),_.connect(t),y.onended=()=>{y.disconnect(),v.disconnect(),_.disconnect()},y.start(x),y.stop(x+A.decayMs*bs+0.02)}}return{play:d,resetCombo(){s=0,r=0}}}function fx(e,t,n){let i=null,s=null,r=null,{musicOn:o,sfxOn:a}=n;function l(){if(e===void 0)return;if(i===null){let h=window.AudioContext??window.webkitAudioContext;if(h===void 0)return;i=new h;let u=i.createGain();u.gain.value=e.sfx.volume,u.connect(i.destination),s=px(i,u,e.blips,e.combo),r=hx(i,i.destination,t,e.music,o)}d();let c=i.createBufferSource();c.buffer=i.createBuffer(1,1,i.sampleRate),c.connect(i.destination),c.start(0),r?.start()}function d(){if(i!==null&&i.state!=="running")i.resume().catch(()=>{})}return{unlock:l,resume:d,suspend(){if(i!==null&&i.state==="running")i.suspend().catch(()=>{})},play(c,h){if(a)s?.play(c,h)},newRound(){s?.resetCombo()},setMusicOn(c){o=c,r?.setOn(c)},setSfxOn(c){a=c},get musicOn(){return o},get sfxOn(){return a}}}var VR={"doc.title":"Змейка 3D","menu.title":"Змейка 3D","menu.scheme":"Управление","scheme.swipes":"Свайпы","scheme.taps":"Тапы","menu.padSide":"Сторона пульта","side.left":"Слева","side.right":"Справа","menu.sound":"Звук","toggle.music.on":"Музыка: вкл","toggle.music.off":"Музыка: выкл","toggle.sfx.on":"Звуки: вкл","toggle.sfx.off":"Звуки: выкл","menu.view":"Вид","toggle.fog.on":"Туман: вкл","toggle.fog.off":"Туман: выкл","menu.quality":"Качество","quality.high":"Высокое","quality.medium":"Среднее","quality.low":"Низкое","board.title":"Лучшие","settings.title":"Настройки","records.title":"Рекорды","nav.back":"Назад","records.empty":"Рекордов пока нет",tapToPlay:"Тапни, чтобы играть","hud.score":"Счёт:","over.score":"Счёт","over.time":"Время","over.drumHint":"Ты в лучших! Выбери три символа","over.drumOk":"Готово","over.playAgain":"Ещё раз","over.toMenu":"В меню","pause.title":"Пауза","pause.resume":"Продолжить","pause.toMenu":"Выйти в меню","demo.title":"Камера уехала за голову","demo.p1":"Это была плоская змейка, а теперь поле стало объёмным: ты смотришь из-за головы.","demo.p2":"Свайпы влево, вправо, вверх и вниз ведут змейку в объёме. Тело остаётся на месте.","demo.hint":"Дальше поворачиваешь только ты.","demo.continue":"Понятно, играем","legal.warn.title":"Внимание: мигающие огни","legal.warn.p1":"Игра использует яркие неоновые цвета, вспышки и быстро меняющиеся изображения. У небольшой доли людей такие изображения могут вызвать приступ — даже если приступов никогда раньше не было.","legal.warn.p2":"Если во время игры вы почувствуете головокружение, изменение зрения, подёргивание мышц, дезориентацию или потеряете сознание — **немедленно прекратите играть** и обратитесь к врачу.","legal.warn.p3":"Играйте в освещённой комнате, не играйте уставшим и делайте перерывы.","legal.warn.ok":"Понятно","legal.terms.title":"Условия использования","legal.terms.b1":"Игра бесплатна и предоставляется «как есть», без каких-либо гарантий. Автор не отвечает за ущерб, связанный с её использованием.","legal.terms.b2":"Игра **не отправляет ничего личного**: ни имени, ни ваших трёх букв, ни счёта, ни идентификатора игрока. Наружу уходят только посещение и несколько безымянных отметок о ходе игры (например, партия началась, партия закончилась, вы вернулись в другой день) через счётчик GoatCounter — чтобы автор понимал, интересна ли игра. Как любой сайт в интернете, счётчик и хостинг сайта (GitHub Pages, itch.io) видят технические данные запроса.","legal.terms.b2b":"Рекорды, ваши три буквы, настройки, монеты с покупками и отметка о прошлом визите хранятся только в вашем браузере и исчезают вместе с данными сайта.","legal.terms.b3":"Музыка: *Cyber Runner*, автор Luis Zuno (ansimuz), лицензия CC0 1.0.","legal.terms.b4":"Продолжая, вы подтверждаете, что прочли предупреждение о мигающих огнях.","legal.terms.ok":"Принимаю","aria.pad":"Пульт управления","aria.up":"Вверх","aria.down":"Вниз","aria.left":"Влево","aria.right":"Вправо","aria.boost":"Ускорение: зажми, чтобы ехать быстрее","aria.stick":"Стик поворота камеры; быстрый тап — сброс камеры","aria.pause":"Пауза","aria.camReset":"Сбросить камеру (клавиша R)","aria.scheme":"Схема управления","aria.padSide":"Сторона пульта","aria.sound":"Звук","aria.view":"Вид","aria.quality":"Качество графики","aria.language":"Язык","aria.settings":"Открыть настройки","aria.records":"Открыть таблицу рекордов","aria.drum":"Три символа для таблицы","aria.reelNext":"Символ {n}: следующий","aria.reelPrev":"Символ {n}: предыдущий","shop.title":"Магазин","shop.play":"Играть","shop.buy":"Купить","shop.equip":"Надеть","shop.equipped":"Надето","shop.short":"Не хватает","shop.owned":"Куплено","shop.active":"Действует","shop.soon":"Скоро","shop.gamesLeft":"Осталось партий: {n}","shop.section.boost":"Ускорение","shop.section.mult":"Множитель монет","shop.section.palette":"Палитра","shop.section.snakeSkin":"Змейка","shop.section.appleSkin":"Яблоко","shop.section.compassSkin":"Стрелка","shop.section.soon":"Скоро","shop.mult.temp":"Монеты ×{n}, партий: {games}","shop.mult.perm":"Монеты ×{n} навсегда","shop.item.palette-neon":"Ночной неон","shop.item.palette-synthwave":"Синтвейв","shop.item.palette-ice":"Лёд","shop.item.palette-terminal":"Терминал","shop.item.palette-contrast":"Контраст","shop.item.snake-tail-guides":"Хвост-указатель","shop.item.apple-orb":"Шар","shop.item.compass-default":"Обычная","shop.item.compass-chevron":"Шеврон","shop.max":"Максимум","shop.section.arena":"Арена","shop.section.obstacles":"Препятствия","shop.section.pace":"Темп","shop.item.density-0":"Без препятствий","shop.obstacles.tiny":"В тесной арене 5³ препятствий нет: она слишком мала. Выбор плотности сохранён и вернётся на большой арене.","shop.item.arena-5":"Тесный 5³","shop.item.pace-1":"Обычный","shop.item.pace-1.5":"Спокойный","shop.item.pace-0.75":"Быстрый","shop.item.pace-0.5":"Очень быстрый","shop.item.snake-classic":"Классика","shop.item.apple-diamond":"Ромб","shop.item.apple-star":"Звезда","shop.item.compass-ring":"Кольцо","over.coins":"Монеты +{n}","over.toShop":"В магазин","aria.shop":"Открыть магазин","aria.shopBalance":"Монеты: {n}","aria.shopLocked":"Ещё закрыто: скоро в магазине","controls.title":"Управление","aria.controlsDiagram":"Схема экрана с пронумерованными элементами управления","controls.swipe":"Свайп в любом месте: поворот","controls.arrows":"Стрелки: поворот","controls.boost":"Зажми, чтобы ускориться; отпусти, чтобы замедлиться","controls.stick":"Держи стик: камера поворачивается","controls.reset":"Прицел или быстрый тап по стику: сбросить камеру","controls.resetNoStick":"Кнопка-прицел: сбросить камеру","controls.pause":"Пауза","controls.note.fingers":"Два пальца по полю: вместе — наклон камеры, щипок — масштаб.","controls.keys.title":"Клавиатура и мышь","controls.key.turn":"Поворот","controls.key.boost":"Ускорение (держать)","controls.key.cameraReset":"Сбросить камеру","controls.key.pause":"Пауза / продолжить","controls.mouse.tilt":"Наклон камеры: тяни правой кнопкой мыши","controls.mouse.zoom":"Масштаб: колесо мыши","hint.boost.touch":"Зажми {label}: ускорение","hint.boost.keys":"Зажми {keys}: ускорение"},jh={"doc.title":"Snake 3D","menu.title":"Snake 3D","menu.scheme":"Controls","scheme.swipes":"Swipes","scheme.taps":"Taps","menu.padSide":"Pad side","side.left":"Left","side.right":"Right","menu.sound":"Sound","toggle.music.on":"Music: on","toggle.music.off":"Music: off","toggle.sfx.on":"Sounds: on","toggle.sfx.off":"Sounds: off","menu.view":"View","toggle.fog.on":"Fog: on","toggle.fog.off":"Fog: off","menu.quality":"Quality","quality.high":"High","quality.medium":"Medium","quality.low":"Low","board.title":"Best","settings.title":"Settings","records.title":"Records","nav.back":"Back","records.empty":"No records yet",tapToPlay:"Tap to play","hud.score":"Score:","over.score":"Score","over.time":"Time","over.drumHint":"You made the top! Pick three symbols","over.drumOk":"Done","over.playAgain":"Again","over.toMenu":"Menu","pause.title":"Paused","pause.resume":"Resume","pause.toMenu":"Quit to menu","demo.title":"The camera moved behind the head","demo.p1":"It was a flat snake, and now the field is 3D: you look from behind the head.","demo.p2":"Swipe left, right, up and down to steer the snake in 3D. The body stays put.","demo.hint":"From here on, only you turn.","demo.continue":"Got it, let’s play","legal.warn.title":"Warning: flashing lights","legal.warn.p1":"The game uses bright neon colors, flashes and rapidly changing images. For a small share of people, such images can trigger a seizure, even if they have never had one before.","legal.warn.p2":"If while playing you feel dizzy, notice changes in your vision, muscle twitching or disorientation, or lose consciousness, **stop playing immediately** and see a doctor.","legal.warn.p3":"Play in a well-lit room, do not play when tired, and take breaks.","legal.warn.ok":"Got it","legal.terms.title":"Terms of use","legal.terms.b1":"The game is free and provided “as is”, without warranties of any kind. The author is not liable for any damage arising from its use.","legal.terms.b2":"The game **sends nothing personal**: no name, no three letters, no score, no player ID. Only a visit and a few nameless markers of how the game went (for example, a round started, a round ended, you came back on another day) leave it, through the GoatCounter counter, so the author can tell whether the game is interesting. Like any website, the counter and the site’s host (GitHub Pages, itch.io) can see technical request data.","legal.terms.b2b":"High scores, your three letters, settings, coins with purchases, and a note of your last visit are stored only in your browser and disappear along with the site’s data.","legal.terms.b3":"Music: *Cyber Runner* by Luis Zuno (ansimuz), CC0 1.0 license.","legal.terms.b4":"By continuing, you confirm that you have read the warning about flashing lights.","legal.terms.ok":"I accept","aria.pad":"Control pad","aria.up":"Up","aria.down":"Down","aria.left":"Left","aria.right":"Right","aria.boost":"Boost: hold to go faster","aria.stick":"Camera turn stick; quick tap resets the camera","aria.pause":"Pause","aria.camReset":"Reset camera (R key)","aria.scheme":"Control scheme","aria.padSide":"Pad side","aria.sound":"Sound","aria.view":"View","aria.quality":"Graphics quality","aria.language":"Language","aria.settings":"Open settings","aria.records":"Open the records table","aria.drum":"Three symbols for the leaderboard","aria.reelNext":"Symbol {n}: next","aria.reelPrev":"Symbol {n}: previous","shop.title":"Shop","shop.play":"Play","shop.buy":"Buy","shop.equip":"Equip","shop.equipped":"Equipped","shop.short":"Not enough","shop.owned":"Owned","shop.active":"Active","shop.soon":"Soon","shop.gamesLeft":"Games left: {n}","shop.section.boost":"Boost","shop.section.mult":"Coin multiplier","shop.section.palette":"Palette","shop.section.snakeSkin":"Snake","shop.section.appleSkin":"Apple","shop.section.compassSkin":"Compass","shop.section.soon":"Soon","shop.mult.temp":"Coins ×{n}, games: {games}","shop.mult.perm":"Coins ×{n} forever","shop.item.palette-neon":"Night Neon","shop.item.palette-synthwave":"Synthwave","shop.item.palette-ice":"Ice","shop.item.palette-terminal":"Terminal","shop.item.palette-contrast":"Contrast","shop.item.snake-tail-guides":"Tail guides","shop.item.apple-orb":"Orb","shop.item.compass-default":"Default","shop.item.compass-chevron":"Chevron","shop.max":"Maximum","shop.section.arena":"Arena","shop.section.obstacles":"Obstacles","shop.section.pace":"Pace","shop.item.density-0":"No obstacles","shop.obstacles.tiny":"The tight 5³ arena has no obstacles: it is too small for them. Your density choice is kept and returns on a bigger arena.","shop.item.arena-5":"Tight 5³","shop.item.pace-1":"Normal","shop.item.pace-1.5":"Calm","shop.item.pace-0.75":"Fast","shop.item.pace-0.5":"Very fast","shop.item.snake-classic":"Classic","shop.item.apple-diamond":"Diamond","shop.item.apple-star":"Star","shop.item.compass-ring":"Ring","over.coins":"Coins +{n}","over.toShop":"To the shop","aria.shop":"Open the shop","aria.shopBalance":"Coins: {n}","aria.shopLocked":"Locked: coming soon to the shop","controls.title":"Controls","aria.controlsDiagram":"Diagram of the screen with numbered controls","controls.swipe":"Swipe anywhere: turn","controls.arrows":"Arrows: turn","controls.boost":"Hold to boost, let go to slow down","controls.stick":"Hold the stick: turn the camera","controls.reset":"Crosshair or a quick tap on the stick: reset the camera","controls.resetNoStick":"Crosshair button: reset the camera","controls.pause":"Pause","controls.note.fingers":"Two fingers on the field: move together to tilt the camera, pinch to zoom.","controls.keys.title":"Keyboard and mouse","controls.key.turn":"Turn","controls.key.boost":"Boost (hold)","controls.key.cameraReset":"Reset the camera","controls.key.pause":"Pause / resume","controls.mouse.tilt":"Tilt the camera: drag with the right mouse button","controls.mouse.zoom":"Zoom: mouse wheel","hint.boost.touch":"Hold {label} to boost","hint.boost.keys":"Hold {keys} to boost"},WR={"doc.title":"Snake 3D","menu.title":"Snake 3D","menu.scheme":"Controles","scheme.swipes":"Deslizar","scheme.taps":"Toques","menu.padSide":"Lado del mando","side.left":"Izquierda","side.right":"Derecha","menu.sound":"Sonido","toggle.music.on":"Música: sí","toggle.music.off":"Música: no","toggle.sfx.on":"Efectos: sí","toggle.sfx.off":"Efectos: no","menu.view":"Vista","toggle.fog.on":"Niebla: sí","toggle.fog.off":"Niebla: no","menu.quality":"Calidad","quality.high":"Alta","quality.medium":"Media","quality.low":"Baja","board.title":"Mejores","settings.title":"Ajustes","records.title":"Récords","nav.back":"Atrás","records.empty":"Aún no hay récords",tapToPlay:"Toca para jugar","hud.score":"Puntos:","over.score":"Puntos","over.time":"Tiempo","over.drumHint":"¡Estás en el top! Elige tres símbolos","over.drumOk":"Listo","over.playAgain":"Otra vez","over.toMenu":"Menú","pause.title":"Pausa","pause.resume":"Seguir","pause.toMenu":"Salir al menú","demo.title":"La cámara pasó tras la cabeza","demo.p1":"Era una serpiente plana y ahora el campo es 3D: miras desde detrás de la cabeza.","demo.p2":"Desliza a izquierda, derecha, arriba y abajo para guiarla en 3D. El cuerpo se queda quieto.","demo.hint":"Desde aquí, solo tú giras.","demo.continue":"Entendido, a jugar","legal.warn.title":"Advertencia: luces intermitentes","legal.warn.p1":"El juego usa colores de neón brillantes, destellos e imágenes que cambian rápidamente. En una pequeña parte de las personas, estas imágenes pueden provocar una crisis epiléptica, incluso si nunca han tenido una.","legal.warn.p2":"Si mientras juegas sientes mareo, cambios en la visión, espasmos musculares o desorientación, o pierdes el conocimiento, **deja de jugar de inmediato** y consulta a un médico.","legal.warn.p3":"Juega en una habitación iluminada, no juegues cuando tengas cansancio y haz pausas.","legal.warn.ok":"Entendido","legal.terms.title":"Condiciones de uso","legal.terms.b1":"El juego es gratuito y se ofrece «tal cual», sin garantías de ningún tipo. El autor no se hace responsable de los daños derivados de su uso.","legal.terms.b2":"El juego **no envía nada personal**: ni nombre, ni tus tres letras, ni puntuación, ni ningún identificador de jugador. Solo salen una visita y unas pocas marcas anónimas sobre cómo va el juego (por ejemplo, empezó una partida, terminó una partida, volviste otro día), mediante el contador GoatCounter, para que el autor sepa si el juego resulta interesante. Como cualquier sitio de internet, el contador y el alojamiento del sitio (GitHub Pages, itch.io) pueden ver datos técnicos de la solicitud.","legal.terms.b2b":"Los récords, tus tres letras, los ajustes, las monedas con las compras y la marca de tu última visita se guardan solo en tu navegador y desaparecen junto con los datos del sitio.","legal.terms.b3":"Música: *Cyber Runner*, de Luis Zuno (ansimuz), licencia CC0 1.0.","legal.terms.b4":"Al continuar, confirmas que has leído la advertencia sobre luces intermitentes.","legal.terms.ok":"Acepto","aria.pad":"Mando de control","aria.up":"Arriba","aria.down":"Abajo","aria.left":"Izquierda","aria.right":"Derecha","aria.boost":"Turbo: mantén pulsado para ir más rápido","aria.stick":"Palanca de giro de cámara; un toque rápido reinicia la cámara","aria.pause":"Pausa","aria.camReset":"Reiniciar cámara (tecla R)","aria.scheme":"Esquema de control","aria.padSide":"Lado del mando","aria.sound":"Sonido","aria.view":"Vista","aria.quality":"Calidad gráfica","aria.language":"Idioma","aria.settings":"Abrir ajustes","aria.records":"Abrir la tabla de récords","aria.drum":"Tres símbolos para la tabla","aria.reelNext":"Símbolo {n}: siguiente","aria.reelPrev":"Símbolo {n}: anterior","shop.title":"Tienda","shop.play":"Jugar","shop.buy":"Comprar","shop.equip":"Equipar","shop.equipped":"Equipado","shop.short":"Insuficiente","shop.owned":"Comprado","shop.active":"Activo","shop.soon":"Pronto","shop.gamesLeft":"Partidas restantes: {n}","shop.section.boost":"Turbo","shop.section.mult":"Multiplicador de monedas","shop.section.palette":"Paleta","shop.section.snakeSkin":"Serpiente","shop.section.appleSkin":"Manzana","shop.section.compassSkin":"Brújula","shop.section.soon":"Pronto","shop.mult.temp":"Monedas ×{n}, partidas: {games}","shop.mult.perm":"Monedas ×{n} para siempre","shop.item.palette-neon":"Neón nocturno","shop.item.palette-synthwave":"Synthwave","shop.item.palette-ice":"Hielo","shop.item.palette-terminal":"Terminal","shop.item.palette-contrast":"Contraste","shop.item.snake-tail-guides":"Guías de cola","shop.item.apple-orb":"Orbe","shop.item.compass-default":"Normal","shop.item.compass-chevron":"Galón","shop.max":"Máximo","shop.section.arena":"Arena","shop.section.obstacles":"Obstáculos","shop.section.pace":"Ritmo","shop.item.density-0":"Sin obstáculos","shop.obstacles.tiny":"La arena estrecha 5³ no tiene obstáculos: es demasiado pequeña. Tu elección de densidad se conserva y vuelve en una arena mayor.","shop.item.arena-5":"Estrecho 5³","shop.item.pace-1":"Normal","shop.item.pace-1.5":"Tranquilo","shop.item.pace-0.75":"Rápido","shop.item.pace-0.5":"Muy rápido","shop.item.snake-classic":"Clásica","shop.item.apple-diamond":"Diamante","shop.item.apple-star":"Estrella","shop.item.compass-ring":"Anillo","over.coins":"Monedas +{n}","over.toShop":"A la tienda","aria.shop":"Abrir la tienda","aria.shopBalance":"Monedas: {n}","aria.shopLocked":"Bloqueado: pronto en la tienda","controls.title":"Controles","aria.controlsDiagram":"Esquema de la pantalla con controles numerados","controls.swipe":"Desliza en cualquier parte: girar","controls.arrows":"Flechas: girar","controls.boost":"Mantén para ir más rápido, suelta para frenar","controls.stick":"Mantén la palanca: gira la cámara","controls.reset":"Mira o un toque rápido en la palanca: reiniciar la cámara","controls.resetNoStick":"Botón de mira: reiniciar la cámara","controls.pause":"Pausa","controls.note.fingers":"Dos dedos en el campo: juntos inclinan la cámara, pellizca para hacer zoom.","controls.keys.title":"Teclado y ratón","controls.key.turn":"Girar","controls.key.boost":"Turbo (mantener)","controls.key.cameraReset":"Reiniciar la cámara","controls.key.pause":"Pausa / continuar","controls.mouse.tilt":"Inclinar la cámara: arrastra con el botón derecho del ratón","controls.mouse.zoom":"Zoom: rueda del ratón","hint.boost.touch":"Mantén {label} para turbo","hint.boost.keys":"Mantén {keys} para turbo"},jR={"doc.title":"Snake 3D","menu.title":"Snake 3D","menu.scheme":"Controles","scheme.swipes":"Deslizar","scheme.taps":"Toques","menu.padSide":"Lado do controle","side.left":"Esquerda","side.right":"Direita","menu.sound":"Som","toggle.music.on":"Música: sim","toggle.music.off":"Música: não","toggle.sfx.on":"Sons: sim","toggle.sfx.off":"Sons: não","menu.view":"Visão","toggle.fog.on":"Névoa: sim","toggle.fog.off":"Névoa: não","menu.quality":"Qualidade","quality.high":"Alta","quality.medium":"Média","quality.low":"Baixa","board.title":"Melhores","settings.title":"Configurações","records.title":"Recordes","nav.back":"Voltar","records.empty":"Ainda sem recordes",tapToPlay:"Toque para jogar","hud.score":"Pontos:","over.score":"Pontos","over.time":"Tempo","over.drumHint":"Você está no top! Escolha três símbolos","over.drumOk":"Pronto","over.playAgain":"De novo","over.toMenu":"Menu","pause.title":"Pausa","pause.resume":"Continuar","pause.toMenu":"Sair para o menu","demo.title":"A câmera foi para trás da cabeça","demo.p1":"Era uma cobrinha plana, e agora o campo é 3D: você olha de trás da cabeça.","demo.p2":"Deslize para a esquerda, direita, cima e baixo para guiar a cobra em 3D. O corpo fica parado.","demo.hint":"Daqui em diante, só você vira.","demo.continue":"Entendi, vamos jogar","legal.warn.title":"Aviso: luzes piscantes","legal.warn.p1":"O jogo usa cores neon brilhantes, flashes e imagens que mudam rapidamente. Em uma pequena parcela das pessoas, essas imagens podem provocar uma crise epiléptica, mesmo que a pessoa nunca tenha tido uma antes.","legal.warn.p2":"Se durante o jogo você sentir tontura, alteração na visão, contrações musculares ou desorientação, ou perder a consciência, **pare de jogar imediatamente** e procure um médico.","legal.warn.p3":"Jogue em um ambiente iluminado, não jogue com cansaço e faça pausas.","legal.warn.ok":"Entendi","legal.terms.title":"Termos de uso","legal.terms.b1":"O jogo é gratuito e é oferecido “no estado em que se encontra”, sem garantias de qualquer tipo. O autor não se responsabiliza por danos decorrentes do seu uso.","legal.terms.b2":"O jogo **não envia nada pessoal**: nem nome, nem suas três letras, nem pontuação, nem qualquer identificador de jogador. Saem apenas uma visita e algumas marcações anônimas sobre o andamento do jogo (por exemplo, uma partida começou, uma partida terminou, você voltou em outro dia), por meio do contador GoatCounter, para que o autor saiba se o jogo é interessante. Como qualquer site na internet, o contador e a hospedagem do site (GitHub Pages, itch.io) podem ver dados técnicos da requisição.","legal.terms.b2b":"Os recordes, suas três letras, as configurações, as moedas com as compras e a marca da sua última visita ficam armazenados apenas no seu navegador e desaparecem junto com os dados do site.","legal.terms.b3":"Música: *Cyber Runner*, de Luis Zuno (ansimuz), licença CC0 1.0.","legal.terms.b4":"Ao continuar, você confirma que leu o aviso sobre luzes piscantes.","legal.terms.ok":"Aceito","aria.pad":"Controle na tela","aria.up":"Para cima","aria.down":"Para baixo","aria.left":"Para a esquerda","aria.right":"Para a direita","aria.boost":"Turbo: segure para ir mais rápido","aria.stick":"Manche de giro da câmera; toque rápido reinicia a câmera","aria.pause":"Pausa","aria.camReset":"Reiniciar câmera (tecla R)","aria.scheme":"Esquema de controle","aria.padSide":"Lado do controle","aria.sound":"Som","aria.view":"Visão","aria.quality":"Qualidade gráfica","aria.language":"Idioma","aria.settings":"Abrir configurações","aria.records":"Abrir a tabela de recordes","aria.drum":"Três símbolos para a tabela","aria.reelNext":"Símbolo {n}: próximo","aria.reelPrev":"Símbolo {n}: anterior","shop.title":"Loja","shop.play":"Jogar","shop.buy":"Comprar","shop.equip":"Equipar","shop.equipped":"Equipado","shop.short":"Faltam moedas","shop.owned":"Comprado","shop.active":"Ativo","shop.soon":"Em breve","shop.gamesLeft":"Partidas restantes: {n}","shop.section.boost":"Turbo","shop.section.mult":"Multiplicador de moedas","shop.section.palette":"Paleta","shop.section.snakeSkin":"Cobra","shop.section.appleSkin":"Maçã","shop.section.compassSkin":"Bússola","shop.section.soon":"Em breve","shop.mult.temp":"Moedas ×{n}, partidas: {games}","shop.mult.perm":"Moedas ×{n} para sempre","shop.item.palette-neon":"Neon noturno","shop.item.palette-synthwave":"Synthwave","shop.item.palette-ice":"Gelo","shop.item.palette-terminal":"Terminal","shop.item.palette-contrast":"Contraste","shop.item.snake-tail-guides":"Guias da cauda","shop.item.apple-orb":"Orbe","shop.item.compass-default":"Padrão","shop.item.compass-chevron":"Divisa","shop.max":"Máximo","shop.section.arena":"Arena","shop.section.obstacles":"Obstáculos","shop.section.pace":"Ritmo","shop.item.density-0":"Sem obstáculos","shop.obstacles.tiny":"A arena apertada 5³ não tem obstáculos: é pequena demais. Sua escolha de densidade fica guardada e volta em uma arena maior.","shop.item.arena-5":"Apertado 5³","shop.item.pace-1":"Normal","shop.item.pace-1.5":"Calmo","shop.item.pace-0.75":"Rápido","shop.item.pace-0.5":"Muito rápido","shop.item.snake-classic":"Clássica","shop.item.apple-diamond":"Diamante","shop.item.apple-star":"Estrela","shop.item.compass-ring":"Anel","over.coins":"Moedas +{n}","over.toShop":"Para a loja","aria.shop":"Abrir a loja","aria.shopBalance":"Moedas: {n}","aria.shopLocked":"Bloqueado: em breve na loja","controls.title":"Controles","aria.controlsDiagram":"Esquema da tela com controles numerados","controls.swipe":"Deslize em qualquer lugar: virar","controls.arrows":"Setas: virar","controls.boost":"Segure para ir mais rápido, solte para desacelerar","controls.stick":"Segure o manche: gira a câmera","controls.reset":"Mira ou um toque rápido no manche: reiniciar a câmera","controls.resetNoStick":"Botão de mira: reiniciar a câmera","controls.pause":"Pausa","controls.note.fingers":"Dois dedos no campo: juntos inclinam a câmera, pinça para dar zoom.","controls.keys.title":"Teclado e mouse","controls.key.turn":"Virar","controls.key.boost":"Turbo (segurar)","controls.key.cameraReset":"Reiniciar a câmera","controls.key.pause":"Pausa / continuar","controls.mouse.tilt":"Inclinar a câmera: arraste com o botão direito do mouse","controls.mouse.zoom":"Zoom: roda do mouse","hint.boost.touch":"Segure {label} para turbo","hint.boost.keys":"Segure {keys} para turbo"},XR={"doc.title":"贪吃蛇 3D","menu.title":"贪吃蛇 3D","menu.scheme":"操控方式","scheme.swipes":"滑动","scheme.taps":"点按","menu.padSide":"按键位置","side.left":"左侧","side.right":"右侧","menu.sound":"声音","toggle.music.on":"音乐：开","toggle.music.off":"音乐：关","toggle.sfx.on":"音效：开","toggle.sfx.off":"音效：关","menu.view":"画面","toggle.fog.on":"雾：开","toggle.fog.off":"雾：关","menu.quality":"画质","quality.high":"高","quality.medium":"中","quality.low":"低","board.title":"排行榜","settings.title":"设置","records.title":"排行榜","nav.back":"返回","records.empty":"暂无记录",tapToPlay:"点击开始","hud.score":"得分：","over.score":"得分","over.time":"用时","over.drumHint":"上榜了！选三个字符","over.drumOk":"完成","over.playAgain":"再来一次","over.toMenu":"菜单","pause.title":"暂停","pause.resume":"继续","pause.toMenu":"退出到菜单","demo.title":"镜头绕到了蛇头后面","demo.p1":"刚才是平面贪吃蛇，现在场地变成立体的了：你从蛇头后方观察。","demo.p2":"向左、右、上、下滑动，在立体空间中转向。蛇身留在原地。","demo.hint":"接下来只有你来转向。","demo.continue":"明白，开始","legal.warn.title":"警告：闪烁光线","legal.warn.p1":"本游戏使用明亮的霓虹色彩、闪光和快速变化的画面。对少数人来说，这类画面可能诱发癫痫发作，即使他们以前从未发作过。","legal.warn.p2":"如果在游戏过程中出现头晕、视力改变、肌肉抽搐、迷失方向或失去意识，请**立即停止游戏**并就医。","legal.warn.p3":"请在光线充足的房间里玩游戏，疲劳时不要玩，并适当休息。","legal.warn.ok":"知道了","legal.terms.title":"使用条款","legal.terms.b1":"本游戏免费，按“现状”提供，不作任何保证。作者对因使用本游戏而造成的任何损害不承担责任。","legal.terms.b2":"本游戏**不发送任何个人信息**：没有姓名，没有你的三个字母，没有分数，也没有玩家标识符。只有一次访问和少量关于游戏进程的匿名记录（例如：一局开始了、一局结束了、你隔天又回来了）会通过 GoatCounter 计数器发出，以便作者了解这款游戏是否有趣。与互联网上的任何网站一样，计数器和网站的托管方（GitHub Pages、itch.io）可能会看到请求的技术数据。","legal.terms.b2b":"最高分、你的三个字母、设置、金币与购买记录以及上次访问的标记仅保存在你的浏览器中，并会随网站数据一起被清除。","legal.terms.b3":"音乐：*Cyber Runner*，作者 Luis Zuno (ansimuz)，采用 CC0 1.0 许可。","legal.terms.b4":"继续即表示你确认已阅读闪烁光线警告。","legal.terms.ok":"我接受","aria.pad":"控制按键","aria.up":"上","aria.down":"下","aria.left":"左","aria.right":"右","aria.boost":"加速：按住可加快速度","aria.stick":"镜头转动摇杆；快速点按重置镜头","aria.pause":"暂停","aria.camReset":"重置镜头（R 键）","aria.scheme":"操控方式","aria.padSide":"按键位置","aria.sound":"声音","aria.view":"画面","aria.quality":"画面质量","aria.language":"语言","aria.settings":"打开设置","aria.records":"打开排行榜","aria.drum":"排行榜的三个字符","aria.reelNext":"第 {n} 个字符：下一个","aria.reelPrev":"第 {n} 个字符：上一个","shop.title":"商店","shop.play":"开始游戏","shop.buy":"购买","shop.equip":"装备","shop.equipped":"已装备","shop.short":"金币不足","shop.owned":"已拥有","shop.active":"生效中","shop.soon":"敬请期待","shop.gamesLeft":"剩余局数：{n}","shop.section.boost":"加速","shop.section.mult":"金币倍率","shop.section.palette":"配色","shop.section.snakeSkin":"蛇","shop.section.appleSkin":"苹果","shop.section.compassSkin":"指南针","shop.section.soon":"敬请期待","shop.mult.temp":"金币 ×{n}，共 {games} 局","shop.mult.perm":"金币 ×{n}，永久","shop.item.palette-neon":"夜色霓虹","shop.item.palette-synthwave":"合成波","shop.item.palette-ice":"冰蓝","shop.item.palette-terminal":"终端","shop.item.palette-contrast":"高对比","shop.item.snake-tail-guides":"尾部指引","shop.item.apple-orb":"球形","shop.item.compass-default":"默认","shop.item.compass-chevron":"V 形","shop.max":"已达上限","shop.section.arena":"场地","shop.section.obstacles":"障碍","shop.section.pace":"节奏","shop.item.density-0":"无障碍","shop.obstacles.tiny":"狭窄的 5³ 竞技场没有障碍：空间太小。你选的障碍密度会保留，换回大竞技场后继续生效。","shop.item.arena-5":"狭窄 5³","shop.item.pace-1":"标准","shop.item.pace-1.5":"舒缓","shop.item.pace-0.75":"较快","shop.item.pace-0.5":"极快","shop.item.snake-classic":"经典","shop.item.apple-diamond":"菱形","shop.item.apple-star":"星形","shop.item.compass-ring":"圆环","over.coins":"金币 +{n}","over.toShop":"去商店","aria.shop":"打开商店","aria.shopBalance":"金币：{n}","aria.shopLocked":"未解锁：商店即将上新","controls.title":"操控说明","aria.controlsDiagram":"带编号操控元素的屏幕示意图","controls.swipe":"在任意位置滑动：转向","controls.arrows":"方向按钮：转向","controls.boost":"按住加速，松开减速","controls.stick":"按住摇杆：转动镜头","controls.reset":"准星或快速点按摇杆：重置镜头","controls.resetNoStick":"准星按钮：重置镜头","controls.pause":"暂停","controls.note.fingers":"双指放在场地上：一起移动可倾斜镜头，捏合可缩放。","controls.keys.title":"键盘和鼠标","controls.key.turn":"转向","controls.key.boost":"加速（按住）","controls.key.cameraReset":"重置镜头","controls.key.pause":"暂停 / 继续","controls.mouse.tilt":"倾斜镜头：按住鼠标右键拖动","controls.mouse.zoom":"缩放：鼠标滚轮","hint.boost.touch":"按住 {label} 加速","hint.boost.keys":"按住 {keys} 加速"},ys=[{code:"en",primary:"en",native:"English",dict:jh},{code:"es",primary:"es",native:"Español",dict:WR},{code:"pt-BR",primary:"pt",native:"Português",dict:jR},{code:"zh-Hans",primary:"zh",native:"简体中文",dict:XR},{code:"ru",primary:"ru",native:"Русский",dict:VR}],mx="en";function Tl(e){if(e===null||e===void 0)return null;return ys.find((t)=>t.code===e)??null}function Xh(e){for(let t of e){if(typeof t!=="string")continue;let n=t.trim().toLowerCase().split(/[-_]/,1)[0];if(n===void 0||n==="")continue;let i=ys.find((s)=>s.primary===n);if(i!==void 0)return i}return Tl(mx)??ys[0]}function JR(e,t){if(t===void 0)return e;return e.replace(/\{(\w+)\}/g,(n,i)=>{let s=t[i];return s===void 0?n:String(s)})}function gx(e,t,n){return JR(e[t],n)}function vx(e){let t=[],n=/\*\*([^*]+)\*\*|\*([^*]+)\*/g,i=0;for(let s=n.exec(e);s!==null;s=n.exec(e)){if(s.index>i)t.push({text:e.slice(i,s.index),style:"plain"});if(s[1]!==void 0)t.push({text:s[1],style:"bold"});else t.push({text:s[2],style:"italic"});i=s.index+s[0].length}if(i<e.length)t.push({text:e.slice(i),style:"plain"});return t}function xx(e){return e.primary.toUpperCase()}var bx="snake:lang",hr=Xh([]),yx=[];function Al(){return hr}function je(e,t){return gx(hr.dict,e,t)}function Ni(e){yx.push(e)}function _x(e=document){document.documentElement.lang=hr.code,document.title=je("doc.title");for(let t of e.querySelectorAll("[data-i18n]"))t.textContent=je(t.dataset.i18n);for(let t of e.querySelectorAll("[data-i18n-rich]")){let n=vx(je(t.dataset.i18nRich));t.replaceChildren(...n.map((i)=>{if(i.style==="plain")return document.createTextNode(i.text);let s=document.createElement(i.style==="bold"?"strong":"em");return s.textContent=i.text,s}))}for(let t of e.querySelectorAll("[data-i18n-aria]"))t.setAttribute("aria-label",je(t.dataset.i18nAria))}function Sx(e,t){let n=Tl(e);if(n===null)return;hr=n,t.set(bx,n.code),_x();for(let i of yx)i(n)}function Mx(e,t){let n=Tl(e.get(bx));if(n!==null)hr=n;else hr=Xh([...t.languages??[],t.language]);_x()}function YR(e,t,n){if(!(t>=n.minScore))return-1;let i=0;while(i<e.length&&e[i].score>=t)i++;return i<n.size?i:-1}function Ex(e,t,n){let i=YR(e,t.score,n);if(i<0)return{table:e.slice(0,n.size),index:i};let s=e.slice();return s.splice(i,0,t),s.length=Math.min(s.length,n.size),{table:s,index:i}}function Tx(e,t,n){return e.map((i,s)=>s===t?{...i,name:n}:i)}function Ax(e,t,n){let i=e.length;if(i===0)return t;let s=e.indexOf(t);if(s<0)return e.charAt(0);return e.charAt(((s+n)%i+i)%i)}function Jh(e,t){if(typeof e!=="string")return t.defaultName;let n=e.toUpperCase();if(n.length!==t.nameLength)return t.defaultName;for(let i of n)if(!t.alphabet.includes(i))return t.defaultName;return n}function qR(e){if(typeof e!=="object"||e===null)return!1;let t=e.score;return typeof t==="number"&&Number.isFinite(t)&&t>=0}function wx(e){return typeof e==="number"&&Number.isFinite(e)&&e>0?e:0}function Rx(e,t){if(e===null)return null;let n;try{n=JSON.parse(e)}catch{return null}if(!Array.isArray(n))return null;let i=[];for(let s of n){if(!qR(s))continue;let r=s.name===t.legacyName?t.legacyName:Jh(s.name,t);i.push({score:s.score,name:r,durationMs:wx(s.durationMs),date:wx(s.date)})}return i.sort((s,r)=>r.score-s.score),i.slice(0,t.size)}function Cx(e,t){if(e===null)return[];let n=Number.parseInt(e,10);if(!Number.isFinite(n)||n<t.minScore)return[];return[{score:n,name:t.legacyName,durationMs:0,date:0}]}function Rl(e){if(!(e>0))return"—";let t=Math.round(e/1000),n=Math.floor(t/60),i=t%60;return`${n}:${i<10?"0":""}${i}`}function Cl(e,t,n,i){e.replaceChildren();for(let s=0;s<n;s++){let r=t[s],o=document.createElement("li");if(o.className="board-row",r===void 0)o.classList.add("empty");if(s===i)o.classList.add("mine");let a=[["rank",String(s+1)],["name",r?.name??"···"],["score",r===void 0?"—":String(r.score)],["time",r===void 0?"":Rl(r.durationMs)]];for(let[l,d]of a){let c=document.createElement("span");c.className=l,c.textContent=d,o.appendChild(c)}e.appendChild(o)}}function Lx(e,t){e.replaceChildren();let n=t[0];if(n===void 0){let i=document.createElement("span");return i.className="empty-label",i.textContent=je("records.empty"),e.appendChild(i),!1}for(let[i,s]of[["rank","1"],["name",n.name],["score",String(n.score)]]){let r=document.createElement("span");r.className=i,r.textContent=s,e.appendChild(r)}return!0}function Px(e,t){let n=[],i=[],s=[],r=[],o=0,a=()=>{},l=()=>{},d=0,c=0;function h(){return n.join("")}function u(){for(let E=0;E<i.length;E++){let b=i[E];b.textContent=n[E],b.classList.toggle("active",E===o)}}function p(){u(),a(h())}function g(E,b){o=E,n[E]=Ax(t.alphabet,n[E],b),p()}function x(){window.clearTimeout(d),window.clearInterval(c)}function m(E,b,S){E.addEventListener("pointerdown",(A)=>{A.preventDefault(),x(),g(b,S),d=window.setTimeout(()=>{c=window.setInterval(()=>g(b,S),t.repeatMs)},t.repeatDelayMs)});for(let A of["pointerup","pointercancel","pointerleave","lostpointercapture"])E.addEventListener(A,x);E.addEventListener("contextmenu",(A)=>A.preventDefault())}for(let E=0;E<t.nameLength;E++){n.push(t.alphabet.charAt(0));let b=document.createElement("div");b.className="reel";let S=document.createElement("button");S.type="button",S.className="step",S.tabIndex=-1,S.textContent="▲";let A=document.createElement("div");A.className="sym";let y=document.createElement("button");y.type="button",y.className="step",y.tabIndex=-1,y.textContent="▼",A.addEventListener("pointerdown",()=>{o=E,u()}),m(S,E,1),m(y,E,-1),b.append(S,A,y),e.appendChild(b),i.push(A),s.push(S),r.push(y)}function f(){for(let E=0;E<i.length;E++)s[E].setAttribute("aria-label",je("aria.reelNext",{n:E+1})),r[E].setAttribute("aria-label",je("aria.reelPrev",{n:E+1}))}f(),window.addEventListener("blur",x);function T(E){if(E.ctrlKey||E.metaKey||E.altKey)return;let b=E.key;if(b==="ArrowUp"||b==="ArrowDown")g(o,b==="ArrowUp"?1:-1);else if(b==="ArrowLeft")o=Math.max(0,o-1);else if(b==="ArrowRight")o=Math.min(n.length-1,o+1);else if(b==="Backspace")o=Math.max(0,o-1);else if(b==="Enter")l();else if(b.length===1&&t.alphabet.includes(b.toUpperCase()))n[o]=b.toUpperCase(),o=Math.min(n.length-1,o+1),p();else return;E.preventDefault(),u()}return{relabel:f,show(E,b,S){let A=E.length===n.length?E:t.defaultName;for(let y=0;y<n.length;y++)n[y]=A.charAt(y);o=0,a=b,l=S,u(),e.classList.remove("hidden"),window.addEventListener("keydown",T)},hide(){x(),window.removeEventListener("keydown",T),e.classList.add("hidden")}}}var Ix=[];function Dx(e){let t=Al().code;for(let n of e.querySelectorAll("button")){let i=n.dataset.lang===t;n.classList.toggle("selected",i),n.setAttribute("aria-pressed",String(i))}e.setAttribute("aria-label",je("aria.language"))}var zx=!1;function Fx(e,t){e.setAttribute("role","group"),e.replaceChildren();for(let n of ys){let i=document.createElement("button");i.type="button",i.dataset.lang=n.code,i.lang=n.code,i.textContent=xx(n),i.setAttribute("aria-label",n.native),i.title=n.native,e.appendChild(i)}if(e.addEventListener("click",(n)=>{let i=n.target;if(!(i instanceof Element))return;let r=i.closest("button")?.dataset.lang;if(r!==void 0)Sx(r,t)}),Ix.push(e),Dx(e),!zx)zx=!0,Ni(()=>{for(let n of Ix)Dx(n)})}function KR(e){return e.get("snake:termsAccepted")!=="1"}function ZR(e){return KR(e)?["warning","terms"]:["warning"]}function Ux(e,t){let n=[],i=null,s=()=>{i=n.shift()??null,t(i)};return{start(){n=ZR(e),s()},confirm(){if(i===null)return;if(i==="terms")e.set("snake:termsAccepted","1");s()},skipAll(){n=[],i=null,t(null)}}}function Yh(e){let t=new URLSearchParams(e).get("perf");return t!==null&&t!=="0"&&t!=="false"}function Nx(e){let t=new URLSearchParams(e).get("perf");return t==="bench"||t==="freeze"}var Ox=["warning","terms","menu","settings","records","shop","controls","hud","over","pause","demo"];function Bx(e){let t=new Set;if(e.base==="game"){if(t.add("hud"),e.demo)t.add("demo");else if(e.paused)t.add("pause")}else if(e.base==="over")t.add("over");else t.add(e.base);if(e.legal!==null)t.add(e.legal);return t}function kx(e){return e.paused||e.demo}function Gx(e,t){let n={legal:null,base:"menu",paused:!1,demo:!1},i=(r)=>{let o={...n,...r};if(o.legal===n.legal&&o.base===n.base&&o.paused===n.paused&&o.demo===n.demo)return;n=o,t(n)},s=Ux(e,(r)=>i({legal:r}));return{get state(){return n},start(){s.start()},skipLegal(){s.skipAll()},confirmLegal(){s.confirm()},openSettings(){if(n.legal===null&&n.base==="menu")i({base:"settings"})},openRecords(){if(n.legal===null&&n.base==="menu")i({base:"records"})},openShop(){if(n.legal===null&&(n.base==="menu"||n.base==="over"))i({base:"shop"})},openControls(){if(n.legal===null&&n.base==="menu")i({base:"controls"})},back(){if(n.legal===null&&(n.base==="settings"||n.base==="records"||n.base==="shop"||n.base==="controls"))i({base:"menu"})},startGame(){i({base:"game",paused:!1,demo:!1})},died(){if(n.base==="game")i({base:"over",paused:!1,demo:!1})},toMenu(){i({base:"menu",paused:!1,demo:!1})},pause(){if(n.base!=="game"||n.paused)return!1;return i({paused:!0}),!0},resume(){if(n.paused)i({paused:!1})},openDemo(){if(n.base==="game")i({demo:!0})},closeDemo(){if(n.demo)i({demo:!1})}}}var QR={boost:"boost",palette:"palette",snakeSkin:"snakeSkin",appleSkin:"appleSkin",compassSkin:"compassSkin",arenaSize:"arenaSize",obstacleDensity:"obstacles",pace:"pace"},Ll=["boost","palette","snakeSkin","appleSkin","compassSkin","arenaSize","obstacles","pace"],$R=new Set(["boost","scoreMultPermanent","scoreMultTemporary","palette","snakeSkin","appleSkin","compassSkin","arenaSize","obstacleDensity","pace","comingSoon"]);function Oi(e){return QR[e.kind]??null}function qh(e){return typeof e==="number"&&Number.isFinite(e)&&e>=0}function _s(e){if(!qh(e))return 0;return Math.min(Number.MAX_SAFE_INTEGER,Math.floor(e))}function eC(e){let t=e??{},n={};if(typeof t.factor==="number")n.factor=t.factor;if(typeof t.mult==="number")n.mult=t.mult;if(typeof t.palette==="string")n.palette=t.palette;if(typeof t.skin==="string")n.skin=t.skin;if(typeof t.slot==="string")n.slot=t.slot;if(typeof t.size==="number")n.size=t.size;if(typeof t.density==="number")n.density=t.density;if(typeof t.scale==="number")n.scale=t.scale;return n}function Hx(e){let t=e?.payload.mult;return t!==void 0&&Number.isFinite(t)&&t>=1?t:1}var Vx=new WeakMap;function Ss(e){let t=Vx.get(e);if(t!==void 0)return t;let n=[],i=new Set;for(let s of e.shop.items){if(typeof s.id!=="string"||s.id===""||i.has(s.id))continue;if(!$R.has(s.kind)||!qh(s.price))continue;let r=s.kind,o=eC(s.payload);if(r==="boost"&&!(o.factor!==void 0&&o.factor>=1&&Number.isFinite(o.factor)))continue;if((r==="scoreMultPermanent"||r==="scoreMultTemporary")&&!(o.mult!==void 0&&o.mult>=1&&Number.isFinite(o.mult)))continue;if(r==="arenaSize"&&!(o.size!==void 0&&Number.isInteger(o.size)&&o.size>=1))continue;if(r==="obstacleDensity"&&!(o.density!==void 0&&Number.isFinite(o.density)&&o.density>=0))continue;if(r==="pace"&&!(o.scale!==void 0&&Number.isFinite(o.scale)&&o.scale>0))continue;if(r==="scoreMultTemporary"&&!(typeof s.games==="number"&&Number.isInteger(s.games)&&s.games>=1))continue;i.add(s.id);let a={id:s.id,kind:r,price:s.price,payload:o};if(r==="scoreMultTemporary")a.games=s.games;n.push(a)}return Vx.set(e,n),n}function un(e,t){return Ss(e).find((n)=>n.id===t)}function Kh(e){let t=e.shop.defaults,n=[],i={};for(let s of t.owned){let r=un(e,s);if(r!==void 0&&r.kind!=="comingSoon"&&r.kind!=="scoreMultTemporary"&&!n.includes(s))n.push(s)}for(let s of Ll){let r=t.equipped[s];if(r===void 0)continue;let o=un(e,r);if(o!==void 0&&Oi(o)===s&&n.includes(r))i[s]=r}return{balance:_s(t.balance),totalEarned:0,owned:n,equipped:i,temporary:[],sessionMult:1}}function pr(e,t){return e.owned.includes(t.id)}function Pl(e,t){return e.temporary.find((n)=>n.id===t.id)?.gamesLeft??0}function Il(e,t,n){let i=un(n,t.id);if(i===void 0||i.kind==="comingSoon")return!1;if(e.balance<i.price)return!1;if(i.kind==="scoreMultTemporary")return Pl(e,i)<n.shop.maxTemporaryGames;return!pr(e,i)}function Zh(e,t,n){if(!Il(e,t,n))return e;let i=un(n,t.id),s=e.balance-i.price;if(i.kind==="scoreMultTemporary"){let r=n.shop.maxTemporaryGames,o=i.games??0,a=[],l=!1;for(let d of e.temporary)if(d.id===i.id)a.push({id:d.id,gamesLeft:Math.min(r,d.gamesLeft+o)}),l=!0;else a.push({id:d.id,gamesLeft:d.gamesLeft});if(!l)a.push({id:i.id,gamesLeft:Math.min(r,o)});return{...e,balance:s,owned:[...e.owned],equipped:{...e.equipped},temporary:a}}return{...e,balance:s,owned:[...e.owned,i.id],equipped:{...e.equipped},temporary:e.temporary.map((r)=>({id:r.id,gamesLeft:r.gamesLeft}))}}function Qh(e,t,n){let i=un(n,t.id),s=i===void 0?null:Oi(i);if(i===void 0||s===null||!pr(e,i))return e;return{...e,owned:[...e.owned],equipped:{...e.equipped,[s]:i.id},temporary:e.temporary.map((r)=>({id:r.id,gamesLeft:r.gamesLeft}))}}function Ro(e,t){let n=1,i=1;for(let s of e.owned){let r=un(t,s);if(r?.kind==="scoreMultPermanent")n=Math.max(n,Hx(r))}for(let s of e.temporary){let r=un(t,s.id);if(r?.kind==="scoreMultTemporary"&&s.gamesLeft>=1)i=Math.max(i,Hx(r))}return n*i}function Wx(e,t,n){if(!qh(t))return 0;let i=Number.isFinite(n)&&n>=1?n:1;return _s(Math.round(Math.floor(t)*e.shop.coinPerApple*i))}function $h(e,t,n){let i=Wx(n,t,e.sessionMult);return{...e,balance:_s(e.balance+i),totalEarned:_s(e.totalEarned+i),owned:[...e.owned],equipped:{...e.equipped},temporary:e.temporary.map((s)=>({id:s.id,gamesLeft:s.gamesLeft})),sessionMult:1}}function ep(e,t){let n=Ro(e,t),i=[];for(let s of e.temporary)if(s.gamesLeft>1)i.push({id:s.id,gamesLeft:s.gamesLeft-1});return{...e,owned:[...e.owned],equipped:{...e.equipped},temporary:i,sessionMult:n}}function tp(e){return e.sessionMult}function jx(e,t){let n=e.equipped.boost,i=n===void 0?void 0:un(t,n);if(i?.kind==="boost"&&i.payload.factor!==void 0&&e.owned.includes(i.id))return i.payload.factor;let s=t.shop.defaultBoost;return Number.isFinite(s)&&s>=1?s:t.speed.boostFactor}function fr(e,t,n){let i=e.equipped[n];if(i===void 0||!e.owned.includes(i))return;let s=un(t,i);return s!==void 0&&Oi(s)===n?s:void 0}function np(e,t,n,i){let s=fr(e,t,n);return s?.kind===i?s.payload:void 0}function Dl(e,t){return np(e,t,"arenaSize","arenaSize")?.size??t.shop.defaultArenaSize}function Xx(e,t){return np(e,t,"obstacles","obstacleDensity")?.density??1}function Jx(e,t){return np(e,t,"pace","pace")?.scale??1}function zl(e,t){return{size:Dl(e,t),boostFactor:jx(e,t),obstacleMult:Xx(e,t),paceScale:Jx(e,t),scoreMultiplier:Ro(e,t)}}var sp="snake:shop",tC=1;function rp(e){return JSON.stringify({v:tC,balance:e.balance,totalEarned:e.totalEarned,owned:e.owned,equipped:e.equipped,temporary:e.temporary})}function ip(e){return typeof e==="object"&&e!==null&&!Array.isArray(e)}function op(e,t){let n=Kh(t);if(typeof e!=="string"||e==="")return n;let i;try{i=JSON.parse(e)}catch{return n}if(!ip(i))return n;let r=typeof i.balance==="number"&&Number.isFinite(i.balance)?_s(i.balance):n.balance,o=Math.max(_s(i.totalEarned),0),a=[...n.owned];if(Array.isArray(i.owned))for(let c of i.owned){if(typeof c!=="string"||a.includes(c))continue;let h=un(t,c);if(h===void 0||h.kind==="comingSoon"||h.kind==="scoreMultTemporary")continue;a.push(c)}let l={...n.equipped};if(ip(i.equipped))for(let c of Ll){let h=i.equipped[c];if(typeof h!=="string"||!a.includes(h))continue;let u=un(t,h);if(u!==void 0&&Oi(u)===c)l[c]=h}let d=[];if(Array.isArray(i.temporary))for(let c of i.temporary){if(!ip(c)||typeof c.id!=="string")continue;if(d.some((p)=>p.id===c.id))continue;let h=un(t,c.id);if(h===void 0||h.kind!=="scoreMultTemporary")continue;if(typeof c.gamesLeft!=="number"||!Number.isFinite(c.gamesLeft))continue;let u=Math.min(t.shop.maxTemporaryGames,Math.floor(c.gamesLeft));if(u>=1)d.push({id:c.id,gamesLeft:u})}return{balance:r,totalEarned:o,owned:a,equipped:l,temporary:d,sessionMult:1}}function Co(e,t,n){if(t.kind==="comingSoon")return"soon";if(t.kind==="scoreMultPermanent"&&pr(e,t))return"active";if(t.kind!=="scoreMultTemporary"&&pr(e,t)){let i=Oi(t);return i!==null&&e.equipped[i]===t.id?"equipped":"owned"}if(Il(e,t,n))return"buyable";return t.kind==="scoreMultTemporary"&&e.balance>=t.price?"maxed":"short"}function Yx(e){return e.finishedGame||e.hasRecords}function qx(e,t,n){return Ss(t).some((i)=>i.kind!=="scoreMultTemporary"&&Co(e,i,t)==="buyable"&&!Lo(e,i,t,n))}function Fl(e,t,n){if(n===void 0)return!1;return!Yp(Dl(e,t),n.clearRadius,n.wallMargin)}function Lo(e,t,n,i){return t.kind==="obstacleDensity"&&Fl(e,n,i)}function Kx(e,t){let n=e,i=!1;return{get state(){return n},config:t,get runOpen(){return i},begin(){n=ep(n,t),i=!0},settle(s){if(!i)return null;i=!1;let r=tp(n),o=n.balance;return n=$h(n,s,t),{gained:Math.max(0,n.balance-o),mult:r}},buy(s){let r=Zh(n,s,t),o=r!==n;return n=r,o},equip(s){let r=Qh(n,s,t),o=r!==n;return n=r,o}}}var Ul=[{id:"boost",kinds:["boost"]},{id:"arena",kinds:["arenaSize"]},{id:"obstacles",kinds:["obstacleDensity"]},{id:"pace",kinds:["pace"]},{id:"mult",kinds:["scoreMultTemporary","scoreMultPermanent"]},{id:"palette",kinds:["palette"]},{id:"snakeSkin",kinds:["snakeSkin"]},{id:"appleSkin",kinds:["appleSkin"]},{id:"compassSkin",kinds:["compassSkin"]},{id:"soon",kinds:[]}],Nl={boost:"boost",arena:"arenaSize",obstacles:"obstacles",pace:"pace",mult:"mult",palette:"palette",snakeSkin:"snakeSkin",appleSkin:"appleSkin",compassSkin:"compassSkin",soon:null};function ap(e,t){let n=[];for(let s of t.kinds)for(let r of e)if(r.kind===s)n.push(r);let i=Nl[t.id];for(let s of e){if(s.kind!=="comingSoon")continue;if(i!==null?s.payload.slot===i:t.id==="soon"&&!nC(s.payload.slot))n.push(s)}return n}function nC(e){return e!==void 0&&Object.values(Nl).includes(e)}function Zx(e,t,n){let i=Ss(n).find((s)=>s.kind==="arenaSize"&&s.payload.size===t);if(i===void 0||e.equipped.arenaSize===i.id)return e;return{...e,owned:e.owned.includes(i.id)?[...e.owned]:[...e.owned,i.id],equipped:{...e.equipped,arenaSize:i.id}}}var Po=(e)=>String(Math.round(e*100)/100);function Qx(e){return e in jh}function $x(e){switch(e.kind){case"boost":return`×${Po(e.payload.factor??1)}`;case"scoreMultTemporary":return je("shop.mult.temp",{n:Po(e.payload.mult??1),games:e.games??1});case"scoreMultPermanent":return je("shop.mult.perm",{n:Po(e.payload.mult??1)});case"arenaSize":{let t=`shop.item.${e.id}`;return Qx(t)?je(t):`${e.payload.size??"?"}³`}case"obstacleDensity":{let t=e.payload.density??1;return t===0?je("shop.item.density-0"):`×${t===0.25?"¼":t===0.5?"½":Po(t)}`}case"comingSoon":return"???";default:{let t=`shop.item.${e.id}`;return Qx(t)?je(t):e.id}}}function an(e,t,n){let i=document.createElement(e);if(t!==void 0)i.className=t;if(n!==void 0)i.textContent=n;return i}function iC(){let e=an("span","coin");return e.setAttribute("aria-hidden","true"),e}var sC={buyable:"shop.buy",owned:"shop.equip",equipped:"shop.equipped",active:"shop.active",short:"shop.short",maxed:"shop.max"};function rC(e,t,n,i){let s=Co(t,e,n),r=an("div",`shop-item ${s}${i?" locked":""}`);r.dataset.id=e.id,r.appendChild(an("div","name",$x(e)));let o=an("div","meta");if(s==="soon")o.textContent=je("shop.soon");else if(s==="buyable"||s==="short"){o.append(iC(),an("span",void 0,String(e.price)));let a=Pl(t,e);if(a>0)o.append(an("span",void 0,`· ${je("shop.gamesLeft",{n:a})}`))}else o.textContent=je("shop.owned");if(r.appendChild(o),s!=="soon"){let a=an("button",`act ${s==="buyable"?"buy":""}`,je(sC[s]));if(a.type="button",a.dataset.id=e.id,i)a.disabled=!0;else if(s==="buyable")a.dataset.act="buy";else if(s==="owned")a.dataset.act="equip";else a.disabled=!0;r.appendChild(a)}else r.setAttribute("aria-label",je("aria.shopLocked"));return r}function oC(e,t,n,i){if(e.id==="obstacles"&&Fl(t,n,i))return je("shop.item.density-0");if(e.id==="mult"){let o=Ro(t,n);return o>1?`×${Po(o)}`:"—"}let s=Nl[e.id],r=s===null?void 0:fr(t,n,s);return r===void 0?"":$x(r)}function eb(e,t,n,i){let s=null;function r(){let a=i.state();for(let l of Ul)if(ap(i.items(),l).some((c)=>c.kind!=="scoreMultTemporary"&&Co(a,c,i.config)==="buyable"&&!Lo(a,c,i.config,i.obstacleGeometry)))return l.id;return Ul[0]?.id??"boost"}function o(){let a=i.state(),l=i.items(),d=e.scrollTop,c=document.activeElement instanceof HTMLElement&&e.contains(document.activeElement)?document.activeElement.dataset.id:void 0,h=[];for(let u of Ul){let p=ap(l,u);if(p.length===0)continue;let g=s===u.id,x=an("section",`shop-group${g?" open":""}`),m=an("button","shop-group-head");if(m.type="button",m.dataset.group=u.id,m.setAttribute("aria-expanded",String(g)),m.append(an("span","g-title",je(`shop.section.${u.id}`))),p.some((f)=>f.kind!=="scoreMultTemporary"&&Co(a,f,i.config)==="buyable"&&!Lo(a,f,i.config,i.obstacleGeometry)))m.append(an("span","g-dot"));if(m.append(an("span","g-now",oC(u,a,i.config,i.obstacleGeometry)),an("span","g-chev")),x.appendChild(m),g){let f=an("div","shop-group-items");if(u.id==="obstacles"&&Fl(a,i.config,i.obstacleGeometry)){let E=an("p","shop-note",je("shop.obstacles.tiny"));E.setAttribute("role","note"),f.appendChild(E)}for(let E of p)f.appendChild(rC(E,a,i.config,Lo(a,E,i.config,i.obstacleGeometry)));x.appendChild(f)}h.push(x)}if(e.replaceChildren(...h),e.scrollTop=d,t.textContent=String(a.balance),t.parentElement?.setAttribute("aria-label",je("aria.shopBalance",{n:a.balance})),n.textContent=String(a.balance),c!==void 0)e.querySelector(`button[data-id="${CSS.escape(c)}"]:not(:disabled)`)?.focus({preventScroll:!0})}return e.addEventListener("click",(a)=>{let l=a.target;if(!(l instanceof Element))return;let d=l.closest("button[data-group]");if(d!==null){let p=d.dataset.group;s=s===p?null:p,o(),e.querySelector(`button[data-group="${p}"]`)?.scrollIntoView({block:"nearest"});return}let c=l.closest("button[data-act]");if(c===null)return;let h=i.items().find((p)=>p.id===c.dataset.id);if(h===void 0)return;if(c.dataset.act==="buy")i.onBuy(h);else if(c.dataset.act==="equip")i.onEquip(h);e.querySelector(`.shop-item[data-id="${CSS.escape(h.id)}"]`)?.classList.add("flash")}),{render:o,reset(){s=r(),o(),e.scrollTop=0}}}var aC={ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→"};function mr(e){let t=aC[e];if(t!==void 0)return t;if(e.startsWith("Key"))return e.slice(3);if(e.startsWith("Shift"))return"Shift";if(e==="Escape")return"Esc";return e}var lC=["up","left","down","right"];function dC(e,t){return Object.keys(e).filter((n)=>e[n]===t)}function tb(e){return[...new Set(e)]}function nb(){let e=lC.flatMap((i)=>dC(Hh,i)),t=e.filter((i)=>i.startsWith("Arrow")),n=e.filter((i)=>!i.startsWith("Arrow"));return[{action:"turn",groups:[t.map(mr),n.map(mr)]},{action:"boost",groups:tb(wl.map(mr)).map((i)=>[i])},{action:"cameraReset",groups:[[mr(Wh)]]},{action:"pause",groups:[[mr(Vh)]]}]}function ib(){return tb(wl.map(mr))}function sb(){return Oh}var cC={swipes:["swipe","boost","stick","reset","pause"],taps:["arrows","boost","stick","reset","pause"]};function rb(e,t){return cC[e].filter((n)=>n!=="stick"||t.touch)}function ob(e){if(!e.keyboard)return"none";return e.touch?"last":"first"}function lp(){let e=(t)=>typeof matchMedia==="function"&&matchMedia(t).matches;return{touch:e("(any-pointer: coarse)"),keyboard:e("(any-pointer: fine)")}}var uC={swipe:"controls.swipe",arrows:"controls.arrows",boost:"controls.boost",stick:"controls.stick",reset:"controls.reset",pause:"controls.pause"},hC={turn:"controls.key.turn",boost:"controls.key.boost",cameraReset:"controls.key.cameraReset",pause:"controls.key.pause"};function Ht(e,t,n){let i=document.createElement(e);if(t!==void 0)i.className=t;if(n!==void 0)i.textContent=n;return i}var pC="http://www.w3.org/2000/svg",Ol=160,ab=260;function tn(e,t,n){let i=document.createElementNS(pC,e);for(let[s,r]of Object.entries(t))i.setAttribute(s,String(r));if(n!==void 0)i.setAttribute("class",n);return i}function fC(e,t,n){let i=tn("svg",{viewBox:`0 0 ${Ol} ${ab}`,role:"img"},"ctl-diagram");i.setAttribute("aria-label",je("aria.controlsDiagram"));let s=t==="right",r=(h)=>s?h:Ol-h,o=s?24:Ol-24,a=(h,u,p,g="d-badge")=>{let x=n(p);if(x===void 0)return;i.append(tn("circle",{cx:h,cy:u,r:7.5},g));let m=tn("text",{x:h,y:u+0.5,"text-anchor":"middle","dominant-baseline":"central"},"d-num");m.textContent=String(x),i.append(m)},l=(h,u,p,g)=>{i.append(tn("path",{d:`M${-g} ${g*0.5} L0 ${-g*0.5} L${g} ${g*0.5}`,transform:`translate(${h} ${u}) rotate(${p})`},"d-line"))};i.append(tn("rect",{x:1,y:1,width:Ol-2,height:ab-2,rx:14},"d-frame")),i.append(tn("circle",{cx:144,cy:16,r:9},"d-ctl")),i.append(tn("rect",{x:140,y:12,width:2.6,height:8,rx:0.8},"d-fill")),i.append(tn("rect",{x:145.4,y:12,width:2.6,height:8,rx:0.8},"d-fill")),a(126,16,"pause");let d=(h,u,p)=>{i.append(tn("circle",{cx:h,cy:u,r:p},"d-ctl")),i.append(tn("circle",{cx:h,cy:u,r:2.2},"d-line")),i.append(tn("path",{d:`M${h} ${u-p+2} v3 M${h} ${u+p-2} v-3 M${h-p+2} ${u} h3 M${h+p-2} ${u} h-3`},"d-line"))},c=(h,u)=>{if(n("stick")===void 0)return;i.append(tn("circle",{cx:h,cy:u,r:19},"d-ctl")),i.append(tn("circle",{cx:h,cy:u,r:6},"d-ctl")),a(h,u-19-9,"stick")};if(e==="swipes"){for(let h of[0,90,180,270]){let u=h*Math.PI/180;l(80+Math.sin(u)*24,110-Math.cos(u)*24,h,6)}a(80,68,"swipe"),i.append(tn("circle",{cx:r(136),cy:236,r:16},"d-boost")),a(r(136),236,"boost","d-badge boost"),d(r(136),206,10),a(r(136),187,"reset"),c(o,236)}else{let p=s?82:8,g=(b)=>p+b*24,x=(b)=>182+b*24,m=[{id:"up",col:1,row:0,angle:0},{id:"left",col:0,row:1,angle:270},{id:"right",col:2,row:1,angle:90},{id:"down",col:1,row:2,angle:180}],f=new Set(sb());for(let b of m){if(!f.has(b.id))continue;i.append(tn("rect",{x:g(b.col),y:x(b.row),width:22,height:22,rx:5},"d-ctl")),l(g(b.col)+11,x(b.row)+11,b.angle,5)}let T=g(1)+11;a(T,173,"arrows"),i.append(tn("circle",{cx:T,cy:x(1)+11,r:10},"d-boost")),a(T,x(1)+11,"boost","d-badge boost");let E=g(s?2:0)+11;d(E,169,9),a(E,151,"reset"),c(o,217)}return i}function lb(e,t){function n(){let s=Ht("section","ctl-keys");s.append(Ht("h3",void 0,je("controls.keys.title")));let r=Ht("dl","ctl-keylist");for(let o of nb()){r.append(Ht("dt",void 0,je(hC[o.action])));let a=Ht("dd");o.groups.forEach((l,d)=>{if(d>0)a.append(Ht("span","ctl-or","/"));let c=Ht("span","ctl-caps");for(let h of l)c.append(Ht("kbd",void 0,h));a.append(c)}),r.append(a)}return s.append(r),s.append(Ht("p","ctl-note",je("controls.mouse.tilt")),Ht("p","ctl-note",je("controls.mouse.zoom"))),s}function i(){let s=t.kinds(),r=t.scheme(),o=rb(r,s),a=(p)=>{let g=o.indexOf(p);return g<0?void 0:g+1},l=Ht("div","options ctl-tabs");l.setAttribute("role","radiogroup"),l.setAttribute("aria-label",je("aria.scheme"));for(let p of["swipes","taps"]){let g=Ht("button",p===r?"selected":"",je(p==="swipes"?"scheme.swipes":"scheme.taps"));g.type="button",g.dataset.ctlScheme=p,g.setAttribute("aria-pressed",String(p===r)),l.append(g)}let d=Ht("div","ctl-main");d.append(fC(r,t.padSide(),a));let c=Ht("ol","ctl-legend");for(let p of o){let g=Ht("li");g.append(Ht("span",p==="boost"?"ctl-badge boost":"ctl-badge",String(a(p))),Ht("span","ctl-text",je(p==="reset"&&!s.touch?"controls.resetNoStick":uC[p]))),c.append(g)}d.append(c);let h=[l];if(h.push(d),s.touch)h.push(Ht("p","ctl-note",je("controls.note.fingers")));let u=ob(s);if(u==="first")h.unshift(n());else if(u==="last")h.push(n());e.replaceChildren(...h)}return e.addEventListener("click",(s)=>{let r=s.target;if(!(r instanceof Element))return;let o=r.closest("button[data-ctl-scheme]");if(o===null)return;let a=o.dataset.ctlScheme;if(a!=="swipes"&&a!=="taps")return;t.setScheme(a)}),{render:i,reset(){i(),e.scrollTop=0}}}function db(e,t,n){let i=e.get("snake:boostHintSeen")==="1",s="idle",r=!1,o=0,a=!1,l=()=>{if(i)return;i=!0,e.set("snake:boostHintSeen","1")},d=()=>{let c=s==="shown"&&!r;if(c===a)return;a=c,n(c)};return{begin(){s=i?"idle":"waiting",r=!1,o=0,d()},advance(c){if(r)return;if(s==="waiting"){if(o+=c,o>=t.showAfterMs)s="shown",o=0}else if(s==="shown"){if(o+=c,o>=t.visibleMs)s="done"}d()},boosted(){if(l(),s==="waiting"||s==="shown")s="done";d()},setHeld(c){r=c,d()},end(){if(s==="waiting"||s==="shown")s="done";r=!1,d()},get visible(){return a},get ticking(){return!r&&(s==="waiting"||s==="shown")}}}function mC(e){return Boolean(e.fullscreenElement)||Boolean(e.webkitFullscreenElement)||e.displayModeFullscreen}function gC(e,t){let n=t.fullscreenBottomReservePx;return e&&Number.isFinite(n)&&n>0?n:0}function cb(e,t=document,n=window){let i=t.documentElement,s=n.matchMedia("(display-mode: fullscreen)"),r=()=>{let o=t,a=mC({fullscreenElement:t.fullscreenElement,webkitFullscreenElement:o.webkitFullscreenElement,displayModeFullscreen:s.matches});i.style.setProperty("--fs-reserve",`${gC(a,e)}px`)};return t.addEventListener("fullscreenchange",r),t.addEventListener("webkitfullscreenchange",r),s.addEventListener("change",r),n.addEventListener("resize",r),n.addEventListener("orientationchange",r),r(),()=>{t.removeEventListener("fullscreenchange",r),t.removeEventListener("webkitfullscreenchange",r),s.removeEventListener("change",r),n.removeEventListener("resize",r),n.removeEventListener("orientationchange",r)}}var ub="./cyber-runner-brw2rcmr.mp3";var Io={counterUrl:"https://ku113p.goatcounter.com/count",scriptUrl:"https://gc.zgo.at/count.js",returnMinGapHours:6};function hb(e){let t=new Date(e);return Math.floor(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/86400000)}function bC(e,t,n,i=hb){if(e===null||!/^\d{1,16}$/.test(e))return!1;let s=Number(e);if(!Number.isFinite(s)||s>t)return!1;if(t-s<n*3600000)return!1;return i(t)>i(s)}function pb(e){let t=e.dayOf??hb,n=0,i=!1,s=!1;return{gameStarted(){if(!e.enabled)return;if(n++,n===1){let r=bC(e.storage.get("snake:lastVisit"),e.now(),e.returnMinGapHours,t);if(e.storage.set("snake:lastVisit",String(e.now())),e.send("start"),r)e.send("return")}else if(n===2)e.send("again")},twistSeen(){if(!e.enabled||n===0||i)return;i=!0,e.send("twist")},gameFinished(){if(!e.enabled||n===0||s)return;s=!0,e.send("finish")}}}function yC(e){let t=e.toLowerCase();return t===""||t==="localhost"||t.endsWith(".localhost")||t==="[::1]"||/^(127|10)\./.test(t)||/^192\.168\./.test(t)||/^172\.(1[6-9]|2\d|3[01])\./.test(t)||t==="0.0.0.0"}function fb(e,t){return!t&&!yC(e)}var _C={start:"Game started",twist:"Reached the twist",finish:"Game finished",again:"Second game in a visit",return:"Came back on another day"};function mb(){try{let e=document.createElement("script");e.async=!0,e.dataset.goatcounter=Io.counterUrl,e.src=Io.scriptUrl,e.onerror=()=>{},document.head.appendChild(e)}catch{}}function gb(e){setTimeout(()=>{try{let t=window.goatcounter;if(t!==void 0&&typeof t.count==="function")t.count({path:`snake-${e}`,title:_C[e],event:!0})}catch{}},0)}var ws=mt;cb(mt.layout);var SC="snake:highScore",_b="snake:leaderboard",Sb="snake:initials",Mb="snake:hasPlayedBefore",wb="snake:padSide",Eb="snake:musicOn",Tb="snake:sfxOn",Ab="snake:fogOn",Rb="snake:quality",MC="snake:size",Cb="snake:scheme",Lb=sp,Pb="snake:shopUnlocked";function Le(e){let t=document.getElementById(e);if(t===null)throw Error(`main.ts: element #${e} not found in index.html`);return t}var Tn=Le("game-canvas"),Ib=Le("menu"),wC=Le("hud"),Db=Le("score"),EC=Le("game-over"),TC=Le("final-score"),AC=Le("final-time"),zb=Le("game-over-board"),Fb=Le("settings"),Ub=Le("records"),Nb=Le("controls"),RC=Le("controls-body"),CC=Le("open-controls"),gr=Le("boost-hint"),LC=Le("records-board"),cp=Le("record-line"),PC=Le("open-settings"),IC=["settings-back","settings-done","records-back","records-done","controls-back","controls-done"].map((e)=>Le(e)),Ob=Le("drum-block"),DC=Le("drum"),zC=Le("drum-ok"),Bb=Le("game-over-actions"),FC=Le("tap-to-play"),UC=Le("play-again"),NC=Le("pause"),OC=Le("resume"),BC=Le("demo-explainer"),kC=Le("demo-continue"),GC=Le("to-menu"),vr=Le("pad"),Nn=Le("boost"),yp=Le("pause-btn"),xr=Le("cam-reset"),br=Le("stick"),HC=Le("stick-knob"),VC=Le("pause-to-menu"),up=Le("pad-side-options"),_p=Le("scheme-options"),Sp=Le("pause-scheme-options"),kb=Le("legal-warning"),Gb=Le("legal-warning-ok"),Hb=Le("legal-terms"),Vb=Le("legal-terms-ok"),Wb=Le("shop"),jb=Le("open-shop"),WC=Le("shop-back"),jC=Le("shop-play"),XC=Le("shop-body"),JC=Le("shop-balance-n"),YC=Le("menu-balance"),qC=Le("coins-line"),KC=Le("coins-earned"),Xb=Le("to-shop");function Rn(e){try{return localStorage.getItem(e)}catch{return null}}function An(e,t){try{localStorage.setItem(e,t)}catch{}}var Fo={get:Rn,set:An},Jb=fb(location.hostname,Yh(location.search)),hp=pb({enabled:Jb,now:Date.now,storage:Fo,send:gb,returnMinGapHours:Io.returnMinGapHours});if(Jb)mb();Mx(Fo,navigator);var Gi=mt.leaderboard;function Mp(e){An(_b,JSON.stringify(e))}var vb=400,pp=0,fp=!1;function Do(){if(window.clearTimeout(pp),!fp)return;fp=!1,Mp(On),An(Sb,Vl)}function ZC(){if(fp=!0,window.clearTimeout(pp),vb<=0)Do();else pp=window.setTimeout(Do,vb)}window.addEventListener("pagehide",Do);document.addEventListener("visibilitychange",()=>{if(document.hidden)Do()});function QC(){let e=Rx(Rn(_b),Gi);if(e!==null)return e;let t=Cx(Rn(SC),Gi);if(t.length>0)Mp(t);return t}var On=QC(),Vl=Jh(Rn(Sb),Gi);function Yb(){cp.disabled=!Lx(cp,On)}function wp(e){Yb(),Cl(LC,On,Gi.size,-1),Cl(zb,On,Gi.size,e)}wp(-1);var Ep=Px(DC,Gi),Ms=-1;function qb(e,t){let n={score:e,name:Vl,durationMs:t,date:Date.now()},i=Ex(On,n,Gi);if(i.index>=0)On=i.table,Mp(On);return i.index}function Wl(){Do(),Ms=-1,Ep.hide(),Ob.classList.add("hidden"),Bb.classList.remove("hidden"),wp(-1)}zC.addEventListener("click",Wl);function $C(){return Rn(Mb)===null}function eL(){An(Mb,"1")}var dp=mt.sound;function mp(e,t){let n=Rn(e);return n===null?t:n==="1"}var nn=fx(dp,ub,{musicOn:mp(Eb,dp?.defaults.musicOn??!0),sfxOn:mp(Tb,dp?.defaults.sfxOn??!0)}),mi=mp(Ab,mt.fog.defaultOn);function Kb(){nn.unlock()}var tL=document.querySelectorAll("button[data-snd]");function jl(){for(let e of tL){let t=e.dataset.snd==="music",n=t?nn.musicOn:nn.sfxOn;e.textContent=je(`toggle.${t?"music":"sfx"}.${n?"on":"off"}`),e.classList.toggle("selected",n),e.setAttribute("aria-pressed",String(n))}}document.addEventListener("click",(e)=>{let t=e.target;if(!(t instanceof Element))return;let n=t.closest(".screen button");if(n===null)return;Kb();let i=n.dataset.snd;if(i==="music")nn.setMusicOn(!nn.musicOn),An(Eb,nn.musicOn?"1":"0"),jl();else if(i==="sfx")nn.setSfxOn(!nn.sfxOn),An(Tb,nn.sfxOn?"1":"0"),jl();else if(n.dataset.fog!==void 0)mi=!mi,An(Ab,mi?"1":"0"),Tp(),xt?.view.setFogOn(mi);else{let s=n.dataset.quality;if(bl(s))sL(s)}nn.play("click")});jl();var nL=document.querySelectorAll("button[data-fog]");function Tp(){for(let e of nL)e.textContent=je(mi?"toggle.fog.on":"toggle.fog.off"),e.classList.toggle("selected",mi),e.setAttribute("aria-pressed",String(mi))}Tp();var Ql=mt.quality,gp=Rn(Rb),Zb=bl(gp),$l=bl(gp)?gp:Nv(Dv(window.innerWidth,window.innerHeight,window.devicePixelRatio),Ql),Ap=Ov(Ql);Lh(Ql.levels[$l],Ap);var iL=document.querySelectorAll("button[data-quality]");function Qb(){for(let e of iL){let t=e.dataset.quality===$l;e.classList.toggle("selected",t),e.setAttribute("aria-pressed",String(t))}}function sL(e){$l=e,Zb=!0,An(Rb,e),Lh(Ql.levels[e],Ap),Qb(),Zl(),Bi?.refresh()}Qb();var rL=Rn(Cb),Hi=ux(rL,mt.input.defaultScheme);function yr(e,t,n){let i=e.querySelectorAll("button");for(let s of i){let r=s.dataset[t]===n;s.classList.toggle("selected",r),s.setAttribute("aria-pressed",String(r))}}function $b(e){if(e===Hi)return;if(Hi=e,An(Cb,e),yr(_p,"scheme",e),yr(Sp,"scheme",e),Cp.render(),xt!==null)_L(xt,e)}function ey(e){let t=e.target;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.scheme;if(n!=="swipes"&&n!=="taps")return;$b(n)}_p.addEventListener("click",ey);Sp.addEventListener("click",ey);var gi=Bh(Rn(wb));up.addEventListener("click",(e)=>{let t=e.target;if(!(t instanceof HTMLButtonElement))return;gi=Bh(t.dataset.side??null),An(wb,gi),yr(up,"side",gi)});yr(_p,"scheme",Hi);yr(Sp,"scheme",Hi);yr(up,"side",gi);for(let e of["menu-lang","warning-lang","terms-lang"])Fx(Le(e),Fo);Ni(()=>{jl(),Tp(),Ep.relabel(),Yb()});var vi=mt,oL=Ss(vi),Kn=Kx(aL(),vi);function aL(){let e=Rn(Lb),t=op(e,vi);if(e!==null)return t;let n=Number.parseInt(Rn(MC)??"",10);return Number.isFinite(n)?Zx(t,n,vi):t}function Rp(){return zl(Kn.state,vi).size}var vp=Yx({finishedGame:Rn(Pb)==="1",hasRecords:On.length>0});function Xl(){An(Lb,rp(Kn.state))}function ty(){jb.classList.toggle("hidden",!vp)}function ny(){if(vp)return;vp=!0,An(Pb,"1"),ty()}var _r=eb(XC,JC,YC,{config:vi,items:()=>oL,state:()=>Kn.state,obstacleGeometry:mt.obstacles,onBuy(e){if(Kn.buy(e))Xl();_r.render()},onEquip(e){if(Kn.equip(e))Xl();_r.render()}});_r.render();ty();Ni(()=>_r.render());function lL(e){return`×${Math.round(e*10)/10}`}var xb="";function iy(e){let t=lL(df(e));if(t===xb)return;xb=t,Nn.textContent=t}function sy(e){let t=Kn.settle(e);return Xl(),_r.render(),t??{gained:0,mult:1}}function ry(){let e=bt.state.base==="over";if(bt.openShop(),bt.state.base!=="shop")return;if(e)Dp();_r.reset()}function oy(e){if(gr.classList.toggle("hidden",!e),Nn.classList.toggle("hint-ring",e),!e)return;let t=lp().keyboard;gr.textContent=t?je("hint.boost.keys",{keys:ib().join(" / ")}):je("hint.boost.touch",{label:Nn.textContent??""}),gr.classList.toggle("swipes",zo==="swipes"),gr.classList.toggle("taps",zo==="taps"),gr.classList.toggle("side-right",gi==="right"),gr.classList.toggle("side-left",gi==="left")}var Vi=db(Fo,mt.boostHint,oy);Ni(()=>{if(Vi.visible)oy(!0)});var dL={warning:kb,terms:Hb,menu:Ib,settings:Fb,records:Ub,shop:Wb,controls:Nb,hud:wC,over:EC,pause:NC,demo:BC},ay=[kb,Hb].map((e)=>e.querySelector(".legal-body"));function ed(){for(let e of ay)e.classList.toggle("more",e.scrollHeight-e.scrollTop-e.clientHeight>4)}for(let e of ay)e.addEventListener("scroll",ed,{passive:!0});window.addEventListener("resize",ed);Ni(ed);var bb=null;function ly(e){if(e.base!=="game"||e.demo)Vi.end();else Vi.setHeld(e.paused);let t=Bx(e);for(let i of Ox)dL[i].classList.toggle("hidden",!t.has(i));let n=e.legal!==null;if(Ib.inert=n,Fb.inert=n,Ub.inert=n,Wb.inert=n,Nb.inert=n,ed(),e.legal!==bb){if(bb=e.legal,e.legal==="warning")Gb.focus({preventScroll:!0});else if(e.legal==="terms")Vb.focus({preventScroll:!0})}}var Cp=lb(RC,{scheme:()=>Hi,setScheme:$b,padSide:()=>gi,kinds:lp});Ni(()=>Cp.render());var bt=Gx(Fo,ly);ly(bt.state);Gb.addEventListener("click",()=>bt.confirmLegal());Vb.addEventListener("click",()=>bt.confirmLegal());cp.addEventListener("click",()=>bt.openRecords());CC.addEventListener("click",()=>{if(bt.openControls(),bt.state.base==="controls")Cp.reset()});PC.addEventListener("click",()=>bt.openSettings());jb.addEventListener("click",ry);Xb.addEventListener("click",ry);WC.addEventListener("click",()=>bt.back());for(let e of IC)e.addEventListener("click",()=>bt.back());window.addEventListener("keydown",(e)=>{if(e.code==="Escape")bt.back()});if(Nx(location.search))bt.skipLegal();else bt.start();var xt=null,Bi=null,qn=null,xn=!1;function Bl(){return kx(bt.state)||xn}var zo=Hi,dy=mt.frozenView,xp=!1,kl=0,bp=0,Jl=-1,Yl=-1,Lp=-1;function Pp(){xp=!0,kl=performance.now()+dy.settleMs}function ql(){let e=xt;if(e===null||!bt.state.paused||!Ls(e.state))return;e.view.render(e.state,0)}function Ip(e){Jl=Tn.clientWidth,Yl=Tn.clientHeight,Lp=window.devicePixelRatio,e.resize(Jl,Yl)}function cy(e){if(e<bp)return;bp=e+dy.sizePollMs;let t=xt;if(t===null)return;if(Tn.clientWidth===Jl&&Tn.clientHeight===Yl&&window.devicePixelRatio===Lp)return;Ip(t.view),Pp()}function cL(e){if(cy(e),xp)xp=!1,ql();else if(kl!==0&&e>=kl)kl=0,ql()}function uL(e,t,n){switch(e.type){case"started":nn.newRound();break;case"ate":nn.play("eat"),Db.textContent=String(e.score),iy(n.state);break;case"moved":if(t===void 0||t.type!=="ate"&&t.type!=="died")nn.play("tick",Qn(n.state));n.pad?.clearQueued();break;case"modeChanged":if(e.mode==="free")eL();if(e.mode==="free"&&n.explainTransition&&n.counted)hp.twistSeen();if(n.explainTransition&&e.mode==="free")bt.openDemo(),n.stick.release(),n.boost.releaseAll();break;case"died":{queueMicrotask(td),n.boost.releaseAll(),n.stick.release(),n.pad?.clearQueued(),vr.classList.add("hidden"),uy();let i=Ho(n.state),s=$n(n.state);TC.textContent=String(i),AC.textContent=Rl(s);let{gained:r,mult:o}=sy(i);if(ny(),qC.classList.toggle("hidden",r<=0),KC.textContent=je("over.coins",{n:r})+(o>1?` ×${Math.round(o*100)/100}`:""),Xb.classList.toggle("hidden",!qx(Kn.state,vi,mt.obstacles)),Ms=qb(i,s),wp(Ms),Ms>=0)Bb.classList.add("hidden"),Ob.classList.remove("hidden"),Ep.show(Vl,(a)=>{if(Ms<0)return;Vl=a,On=Tx(On,Ms,a),ZC(),Cl(zb,On,Gi.size,Ms)},Wl);else Wl();if(nn.play("death"),bt.died(),n.counted)hp.gameFinished();break}default:break}}function Gl(e,t){for(let n=0;n<t.length;n++){let i=t[n];if(i===void 0)continue;e.view.handle(i,e.state),uL(i,t[n+1],e)}}function uy(){Nn.classList.add("hidden"),yp.classList.add("hidden"),xr.classList.add("hidden"),br.classList.add("hidden")}function hL(){let e=gi==="right";Nn.classList.toggle("side-right",e),xr.classList.toggle("right",e),Nn.classList.remove("hidden"),yp.classList.remove("hidden"),xr.classList.remove("hidden"),br.classList.toggle("side-right",!e),br.classList.remove("hidden")}var pL=mt.camera.zoomMin,fL=mt.camera.zoomMax;function Kl(){let e=It.yaw===0&&It.pitch===0&&It.zoom===1;xr.classList.toggle("idle",e)}function Hl(){g0(),Kl()}xr.addEventListener("click",Hl);var ki=mt.input.stick,mL={deadZone:ki.deadZone,curve:ki.curve,tapMaxMs:ki.tapMaxMs};br.style.setProperty("--stick",`clamp(${ki.sizeMinPx}px, ${ki.sizeVmin}vmin, ${ki.sizeMaxPx}px)`);function gL(e,t,n){It.yaw=Ao(It.yaw,Gh(e,ki.maxRadPerSec,n),1,To),It.pitch=Ao(It.pitch,Gh(t,ki.maxRadPerSec,n),1,To),Kl()}function td(){Bi?.setShown(xt!==null&&Ls(xt.state))}function Dp(){if(Vi.end(),vr.classList.add("hidden"),uy(),xt===null)return;xt.boost.releaseAll(),xt.detachInput(),xt.view.dispose(),xt=null,td()}var vL=Le("pad-cross"),xL=Nn.parentElement??document.body;function bL(e){let t=e?vL:xL;if(Nn.parentElement!==t)t.appendChild(Nn);Nn.classList.toggle("in-cross",e),xr.classList.toggle("above-pad",e),br.classList.toggle("beside-pad",e)}function hy(e){if(bL(e==="taps"),e!=="taps"){vr.classList.add("hidden");return}vr.classList.toggle("left",gi==="left"),vr.classList.remove("hidden")}var yL={onTurn:()=>{},onBoost:()=>{},onPause:()=>{},onCameraTiltBy:()=>{},onCameraZoomBy:()=>{},onCameraReset:()=>{}};function py(e,t){let n=dx(Tn,t,ws,e.handlers);if(t==="taps"){let i=sx(vr,e.handlers);e.pad=i,e.detachSchemeInput=()=>{i.detach(),n(),e.pad=null}}else e.pad=null,e.detachSchemeInput=n}function _L(e,t){e.detachSchemeInput(),py(e,t),hy(t),zo=t}function Uo(e,t,n=!1){if(Dp(),!n)zo=t;Hl();let i=n?!1:$C(),s=n?Uh:Math.floor(Math.random()*2147483647);if(!n)Kn.begin(),Xl();let r=n?null:zl(Kn.state,vi),o=r===null?ws.speed.boostFactor:r.boostFactor,a=Zp(ws,e,s,i,o,r===null?{}:{obstacleMult:r.obstacleMult,paceScale:r.paceScale});iy(a);let l=(x,m)=>n?void 0:fr(Kn.state,vi,x)?.payload?.[m],d=Hv(Tn,ws,a,{palette:l("palette","palette"),snakeSkin:l("snakeSkin","skin"),appleSkin:l("appleSkin","skin"),compassSkin:l("compassSkin","skin")});d.setFogOn(mi);let c=ur((x)=>{if(xn)return;if(x)Vi.boosted();p.boostBtn.setActive(x),Gl(p,ef(p.state,x))}),h=ox(Nn,{onTurn:()=>{},onBoost:(x)=>x?c.press("btn"):c.release("btn")}),u=rx(br,HC,mL,Hl),p={state:a,view:d,detachInput:()=>{},detachSchemeInput:()=>{},handlers:yL,pad:null,boostBtn:h,stick:u,boost:c,explainTransition:i,counted:!n},g={onTurn(x){if(Bl())return;Gl(p,tf(p.state,x))},onBoost:(x)=>x?c.press("kbd"):c.release("kbd"),onPause:()=>{if(xn){if(qn!==null)qn.abort("cancelled with Escape");else wL();return}if(Bl())fy();else zp()},onCameraTiltBy(x,m){if(Bl())return;It.yaw=Ao(It.yaw,x,1,To),It.pitch=Ao(It.pitch,m,1,To),Kl()},onCameraZoomBy(x){if(Bl())return;It.zoom=nx(It.zoom*x,pL,fL),Kl()},onCameraReset:Hl};if(p.handlers=g,py(p,t),p.detachInput=()=>{p.detachSchemeInput(),h.detach(),u.detach()},xt=p,bt.startGame(),!n)Vi.begin();if(Db.textContent="0",hy(t),hL(),Ip(d),Gl(p,$p(p.state)),p.counted)hp.gameStarted();Es=null,td()}function nd(){if(xt!==null&&Ls(xt.state)&&!xn){if(qb(Ho(xt.state),$n(xt.state)),sy(Ho(xt.state)).gained>0)ny()}Wl(),bt.toMenu(),Dp()}FC.addEventListener("click",()=>{Kb(),Uo(Rp(),Hi)});jC.addEventListener("click",()=>Uo(Rp(),Hi));UC.addEventListener("click",()=>Uo(Rp(),zo));GC.addEventListener("click",nd);VC.addEventListener("click",nd);function fy(){bt.resume(),Es=null}function zp(){let e=xt;if(xn)return;if(e===null||!Ls(e.state)||!bt.pause())return;e.boost.releaseAll(),e.stick.release()}document.addEventListener("visibilitychange",()=>{if(!document.hidden){Es=null,nn.resume();return}if(nn.suspend(),xn)qn?.abort("tab was hidden during the run");zp()});yp.addEventListener("click",zp);OC.addEventListener("click",fy);kC.addEventListener("click",()=>{bt.closeDemo(),Es=null});var SL=xl();function Zl(){xt?.view.applyPerf(Tn.clientWidth,Tn.clientHeight),Jl=Tn.clientWidth,Yl=Tn.clientHeight,Lp=window.devicePixelRatio,ql(),Pp()}function id(){if(Bi===null)Bi=Vv({sample(e){let t=xt;if(t===null)return;t.view.readPerf(e),e.arena=Et(t.state),e.snakeLength=ln(t.state)},apply:Zl,startBench:my,resultClosed(){}});return td(),Bi}function my(){if(qn!==null&&qn.running)return;let e=id();e.open();let t={...pe};xn=!0,Uo(Fh,"swipes",!0),pe.fog=!0,pe.miniMap=!0;let n=new Nh({applyStage(i){Xv(i,Ap),Zl()},sample(i){let s=xt;if(s!==null)s.view.readPerf(i)},finished(i,s){let r=xt,o;if(r===null)o=`SNAKE BENCH v1 (INCOMPLETE: ${s??"session lost"})`;else{let a=Gv(r.view.gpuInfo(),{arena:Et(r.state),snakeLength:ln(r.state),mode:`${Gn(r.state)}, fog menu toggle ${mi?"on":"off"}`,seed:Uh,language:Al().code,quality:`${$l} (${Zb?"chosen by player":"auto, by GPU class and buffer size"})`});o=Jv(a,i,s)}Object.assign(pe,t),Zl(),nd(),xn=!1,qn=null,e.setBench(null),e.showResult(o)}},SL);qn=n,n.start(performance.now()),e.setBench(n)}function ML(){if(xn)return;id().open(),xn=!0,Uo(Fh,"swipes",!0)}function wL(){nd(),xn=!1}window.addEventListener("keydown",(e)=>{if(e.code!=="Backquote"||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;let t=e.target;if(t!==null&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"))return;if(e.preventDefault(),xn&&qn!==null)return;id().toggle()});{let e=new URLSearchParams(location.search).get("perf");if(Yh(location.search)){if(id().open(),e==="bench")setTimeout(my,500);else if(e==="freeze")setTimeout(ML,500)}}function Ts(){if(xt!==null)Ip(xt.view);ql(),Pp()}window.addEventListener("resize",Ts);window.addEventListener("orientationchange",Ts);window.addEventListener("pageshow",Ts);window.visualViewport?.addEventListener("resize",Ts);if(typeof ResizeObserver<"u")new ResizeObserver(Ts).observe(Tn);Tn.addEventListener("webglcontextrestored",Ts);document.addEventListener("visibilitychange",()=>{if(!document.hidden)Ts()});var Es=null;function gy(e){if(requestAnimationFrame(gy),Bi===null){yb(e);return}Bi.beginFrame(e);let t=performance.now();yb(e);let n=performance.now()-t;if(qn!==null)qn.frame(e,n);Bi.endFrame(n)}function yb(e){let t=xt;if(t===null)return;let n=Es===null?0:e-Es,i=n>ws.loop.maxFrameMs?ws.loop.maxFrameMs:n;if(Es=e,bt.state.paused){cL(e);return}if(e>=bp)cy(e);if(!bt.state.demo&&!xn){if(Gl(t,nf(t.state,ws,i)),Vi.ticking)Vi.advance(i);let s=t.stick.state;if(s.x!==0||s.y!==0)gL(s.x,s.y,i)}if(!Ls(t.state))return;t.view.render(t.state,i)}requestAnimationFrame(gy);
