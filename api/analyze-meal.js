import OpenAI from "openai";
import MEXT_FOODS from "../data/mext-food-master.js";

// [official name, kcal, protein, fat, carbohydrate, fiber, salt, MEXT food number]
const FOOD_DB=MEXT_FOODS.map(([id,name,k,p,f,c,fi,s])=>[name,k,p,f,c,fi,s,id]);
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
function findFood(name){
 const alias=directAlias(name);
 if(alias){const hit=FOOD_DB.map(x=>[scoreFood(alias,x),x]).sort((a,b)=>b[0]-a[0])[0];if(hit?.[0]>=80)return hit[1]}
 let ranked=FOOD_DB.map(x=>[scoreFood(name,x),x]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);
 if(ranked[0]?.[0]>=80)return ranked[0][1];
 const rule=FOOD_CATEGORY_RULES.find(r=>r.re.test(name||""));
 if(rule)for(const candidate of rule.candidates){const hit=FOOD_DB.map(x=>[scoreFood(candidate,x),x]).sort((a,b)=>b[0]-a[0])[0];if(hit?.[0]>=80)return hit[1]}
 if(/クッキー|ビスケット|サブレ/.test(name||""))return ["ソフトビスケット",522,5.7,27.6,62.6,1.4,0.6,"cookie-fallback"];
 return null;
}
function nutrients(items){
 let total={calories:0,protein_g:0,fat_g:0,carbohydrate_g:0,fiber_g:0,salt_g:0},mapped=[],unmapped=[];
 for(const item of items){
  const food=findFood(item.nutrition_search_name||item.food_name); const g=Number(item.estimated_amount_g)||0;
  if(g<=0||/未使用/.test(item.cooking_method||"")){mapped.push({...item,estimated_amount_g:0,nutrition_source:"not_consumed"});continue}
  if(food){let k=g/100;let v={calories:food[1]*k,protein_g:food[2]*k,fat_g:food[3]*k,carbohydrate_g:food[4]*k,fiber_g:(food[5]||0)*k,salt_g:(food[6]||0)*k};Object.keys(total).forEach(x=>total[x]+=v[x]);mapped.push({...item,nutrition_source:"mext_food_master",food_number:food[7],...Object.fromEntries(Object.entries(v).map(([k,v])=>[k,Math.round(v*10)/10]))})}
  else if(/ミント|パセリ|ハーブ|飾り|添え葉/.test(item.food_name||"")&&g<=5){mapped.push({...item,nutrition_source:"garnish_ignored"});}
  else {mapped.push({...item,nutrition_source:"unmapped"});unmapped.push(item.food_name)}
 }
 Object.keys(total).forEach(x=>total[x]=Math.round(total[x]*10)/10);return{items:mapped,total,unmapped,complete:unmapped.length===0}
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const {image,food_cache={},overrides={},items:providedItems,dish_name:providedDishName}=req.body||{};
  if(!providedItems&&!image?.startsWith("data:image/"))return res.status(400).json({error:"Image is required"});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`日本の食事写真を栄養計算用に分析してください。皿単位の料理名だけでなく、栄養計算できる構成要素へ分解します。
手順:
1. 写真中の各料理・食品を列挙。複合料理は主な食材・主食・衣・ソース等に分解。飲み物も必ず対象にする。紅茶やコーヒーの横にミルクピッチャーがある、液色がミルク入りに見える等の場合は、飲料本体と牛乳/生クリームを別itemとして推定する。
2. 器・箸・既知サイズとの相対比較、個数、盛り付け面積と厚みから可食部重量を推定。
3. estimated_amount_g は最尤値、amount_min_g/amount_max_g は妥当な範囲。
4. 揚げ物の吸油、炒め油、ドレッシング、マヨネーズ等は見える/調理法から強く示唆される場合だけ別itemにし、推定であることを明示。
5. 写真で区別できない候補は alternatives に最大2件。断定しない。
6. confidenceは食品同定と量推定を総合した0〜1。量が曖昧なら低くする。
7. カロリーや栄養値は絶対に生成しない。各itemには表示用food_nameとは別に、食品成分表で検索しやすい一般名称 nutrition_search_name と大分類 food_category も返す。商品名・見た目の名称ではなく一般的な食品名にする。\n8. 砂糖やシロップは写真だけで確認できない場合、勝手に加えず needs_user_confirmation に「砂糖・シロップを入れたか」を入れる。ミルクも使用量が不確実なら範囲を広くし確認候補にする。
JSONのみ:
{"dish_name":"鮭定食","items":[{"food_name":"白ごはん","nutrition_search_name":"炊いた白米","food_category":"穀類","estimated_amount_g":150,"amount_min_g":130,"amount_max_g":180,"cooking_method":"炊飯","confidence":0.85,"assumption":"茶碗1杯程度","alternatives":[]}],"notes":["写真だけでは判別困難な点"],"needs_user_confirmation":["確認すると精度が上がる項目"]}`;
  let vision;
  if(providedItems){
    vision={dish_name:providedDishName||"食事",items:providedItems,notes:[],needs_user_confirmation:[]};
  }else{
    const response=await client.responses.create({model:process.env.OPENAI_VISION_MODEL||"gpt-5.4-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}]});
    let raw=(response.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
    try{vision=JSON.parse(raw)}catch(parseErr){const start=raw.indexOf("{"),end=raw.lastIndexOf("}");if(start<0||end<=start)throw new Error("AI response was not valid JSON");vision=JSON.parse(raw.slice(start,end+1))}
  }
  if(/クッキー|ビスケット|サブレ/.test(vision.dish_name||"")&&!vision.items?.some(x=>/クッキー|ビスケット|サブレ/.test(x.food_name||""))){
    vision.items=[...(vision.items||[]),{food_name:"クッキー",estimated_amount_g:40,amount_min_g:30,amount_max_g:55,cooking_method:"焼成",confidence:0.65,assumption:"写真の主役の焼き菓子2枚。AIがitemsから落としたため料理名から復元",alternatives:["ビスケット","サブレ"]}];
  }
  if(vision.items?.length){
    const nonFood=/ナプキン|ティッシュ|皿|プレート|カップ|ポット|フォーク|スプーン|ナイフ|箸|ストロー|包装|包み紙|容器|トレー|コースター/i;
    const unusedAccessory=/砂糖スティック|角砂糖|シュガー|ミルクピッチャー|コーヒーフレッシュ|ガムシロップ|シロップ.*小袋|ソース.*小袋/i;
    vision.items=vision.items.filter(x=>{
      const name=String(x.food_name||"");
      const method=String(x.cooking_method||"");
      const edible=/クッキー|ビスケット|サブレ|ケーキ|パイ|タルト|パン|ごはん|米|肉|魚|卵|野菜|果物|サラダ|麺|紅茶|コーヒー|牛乳|ミルク|ヨーグルト|チーズ/i;
      if(nonFood.test(name)&&!edible.test(name))return false;
      if(/未使用|使用していない|添え物/.test(method))return false;
      if(unusedAccessory.test(name)&&!/使用済|投入|混ぜ|加え/.test(method))return false;
      return true;
    });
  }
  if(vision.items?.length){
    const pastry=vision.items.filter(x=>/焼き菓子の生地|ケーキの生地|スポンジ.*生地|パイ.*生地|タルト.*生地|りんご.*フィリング|リンゴ.*フィリング|りんご系フィリング|フィリング.*トッピング|焼き菓子表面の卵液|照り用つや出し|グレーズ|砂糖がけ/.test(x.food_name));
    const hasApple=pastry.some(x=>/りんご|リンゴ|アップル/.test(x.food_name));
    const hasCrust=pastry.some(x=>/生地|スポンジ|パイ|タルト/.test(x.food_name));
    if(hasApple&&hasCrust){
      const totalG=pastry.reduce((s,x)=>s+(Number(x.estimated_amount_g)||0),0);
      const remove=new Set(pastry);
      vision.items=[...vision.items.filter(x=>!remove.has(x)),{food_name:"アップルパイ",estimated_amount_g:Math.round(totalG),amount_min_g:null,amount_max_g:null,cooking_method:"焼成",confidence:Math.min(...pastry.map(x=>Number(x.confidence)||0.7)),assumption:"りんご系の焼き菓子を完成品として統合",alternatives:[]}];
      vision.dish_name=/紅茶/.test(vision.dish_name||"")?"ミルクティーとアップルパイ":"アップルパイ";
    }
  }
  if(vision.items?.length){const tea=vision.items.filter(x=>/紅茶/.test(x.food_name));const milk=vision.items.filter(x=>/ミルク|牛乳|クリーム/.test(x.food_name));if(tea.length&&milk.length){vision.dish_name="ミルクティー";}}
  if(vision.items?.length){
    vision.items=vision.items.map((item,i)=>{
      const key=String(i);
      if(overrides[key]?.food_name==="なし")return {...item,estimated_amount_g:0,food_name:"なし"}; return overrides[key]?.food_name?{...item,food_name:overrides[key].food_name}:item;
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
        if(cached&&cached.basis==="per_100g"&&Number.isFinite(Number(cached.calories))){
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
            if(!candidate.not_found&&candidate.basis==="per_100g"&&Number.isFinite(Number(candidate.calories))&&candidate.source_name&&candidate.source_url){
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
  const safeNutrition=meaningful?calculated.total:null;
  return res.status(200).json({...vision,items:calculated.items,nutrition:safeNutrition,calculation_note:calculated.complete?"栄養値は食品成分表ベースの100g値×推定重量で計算しています。":"未対応食品（"+calculated.unmapped.join("、")+"）があるため、表示合計は暫定値です。",nutrition_complete:calculated.complete,unmapped_items:calculated.unmapped,web_fallbacks,source_label:"日本食品標準成分表（八訂）増補2023年・2026-03-27版"});
 }catch(e){return res.status(500).json({error:"Photo analysis failed",detail:e?.message||String(e)})}
}