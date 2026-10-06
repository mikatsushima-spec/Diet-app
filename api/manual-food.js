import OpenAI from "openai";
import MEXT_FOODS from "../data/mext-food-master.js";

const DB=MEXT_FOODS.map(([id,name,k,p,f,c,fi,s])=>({id,name,k,p,f,c,fi:fi||0,s:s||0}));
const norm=x=>String(x||"").replace(/[\s　]/g,"").toLowerCase();
function findFood(name){
 const q=norm(name);
 let rows=DB.map(x=>({x,score:norm(x.name)===q?1000:norm(x.name).includes(q)?800:q.includes(norm(x.name))?650:0})).filter(v=>v.score).sort((a,b)=>b.score-a.score||a.x.name.length-b.x.name.length);
 return rows[0]?.x||null;
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const q=String(req.body?.query||"").trim();
 if(!q)return res.status(400).json({error:"食品名を入力してください"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"AIを利用できません"});
 try{
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const model=process.env.OPENAI_VISION_MODEL||"gpt-6-luna";
  const r=await client.responses.create({model,input:"料理名「"+q+"」を一般的な1人前の材料に分解してください。各材料は日本食品標準成分表で検索しやすい具体名と可食量gにしてください。油や砂糖など栄養に影響する材料も含めます。栄養値やカロリーは作らないでください。JSONだけを返してください。形式: {\"dish_name\":\"料理名\",\"items\":[{\"food_name\":\"材料名\",\"grams\":100}]}。最大8材料。"});
  let data;try{data=JSON.parse((r.output_text||"").replace(/\x60\x60\x60json|\x60\x60\x60/g,"").trim())}catch{return res.status(422).json({error:"料理の内訳を作成できませんでした"})}
  const items=(data.items||[]).map(i=>{const food=findFood(i.food_name);if(!food)return null;return {display_name:i.food_name,name:food.name,grams:Math.max(1,Number(i.grams)||1),food_number:food.id,calories_per_100g:food.k,protein_per_100g:food.p,fat_per_100g:food.f,carbohydrate_per_100g:food.c}}).filter(Boolean);
  if(!items.length)return res.status(422).json({error:"食品DBに照合できる材料がありませんでした"});
  return res.status(200).json({dish_name:data.dish_name||q,items});
 }catch(e){return res.status(500).json({error:"料理の内訳を取得できませんでした",detail:e?.message||String(e)})}
}
