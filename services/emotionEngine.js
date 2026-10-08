const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const defaults = {
  Stressed:['stressed','anxious','overwhelmed','worried','panic','pressure','nervous','tense','scared'],
  Fatigued:['tired','exhausted','sleepy','drained','疲れた','burnt','burned','fatigued','weary'],
  Motivated:['motivated','excited','ready','confident','focused','determined','inspired','progress','proud'],
  Frustrated:['frustrated','confused','stuck','annoyed','angry','difficult','impossible','failed','upset']
};
const negators = new Set(['not','no','never','isnt','wasnt','dont','doesnt','hardly']);
const negationBoundaries = new Set(['but','however','although','though','just','yet']);
const intensifiers = new Map([['very',1.7],['really',1.5],['extremely',2],['so',1.4],['slightly',0.55],['bit',0.65],['little',0.65],['quite',1.3]]);
function classify(text, entries=[]) {
  const words=tokenizer.tokenize(String(text||'').toLowerCase().replace(/[’']/g,''));
  const lex=[...Object.entries(defaults).flatMap(([emotion,list])=>list.map(word=>({word,emotion,weight:1}))),...entries];
  const scores={Stressed:0,Fatigued:0,Motivated:0,Frustrated:0};
  for(let i=0;i<words.length;i++) {
    const matches=lex.filter(e=>String(e.word).toLowerCase()===words[i]); if(!matches.length) continue;
    const context=words.slice(Math.max(0,i-4),i);
    let negated=false;for(const word of context.slice().reverse()){if(negationBoundaries.has(word))break;if(negators.has(word)){negated=true;break;}}
    if(negated) continue;
    let factor=1; for(const w of context) if(intensifiers.has(w)) factor=Math.max(factor,intensifiers.get(w));
    for(const m of matches) if(scores[m.emotion]!==undefined) scores[m.emotion]+=Number(m.weight||1)*factor;
  }
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return {emotion:best[1]>0?best[0]:'Neutral',scores,confidence:best[1]>0?Math.min(1,best[1]/3):0};
}
module.exports={classify,defaults};
