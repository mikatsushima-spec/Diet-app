import OpenAI from "openai";

const FOOD_DB=[
 // 日本食品標準成分表（八訂）増補2023年を基礎にした日常食用サブセット（100g当たり）
 ["白ごはん",156,2.5,0.3,37.1,1.5,0],["玄米ごはん",152,2.8,1.0,35.6,1.4,0],["おかゆ",65,1.1,0.1,15.7,0.5,0],
 ["食パン",248,8.9,4.1,46.4,4.2,1.2],["ロールパン",309,10.1,9.0,48.6,2.0,1.2],["うどん",95,2.6,0.4,21.6,1.3,0.3],
 ["そば",130,4.8,1.0,26.0,2.9,0],["パスタ",150,5.8,0.9,32.2,3.0,0],["中華麺",133,4.9,0.6,29.2,1.3,0.2],
 ["鶏むね肉",133,21.3,5.9,0,0,0.1],["鶏もも肉",190,16.6,14.2,0,0,0.2],["ささみ",98,23.9,0.8,0.1,0,0.1],
 ["豚ロース",248,19.3,19.2,0.2,0,0.1],["豚もも",171,20.5,10.2,0.2,0,0.1],["豚ばら",366,14.4,35.4,0.1,0,0.1],
 ["牛もも",235,19.2,18.7,0.5,0,0.1],["牛ばら",472,11.0,50.0,0.1,0,0.1],["ひき肉",220,18.0,16.0,0.5,0,0.2],
 ["焼き鮭",160,25.0,6.0,0.1,0,0.2],["鮭",124,22.3,4.1,0.1,0,0.1],["さば",211,20.6,16.8,0.3,0,0.2],
 ["まぐろ",115,26.4,1.4,0.1,0,0.1],["ぶり",222,21.4,17.6,0.3,0,0.1],["あじ",112,19.7,4.5,0.1,0,0.3],
 ["えび",77,18.4,0.3,0.1,0,0.4],["いか",76,17.9,0.8,0.1,0,0.5],["たこ",70,16.4,0.7,0.1,0,0.6],
 ["卵",142,12.2,10.2,0.4,0,0.4],["木綿豆腐",73,7.0,4.9,1.5,1.1,0],["絹ごし豆腐",56,5.3,3.5,2.0,0.9,0],
 ["納豆",184,16.5,10.0,12.1,6.7,0],["枝豆",125,11.7,6.2,8.8,5.0,0],
 ["紅茶",1,0.1,0,0.1,0,0],["コーヒー",4,0.2,0,0.7,0,0],["普通牛乳",61,3.3,3.8,4.8,0,0.1],["低脂肪牛乳",42,3.8,1.0,5.5,0,0.2],["生クリーム",404,1.9,43.0,6.5,0,0.1],["ヨーグルト",56,3.6,3.0,4.9,0,0.1],["プロセスチーズ",313,22.7,26.0,1.3,0,2.8],
 ["ブロッコリー",37,5.4,0.6,6.6,5.1,0],["キャベツ",23,1.3,0.2,5.2,1.8,0],["レタス",11,0.6,0.1,2.8,1.1,0],
 ["トマト",20,0.7,0.1,4.7,1.0,0],["きゅうり",13,1.0,0.1,3.0,1.1,0],["にんじん",35,0.7,0.2,9.3,2.8,0.1],
 ["玉ねぎ",33,1.0,0.1,8.4,1.5,0],["ほうれん草",18,2.2,0.4,3.1,2.8,0.2],["小松菜",13,1.5,0.2,2.4,1.9,0.1],
 ["じゃがいも",59,1.8,0.1,17.3,8.9,0],["さつまいも",127,0.9,0.5,33.1,2.8,0.1],["かぼちゃ",78,1.9,0.3,20.6,3.5,0],
 ["なす",18,1.1,0.1,5.1,2.2,0],["ピーマン",20,0.9,0.2,5.1,2.3,0],["もやし",15,1.8,0.1,2.6,1.3,0],
 ["バナナ",93,1.1,0.2,22.5,1.1,0],["りんご",53,0.1,0.2,15.5,1.4,0],["みかん",49,0.7,0.1,12.0,1.0,0],
 ["いちご",31,0.9,0.1,8.5,1.4,0],["キウイ",51,1.0,0.2,13.4,2.6,0],
 ["オリーブ油",894,0,100,0,0,0],["サラダ油",886,0,100,0,0,0],["ごま油",890,0,100,0,0,0],
 ["マヨネーズ",668,1.4,76.0,3.6,0,1.8],["ケチャップ",104,1.6,0.2,27.4,1.7,3.1],["しょうゆ",76,7.7,0,7.9,0,14.5],
 ["みそ",182,12.5,6.0,26.3,4.9,12.4],["砂糖",391,0,0,99.3,0,0],["アップルパイ",294,4.0,17.5,32.8,1.2,0.4]
];
function norm(s=""){return s.replace(/[\s　]/g,"").toLowerCase()}
function canonicalFood(name=""){
 const n=norm(name);
 if(/ミルク|牛乳/.test(n)) return /低脂肪/.test(n)?"低脂肪牛乳":/生クリーム|クリーム/.test(n)&&!/ミルク/.test(n)?"生クリーム":"普通牛乳";
 if(/紅茶|ティー/.test(n)) return "紅茶";
 if(/コーヒー|珈琲/.test(n)) return "コーヒー";
 return name;
}
function findFood(name){let n=norm(canonicalFood(name)),hit=FOOD_DB.find(x=>n.includes(norm(x[0]))||norm(x[0]).includes(n));return hit||null}
function nutrients(items){
 let total={calories:0,protein_g:0,fat_g:0,carbohydrate_g:0,fiber_g:0,salt_g:0},mapped=[],unmapped=[];
 for(const item of items){
  const food=findFood(item.food_name); const g=Number(item.estimated_amount_g)||0;
  if(food&&g>0){let k=g/100;let v={calories:food[1]*k,protein_g:food[2]*k,fat_g:food[3]*k,carbohydrate_g:food[4]*k,fiber_g:(food[5]||0)*k,salt_g:(food[6]||0)*k};Object.keys(total).forEach(x=>total[x]+=v[x]);mapped.push({...item,nutrition_source:"local_food_db",...Object.fromEntries(Object.entries(v).map(([k,v])=>[k,Math.round(v*10)/10]))})}
  else {mapped.push({...item,nutrition_source:"unmapped"});unmapped.push(item.food_name)}
 }
 Object.keys(total).forEach(x=>total[x]=Math.round(total[x]*10)/10);return{items:mapped,total,unmapped,complete:unmapped.length===0}
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const {image}=req.body||{};if(!image?.startsWith("data:image/"))return res.status(400).json({error:"Image is required"});
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
  const calculated=nutrients(vision.items||[]);
  // Never present a partial sum as the meal total. If any detected food is
  // unmapped, nutrition is intentionally withheld until the master/mapping is completed.
  const safeNutrition=calculated.complete?calculated.total:null;
  return res.status(200).json({...vision,items:calculated.items,nutrition:safeNutrition,calculation_note:calculated.complete?"栄養値は食品成分表ベースの100g値×推定重量で計算しています。":"未対応食品（"+calculated.unmapped.join("、")+"）があるため、表示合計は暫定値です。",nutrition_complete:calculated.complete,unmapped_items:calculated.unmapped,source_label:"日本食品標準成分表（八訂）増補2023年（2026年正誤表対応方針）"});
 }catch(e){return res.status(500).json({error:"Photo analysis failed",detail:e?.message||String(e)})}
}