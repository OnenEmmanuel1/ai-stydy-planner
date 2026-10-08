// Optional OpenAI-compatible chat completion provider. The caller must perform crisis screening first.
async function generate(message,context={}) {
  if(!process.env.LLM_API_KEY) return null;
  const base=(process.env.LLM_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  const response=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.LLM_API_KEY}`},body:JSON.stringify({model:process.env.LLM_MODEL||'gpt-4o-mini',messages:[{role:'system',content:'You are an academic study planning assistant. Give concise study help and encouragement only. Do not diagnose or provide therapy. Do not handle crisis situations; those are escalated before you are called.'},{role:'user',content:`Emotion: ${context.emotion||'Neutral'}; intent: ${context.intent||'General'}. Student message: ${message}`}],temperature:.5})});
  if(!response.ok) throw new Error(`LLM provider returned ${response.status}`);
  const data=await response.json(); return data.choices?.[0]?.message?.content||null;
}
module.exports={generate};
