import React,{useEffect,useMemo,useState}from'react';import{createRoot}from'react-dom/client';import{Camera,ChevronLeft,ChevronRight,Home,Image as ImageIcon,LineChart,Settings}from'lucide-react';import'./style.css';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

const K='diet-app-v1',FOOD_CACHE_KEY='diet-app-food-cache-v1';const today=()=>{const x=new Date(),y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),d=String(x.getDate()).padStart(2,'0');return y+'-'+m+'-'+d};
function calc(p){let b=10*p.weight+6.25*p.height-5*p.age+(p.sex==='female'?-161:5);let a={low:1.2,light:1.375,medium:1.55,high:1.725}[p.activity];let t=b*a,days=Math.max(1,(new Date(p.targetDate)-new Date(p.startDate))/86400000),def=Math.max(0,(p.weight-p.targetWeight)*7200/days),calculated=Math.round(t-def);return{bmr:Math.round(b),tdee:Math.round(t),cal:Number(p.targetCalories)||1536,calculated,pacingDeficit:Math.round(def),pace:((p.weight-p.targetWeight)/(days/7)).toFixed(2)}} 
function App(){const[s,setS]=useState(()=>JSON.parse(localStorage.getItem(K)||'null')||{profile:null,weights:[],meals:{}});const[tab,setTab]=useState('today');const[install,setInstall]=useState(null);useEffect(()=>localStorage.setItem(K,JSON.stringify(s)),[s]);useEffect(()=>{const h=e=>{e.preventDefault();setInstall(e)};window.addEventListener('beforeinstallprompt',h);return()=>window.removeEventListener('beforeinstallprompt',h)},[]);async function installApp(){if(!install)return;await install.prompt();setInstall(null)}if(!s.profile)return <Setup done={p=>setS({...s,profile:p,weights:[{date:today(),weight:p.weight}]})}/>;return <><main>{tab==='today'?<Today s={s} setS={setS}/>:tab==='weight'?<Weight s={s} setS={setS}/>:<><section><header><h1>設定</h1></header>{install&&<div className="install-card"><div><b>ホーム画面に追加</b><small>アプリのようにすぐ開けます</small></div><button onClick={installApp}>追加</button></div>}</section><Setup initial={s.profile} done={p=>setS({...s,profile:p})}/></>}</main><nav><button onClick={()=>setTab('today')}><Home/>今日</button><button onClick={()=>setTab('weight')}><LineChart/>体重</button><button onClick={()=>setTab('settings')}><Settings/>設定</button></nav></>}
function Setup({done,initial}){const[p,setP]=useState(initial||{sex:'female',age:40,height:160,weight:60,targetWeight:55,startDate:today(),targetDate:'2027-04-06',activity:'light',targetCalories:1536});let c=calc(p);return <section className="setup"><h1>目標を決める</h1><p>まず、目標体重と期間から無理のない目安を作ります。</p><div className="card form"><label>現在体重 (kg)<input type="number" step=".1" value={p.weight} onChange={e=>setP({...p,weight:+e.target.value})}/></label><label>目標体重 (kg)<input type="number" step=".1" value={p.targetWeight} onChange={e=>setP({...p,targetWeight:+e.target.value})}/></label><label>目標達成日<input type="date" value={p.targetDate} onChange={e=>setP({...p,targetDate:e.target.value})}/></label><div className="row"><label>身長 cm<input type="number" value={p.height} onChange={e=>setP({...p,height:+e.target.value})}/></label><label>年齢<input type="number" value={p.age} onChange={e=>setP({...p,age:+e.target.value})}/></label></div><label>活動量<select value={p.activity} onChange={e=>setP({...p,activity:e.target.value})}><option value="low">ほぼ座っている</option><option value="light">軽く動く・歩く</option><option value="medium">適度に運動</option><option value="high">かなり活動的</option></select></label><label>1日の摂取カロリー目標<input type="number" step="1" value={p.targetCalories||1536} onChange={e=>setP({...p,targetCalories:+e.target.value})}/><small>現在の目標：1536 kcal。設定から変更できます。</small></label></div><div className="card result"><b>1日の目安 {c.cal} kcal</b><span>推定消費 {c.tdee} kcal</span><span>目標ペース −{c.pace} kg/週</span></div><button className="primary" onClick={()=>done(p)}>この目標ではじめる</button></section>}
function Today({s,setS}){const[person,setPerson]=useState('me');const[scan,setScan]=useState(null);const[analyzing,setAnalyzing]=useState(false);const[pickType,setPickType]=useState(null);const[pickMode,setPickMode]=useState(null);const[manual,setManual]=useState(null);const[manualResults,setManualResults]=useState([]);const[dressing,setDressing]=useState('');const[selectedDate,setSelectedDate]=useState(today());let c=calc(s.profile),d=selectedDate,isChild=person!=='me',childInfo=person==='yuki'?{name:'ゆうき',cal:1550,p:50}:{name:'たけき',cal:2250,p:73},targetCal=isChild?childInfo.cal:c.cal,mealStore=isChild?(s.childMeals?.[person]||{}):s.meals,ms=mealStore[d]||[],sum=ms.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c}),{cal:0,p:0,f:0,c:0});let goals=isChild?{p:childInfo.p,f:Math.round(targetCal*.25/9),c:Math.round(targetCal*.575/4)}:{p:Math.round(s.profile.weight*1.5),f:Math.round(c.cal*.27/9),c:Math.round((c.cal-s.profile.weight*1.5*4-(c.cal*.27))/4)};
let remaining=Math.max(0,Math.round(targetCal-sum.cal)),pRemain=Math.max(0,Math.round(goals.p-sum.p));
function remainingAdvice(){
 if(isChild){if(remaining<=0)return '今日のエネルギーの目安量はとれています。成長期なので、まだお腹が空いていたら無理に制限せず食べましょう。';if(remaining>=500)return '成長のための1日の目安まであと約'+remaining+'kcalです。主食に、肉・魚・卵・豆腐などのおかずを組み合わせて、しっかり食べましょう。';return '成長のための1日の目安まであと約'+remaining+'kcalです。食事や間食で無理なく補いましょう。';}
 if(remaining<=0)return '今日はカロリー目安に到達しています。まだお腹が空いていたら、温かいお茶や無糖の飲み物で様子を見て、空腹が強ければ量を決めて軽く食べましょう。';
 let ideas=[];
 if(remaining>=500)ideas.push('ごはん＋魚や鶏肉＋野菜のおかず');
 else if(remaining>=300)ideas.push('小さめのごはん＋焼き魚や冷奴','そば・うどんを軽めに');
 else if(remaining>=180)ideas.push('おにぎり1個','無糖ヨーグルト＋果物','ゆで卵＋小さめのパン');
 else if(remaining>=80)ideas.push('果物','無糖ヨーグルト','ゆで卵');
 else ideas.push('具なしのみそ汁やスープ','少量の果物');
 const nutrient=pRemain>=15?' たんぱく質もあと約'+pRemain+'gなので、魚・鶏肉・卵・豆腐などを入れると整えやすいです。':'';
 return 'あと約'+remaining+'kcal。例えば「'+ideas.join('」「')+'」くらいが候補です。'+nutrient;
}
function add(type){setPickType(type)}
async function searchManualFood(q){setManual(x=>({...x,q,food:null,dish:null,error:''}));if(q.trim().length<1){setManualResults([]);return}try{const r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search_food',query:q})});const data=await r.json();setManualResults(data.candidates||[])}catch{setManualResults([])}}
function selectManualFood(food){setManual(x=>({...x,food,grams:x?.grams||100}));setManualResults([])}
function saveManualFood(){if(!manual?.food)return;let g=Math.max(1,Number(manual.grams)||100),f=manual.food,k=g/100,m={type:manual.type,name:f.name,cal:Math.round(f.calories_per_100g*k*10)/10,p:Math.round(f.protein_per_100g*k*10)/10,f:Math.round(f.fat_per_100g*k*10)/10,c:Math.round(f.carbohydrate_per_100g*k*10)/10,items:[{food_name:f.name,estimated_amount_g:g,nutrition_source:'mext_food_master',food_number:f.food_number}]};saveMealForPerson(m);setManual(null);setManualResults([])}
function choosePhotoSource(source,mode='meal'){const type=pickType;if(!type)return;setPickMode(mode);document.getElementById((source==='camera'?'camera-':'gallery-')+type)?.click()}
async function picked(type,e){let file=e.target.files?.[0];if(!file)return;let mode=pickMode||'meal';let url=URL.createObjectURL(file);setScan({type,url,name:'解析中…',cal:'',p:'',f:'',c:'',items:[],scan_mode:mode});setAnalyzing(true);e.target.value='';try{setPickType(null);let image=await (mode==='label'?prepareLabelImage(file):compressImage(file));let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,label_only:mode==='label',food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});let rawResponse=await r.text();let data={};try{data=JSON.parse(rawResponse)}catch{}if(!r.ok)throw new Error(data.detail||data.error||rawResponse||('HTTP '+r.status));if(data.web_fallbacks?.length){
       let cache=JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}');
       for(const w of data.web_fallbacks){
         if(w.estimation_source==="web_search"&&w.food_name){
           cache[w.food_name]={food_name:w.food_name,basis:w.basis||"per_100g",calories:w.calories,protein_g:w.protein_g,fat_g:w.fat_g,carbohydrate_g:w.carbohydrate_g,fiber_g:w.fiber_g,salt_g:w.salt_g,source_name:w.source_name,source_url:w.source_url,confidence:w.confidence,cached_at:new Date().toISOString()};
         }
       }
       localStorage.setItem(FOOD_CACHE_KEY,JSON.stringify(cache));
     }
     let names=(data.items||[]).map(x=>x.food_name).join('・');
     if(mode==='label'&&!data.label_read_failed){
       const it=(data.items||[])[0];
       const valid=it?.nutrition_source==='package_label'&&data.nutrition&&['calories','protein_g','fat_g','carbohydrate_g'].every(k=>data.nutrition[k]!==null&&data.nutrition[k]!==undefined&&Number.isFinite(Number(data.nutrition[k])));
       if(!valid)throw new Error('ラベル専用モードの応答が不正です。通常の料理解析には切り替えません。');
     }
     setScan(x=>({...x,name:data.dish_name||names||'食事',items:data.items||[],notes:data.notes||[],cal:data.nutrition?.calories??'',p:data.nutrition?.protein_g??'',f:data.nutrition?.fat_g??'',c:data.nutrition?.carbohydrate_g??'',calculation_note:data.calculation_note,needs_confirmation:data.needs_user_confirmation||[],error:data.label_read_failed?'栄養成分表示の数値を正確に読み取れませんでした。ラベル部分を大きく写して、もう一度撮影してください。':null,label_read_failed:!!data.label_read_failed,scan_mode:mode}))}catch(err){setScan(x=>({...x,name:'',error:(err?.message||'').includes('413')?'写真を小さくして再送できませんでした。もう一度写真を選んでください。':'AI解析を利用できません：'+(err?.message||'不明なエラー')}))}finally{setAnalyzing(false)}}
async function removeDetectedItem(index){
 if(!scan?.items)return;
 // Remove immediately in the UI. Nutrition recalculation can finish in the background.
 const items=scan.items.filter((_,i)=>i!==index);
 const removed=scan.items[index];
 const subtract=(key,current)=>{const v=Number(removed?.[key]);return Number.isFinite(v)?Math.max(0,Math.round((Number(current||0)-v)*10)/10):current};
 setScan(x=>({...x,items,cal:subtract('calories',x.cal),p:subtract('protein_g',x.p),f:subtract('fat_g',x.f),c:subtract('carbohydrate_g',x.c),error:null}));
 try{
  let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,dish_name:scan.name,food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});
  let raw=await r.text(),data={};try{data=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(data.detail||data.error||raw||('HTTP '+r.status));
  setScan(x=>({...x,items:data.items||x.items,cal:data.nutrition?.calories??x.cal,p:data.nutrition?.protein_g??x.p,f:data.nutrition?.fat_g??x.f,c:data.nutrition?.carbohydrate_g??x.c,calculation_note:data.calculation_note,needs_confirmation:data.needs_user_confirmation||[]}));
 }catch(err){setScan(x=>({...x,error:'栄養値の再計算に失敗しました。項目の削除は反映されています。'}))}
}
async function recalcItem(index,patch){
 setAnalyzing(true);
 try{
  let r=await fetch('/api/analyze-meal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:scan.items,dish_name:scan.name,overrides:{[String(index)]:patch},food_cache:JSON.parse(localStorage.getItem(FOOD_CACHE_KEY)||'{}')})});
  let raw=await r.text(),data={};try{data=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(data.detail||data.error||raw||('HTTP '+r.status));
  setScan(x=>({...x,items:data.items||x.items,cal:data.nutrition?.calories??'',p:data.nutrition?.protein_g??'',f:data.nutrition?.fat_g??'',c:data.nutrition?.carbohydrate_g??'',calculation_note:data.calculation_note}));
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
function compressImage(file){return new Promise((ok,ng)=>{let r=new FileReader();r.onerror=ng;r.onload=()=>{let img=new Image();img.onerror=ng;img.onload=()=>{let max=2200,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);ok(canvas.toDataURL('image/jpeg',.92))};img.src=r.result};r.readAsDataURL(file)})}
function prepareLabelImage(file){return new Promise((ok,ng)=>{let r=new FileReader();r.onerror=ng;r.onload=()=>{let img=new Image();img.onerror=ng;img.onload=()=>{let max=2400,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);let quality=.9,data=canvas.toDataURL('image/jpeg',quality);while(data.length>3_500_000&&quality>.6){quality-=.08;data=canvas.toDataURL('image/jpeg',quality)}ok(data)};img.src=r.result};r.readAsDataURL(file)})}
function saveMealForPerson(m){if(person==='me')setS({...s,meals:{...s.meals,[d]:[...(s.meals[d]||[]),m]}});else{let childMeals=s.childMeals||{},pm=childMeals[person]||{};setS({...s,childMeals:{...childMeals,[person]:{...pm,[d]:[...(pm[d]||[]),m]}}})}}
function saveScan(){let m={type:scan.type,name:scan.name||'食事',cal:+scan.cal||0,p:+scan.p||0,f:+scan.f||0,c:+scan.c||0,source:'photo_manual',items:(scan.items||[]).map(x=>({food_name:x.food_name,estimated_amount_g:x.estimated_amount_g,food_number:x.food_number||x.selected_food_number||null,nutrition_source:x.nutrition_source,user_corrected:!!x.user_corrected,calories:x.calories,protein_g:x.protein_g,fat_g:x.fat_g,carbohydrate_g:x.carbohydrate_g}))};saveMealForPerson(m);if(scan.url)URL.revokeObjectURL(scan.url);setScan(null)}function closeScan(){if(scan?.url)URL.revokeObjectURL(scan.url);setScan(null)}
function deleteMeal(meal){const next=ms.filter(x=>x!==meal);if(person==='me')setS({...s,meals:{...s.meals,[d]:next}});else{let childMeals=s.childMeals||{},pm=childMeals[person]||{};setS({...s,childMeals:{...childMeals,[person]:{...pm,[d]:next}}})}}
const selected=new Date(d+'T00:00:00'),isToday=d===today(),dateLabel=selected.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
return <section><div className="person-tabs"><button className={person==='me'?'active':''} onClick={()=>setPerson('me')}>ママ</button><button className={person==='yuki'?'active':''} onClick={()=>setPerson('yuki')}>ゆうき</button><button className={person==='takeki'?'active':''} onClick={()=>setPerson('takeki')}>たけき</button></div><header><h1>{isToday?'今日':'食事記録'}</h1><div className="date-picker"><label className="date-control"><span>{dateLabel} ▾</span><input aria-label="日付を選択" type="date" value={d} max={today()} onChange={e=>e.target.value&&setSelectedDate(e.target.value)}/></label>{!isToday&&<button type="button" onClick={()=>setSelectedDate(today())}>今日へ</button>}</div></header><div className="hero"><small>今日の摂取</small><strong>{displayNum(sum.cal)} <i>/ {displayNum(targetCal)} kcal</i></strong><p>{isChild?'成長のための1日の目安まで':'あと'} <b>{displayNum(Math.max(0,targetCal-sum.cal))} kcal</b>{isChild?'':' が目安'}</p></div><div className="card nutrients"><Bar n="たんぱく質" v={sum.p} g={goals.p}/><Bar n="脂質" v={sum.f} g={goals.f}/><Bar n="炭水化物" v={sum.c} g={goals.c}/></div><div className="advice"><b>今日のアドバイス</b><p>{remainingAdvice()}</p></div>{['朝食','昼食','夕食','間食'].map(t=><div className="card meal" key={t}><div className="mealhead"><b>{t}</b><div className="meal-actions"><button type="button" onClick={()=>{setManual({type:t,q:'',food:null,grams:100});setManualResults([])}}>＋ 手入力</button><button onClick={()=>add(t)}><Camera/>写真</button></div><input id={'camera-'+t} className="hidden" type="file" accept="image/*" capture="environment" onChange={e=>picked(t,e)}/><input id={'gallery-'+t} className="hidden" type="file" accept="image/*" onChange={e=>picked(t,e)}/></div>{ms.filter(x=>x.type===t).map((m,i)=><div className="food saved-food" key={i}><span>{m.name}</span><b>{displayNum(m.cal)} kcal</b><small>たんぱく質 {displayNum(m.p)}g　脂質 {displayNum(m.f)}g　炭水化物 {displayNum(m.c)}g</small><button type="button" className="delete-meal" aria-label={m.name+'を削除'} onClick={()=>deleteMeal(m)}>×</button></div>)}</div>)}{manual&&<div className="modal"><div className="sheet manual-sheet"><h2>{manual.type}を手入力</h2><label>食品名<input autoFocus value={manual.q||''} placeholder="例：ごはん、納豆、ヨーグルト" onChange={e=>searchManualFood(e.target.value)}/></label>{manualResults.length>0&&<div className="manual-results">{manualResults.map(x=><button type="button" key={x.food_number||x.name} onClick={()=>selectManualFood(x)}><b>{x.name}</b><small>{displayNum(x.calories_per_100g)} kcal / 100g</small></button>)}</div>}{manual.q&&manualResults.length===0&&!manual.food&&<p className="muted">食品DBに候補がありません。料理名ではなく、材料・食品名で検索してください。</p>}{manual.food&&<div className="manual-selected"><b>{manual.food.name}</b><label>食べた量（g）<input type="number" min="1" inputMode="decimal" value={manual.grams} onChange={e=>setManual({...manual,grams:e.target.value})}/></label><p>{displayNum((manual.food.calories_per_100g*(Number(manual.grams)||0)/100))} kcal</p></div>}<div className="actions"><button type="button" onClick={()=>{setManual(null);setManualResults([])}}>キャンセル</button><button type="button" disabled={!manual.food} onClick={saveManualFood}>登録</button></div></div></div>}{pickType&&<div className="photo-source-backdrop" onClick={()=>{setPickType(null);setPickMode(null)}}><div className="photo-source-sheet" onClick={e=>e.stopPropagation()}><b>何を読み取りますか？</b><p>既製品は「栄養成分表示」を選ぶと、原材料や料理推定をせずラベルの数値だけを読み取ります。画像は保存しません。</p><div className="mode-grid"><button type="button" onClick={()=>choosePhotoSource('camera','meal')}><Camera/>料理を撮影</button><button type="button" onClick={()=>choosePhotoSource('gallery','meal')}><ImageIcon/>料理写真を選ぶ</button><button type="button" onClick={()=>choosePhotoSource('camera','label')}><Camera/>栄養成分表示を撮影</button><button type="button" onClick={()=>choosePhotoSource('gallery','label')}><ImageIcon/>ラベル写真を選ぶ</button></div><small>栄養成分表示は文字が画面いっぱいになるように撮ると正確です。</small><button type="button" className="photo-source-cancel" onClick={()=>{setPickType(null);setPickMode(null)}}>キャンセル</button></div></div>}{scan&&<div className="modal"><div className="sheet">{scan.url&&<img className="preview" src={scan.url} onError={e=>{e.currentTarget.style.display="none"}}/>}<h2>{scan.type}を記録</h2><p className="muted">{analyzing?'写真から料理と量を解析しています…':scan.error||'AIが写真から料理と推定量を読み取りました。内容を確認し、必要なら修正してください。'}</p>{scan.items?.length>0&&<div className="detected">{scan.items.map((x,i)=><div key={i} className="detected-row"><b>{x.food_name}</b><div className="item-actions">{x.needs_food_confirmation&&x.food_candidates?.length>1&&<select aria-label="食品の種類" defaultValue={x.food_number||''} onChange={e=>recalcItem(i,{selected_food_number:e.target.value})}>{x.food_candidates.map(c=><option key={c.food_number} value={c.food_number}>{c.food_name}</option>)}</select>}{x.nutrition_source==="package_label"?<span className="amount-display">{x.amount_display||x.label_nutrition?.basis||"1包装"}</span>:<label className="amount-inline"><input aria-label="量" type="number" inputMode="decimal" defaultValue={x.estimated_amount_g} onBlur={e=>{const g=Number(e.target.value);if(Number.isFinite(g)&&g!==Number(x.estimated_amount_g))recalcItem(i,{estimated_amount_g:g})}}/><small>g</small></label>}</div>{/ドレッシング|ソース/.test(x.food_name)&&<select value={dressing} onChange={e=>chooseDressing(i,e.target.value)}><option value="">種類を選ぶ</option><option>オリーブオイル</option><option>ごまドレッシング</option><option>マヨネーズ</option><option>ポン酢</option><option>ケチャップ</option><option>醤油</option><option>中濃ソース</option><option>なし</option></select>}<button type="button" className="remove-item" aria-label={x.food_name+'を削除'} title="食べていないので削除" onClick={()=>removeDetectedItem(i)}>×</button></div>)}{scan.notes?.map((n,i)=><small key={i}>※ {n}</small>)}{scan.calculation_note&&<small>※ {scan.calculation_note}</small>}{scan.needs_confirmation?.map((n,i)=><small key={'q'+i}>確認するとより正確：{n}</small>)}</div>}<label>料理名<input value={scan.name} onChange={e=>setScan({...scan,name:e.target.value})}/></label><div className="grid2"><label>カロリー<input inputMode="decimal" value={scan.cal} onChange={e=>setScan({...scan,cal:e.target.value})}/></label><label>たんぱく質 g<input inputMode="decimal" value={scan.p} onChange={e=>setScan({...scan,p:e.target.value})}/></label><label>脂質 g<input inputMode="decimal" value={scan.f} onChange={e=>setScan({...scan,f:e.target.value})}/></label><label>炭水化物 g<input inputMode="decimal" value={scan.c} onChange={e=>setScan({...scan,c:e.target.value})}/></label></div><button className="primary" onClick={saveScan}>記録する</button><button className="cancel" onClick={closeScan}>キャンセル</button></div></div>}</section>}
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