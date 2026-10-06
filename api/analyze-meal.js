import OpenAI from "openai";
import MEXT_FOODS from "../data/mext-food-master.js";

// [official name, kcal, protein, fat, carbohydrate, fiber, salt, MEXT food number]
const FOOD_DB=MEXT_FOODS.map(([id,name,k,p,f,c,fi,s])=>[name,k,p,f,c,fi,s,id]);
// Stable canonical rows for common drinks. These override ambiguous master-name matching.
const CANONICAL_FOODS={
 "紅茶":["紅茶（浸出液）",1,0.1,0,0.1,0,0,"canonical-tea"],
 "コーヒー":["コーヒー（浸出液）",4,0.2,0,0.7,0,0,"canonical-coffee"],
 "普通牛乳":["普通牛乳",61,3.3,3.8,4.8,0,0.1,"canonical-milk"],
 "低脂肪牛乳":["低脂肪牛乳",42,3.8,1.0,5.5,0,0.2,"canonical-lowfat-milk"]
};
function norm(s=""){return s.replace(/[\s　]/g,"").toLowerCase()}
function tokenizeFood(s=""){
 return norm(s).replace(/[（）()［］\[\]・、,+／/]/g," ").split(/\s+/).filter(Boolean);
}
const FOOD_CATEGORY_RULES=[
 {re:/油|オイル/, candidates:["調合油","オリーブ油","ごま油"]},
 {re:/きのこ|キノコ|茸/, candidates:["ぶなしめじ 生","えのきたけ 生","生しいたけ 菌床栽培 生"]},
 {re:/クッキー|ビスケット|サブレ/, candidates:["ビスケット ソフトビスケット","ビスケット ハードビスケット"]},
 {re:/豚/, candidates:["ぶた 大型種肉 ロース 赤肉 生","ぶた 大型種肉 もも 赤肉 生","ぶた ひき肉 生"]},
 {re:/鶏|チキン/, candidates:["にわとり 若どり むね 皮なし 生","にわとり 若どり もも 皮なし 生"]},
 {re:/牛肉|ビーフ/, candidates:["うし 輸入牛肉 もも 赤肉 生","うし ひき肉 生"]},
 {re:/魚|鮭|さけ|サケ/, candidates:["しろさけ 生","しろさけ 焼き"]},
 {re:/卵|たまご/, candidates:["鶏卵 全卵 生","鶏卵 全卵 ゆで"]},
 {re:/葉野菜|サラダ/, candidates:["レタス 土耕栽培 結球葉 生"]},
];
function directAlias(name=""){
 const n=norm(name);
 if(/ミルク|牛乳/.test(n)) return /低脂肪/.test(n)?"低脂肪牛乳":/生クリーム|クリーム/.test(n)&&!/ミルク/.test(n)?"生クリーム":"普通牛乳";
 if(/紅茶|ティー/.test(n)) return "紅茶";
 if(/コーヒー|珈琲/.test(n)) return "コーヒー";
 if(/ゆで卵|茹で卵|煮卵/.test(n)) return "鶏卵 全卵 ゆで";
 if(/鮭|さけ|サケ|しゃけ|シャケ/.test(n)) return /焼|加熱|蒸/.test(n)?"しろさけ 焼き":"しろさけ 生";
 if(/じゃがいも|ジャガイモ|馬鈴薯/.test(n)) return /ゆで|茹|蒸/.test(n)?"じゃがいも 塊茎 皮なし 水煮":"じゃがいも 塊茎 皮なし 生";
 if(/オリーブオイル|オリーブ油/.test(n)) return "オリーブ油";
 if(/ごま.*ドレッシング|胡麻.*ドレッシング/.test(n)) return "ごまドレッシング";
 if(/マヨネーズ/.test(n)) return "マヨネーズ 全卵型";
 if(/ポン酢|ぽん酢/.test(n)) return "ぽん酢しょうゆ";
 if(/ケチャップ/.test(n)) return "トマトケチャップ";
 if(/醤油|しょうゆ/.test(n)) return "こいくちしょうゆ";
 if(/中濃ソース/.test(n)) return "中濃ソース";
 return null;
}
function scoreFood(query,row){
 const q=norm(query),n=norm(row[0]); if(!q||!n)return 0;
 if(q===n)return 1000;
 if(n.includes(q)||q.includes(n))return 700-Math.abs(n.length-q.length);
 const qt=tokenizeFood(query),nt=tokenizeFood(row[0]);
 let score=0;for(const t of qt){if(t.length<2)continue;if(nt.some(x=>x.includes(t)||t.includes(x)))score+=80}
 return score;
}
function bestFood(query,minScore=650){
 const ranked=FOOD_DB.map(x=>[scoreFood(query,x),x]).sort((a,b)=>b[0]-a[0]);
 return ranked[0]?.[0]>=minScore?ranked[0][1]:null;
}
function foodCandidates(name,limit=3){
 const alias=directAlias(name);
 const query=alias||name;
 let ranked=FOOD_DB.map(x=>[scoreFood(query,x),x]).filter(x=>x[0]>=650).sort((a,b)=>b[0]-a[0]);
 const seen=new Set(),out=[];
 for(const [score,row] of ranked){const id=String(row[7]);if(seen.has(id))continue;seen.add(id);out.push({food_number:row[7],food_name:row[0],score});if(out.length>=limit)break}
 return out;
}
function findFoodByNumber(id){return FOOD_DB.find(x=>String(x[7])===String(id))||null}
function findFood(name,preferredFoodNumber){
 if(preferredFoodNumber){const selected=findFoodByNumber(preferredFoodNumber);if(selected)return selected}
 const alias=directAlias(name);
 if(alias){
   if(CANONICAL_FOODS[alias])return CANONICAL_FOODS[alias];
   const exact=FOOD_DB.find(x=>norm(x[0])===norm(alias));
   if(exact)return exact;
   const hit=bestFood(alias,650);
   if(hit)return hit;
 }
 const direct=bestFood(name,650);
 if(direct)return direct;
 const rule=FOOD_CATEGORY_RULES.find(r=>r.re.test(name||""));
 if(rule)for(const candidate of rule.candidates){
   const exact=FOOD_DB.find(x=>norm(x[0])===norm(candidate));
   if(exact)return exact;
   const hit=bestFood(candidate,650);
   if(hit)return hit;
 }
 if(/クッキー|ビスケット|サブレ/.test(name||""))return ["ソフトビスケット",522,5.7,27.6,62.6,1.4,0.6,"cookie-fallback"];
 return null;
}
function nutritionIsPlausible(food,g){
 if(!food||g<=0)return false;
 const kcal=Number(food[1]),p=Number(food[2]),fat=Number(food[3]),carb=Number(food[4]);
 if(![kcal,p,fat,carb].every(Number.isFinite))return false;
 // Per-100g physical sanity checks. Reject corrupt/mismatched rows.
 if(kcal<0||kcal>950||p<0||p>100||fat<0||fat>100||carb<0||carb>100)return false;
 const macroKcal=p*4+fat*9+carb*4;
 if(kcal>50&&macroKcal>0&&(macroKcal/kcal<0.35||macroKcal/kcal>1.65))return false;
 return true;
}
function labelNutrients(item){
 const l=item?.nutrition_source==="package_label"?item.label_nutrition:null;
 if(!l)return null;
 const keys=["calories","protein_g","fat_g","carbohydrate_g"];
 if(keys.some(k=>l[k]==null||!Number.isFinite(Number(l[k]))))return null;
 return {calories:Number(l.calories),protein_g:Number(l.protein_g),fat_g:Number(l.fat_g),carbohydrate_g:Number(l.carbohydrate_g),fiber_g:Number(l.fiber_g||0),salt_g:Number(l.salt_g||0)};
}
function nutrients(items){
 let total={calories:0,protein_g:0,fat_g:0,carbohydrate_g:0,fiber_g:0,salt_g:0},mapped=[],unmapped=[];
 for(const item of items){
  const ln=labelNutrients(item);
  if(ln){Object.keys(total).forEach(k=>total[k]+=ln[k]||0);mapped.push({...item,...ln,nutrition_source:"package_label"});continue}
  if(item.nutrition_source==="package_label"){mapped.push({...item,nutrition_source:"package_label_unreadable"});unmapped.push(item.food_name);continue}
  const food=findFood(item.nutrition_search_name||item.food_name,item.selected_food_number); const g=Number(item.estimated_amount_g)||0;
  if(g<=0||/未使用/.test(item.cooking_method||"")){mapped.push({...item,estimated_amount_g:0,nutrition_source:"not_consumed"});continue}
  if(food&&nutritionIsPlausible(food,g)){let k=g/100;let v={calories:food[1]*k,protein_g:food[2]*k,fat_g:food[3]*k,carbohydrate_g:food[4]*k,fiber_g:(food[5]||0)*k,salt_g:(food[6]||0)*k};Object.keys(total).forEach(x=>total[x]+=v[x]);mapped.push({...item,nutrition_source:"mext_food_master",food_number:food[7],...Object.fromEntries(Object.entries(v).map(([k,v])=>[k,Math.round(v*10)/10]))})}
  else if(/ミント|パセリ|ハーブ|飾り|添え葉/.test(item.food_name||"")&&g<=5){mapped.push({...item,nutrition_source:"garnish_ignored"});}
  else {mapped.push({...item,nutrition_source:"unmapped"});unmapped.push(item.food_name)}
 }
 mapped=mapped.map(item=>{
  if(item.nutrition_source!=="mext_food_master")return item;
  const candidates=foodCandidates(item.nutrition_search_name||item.food_name,3);
  const chosen=candidates.find(x=>String(x.food_number)===String(item.food_number));
  const runner=candidates.find(x=>String(x.food_number)!==String(item.food_number));
  const ambiguous=!!runner&&(!chosen||chosen.score-runner.score<80);
  // Ask only when choosing another plausible food would materially change this serving.
  // Small differences (tea varieties, similar vegetables, etc.) stay automatic.
  const g=Math.max(0,Number(item.estimated_amount_g)||0);
  const nutritionAt=(cand)=>{const row=findFoodByNumber(cand?.food_number);if(!row)return null;const k=g/100;return {kcal:Number(row[1]||0)*k,p:Number(row[2]||0)*k,f:Number(row[3]||0)*k,c:Number(row[4]||0)*k}};
  const base=nutritionAt(chosen),alt=nutritionAt(runner);
  const impact=base&&alt?Math.max(Math.abs(base.kcal-alt.kcal),Math.abs(base.p-alt.p)*4,Math.abs(base.f-alt.f)*9,Math.abs(base.c-alt.c)*4):0;
  // Confirmation should be rare: only ask when the ambiguity can materially
  // change the meal. Minor produce/tea varieties are never worth interrupting for.
  const trivialCategory=/トマト|きゅうり|レタス|キャベツ|葉菜|野菜|きのこ|紅茶|茶|コーヒー/.test(String(item.food_name||""));
  const materialImpact=impact>=70;
  return {...item,food_candidates:candidates,needs_food_confirmation:ambiguous&&materialImpact&&!trivialCategory&&!item.selected_food_number};
 });
 Object.keys(total).forEach(x=>total[x]=Math.round(total[x]*10)/10);return{items:mapped,total,unmapped,complete:unmapped.length===0}
}

function normalizationKey(item={}){
 return "v2::"+norm([item.food_name,item.food_category,item.cooking_method,item.assumption,(item.alternatives||[]).join("|")].join("::"));
}
function deterministicCanonical(item={}){
 const name=String(item.food_name||"");
 const alias=directAlias(name);
 if(alias)return {canonical_name:alias,canonical_category:item.food_category||"",normalization_source:"rule",normalization_confidence:0.99};
 // Keep code rules deterministic only. Semantic food interpretation belongs to the normalizer LLM.
 return null;
}
async function normalizeItems(client,items=[],normalizationCache={}){
 const out=[];
 const newlyNormalized=[];
 for(const item of items){
   const key=normalizationKey(item);
   const deterministic=deterministicCanonical(item);
   if(deterministic){
     out.push({...item,...deterministic,nutrition_search_name:deterministic.canonical_name,normalization_key:key});
     continue;
   }
   const cached=normalizationCache[key];
   if(cached?.canonical_name){
     out.push({...item,...cached,nutrition_search_name:cached.canonical_name,normalization_source:"cache",normalization_key:key});
     continue;
   }
   try{
     const response=await client.responses.create({
       model:process.env.OPENAI_NORMALIZATION_MODEL||process.env.OPENAI_VISION_MODEL||"gpt-5.4-mini",
       input:`あなたは日本の食事記録アプリの食品名正規化器です。画像認識結果を、栄養DBを検索するための一般的な食品単位へ正規化してください。栄養値・カロリー・DBレコードIDは絶対に生成しません。
ルール:
- 見た目の表現、料理名、形状名を一般的な食品名へ変換する。
- 複合料理でも、入力itemがすでに一つの食品として妥当なら無理に分解しない。
- food_nameだけでなく alternatives・assumption・food_category・cooking_method を根拠として使う。
- 入力に、より具体的な食品を示す根拠がある場合は「ケーキ」「肉」「魚」「きのこ」のような上位概念へ丸めず、根拠の範囲で最も具体的な一般食品名にする。
- 根拠が弱い場合は無理に具体化せず一般名を維持する。見えていない材料や種類を推測で追加しない。
- 「豚肉」「まいたけ」「炒め油」のように栄養計算単位として扱える名称にする。
- 食品でない物は is_food=false。飾りで通常食べない物は is_garnish=true。
- 不明な場合も架空の固有商品名を作らず、最も一般的な食品名にする。
JSONのみで {"canonical_name":"","canonical_category":"","is_food":true,"is_garnish":false,"confidence":0.0} を返す。
入力: ${JSON.stringify({food_name:item.food_name,food_category:item.food_category,cooking_method:item.cooking_method,alternatives:item.alternatives,assumption:item.assumption})}`
     });
     let raw=(response.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
     const a=raw.indexOf("{"),b=raw.lastIndexOf("}");
     if(a<0||b<=a)throw new Error("normalization JSON missing");
     const n=JSON.parse(raw.slice(a,b+1));
     if(n.is_food===false||n.is_garnish===true){
       out.push({...item,canonical_name:n.canonical_name||item.food_name,is_food:n.is_food!==false,is_garnish:!!n.is_garnish,normalization_source:"llm",normalization_confidence:Number(n.confidence)||0,normalization_key:key,nutrition_search_name:n.canonical_name||item.food_name});
       newlyNormalized.push({key,canonical_name:n.canonical_name||item.food_name,canonical_category:n.canonical_category||item.food_category||"",is_food:n.is_food!==false,is_garnish:!!n.is_garnish,normalization_confidence:Number(n.confidence)||0});
       continue;
     }
     if(!n.canonical_name)throw new Error("canonical_name missing");
     const entry={canonical_name:String(n.canonical_name),canonical_category:String(n.canonical_category||item.food_category||""),is_food:true,is_garnish:false,normalization_confidence:Number(n.confidence)||0};
     out.push({...item,...entry,nutrition_search_name:entry.canonical_name,normalization_source:"llm",normalization_key:key});
     newlyNormalized.push({key,...entry});
   }catch{
     // Fail open: keep the observed food name so the deterministic resolver/web fallback can still work.
     out.push({...item,canonical_name:item.food_name,nutrition_search_name:item.food_name,normalization_source:"fallback",normalization_confidence:0,normalization_key:key});
   }
 }
 return {items:out,newlyNormalized};
}


async function reconcileNormalizedItems(client,items=[]){
 if(items.length<2)return items;
 try{
  const response=await client.responses.create({
   model:process.env.OPENAI_NORMALIZATION_MODEL||process.env.OPENAI_VISION_MODEL||"gpt-5.4-mini",
   input:`あなたは食事記録の重複・構成要素を整理するリコンサイラです。入力はすでに食品名正規化済みです。栄養値は生成しません。
目的は、同じ実物を二重計上しないことです。
ルール:
- 同じ完成食品が重複している場合は1件に統合する。重量は二つを足さず、写真から同一物の別推定なら原則として信頼度が高い方、または妥当な代表値を採用する。
- 完成食品と、その食品の内部構成要素（例: 完成したパイ + フィリング/生地/表面グレーズ）が同時にある場合、構成要素は完成食品に包含し、別計上しない。
- ただし別添えで実際に追加摂取する可能性がある砂糖、ミルク、ドレッシング、ソース等は統合せず残す。
- 別々に食べる食品は統合しない。
- 食品名を新たに推測して変更しない。入力の canonical_name を尊重する。
JSONのみで {"groups":[{"keep_index":0,"drop_indices":[1],"reason":"same_food_duplicate"}]} を返す。統合不要なら {"groups":[]}。
入力: ${JSON.stringify(items.map((x,i)=>({index:i,food_name:x.food_name,canonical_name:x.canonical_name||x.nutrition_search_name,grams:x.estimated_amount_g,confidence:x.confidence,assumption:x.assumption,optional_consumption:x.optional_consumption})))}`
  });
  let raw=(response.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
  const a=raw.indexOf("{"),b=raw.lastIndexOf("}");
  if(a<0||b<=a)return items;
  const parsed=JSON.parse(raw.slice(a,b+1));
  const drop=new Set();
  for(const g of parsed.groups||[]){
   const keep=Number(g.keep_index);
   if(!Number.isInteger(keep)||!items[keep])continue;
   for(const di of g.drop_indices||[]){
    const d=Number(di);
    if(!Number.isInteger(d)||!items[d]||d===keep)continue;
    // Safety: never auto-drop optional user-decision condiments/accessories.
    if(items[d].optional_consumption)continue;
    drop.add(d);
   }
  }
  return items.filter((_,i)=>!drop.has(i));
 }catch{return items;}
}

export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const {image,label_only=false,food_cache={},normalization_cache={},overrides={},items:providedItems,dish_name:providedDishName}=req.body||{};
  if(!providedItems&&!image?.startsWith("data:image/"))return res.status(400).json({error:"Image is required"});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  if(label_only&&image){
    const model=process.env.OPENAI_VISION_MODEL||"gpt-6-luna";
    // Pass 1 is deliberately transcription-only. Asking vision to OCR and construct JSON
    // in one step proved brittle for small Japanese package labels.
    const tr=await client.responses.create({model,input:[{role:"user",content:[
      {type:"input_text",text:"栄養成分表示の読み取り専用です。画像全体を確認し、『栄養成分表示』の見出しから、表示基準、熱量、たんぱく質、脂質、炭水化物、食塩相当量が書かれた部分だけを文字起こししてください。原材料名、賞味期限、製造者、バーコードは無視してください。改行や項目順は画像のままで構いません。数字・小数点・単位を最優先で正確に転記し、推測しないでください。JSONにはせず、読めた文字だけ返してください。"},
      {type:"input_image",image_url:image,detail:"high"}
    ]}]});
    const transcript=(tr.output_text||"").replace(/[：:]/g,":").replace(/[，,]/g,".").replace(/\s+/g," ").trim();
    const numberAfter=(labels)=>{
      for(const label of labels){
        const re=new RegExp(label+"\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(?:kcal|g)?","i");
        const m=transcript.match(re); if(m)return Number(m[1]);
      }
      return null;
    };
    const calories=numberAfter(["熱量","エネルギー"]);
    const protein_g=numberAfter(["たんぱく質","タンパク質","蛋白質"]);
    const fat_g=numberAfter(["脂質"]);
    const carbohydrate_g=numberAfter(["炭水化物"]);
    const salt_g=numberAfter(["食塩相当量"]);
    const bm=transcript.match(/栄養成分表示\s*[（(]?\s*([^）)]{1,30}(?:あたり|当たり))\s*[）)]?/);
    const basis=bm?.[1]?.trim()||"1包装あたり";
    const lab={basis,calories,protein_g,fat_g,carbohydrate_g,salt_g};
    const valid=["calories","protein_g","fat_g","carbohydrate_g"].every(k=>Number.isFinite(lab[k]));
    if(!valid)return res.status(200).json({dish_name:"包装食品",items:[],nutrition:{calories:null,protein_g:null,fat_g:null,carbohydrate_g:null,fiber_g:null,salt_g:null},label_read_failed:true,notes:["栄養成分表示を正確に読み取れませんでした。ラベル部分を画面いっぱいに写して再撮影してください。"],needs_user_confirmation:[]});
    const nutrition={calories,protein_g,fat_g,carbohydrate_g,fiber_g:0,salt_g:Number.isFinite(salt_g)?salt_g:0};
    return res.status(200).json({dish_name:"包装食品",items:[{food_name:"包装食品",estimated_amount_g:null,serving_count:1,amount_display:basis,nutrition_source:"package_label",label_nutrition:lab,...nutrition}],nutrition,calculation_note:"栄養成分表示の記載値をそのまま使用しています。",notes:["栄養成分表示の記載値を使用しています。"],needs_user_confirmation:[],label_read_failed:false});
  }
  const prompt=`日本の食事写真を栄養計算用に分析してください。皿単位の料理名だけでなく、栄養計算できる構成要素へ分解します。
手順:
1. 写真中の「見えている可食物」を漏れなく列挙する。料理名だけでまとめず、見た目で独立して確認できる主要食材は別itemにする。特に炒め物の肉・きのこ・なす等、サラダのトマト・きゅうり・葉物等は、それぞれ見えているなら必ず別itemとして返す。少量だから、省エネだから、栄養影響が小さいからという理由でitemsから省略してはいけない。複合料理は主な食材・主食・衣・ソース等に分解。飲み物も必ず対象にする。紅茶やコーヒーの横にミルクピッチャーがある、液色がミルク入りに見える等の場合は、飲料本体と牛乳/生クリームを別itemとして推定する。
2. 器・箸・既知サイズとの相対比較、個数、盛り付け面積と厚みから可食部重量を推定。
   白米については、ユーザー宅の「いつもの白い茶碗」の実測参考値を優先的な量感アンカーとして使う。同じ茶碗に見える場合の参考は、少なめ=83g、普通盛り=120g、多め=186g。写真の盛り付け量がこれらの中間なら、見た目の面積・高さ・茶碗に対する占有率から連続値で補間する。別の器、丼、平皿、明らかに異なる茶碗ではこの基準を固定値として適用せず、通常の画像推定を行う。この3値は参考アンカーであり、83/120/186gのいずれかへ丸めない。
3. estimated_amount_g は最尤値、amount_min_g/amount_max_g は妥当な範囲。
4. 揚げ物の吸油、炒め油、ドレッシング、マヨネーズ等は見える/調理法から強く示唆される場合だけ別itemにし、推定であることを明示。
5. 写真で区別できない候補は alternatives に最大2件。断定しない。ただし「食品をitemsに載せるか」と「ユーザーに種類確認を求めるか」は別問題。見えているきゅうり・きのこ等は必ずitemsに載せ、種類差の栄養影響が小さければ後工程で自動処理する。
6. confidenceは食品同定と量推定を総合した0〜1。量が曖昧なら低くする。
7. これは通常の料理写真モードである。栄養成分表示・包装ラベル・原材料表示が写真内に写っていても読み取り対象にせず、料理そのものと見えている可食物だけを分析する。栄養値は生成せず、後工程の食品成分データベースで計算する。包装食品ラベルを読みたい場合は別の label_only モードを使う。\n8. 飲み物が紅茶またはコーヒーの場合、砂糖とミルクは使用有無が不明でも必ず items に候補として追加する。未確認なら estimated_amount_g:0、optional_consumption:true とし、砂糖は food_name:"砂糖"、ミルクは food_name:"牛乳" とする。写真から実使用量を推定できる場合だけ推定量を入れる。notesだけに書いて items から省略してはいけない。
JSONのみ:
{"dish_name":"鮭定食","items":[{"food_name":"白ごはん","food_category":"穀類","estimated_amount_g":150,"amount_min_g":130,"amount_max_g":180,"cooking_method":"炊飯","confidence":0.85,"assumption":"茶碗1杯程度","alternatives":[],"nutrition_source":null,"label_nutrition":null}],"notes":["写真だけでは判別困難な点"],"needs_user_confirmation":["確認すると精度が上がる項目"]}`;
  let vision;
  if(providedItems){
    vision={dish_name:providedDishName||"食事",items:providedItems,notes:[],needs_user_confirmation:[]};
  }else{
    const mealOnlyPrompt=prompt+`
9. 絶対条件: このリクエストは通常の料理写真モードである。画像内の文字、商品名、包装、栄養成分表示、バーコードは背景情報として無視する。nutrition_source は package_label にせず、label_nutrition は必ず null にする。写真に文字が見えることを理由にモードを変更してはいけない。
`;
    const response=await client.responses.create({model:process.env.OPENAI_VISION_MODEL||"gpt-5.4-mini",input:[{role:"user",content:[{type:"input_text",text:mealOnlyPrompt},{type:"input_image",image_url:image,detail:"high"}]}]});
    let raw=(response.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
    try{vision=JSON.parse(raw)}catch(parseErr){const start=raw.indexOf("{"),end=raw.lastIndexOf("}");if(start<0||end<=start)throw new Error("AI response was not valid JSON");vision=JSON.parse(raw.slice(start,end+1))}
    // Normal meal mode must never auto-switch to package-label OCR.
    vision.items=(vision.items||[]).map(x=>({...x,nutrition_source:null,label_nutrition:null}));
  if(/クッキー|ビスケット|サブレ/.test(vision.dish_name||"")&&!vision.items?.some(x=>/クッキー|ビスケット|サブレ/.test(x.food_name||""))){
    vision.items=[...(vision.items||[]),{food_name:"クッキー",estimated_amount_g:40,amount_min_g:30,amount_max_g:55,cooking_method:"焼成",confidence:0.65,assumption:"写真の主役の焼き菓子2枚。AIがitemsから落としたため料理名から復元",alternatives:["ビスケット","サブレ"]}];
  }
  if(vision.items?.length){
    const nonFood=/ナプキン|ティッシュ|皿|プレート|カップ|ポット|フォーク|スプーン|ナイフ|箸|ストロー|包装|包み紙|容器|トレー|コースター/i;
    const unusedAccessory=/ガムシロップ|シロップ.*小袋|ソース.*小袋/i;
    vision.items=vision.items.filter(x=>{
      const name=String(x.food_name||"");
      const method=String(x.cooking_method||"");
      const edible=/クッキー|ビスケット|サブレ|ケーキ|パイ|タルト|パン|ごはん|米|肉|魚|卵|野菜|果物|サラダ|麺|紅茶|コーヒー|牛乳|ミルク|ヨーグルト|チーズ/i;
      if(nonFood.test(name)&&!edible.test(name))return false;
      if(/未使用|使用していない|添え物/.test(method)&&!/砂糖|シュガー|ミルク|牛乳|クリーム/.test(name))return false;
      if(unusedAccessory.test(name)&&!/使用済|投入|混ぜ|加え/.test(method))return false;
      return true;
    });
  }
  if(vision.items?.length){
    // Visible sugar/milk are user decisions: keep them in the list so × can mean "didn't consume".
    vision.items=vision.items.map(item=>{
      const name=String(item.food_name||"");
      if(/砂糖スティック|角砂糖|スティックシュガー|シュガー/.test(name)){
        const g=Number(item.estimated_amount_g);
        return {...item,food_name:"砂糖",nutrition_search_name:"砂糖",estimated_amount_g:g>0?g:3,cooking_method:"使用不明（添え物）",optional_consumption:true};
      }
      if(/ミルクピッチャー|コーヒーフレッシュ|ミルクまたはクリーム|牛乳またはミルク/.test(name)){
        const g=Number(item.estimated_amount_g);
        return {...item,food_name:"牛乳またはミルク",nutrition_search_name:"普通牛乳",estimated_amount_g:g>0?g:15,cooking_method:"使用不明（添え物）",optional_consumption:true};
      }
      return item;
    });
  }
  // UI invariant: tea/coffee always exposes sugar and milk as removable optional rows.
  // Do not rely on Vision to remember these confirmation candidates.
  if(vision.items?.some(x=>/紅茶|ティー|コーヒー|珈琲/.test(x.food_name||""))){
    if(!vision.items.some(x=>/砂糖|シュガー|シロップ/.test(x.food_name||""))){
      vision.items.push({food_name:"砂糖",food_category:"調味料",estimated_amount_g:0,amount_min_g:0,amount_max_g:6,cooking_method:"使用不明（添え物）",confidence:0.2,assumption:"使用有無をユーザー確認",alternatives:[],optional_consumption:true});
    }
    if(!vision.items.some(x=>/ミルク|牛乳|クリーム/.test(x.food_name||""))){
      vision.items.push({food_name:"牛乳",food_category:"乳類",estimated_amount_g:0,amount_min_g:0,amount_max_g:30,cooking_method:"使用不明（添え物）",confidence:0.2,assumption:"使用有無をユーザー確認",alternatives:[],optional_consumption:true});
    }
  }
  if(vision.items?.length){
    const tea=vision.items.filter(x=>/紅茶/.test(x.food_name));
    if(tea.length>1){
      // A cup and a pot are usually the same serving context. Count the cup as consumed;
      // do not count the reserve tea in the pot unless the user explicitly adds it later.
      const cup=tea.find(x=>/カップ|cup/i.test(x.food_name))||tea[0];
      const others=new Set(tea.filter(x=>x!==cup));
      vision.items=vision.items.filter(x=>!others.has(x));
      cup.food_name="紅茶";
      cup.nutrition_search_name="紅茶";
    }
    const milk=vision.items.filter(x=>/ミルク|牛乳|クリーム/.test(x.food_name));
    if(vision.items.some(x=>/紅茶/.test(x.food_name))&&milk.length){vision.dish_name="ミルクティー";}
  }
  if(vision.items?.length){
    vision.items=vision.items.map((item,i)=>{
      const key=String(i);
      if(overrides[key]?.food_name==="なし")return {...item,estimated_amount_g:0,food_name:"なし"}; 
      let next=overrides[key]?.food_name?{...item,food_name:overrides[key].food_name}:item;
      if(overrides[key]?.estimated_amount_g!=null)next={...next,estimated_amount_g:Number(overrides[key].estimated_amount_g)||0,user_corrected:true};
      if(overrides[key]?.selected_food_number)next={...next,selected_food_number:String(overrides[key].selected_food_number),user_corrected:true};
      return next;
    });
  }
  // Final invariant before nutrition: if the recognized dish name clearly names a
  // main edible cookie/biscuit but the item list lost it during normalization,
  // restore the main food here (after every filter/transform).
  if(/クッキー|ビスケット|サブレ/.test(vision.dish_name||"")&&!vision.items?.some(x=>/クッキー|ビスケット|サブレ/.test(x.food_name||""))){
    vision.items=[...(vision.items||[]),{
      food_name:"クッキー",
      estimated_amount_g:40,
      amount_min_g:30,
      amount_max_g:55,
      cooking_method:"焼成",
      confidence:0.65,
      assumption:"料理名と写真の主役からクッキー2枚として復元",
      alternatives:["ビスケット","サブレ"]
    }];
  }
  // Separate semantic normalization from image recognition and DB resolution.
  // Vision says what it sees; this layer decides the stable food concept; nutrients() only resolves DB rows.
  const hasPackageLabel=(vision.items||[]).some(x=>x.nutrition_source==="package_label");
  const normalized=hasPackageLabel?{items:vision.items,newlyNormalized:[]}:await normalizeItems(client,vision.items||[],normalization_cache);
  vision.items=normalized.items.filter(x=>x.is_food!==false&&!x.is_garnish);
  if(!hasPackageLabel)vision.items=await reconcileNormalizedItems(client,vision.items);
  let calculated=nutrients(vision.items||[]);
  let web_fallbacks=[];
  if(!calculated.complete){
    const unresolved=calculated.items.filter(x=>x.nutrition_source==="unmapped");
    for(const original of unresolved){
      const displayName=String(original.food_name||"").trim();
      const searchName=String(original.nutrition_search_name||displayName).trim();
      const cacheKey=norm(searchName);
      try{
        const cached=food_cache[cacheKey]||food_cache[searchName]||food_cache[displayName];
        let hit=null,source="local_web_cache";
        if(cached&&cached.basis==="per_100g"&&Number.isFinite(Number(cached.calories))&&nutritionIsPlausible(["cached",cached.calories,cached.protein_g||0,cached.fat_g||0,cached.carbohydrate_g||0],100)){
          hit=cached;
        }else{
          const q=await client.responses.create({
            model:process.env.OPENAI_WEB_MODEL||"gpt-5.4-mini",
            tools:[{type:"web_search",search_context_size:"low"}],
            tool_choice:"required",
            include:["web_search_call.action.sources"],
            input:`「${searchName}」の栄養成分をWeb検索してください。対象の表示名は「${displayName}」です。メーカー・飲食店の商品なら公式サイトを最優先し、一般食品なら公的機関を最優先してください。次に信頼できる食品・レシピ情報を使ってください。100g当たりへ換算できる明確な根拠がある場合だけ、JSONのみで {"food_name":"${displayName}","search_name":"${searchName}","basis":"per_100g","calories":0,"protein_g":0,"fat_g":0,"carbohydrate_g":0,"fiber_g":null,"salt_g":null,"source_name":"","source_url":"","confidence":0} を返してください。source_url は実際に根拠として使ったページURLにしてください。根拠が不十分、または100g換算できない場合は {"food_name":"${displayName}","search_name":"${searchName}","not_found":true} を返してください。栄養値を推測で作らないでください。`
          });
          let txt=(q.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
          const x=txt.indexOf("{"),y=txt.lastIndexOf("}");
          if(x>=0&&y>x){
            const candidate=JSON.parse(txt.slice(x,y+1));
            if(!candidate.not_found&&candidate.basis==="per_100g"&&Number.isFinite(Number(candidate.calories))&&candidate.source_name&&candidate.source_url&&nutritionIsPlausible(["web",candidate.calories,candidate.protein_g||0,candidate.fat_g||0,candidate.carbohydrate_g||0],100)){
              hit=candidate; source="web_search";
            }
          }
        }
        if(hit){
          const g=Number(original.estimated_amount_g)||0,k=g/100;
          const vals={calories:Number(hit.calories)*k,protein_g:Number(hit.protein_g||0)*k,fat_g:Number(hit.fat_g||0)*k,carbohydrate_g:Number(hit.carbohydrate_g||0)*k,fiber_g:hit.fiber_g==null?0:Number(hit.fiber_g)*k,salt_g:hit.salt_g==null?0:Number(hit.salt_g)*k};
          Object.keys(vals).forEach(x=>vals[x]=Math.round(vals[x]*10)/10);
          web_fallbacks.push({...hit,food_name:displayName,search_name:searchName,cache_key:cacheKey,estimated_amount_g:g,calculated:vals,estimation_source:source});
        }
      }catch{}
    }
    const resolvedNames=new Set(web_fallbacks.map(w=>w.food_name));
    for(const w of web_fallbacks){
      Object.keys(calculated.total).forEach(k=>calculated.total[k]+=Number(w.calculated?.[k])||0);
      const idx=calculated.items.findIndex(x=>x.food_name===w.food_name&&x.nutrition_source==="unmapped");
      if(idx>=0)calculated.items[idx]={...calculated.items[idx],...w.calculated,nutrition_source:w.estimation_source,source_name:w.source_name,source_url:w.source_url,confidence:w.confidence,cache_key:w.cache_key};
    }
    calculated.unmapped=calculated.unmapped.filter(name=>!resolvedNames.has(name));
    Object.keys(calculated.total).forEach(k=>calculated.total[k]=Math.round(calculated.total[k]*10)/10);
    calculated.complete=calculated.unmapped.length===0;
  }
  // Show the resolved portion even when some foods remain unresolved; completeness is reported separately.
  const meaningful=calculated.items.some(x=>["mext_food_master","web_search","local_web_cache"].includes(x.nutrition_source)&&Number(x.estimated_amount_g)>0);
  const totalWeight=calculated.items.reduce((s,x)=>s+(Number(x.estimated_amount_g)||0),0);
  const totalPlausible=totalWeight>0&&calculated.total.calories>=0&&calculated.total.calories<=totalWeight*9.5&&calculated.total.protein_g<=totalWeight&&calculated.total.fat_g<=totalWeight&&calculated.total.carbohydrate_g<=totalWeight*1.1;
  const safeNutrition=meaningful&&totalPlausible?calculated.total:null;
  return res.status(200).json({...vision,items:calculated.items,normalization_updates:normalized.newlyNormalized,nutrition:safeNutrition,calculation_note:calculated.complete?"栄養値は食品成分表ベースの100g値×推定重量で計算しています。":"未対応食品（"+calculated.unmapped.join("、")+"）があるため、表示合計は暫定値です。",nutrition_complete:calculated.complete,unmapped_items:calculated.unmapped,web_fallbacks,source_label:"日本食品標準成分表（八訂）増補2023年・2026-03-27版"});
 }catch(e){return res.status(500).json({error:"Photo analysis failed",detail:e?.message||String(e)})}
}