import OpenAI from "openai";
import MEXT_FOODS from "../data/mext-food-master.js";

// [official name, kcal, protein, fat, carbohydrate, fiber, salt, MEXT food number]
const FOOD_DB=MEXT_FOODS.map(([id,name,k,p,f,c,fi,s])=>[name,k,p,f,c,fi,s,id]);
function norm(s=""){return s.replace(/[\s　]/g,"").toLowerCase()}
function canonicalFood(name=""){
 const n=norm(name);
 if(/ミルク|牛乳/.test(n)) return /低脂肪/.test(n)?"低脂肪牛乳":/生クリーム|クリーム/.test(n)&&!/ミルク/.test(n)?"生クリーム":"普通牛乳";
 if(/紅茶|ティー/.test(n)) return "紅茶";
 if(/コーヒー|珈琲/.test(n)) return "コーヒー";
 return name;
}
function findFood(name){
 const n=norm(canonicalFood(name));
 const hits=FOOD_DB.filter(x=>{const m=norm(x[0]);return n===m||m.includes(n)||n.includes(m)});
 if(!hits.length)return null;
 return hits.sort((a,b)=>{const an=norm(a[0]),bn=norm(b[0]);const ae=an===n?0:1,be=bn===n?0:1;return ae-be||an.length-bn.length})[0];
}
function nutrients(items){
 let total={calories:0,protein_g:0,fat_g:0,carbohydrate_g:0,fiber_g:0,salt_g:0},mapped=[],unmapped=[];
 for(const item of items){
  const food=findFood(item.food_name); const g=Number(item.estimated_amount_g)||0;
  if(food&&g>0){let k=g/100;let v={calories:food[1]*k,protein_g:food[2]*k,fat_g:food[3]*k,carbohydrate_g:food[4]*k,fiber_g:(food[5]||0)*k,salt_g:(food[6]||0)*k};Object.keys(total).forEach(x=>total[x]+=v[x]);mapped.push({...item,nutrition_source:"mext_food_master",food_number:food[7],...Object.fromEntries(Object.entries(v).map(([k,v])=>[k,Math.round(v*10)/10]))})}
  else {mapped.push({...item,nutrition_source:"unmapped"});unmapped.push(item.food_name)}
 }
 Object.keys(total).forEach(x=>total[x]=Math.round(total[x]*10)/10);return{items:mapped,total,unmapped,complete:unmapped.length===0}
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const {image,food_cache={}}=req.body||{};if(!image?.startsWith("data:image/"))return res.status(400).json({error:"Image is required"});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`日本の食事写真を栄養計算用に分析してください。皿単位の料理名だけでなく、栄養計算できる構成要素へ分解します。
手順:
1. 写真中の各料理・食品を列挙。複合料理は主な食材・主食・衣・ソース等に分解。飲み物も必ず対象にする。紅茶やコーヒーの横にミルクピッチャーがある、液色がミルク入りに見える等の場合は、飲料本体と牛乳/生クリームを別itemとして推定する。
2. 器・箸・既知サイズとの相対比較、個数、盛り付け面積と厚みから可食部重量を推定。
3. estimated_amount_g は最尤値、amount_min_g/amount_max_g は妥当な範囲。
4. 揚げ物の吸油、炒め油、ドレッシング、マヨネーズ等は見える/調理法から強く示唆される場合だけ別itemにし、推定であることを明示。
5. 写真で区別できない候補は alternatives に最大2件。断定しない。
6. confidenceは食品同定と量推定を総合した0〜1。量が曖昧なら低くする。
7. カロリーや栄養値は絶対に生成しない。食品と重量だけ返す。\n8. 砂糖やシロップは写真だけで確認できない場合、勝手に加えず needs_user_confirmation に「砂糖・シロップを入れたか」を入れる。ミルクも使用量が不確実なら範囲を広くし確認候補にする。
JSONのみ:
{"dish_name":"鮭定食","items":[{"food_name":"白ごはん","estimated_amount_g":150,"amount_min_g":130,"amount_max_g":180,"cooking_method":"炊飯","confidence":0.85,"assumption":"茶碗1杯程度","alternatives":[]}],"notes":["写真だけでは判別困難な点"],"needs_user_confirmation":["確認すると精度が上がる項目"]}`;
  const response=await client.responses.create({model:process.env.OPENAI_VISION_MODEL||"gpt-5.4-mini",input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}]});
  let raw=(response.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
  let vision;
  try{vision=JSON.parse(raw)}catch(parseErr){const start=raw.indexOf("{"),end=raw.lastIndexOf("}");if(start<0||end<=start)throw new Error("AI response was not valid JSON");vision=JSON.parse(raw.slice(start,end+1))}
  if(vision.items?.length){const tea=vision.items.filter(x=>/紅茶/.test(x.food_name));const milk=vision.items.filter(x=>/ミルク|牛乳|クリーム/.test(x.food_name));if(tea.length&&milk.length){vision.dish_name="ミルクティー";}}
  let calculated=nutrients(vision.items||[]);
  let web_fallbacks=[];
  if(!calculated.complete){
    for(const missing of calculated.unmapped){
      try{
        const cached=food_cache[missing];
        if(cached&&cached.basis==="per_100g"&&Number.isFinite(Number(cached.calories))){
          const original=(vision.items||[]).find(x=>x.food_name===missing);
          const g=Number(original?.estimated_amount_g)||0,k=g/100;
          const vals={calories:Number(cached.calories)*k,protein_g:Number(cached.protein_g||0)*k,fat_g:Number(cached.fat_g||0)*k,carbohydrate_g:Number(cached.carbohydrate_g||0)*k,fiber_g:cached.fiber_g==null?0:Number(cached.fiber_g)*k,salt_g:cached.salt_g==null?0:Number(cached.salt_g)*k};
          Object.keys(vals).forEach(x=>vals[x]=Math.round(vals[x]*10)/10);
          web_fallbacks.push({...cached,food_name:missing,estimated_amount_g:g,calculated:vals,estimation_source:"local_web_cache"});
          continue;
        }
        const q=await client.responses.create({
          model:process.env.OPENAI_WEB_MODEL||"gpt-5.4-mini",
          tools:[{type:"web_search",search_context_size:"low"}],
          tool_choice:"required",
          include:["web_search_call.action.sources"],
          input:`「${missing}」の栄養成分をWeb検索してください。メーカー・飲食店の商品なら公式サイトを最優先。次に公的機関・信頼できる食品/レシピ情報を使うこと。100g当たりに換算できる根拠がある場合だけ、JSONのみで {"food_name":"","basis":"per_100g","calories":0,"protein_g":0,"fat_g":0,"carbohydrate_g":0,"fiber_g":null,"salt_g":null,"source_name":"","source_url":"","confidence":0} を返す。根拠が不十分なら {"food_name":"${missing}","not_found":true} を返す。栄養値を推測で作らないこと。`
        });
        let txt=(q.output_text||"").trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
        const a=txt.indexOf("{"),b=txt.lastIndexOf("}");
        if(a>=0&&b>a){
          const hit=JSON.parse(txt.slice(a,b+1));
          if(!hit.not_found&&Number.isFinite(Number(hit.calories))){
            const original=(vision.items||[]).find(x=>x.food_name===missing);
            const g=Number(original?.estimated_amount_g)||0,k=g/100;
            const vals={calories:Number(hit.calories)*k,protein_g:Number(hit.protein_g||0)*k,fat_g:Number(hit.fat_g||0)*k,carbohydrate_g:Number(hit.carbohydrate_g||0)*k,fiber_g:hit.fiber_g==null?0:Number(hit.fiber_g)*k,salt_g:hit.salt_g==null?0:Number(hit.salt_g)*k};
            Object.keys(vals).forEach(x=>vals[x]=Math.round(vals[x]*10)/10);
            web_fallbacks.push({...hit,estimated_amount_g:g,calculated:vals,estimation_source:"web_search"});
          }
        }
      }catch{}
    }
    if(web_fallbacks.length===calculated.unmapped.length){
      for(const w of web_fallbacks)Object.keys(calculated.total).forEach(k=>calculated.total[k]+=w.calculated[k]||0);
      Object.keys(calculated.total).forEach(k=>calculated.total[k]=Math.round(calculated.total[k]*10)/10);
      calculated.complete=true;calculated.unmapped=[];
    }
  }
  // Never present a partial sum as the meal total. If any detected food is
  // unmapped, nutrition is intentionally withheld until the master/mapping is completed.
  const safeNutrition=calculated.complete?calculated.total:null;
  return res.status(200).json({...vision,items:calculated.items,nutrition:safeNutrition,calculation_note:calculated.complete?"栄養値は食品成分表ベースの100g値×推定重量で計算しています。":"未対応食品（"+calculated.unmapped.join("、")+"）があるため、表示合計は暫定値です。",nutrition_complete:calculated.complete,unmapped_items:calculated.unmapped,web_fallbacks,source_label:"日本食品標準成分表（八訂）増補2023年・2026-03-27版"});
 }catch(e){return res.status(500).json({error:"Photo analysis failed",detail:e?.message||String(e)})}
}