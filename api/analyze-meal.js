import OpenAI from "openai";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
  try{
    const {image}=req.body||{};
    if(!image||!image.startsWith("data:image/")) return res.status(400).json({error:"Image is required"});
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const prompt=`あなたは食事写真の解析器です。写真に実際に見える料理・食品を推定してください。
最終カロリーを推測するのではなく、食品名、推定重量g、調理法、確信度を返してください。
油、ドレッシング、調味料など写真だけで量が分からないものは notes に明記してください。
必ずJSONだけを返してください。形式:
{"items":[{"food_name":"白ごはん","estimated_amount_g":150,"cooking_method":"炊飯","confidence":0.8}],"notes":["..."]}
不明なものを断定しないでください。`;
    const response=await client.responses.create({
      model:process.env.OPENAI_VISION_MODEL||"gpt-6-luna",
      input:[{role:"user",content:[
        {type:"input_text",text:prompt},
        {type:"input_image",image_url:image,detail:"high"}
      ]}]
    });
    let raw=response.output_text.trim().replace(/^\`\`\`json\s*/,"").replace(/\`\`\`$/,"");
    const data=JSON.parse(raw);
    return res.status(200).json(data);
  }catch(e){
    return res.status(500).json({error:"Photo analysis failed",detail:e?.message||String(e)});
  }
}