const pool=require('./db');
const emotionEngine=require('./emotionEngine');
const llm=require('./llmProvider');
const CRISIS=[/\bkill myself\b/i,/\bsuicid(?:e|al)\b/i,/\bend my life\b/i,/\bend it all\b/i,/\bwant to die\b/i,/\b(?:do not|don't|dont) want to live\b/i,/\btake my life\b/i,/\bself[ -]?harm\b/i,/\bhurt myself\b/i,/\bcut myself\b/i,/\bbetter off dead\b/i,/\bcan(?:not|'t|’t) go on\b/i,/\bno reason to live\b/i,/\bending my life\b/i,/\bthinking (?:about )?ending my life\b/i,/\b(?:do not|dont) want to be alive\b/i];
function detectCrisis(text){const normalized=String(text||'').normalize('NFKC').replace(/[\u2019\u2018]/g,"'");return CRISIS.some(re=>re.test(normalized));}
const CLINICAL_RESPONSE=/\b(diagnos(?:e|is|ing)|therapy|therapist|counsel(?:ing|or)|medication|treatment|clinical|mental illness|disorder|trauma|panic attack|symptom)\b/i;
function isSafeSupportiveResponse(text){return !CLINICAL_RESPONSE.test(String(text||''));}
function detectIntent(text){const s=text.toLowerCase();if(/\b(hello|hi|hey|good morning|good afternoon)\b/.test(s))return 'Greeting';if(/\b(schedule|plan|session|study time|calendar|what.*study)\b/.test(s))return 'AskSchedule';if(/\b(help|explain|how do i|study|understand|revise|learn)\b/.test(s))return 'AskStudyHelp';return 'ExpressEmotion';}
function supportive(emotion){return {Stressed:'That sounds like a lot to carry. Let us take it one step at a time; a short break can help.',Fatigued:'You sound low on energy. A brief rest and a smaller study block may feel more manageable.',Motivated:'It is great that you are feeling ready. Let us use that momentum on one focused task.',Frustrated:'Getting stuck can be frustrating. Try one smaller step, or take a short reset.',Neutral:'I am here to help with your study planning.'}[emotion]||'';}
async function respond(userId,text) {
  // Crisis screening must precede classification, template lookup, and LLM routing.
  const crisis=detectCrisis(text);
  if(crisis) {
    await pool.query('INSERT INTO chat_messages(userId,sender,content,detectedEmotion,isCrisisFlagged) VALUES(?,?,?,NULL,?)',[userId,'User',text,true]);
    const [settings]=await pool.query("SELECT settingValue FROM system_settings WHERE settingKey='crisis_contact'");
    const contact=settings[0]?.settingValue||process.env.CAMPUS_COUNSELING_CONTACT||'Nigeria emergency support: dial 112; contact your campus counseling office';
    const response=`I am sorry you are dealing with this. I cannot provide crisis support, but you deserve help from a person right now. Please contact ${contact}. If you may be in immediate danger, contact your local emergency number or go to the nearest emergency department. If possible, tell someone you trust and stay with them.`;
    await pool.query('INSERT INTO chat_messages(userId,sender,content,isCrisisFlagged) VALUES(?,?,?,?)',[userId,'Bot',response,true]);
    return {response,emotion:null,intent:'Crisis',crisis:true};
  }
  const entries=await pool.query('SELECT word,emotion,weight FROM emotion_lexicon');
  const detected=emotionEngine.classify(text,entries[0]); const emotion=detected.emotion, intent=detectIntent(text);
  await pool.query('INSERT INTO chat_messages(userId,sender,content,detectedEmotion,isCrisisFlagged) VALUES(?,?,?,?,?)',[userId,'User',text,emotion,false]);
  let response;
  {
    if(process.env.LLM_API_KEY) {try{response=await llm.generate(text,{emotion,intent});if(response&&!isSafeSupportiveResponse(response))response=null;}catch(error){console.error('Optional LLM request failed; using templates:',error.message);}}
    if(!response) {
      const [rows]=await pool.query('SELECT responseText FROM response_templates WHERE intent=? AND emotion=? LIMIT 1',[intent,emotion]);
      response=rows[0]?.responseText;
      if(response&&!isSafeSupportiveResponse(response))response=null;
      if(!response){const [fallback]=await pool.query('SELECT responseText FROM response_templates WHERE intent=? AND emotion=? LIMIT 1',[intent,'Neutral']);response=fallback[0]?.responseText;}
      if(response&&!isSafeSupportiveResponse(response))response=null;
      response=response||`${supportive(emotion)} You can ask me about your schedule or a study topic.`;
    }
    if(intent==='AskSchedule') {
      const [sessions]=await pool.query("SELECT t.title,ss.scheduledStart FROM study_sessions ss JOIN tasks t ON t.taskId=ss.taskId WHERE t.userId=? AND ss.completed=0 AND ss.scheduledStart>=NOW() ORDER BY ss.scheduledStart LIMIT 3",[userId]);
      response+=sessions.length?` Your next sessions: ${sessions.map(s=>`${s.title} (${new Date(s.scheduledStart).toLocaleString()})`).join('; ')}.`:' I don’t see any upcoming sessions yet; add availability and tasks in the Study Planner to create one.';
    }
  }
  await pool.query('INSERT INTO chat_messages(userId,sender,content,isCrisisFlagged) VALUES(?,?,?,?)',[userId,'Bot',response,false]);
  return {response,emotion,intent,crisis:false};
}
module.exports={respond,detectIntent,detectCrisis,isSafeSupportiveResponse};

