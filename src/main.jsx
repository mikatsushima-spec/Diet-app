import React,{useEffect,useMemo,useState}from'react';import{createRoot}from'react-dom/client';import{Camera,ChevronLeft,ChevronRight,Home,Image as ImageIcon,LineChart,Settings}from'lucide-react';import'./style.css';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

const K='diet-app-v1',FOOD_CACHE_KEY='diet-app-food-cache-v1';const today=()=>new Date().toISOString().slice(0,10);
function calc(p){let b=10*p.weight+6.25*p.height-5*p.age+(p.sex==='female'?-161:5);let a={low:1.2,light:1.375,medium:1.55,high:1.725}[p.activity];let t=b*a,days=Math.max(1,(new Date(p.targetDate)-new Date(p.startDate))/86400000),def=Math.max(0,(p.weight-p.targetWeight)*7200/days);return{bmr:Math.round(b),tdee:Math.round(t),cal:Math.round(t-def),pace:((p.weight-p.targetWeight)/(days/7)).toFixed(2)}} 
function App(){const[s,setS]=useState(()=>JSON.parse(localStorage.getItem(K)||'null')||{profile:null,weights:[],meals:{}});const[tab,setTab]=useState('today');const[install,setInstall]=useState(null);useEffect(()=>localStorage.setItem(K,JSON.stringify(s)),[s]);useEffect(()=>{const h=e=>{e.preventDefault();setInstall(e)};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h)},[]);async function installApp(){if(!install)return;await install.prompt();setInstall(null)}if(!s.profile)return <Setup done={p=>setS({...s,profile:p,weights:[{date:today(),weight:p.weight}]})}/>;return <><main>{tab==='today'?<Today s={s} setS={setS}/>:tab==='weight'?<Weight s={s} setS={setS}/>:<><section><header><h1>設定</h1></header>{install&&<div className="install-card"><div><b>ホーム画面に追加</b><small>アプリのようにすぐ開けます</small></div><button onClick={installApp}>追加</button></div>}</section><Setup initial={s.profile} done={p=>setS({...s,profile:p})}/></>}</main><nav><button onClick={()=>setTab('today')}><Home/>今日</button><button onClick={()=>setTab('weight')}><LineChart/>体重</button><button onClick={()=>setTab('settings')}><Settings/>設定</button></nav></>}
function Setup({done,initial}){const[p,setP]=useState(initial||{sex:'female',age:40,height:160,weight:60,targetWeight:55,startDate:today(),targetDate:'2027-04-06',activity:'light'});let c=calc(p);return <section className="setup"><h1>目標を決める</h1><p>まず、目標体重と期間から無理のない目安を作ります。</p><div className="card form"><label>現在体重 (kg)<input type="number" step=".1" value={p.weight} onChange={e=>setP({...p,weight:+e.target.value})}/></label><label>目標体重 (kg)<input type="number" step=".1" value={p.targetWeight} onChange={e=>setP({...p,targetWeight:+e.target.value})}/></label><label>目標達成日<input type="date" value={p.targetDate} onChange={e=>setP({...p,targetDate:e.target.value})}/></label><div className="row"><label>身長 cm<input type="number" value={p.height} onChange={e=>setP({...p,height:+e.target.value})}/></label><label>年齢<input type="number" value={p.age} onChange={e=>setP({...p,age:+e.target.value})}/></label></div><label>活動量<select value={p.activity} onChange={e=>setP({...p,activity:e.target.value})}><option value="low">ほぼ座っている</option><option value="light">軽く動く・歩く</option><option value="medium">適度に運動</option><option value="high">かなり活動的</option></select></label></div><div className="card result"><b>1日の目安 {c.cal} kcal</b><span>推定消費 {c.tdee} kcal</span><span>目標ペース −{c.pace} kg/週</span></div><button className="primary" onClick={()=>done(p)}>この目標ではじめる</button></section>}
function Today({s,setS}){const[scan,setScan]=useState(null);const[analyzing,setAnalyzing]=useState(false);const[pickType,setPickType]=useState(null);const[dressing,setDressing]=useState('');const[selectedDate,setSelectedDate]=useState(today());let c=calc(s.profile),d=selectedDate,ms=s.meals[d]||[],sum=ms.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c}),{cal:0,p:0,f:0,c:0});let goals={p:Math.round(s.profile.weight*1.5),f:Math.round(c.cal*.27/9),c:Math.round((c.cal-s.profile.weight*1.5*4-(c.cal*.27))/4)};function add(type){setPickType(type)}
function choosePhotoSource(source){const type=pickType;setPickType(null);if(!type)return;document.getElementById((source==='camera'?'camera-':'gallery-')+type)?.click()}
async function picked(type,e){let file=e.target.files?.[0];if(!file)return;let url=URL.createObjectURL(file);setScan({type,url,name:'解析中…',cal:'',p:'',f:'',c:'',items:[]});setAnalyzing(true);e.target.value='';try{let image=await compressImage(file);let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});let rawResponse=await r.text();let data={};try{data=JSON.parse(rawResponse)}catch{}if(!r.ok)throw new Error(data.detail||data.error||rawResponse||('HTTP '+r.status));if(data.web_fallbacks?.length){
       let cache=JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}');
       for(const w of data.web_fallbacks){
         if(w.estimation_source==="web_search"&&w.food_name){
           cache[w.food_name]={food_name:w.food_name,basis:w.basis||"per_100g",calories:w.calories,protein_g:w.protein_g,fat_g:w.fat_g,carbohydrate_g:w.carbohydrate_g,fiber_g:w.fiber_g,salt_g:w.salt_g,source_name:w.source_name,source_url:w.source_url,confidence:w.confidence,cached_at:new Date().toISOString()};
         }
       }
       localStorage.setItem(FOOD_CACHE_KEY,JSON.stringify(cache));
     }
     let names=(data.items||[]).map(x=>x.food_name).join('・');setScan(x=>({...x,name:data.dish_name||names||'食事',items:data.items||[],notes:data.notes||[],cal:data.nutrition?.calories??'',p:data.nutrition?.protein_g??'',f:data.nutrition?.fat_g??'',c:data.nutrition?.carbohydrate_g??'',calculation_note:data.calculation_note,needs_confirmation:data.needs_user_confirmation||[]}))}catch(err){setScan(x=>({...x,name:'',error:(err?.message||'').includes('413')?'写真を小さくして再送できませんでした。もう一度写真を選んでください。':'AI解析を利用できません：'+(err?.message||'不明なエラー')}))}finally{setAnalyzing(false)}}
async function removeDetectedItem(index){
 if(!scan?.items)return;
 const items=scan.items.filter((_,i)=>i!==index);
 setAnalyzing(true);
 try{
  let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,dish_name:scan.name,food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});
  let raw=await r.text(),data={};try{data=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(data.detail||data.error||raw||('HTTP '+r.status));
  setScan(x=>({...x,items:data.items||items,cal:data.nutrition?.calories??'',p:data.nutrition?.protein_g??'',f:data.nutrition?.fat_g??'',c:data.nutrition?.carbohydrate_g??'',calculation_note:data.calculation_note,needs_confirmation:data.needs_user_confirmation||[]}));
 }catch(err){setScan(x=>({...x,error:'再計算できませんでした：'+(err?.message||'不明なエラー')}))}
 finally{setAnalyzing(false)}
}
async function chooseDressing(index,value){
 setDressing(value);if(!value||!scan?.items)return;
 setAnalyzing(true);
 try{
  let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:scan.items,dish_name:scan.name,overrides:{[String(index)]:{food_name:value}},food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});
  let raw=await r.text(),data={};try{data=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(data.detail||data.error||raw||('HTTP '+r.status));
  setScan(x=>({...x,items:data.items||x.items,cal:data.nutrition?.calories??'',p:data.nutrition?.protein_g??'',f:data.nutrition?.fat_g??'',c:data.nutrition?.carbohydrate_g??'',calculation_note:data.calculation_note,needs_confirmation:(x.needs_confirmation||[]).filter(q=>!/ドレッシング|ソース/.test(q))}));
 }catch(err){setScan(x=>({...x,error:'再計算できませんでした：'+(err?.message||'不明なエラー')}))}
 finally{setAnalyzing(false)}
}
function compressImage(file){return new Promise((ok,ng)=>{let r=new FileReader();r.onerror=ng;r.onload=()=>{let img=new Image();img.onerror=ng;img.onload=()=>{let max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);ok(canvas.toDataURL('image/jpeg',.78))};img.src=r.result};r.readAsDataURL(file)})}
function saveScan(){let m={type:scan.type,name:scan.name||'食事',cal:+scan.cal||0,p:+scan.p||0,f:+scan.f||0,c:+scan.c||0,source:'photo_manual'};setS({...s,meals:{...s.meals,[d]:[...ms,m]}});if(scan.url)URL.revokeObjectURL(scan.url);setScan(null)}function closeScan(){if(scan?.url)URL.revokeObjectURL(scan.url);setScan(null)}
function deleteMeal(meal){
 const next=(s.meals[d]||[]).filter(x=>x!==meal);
 setS({...s,meals:{...s.meals,[d]:next}});
}
const selected=new Date(d+'T00:00:00'),isToday=d===today(),dateLabel=selected.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
return <section><header><h1>{isToday?'今日':'食事記録'}</h1><div className="date-picker"><label className="date-control"><span>{dateLabel} ▾</span><input aria-label="日付を選択" type="date" value={d} max={today()} onChange={e=>e.target.value&&setSelectedDate(e.target.value)}/></label>{!isToday&&<button type="button" onClick={()=>setSelectedDate(today())}>今日へ</button>}</div></header><div className="hero"><small>今日の摂取</small><strong>{displayNum(sum.cal)} <i>/ {displayNum(c.cal)} kcal</i></strong><p>あと <b>{displayNum(Math.max(0,c.cal-sum.cal))} kcal</b> が目安</p></div><div className="card nutrients"><Bar n="たんぱく質" v={sum.p} g={goals.p}/><Bar n="脂質" v={sum.f} g={goals.f}/><Bar n="炭水化物" v={sum.c} g={goals.c}/></div><div className="advice"><b>今日のアドバイス</b><p>{sum.p<goals.p*.7?'たんぱく質がまだ少なめです。次の食事は魚・鶏肉・豆腐などを意識すると整えやすいです。':'今のところ良いペースです。残りの食事もバランスよく。'}</p></div>{['朝食','昼食','夕食','間食'].map(t=><div className="card meal" key={t}><div className="mealhead"><b>{t}</b><button onClick={()=>add(t)}><Camera/>写真</button><input id={'camera-'+t} className="hidden" type="file" accept="image/*" capture="environment" onChange={e=>picked(t,e)}/><input id={'gallery-'+t} className="hidden" type="file" accept="image/*" onChange={e=>picked(t,e)}/></div>{ms.filter(x=>x.type===t).map((m,i)=><div className="food saved-food" key={i}><span>{m.name}</span><b>{displayNum(m.cal)} kcal</b><small>たんぱく質 {displayNum(m.p)}g　脂質 {displayNum(m.f)}g　炭水化物 {displayNum(m.c)}g</small><button type="button" className="delete-meal" aria-label={m.name+'を削除'} onClick={()=>deleteMeal(m)}>×</button></div>)}</div>)}{pickType&&<div className="photo-source-backdrop" onClick={()=>setPickType(null)}><div className="photo-source-sheet" onClick={e=>e.stopPropagation()}><b>写真を追加</b><p>画像は解析にだけ使用し、食事記録には保存しません。</p><div><button type="button" onClick={()=>choosePhotoSource('camera')}><Camera/>その場で撮影</button><button type="button" onClick={()=>choosePhotoSource('gallery')}><ImageIcon/>写真を選ぶ</button></div><button type="button" className="photo-source-cancel" onClick={()=>setPickType(null)}>キャンセル</button></div></div>}{scan&&<div className="modal"><div className="sheet">{scan.url&&<img className="preview" src={scan.url} onError={e=>{e.currentTarget.style.display="none"}}/>}<h2>{scan.type}を記録</h2><p className="muted">{analyzing?'写真から料理と量を解析しています…':scan.error||'AIが写真から料理と推定量を読み取りました。内容を確認し、必要なら修正してください。'}</p>{scan.items?.length>0&&<div className="detected">{scan.items.map((x,i)=><div key={i} className="detected-row"><b>{x.food_name}</b><span>約 {x.estimated_amount_g}g ・ {x.cooking_method||'調理法不明'} ・ 確信度 {Math.round((x.confidence||0)*100)}%</span>{/ドレッシング|ソース/.test(x.food_name)&&<select value={dressing} onChange={e=>chooseDressing(i,e.target.value)}><option value="">種類を選ぶ</option><option>オリーブオイル</option><option>ごまドレッシング</option><option>マヨネーズ</option><option>ポン酢</option><option>ケチャップ</option><option>醤油</option><option>中濃ソース</option><option>なし</option></select>}<button type="button" className="remove-item" aria-label={x.food_name+'を削除'} title="食べていないので削除" onClick={()=>removeDetectedItem(i)}>×</button></div>)}{scan.notes?.map((n,i)=><small key={i}>※ {n}</small>)}{scan.calculation_note&&<small>※ {scan.calculation_note}</small>}{scan.needs_confirmation?.map((n,i)=><small key={'q'+i}>確認するとより正確：{n}</small>)}</div>}<label>料理名<input value={scan.name} onChange={e=>setScan({...scan,name:e.target.value})}/></label><div className="grid2"><label>カロリー<input inputMode="decimal" value={scan.cal} onChange={e=>setScan({...scan,cal:e.target.value})}/></label><label>たんぱく質 g<input inputMode="decimal" value={scan.p} onChange={e=>setScan({...scan,p:e.target.value})}/></label><label>脂質 g<input inputMode="decimal" value={scan.f} onChange={e=>setScan({...scan,f:e.target.value})}/></label><label>炭水化物 g<input inputMode="decimal" value={scan.c} onChange={e=>setScan({...scan,c:e.target.value})}/></label></div><button className="primary" onClick={saveScan}>記録する</button><button className="cancel" onClick={closeScan}>キャンセル</button></div></div>}</section>}
function displayNum(v,digits=1){const n=Number(v);if(!Number.isFinite(n))return 0;return Number(n.toFixed(digits)).toLocaleString('ja-JP',{maximumFractionDigits:digits})}
function Bar({n,v,g}){return <div><div className="barlabel"><b>{n}</b><span>{displayNum(v)} / {displayNum(g)}g</span></div><div className="bar"><i style={{width:Math.min(100,v/g*100)+'%'}}/></div></div>}
function Weight({s,setS}){
 const all=[...(s.weights||[])].sort((a,b)=>a.date.localeCompare(b.date));
 const latest=Number(all.at(-1)?.weight??s.profile.weight)||0;
 const target=Number(s.profile.targetWeight)||0;
 const periods=[30,90,180,0];
 const [period,setPeriod]=useState(90);
 function add(){let x=+(prompt('今日の体重 (kg)',latest)||0);if(x)setS({...s,weights:[...(s.weights||[]).filter(a=>a.date!==today()),{date:today(),weight:x}]})}
 const cutoff=period?new Date(Date.now()-(period-1)*86400000):null;
 const data=all.filter(x=>!cutoff||new Date(x.date+'T00:00:00')>=cutoff);
 const chart=data.length?data:[{date:today(),weight:latest}];
 const vals=chart.map(x=>Number(x.weight)).filter(Number.isFinite);
 const rawMin=Math.min(...vals,target),rawMax=Math.max(...vals,target);
 const padding=Math.max(0.5,(rawMax-rawMin)*0.12);
 const step=(rawMax-rawMin)>12?5:(rawMax-rawMin)>6?2:1;
 const min=Math.floor((rawMin-padding)/step)*step;
 const max=Math.ceil((rawMax+padding)/step)*step;
 const range=Math.max(step,max-min);
 const plotTop=8,plotBottom=76,plotHeight=plotBottom-plotTop;
 const yFor=v=>plotTop+(max-Number(v))/range*plotHeight;
 const pts=chart.map((x,i)=>({x:chart.length===1?50:10+i*80/(chart.length-1),y:yFor(x.weight),...x}));
 const avgAll=all.map((r,i)=>{
   const d=new Date(r.date+'T00:00:00'),from=new Date(d);from.setDate(from.getDate()-6);
   const window=all.filter(a=>{const ad=new Date(a.date+'T00:00:00');return ad>=from&&ad<=d}).map(a=>Number(a.weight)).filter(Number.isFinite);
   return {...r,avg7:window.length?window.reduce((a,b)=>a+b,0)/window.length:null};
 });
 const avgData=avgAll.filter(x=>chart.some(d=>d.date===x.date));
 const avgPts=avgData.map(x=>{const p=pts.find(d=>d.date===x.date);return p&&x.avg7!=null?{x:p.x,y:yFor(x.avg7),...x}:null}).filter(Boolean);
 const targetY=yFor(target);
 const ticks=[];for(let v=max;v>=min-0.0001;v-=step)ticks.push(+v.toFixed(1));
 return <section><header><h1>体重</h1></header>
  <div className="hero"><small>現在</small><strong>{displayNum(latest)} <i>kg</i></strong><p>目標 {displayNum(target)} kg ／ あと <b>{displayNum(Math.max(0,latest-target))} kg</b></p></div>
  <button className="primary" onClick={add}>今日の体重を入力</button>
  <div className="card weight-chart-card"><div className="chart-head"><div><h3>体重の推移</h3><small>実測値・7日平均・目標体重</small></div><div className="period-tabs">{periods.map(p=><button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p===30?'1か月':p===90?'3か月':p===180?'6か月':'全期間'}</button>)}</div></div>
   <div className="weight-chart">
    <div className="target-label" style={{top:targetY+'%'}}>目標 {displayNum(target)}kg</div>
    <svg viewBox="0 0 100 84" preserveAspectRatio="none" aria-label="体重推移グラフ">
     {ticks.map(v=><g key={v}><line x1="10" x2="96" y1={yFor(v)} y2={yFor(v)} className="gridline"/><text x="1" y={yFor(v)+1.5} className="axis-label">{displayNum(v)}</text></g>)}
     <line x1="10" x2="96" y1={targetY} y2={targetY} className="target-line"/>
     {pts.length>1&&<polyline points={pts.map(p=>p.x+','+p.y).join(' ')} className="weight-line"/>}
     {avgPts.length>1&&<polyline points={avgPts.map(p=>p.x+','+p.y).join(' ')} className="avg-line"/>}
     {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="1.8" className="weight-dot"/>)}
    </svg>
    <div className="chart-unit">kg</div>
    <div className="chart-legend"><span><i className="legend-actual"/>実測</span><span><i className="legend-avg"/>7日平均</span><span><i className="legend-target"/>目標</span></div>
    <div className="chart-axis"><span>{chart[0]?.date?.slice(5).replace('-','/')}</span><span>{chart.at(-1)?.date?.slice(5).replace('-','/')}</span></div>
   </div>
   <div className="weight-summary"><div><small>現在</small><b>{displayNum(latest)} kg</b></div><div><small>目標</small><b>{displayNum(target)} kg</b></div><div><small>差</small><b>{displayNum(latest-target)} kg</b></div></div>
  </div>
  <div className="card"><h3>最近の記録</h3>{all.length?all.slice(-12).reverse().map(x=><div className="weightrow" key={x.date}><span>{x.date}</span><b>{displayNum(x.weight)} kg</b></div>):<p>まだ記録がありません</p>}</div>
 </section>
}
createRoot(document.getElementById('root')).render(<App/>);