/**
 * AI answer generator using OpenAI GPT.
 * Detects interview questions and generates short answers.
 */

const OpenAI = require('openai');

let openaiClient = null;
let groqClient = null;
let openaiFailed = false;
let groqFailed = false;

let lastLoadedOpenAIKey = null;
let lastLoadedGroqKey = null;

function refreshClients() {
  try {
    const path = require('path');
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
  } catch (e) {
    console.error('[aiAnswerGenerator] Failed to reload .env:', e.message);
  }

  const currentOpenAIKey = process.env.OPENAI_API_KEY;
  if (currentOpenAIKey && currentOpenAIKey !== lastLoadedOpenAIKey) {
    openaiClient = new OpenAI({
      apiKey: currentOpenAIKey,
      timeout: 15000,
      maxRetries: 1,
    });
    lastLoadedOpenAIKey = currentOpenAIKey;
    openaiFailed = false;
    console.log('[aiAnswerGenerator] OpenAI client re-initialized with new key.');
  } else if (!currentOpenAIKey) {
    openaiClient = null;
    lastLoadedOpenAIKey = null;
  }

  const currentGroqKey = process.env.GROQ_API_KEY || process.env.GROK_UPLOAD_API_KEY;
  if (currentGroqKey && currentGroqKey !== lastLoadedGroqKey) {
    const isXai = currentGroqKey.startsWith('xai-');
    groqClient = new OpenAI({
      apiKey: currentGroqKey,
      baseURL: isXai ? 'https://api.x.ai/v1' : 'https://api.groq.com/openai/v1',
      timeout: 30000,
      maxRetries: 1,
    });
    groqClient._isXai = isXai;
    lastLoadedGroqKey = currentGroqKey;
    groqFailed = false;
    console.log(`[aiAnswerGenerator] ${isXai ? 'xAI (Grok)' : 'Groq'} client re-initialized with new key.`);
  } else if (!currentGroqKey) {
    groqClient = null;
    lastLoadedGroqKey = null;
  }
  openaiFailed = false;
  groqFailed = false;
}

// Initial initialization
refreshClients();

const PERSONAL_QUESTION_PATTERN = /\b(?:tell\s+(?:me|us)\s+about\s+(?:your\s*self|yourself|your\s+(?:background|experience|work|projects?|career|schooling|education|college|university|degree|academics|internships?|internship\s+experience|past\s+roles?|journey|strengths|weaknesses))|introduce\s+(?:your\s*self|yourself)|give\s+(?:a\s+)?(?:brief\s+)?(?:intro(?:duction)?|overview\s+of\s+your\s+(?:background|profile|resume|education|schooling|internships?|experience))|walk\s+(?:me|us)\s+through\s+your\s+(?:resume|background|experience|projects?|education|schooling|career|internships?)|what\s+(?:is|are)\s+your\s+(?:experience|background|strengths|weaknesses|skills|projects?|education|educational\s+background|qualifications?|schooling|degrees?|internships?|internship\s+experience|achievements?)|where\s+did\s+you\s+(?:study|graduate|go\s+to\s+school|do\s+your\s+(?:internship|internships|schooling|bachelors?|masters?|degree|college|university))|where\s+do\s+you\s+see\s+(?:your\s*self|yourself)|why\s+should\s+we\s+hire\s+you|why\s+do\s+you\s+want\s+(?:this\s+job|to\s+join|this\s+role)|what\s+projects\s+have\s+you\s+(?:worked\s+on|built|developed|created)|describe\s+your\s+(?:current\s+)?(?:role|project|experience|internship|internships|schooling|education|background|college)|tell\s+me\s+about\s+(?:a|your)\s+(?:project|internship|internships|college|schooling|job|previous\s+company|education)|who\s+are\s+you|about\s+yourself|about\s+your\s+(?:schooling|education|internship|internships|projects?|background|experience))\b/i;

function isPersonalQuestion(question) {
  return PERSONAL_QUESTION_PATTERN.test(String(question || ''));
}

function buildResumeContextPrompt(question, resumeContext) {
  if (!resumeContext) return '';
  let resumeText = resumeContext;
  let profile = {};
  try {
    const parsed = typeof resumeContext === 'string' ? JSON.parse(resumeContext) : resumeContext;
    if (parsed && typeof parsed === 'object') {
      resumeText = parsed.resumeText || (typeof parsed.preview === 'object' ? JSON.stringify(parsed.preview) : '') || '';
      profile = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : (parsed.resumeProfile || {});
    }
  } catch (_) {
    // Backward compatibility for plain resume text
  }

  const profileText = Object.entries(profile)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join('\n');
  const boundedResume = String(resumeText || '').trim().slice(0, 35000);
  const boundedProfile = profileText.slice(0, 15000);
  if (!boundedResume && !boundedProfile) return '';

  const isPersonal = isPersonalQuestion(question);

  if (isPersonal) {
    return `\n\nPERSONAL CANDIDATE RESUME & PROFILE CONTEXT (SOURCE OF TRUTH):
You MUST answer strictly in the FIRST PERSON ("I", "my background", "I completed my schooling/degree at...", "During my internship at...", "In my projects, I built...").
Base your entire answer strictly on the candidate's actual uploaded resume and completed profile form details below:
1. SCHOOLING & EDUCATION: If asked about schooling, college, university, or degrees, state the exact school/college name, degree, branch/major, and graduation year directly from the resume/profile.
2. INTERNSHIPS & WORK EXPERIENCE: If asked about internships or previous companies, describe the exact company names, roles, duration, technologies used, and key accomplishments during those internships from the resume.
3. "TELL ME ABOUT YOURSELF" / INTRODUCTIONS: Deliver a confident, coherent first-person elevator pitch connecting your actual name, educational degree/college, technical stack, internship/work experience, and standout projects from the resume.
4. PROJECTS: Discuss the specific project names, architecture, and tech stack listed in the resume.
5. IDENTITY: Speak as the actual candidate. Never say you are an AI, chatbot, or assistant. Never say "According to the resume". State the candidate's actual details naturally as your own truth. Mention only facts present in the context; do not hallucinate fake institutions or companies.
--- CANDIDATE PROFILE FORM START ---
${boundedProfile || '(No profile form details supplied)'}
--- CANDIDATE PROFILE FORM END ---
--- CANDIDATE RESUME START ---
${boundedResume || '(No resume uploaded)'}
--- CANDIDATE RESUME END ---`;
  }

  return `\n\nCANDIDATE BACKGROUND CONTEXT:\nCandidate profile and skills:\n${boundedProfile ? boundedProfile.slice(0, 1000) : ''}\n${boundedResume ? boundedResume.slice(0, 2000) : ''}`;
}

function getAnswerProvider(panel) {
  refreshClients();

  if (groqClient && !groqFailed) {
    const defaultModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    return { client: groqClient, model: defaultModel };
  }

  if (openaiClient && !openaiFailed) {
    return { client: openaiClient, model: 'gpt-4o-mini' };
  }

  throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
}

function getOcrClientAndModel() {
  if (groqClient && !groqFailed) {
    const defaultModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    return { client: groqClient, model: defaultModel };
  }
  if (openaiClient && !openaiFailed) {
    return { client: openaiClient, model: 'gpt-4o-mini' };
  }
  throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
}

// Patterns that indicate an interview QUESTION (send to OpenAI)
const QUESTION_INDICATORS = [
  /\?$/,                                                    // Ends with ?
  /^(what|how|why|when|where|who|which|can|could|would|do|does|did|is|are|was|were)\b/i,
  /tell me about/i,
  /describe\s/i,
  /explain\s/i,
  /give me an example/i,
  /walk me through/i,
  /talk about/i,
  /tell us about/i,
  /what do you think/i,
  /how would you/i,
  /what's your (experience|approach|opinion)/i,
  /could you (explain|describe|tell)/i,
  /would you (mind|like to)/i,
  /\bfind\b/i,
];

const PURE_FILLER_WORDS = new Set([
  'hello', 'hi', 'hey', 'okay', 'ok', 'yes', 'yeah', 'yep', 'nope', 'no',
  'sure', 'alright', 'right', 'well', 'so', 'and', 'then', 'now', 'perfect',
  'great', 'good', 'fine', 'cool', 'um', 'uh', 'ah', 'oh', 'hmm', 'mhm',
  'huh', 'namaste', 'namaskar', 'namaskaram', 'vanakkam', 'dhanyavad', 'dhanyavadalu',
  'shukriya', 'thanks', 'thank', 'you', 'bye', 'goodbye', 'morning',
  'afternoon', 'evening', 'welcome', 'test', 'testing', 'one', 'two', 'three',
  '1', '2', '3', 'sir', 'maam', "ma'am", 'guys', 'everyone', 'everybody', 'all',
  'there', 'team', 'folks', 'please', 'just', 'like', 'actually', 'basically',
  'really', 'anyway', 'anyways'
]);

function isPureFillerOrGreeting(text) {
  if (!text || typeof text !== 'string') return true;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every(w => PURE_FILLER_WORDS.has(w));
}

// Patterns that indicate NOT a question - do NOT send to OpenAI
const NON_QUESTION_INDICATORS = [
  /^(okay|ok|yes|yeah|yep|sure|alright|right|good|great|nice|thanks|thank you)\s*[,.!?]?\s*$/i,
  /^(uh|um|hmm|well|so|and|but|or)\s*$/i,
  /^(hello|hi|hey|good morning|good afternoon|good evening)\s*[,.!?]?\s*$/i,
  /^(bye|goodbye|see you|thank you for your time)\s*[,.!?]?\s*$/i,
  /^(i see|i understand|got it|makes sense)\s*[,.!?]?\s*$/i,
  /^(go ahead|please continue|carry on)\s*[,.!?]?\s*$/i,
  /^(that's (fine|good|great|interesting))\s*[,.!?]?\s*$/i,
  /^(no problem|of course|absolutely)\s*[,.!?]?\s*$/i,
  /^[a-z]{1,3}\s*$/i,  // Very short single words
];

const STATEMENT_STARTERS = [
  /^(i|im|ive|id|ill|me|my|we|well|weve|were|let me|let's|let us|as a|so i|then i|actually i)\b/i,
  /^(yes|yeah|ok|okay|sure|no|nope|correct|right|exactly|absolutely|fine|thanks|thank you)\b/i,
  /^(in my opinion|from my experience|in my background|usually i|for example|for instance)\b/i,
];

/**
 * Detect if the transcribed text is an interview question worth sending to OpenAI.
 * @param {string} text - Transcribed speech text
 * @returns {boolean}
 */
function isInterviewQuestion(text, isSubSentence = false) {
  if (!text || typeof text !== 'string') return false;

  const Q_STARTERS = /^(who|what|when|where|why|how|which|whose|whom|can|could|would|will|shall|should|is|are|was|were|do|does|did|have|has|qué|quién|cuándo|dónde|por qué|cómo|cuál|puede|que|qui|quand|où|pourquoi|comment|quel|quelle|est-ce|was|wer|wann|wo|warum|wieso|wie|welche|kann|könnte|ist|sind|o que|quem|quando|onde|por que|como|qual|cosa|chi|perché|come|quale|что|кто|когда|где|почему|как|какой|можно|क्या|कौन|कब|कहाँ|कहां|क्यों|कैसे|何|誰|いつ|どこ|なぜ|どう|什么|谁|什么时候|哪里|为什么|怎么|무엇|누가|언제|어디|왜|어떻게|ما|من|متى|أين|لماذا|كيف|هل)(?![\p{L}\p{N}])/iu;

  const CMD_STARTERS = /^(please\s+|kindly\s+)?(introduce|explain|describe|define|elaborate|clarify|summarize|summarise|expand on|tell (me|us)|say (me|to me|us|about)?|mention|state (the|its)?|walk (me|us) through|talk about|give (me|us)|show (me|us)|list|compare|what about|how about|advantages of|disadvantages of|pros and cons|benefits of|features of|explica|explícame|explicame|cuéntame|cuentame|explique|expliquez|décris|décrivez|raconte|erkläre|erklär|beschreibe|erläutere|объясни|расскажи|опиши|समझाओ|समझाइए|समझाइये|बताओ|बताइए|बताइये|説明して|教えて|解释|说明|讲讲|설명해|알려줘|اشرح|وضح|explicar|conte|fale sobre|spiega|spiegami|descrivi|racconta|jelaskan|giải thích|อธิบาย|açıkla|anlat|wyjaśnij|opisz|поясни|vertel|leg uit|förklara|forklar|selitä|εξήγησε|vysvětli|explică|magyarázd)(?![\p{L}\p{N}])/iu;

  const STRONG_QUESTION_CONTAINS = [
    /\b(my question is|have a question|has a question|one question|another question|next question)\b/i,
    /\b(anyone know|anyone knows|can anyone|could anyone|someone explain|anyone explain|explain me|explain to me|explain how|tell me about|walk me through|difference between|differences between)\b/i,
    /\b(what is|what are|why do|why is|why are)\b/i,
    /\bhow\s+(?:to|do|does|did|can|should|would|is|about|many|much|long|often|far)\b/i,
    /\b(in python|in java|in javascript|in c\+\+|in c#|in go|in rust|in typescript)\b/i,
    /\b(write a|write an|code for|code of|function to|program to|algorithm for)\b/i,
    /\bfind\b/i,
    /\b(how would you|what is your approach|what's your approach|how to approach|what is the approach|what's the approach|how to solve|your approach|what approach|which approach|what are the steps)\b/i,
    /\b(explain about|explain the|describe the|talk about)\b/i,
    /\bname\s+(?:three|two|four|five|six|some|any|a|an|the|at\s+least|both|several|different|various)\b/i,
    /\b(say me|say to me|say about|tell me the|advantages of|disadvantages of|pros and cons of|benefits of|features of|limitations of|use cases of|compare both|compare them|compare these|which one is better|which is better|how do they compare|how does that compare)\b/i,
    /(?<![\p{L}\p{N}])((?:my question|have a question|one question|another question|next question)|explain|describe|define|elaborate|clarify|summari[sz]e|tell (me|us)|walk (me|us) through|compare|versus|difference between|meaning of|what('s| is| are| was| were| about| do| does)|why (is|are|do|does|did|not|would|should|can'?t)|how (do|does|did|can|could|should|would|to|much|many)|क्या|कौन|कब|कहाँ|कहां|क्यों|कैसे|समझाо|बताо|объясни|расскажи|почему|explica|explícame|explique|pourquoi|erkläre|erklär|warum|اشرح|لماذا)(?![\p{L}\p{N}])/iu,
    /解释|说明|説明|为什么|什么|なぜ|설명|왜/iu
  ];
  
  // Normalize contractions to expand questions
  let normalized = text
    .replace(/\bwhat's\b/gi, 'what is')
    .replace(/\bwhats\b/gi, 'what is')
    .replace(/\bwho's\b/gi, 'who is')
    .replace(/\bhow's\b/gi, 'how is')
    .replace(/\bwhere's\b/gi, 'where is')
    .replace(/\bwhy's\b/gi, 'why is')
    .replace(/\bit's\b/gi, 'it is')
    .replace(/\bthat's\b/gi, 'that is')
    .replace(/\bthere's\b/gi, 'there is')
    .replace(/\bhere's\b/gi, 'here is');

  const trimmed = normalized.trim().replace(/\s+/g, ' ');
  if (isPureFillerOrGreeting(trimmed)) {
    return false;
  }

  // Reject noise terms (e.g. "WhatsApp", "what app", "whats app")
  const lower = trimmed.toLowerCase();
  if (lower.includes('whatsapp') || lower.includes('what app') || lower.includes('whats app') || lower.includes("what's app") || lower.includes('what up') || lower.includes('whats up') || lower.includes("what's up")) {
    return false;
  }

  // Reject greetings and salutations early, regardless of punctuation
  const GREETINGS_AND_SALUTATIONS = /^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|welcome|alright|ok|okay|so)\s+(?:everyone|everybody|all|guys|team|there|folks|people|sir|ma'am|class|here|now)?\s*[,.!?]?\s*$/i;
  if (GREETINGS_AND_SALUTATIONS.test(trimmed)) {
    return false;
  }

  // Reject reported speech and expectations about questions
  const REPORTED_OR_STATEMENT_PATTERNS = [
    /\b(will|going to|would|could|can|they|he|she|we|i)\s+(?:be\s+)?(ask|asking|expect|expecting)\b/i,
    /\b(expect|expected|expecting|types of|kind of|kinds of|example of|examples of)\s+(?:interview\s+)?(question|questions)\b/i,
    /\b(questions|question)\s+(?:we|they|he|she|you)\s+(?:can|will|should|might|may)\s+expect\b/i,
    /\b(questions|question)\s+(?:they|he|she|we)\s+(?:ask|asks|asking|asked)\b/i,
    /\basking\s+(?:me|us|you|them|him|her)?\s*about\b/i,
    /\bask\s+(?:me|us|you|them|him|her)?\s*about\b/i,
    /\bwant to ask\b/i,
    /\bwants to ask\b/i,
    /\bwanted to ask\b/i
  ];

  if (REPORTED_OR_STATEMENT_PATTERNS.some(p => p.test(trimmed))) {
    // If it contains a very clear, direct question pattern, let it pass so it can be answered
    const hasDirectQuestion = /\b(what is your|what's your|what is|what's|how do you|how does|how to|name\s+(?:three|two|four|five|six|some|any|a|an|the|at\s+least|both|several|different|various))\b/i.test(trimmed);
    if (!hasDirectQuestion) {
      return false;
    }
  }

  if (trimmed.length < 10) return false;  // Too short to be a real question or command

  // Split by sentence delimiters and check if any individual sentence is a question.
  // We do this to ensure that questions embedded in a larger paragraph/statement are not ignored.
  if (!isSubSentence && (trimmed.includes('.') || trimmed.includes('!') || trimmed.includes('?'))) {
    const sentences = trimmed.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 1) {
      for (const s of sentences) {
        if (s.length >= 10 && isInterviewQuestion(s, true)) {
          return true;
        }
      }
    }
  }

  // Strip leading conversational fillers like "ok", "okay", "so", "and", "then", "now", "well", "yeah", "yes", "perfect", "great"
  let cleanTextForCheck = trimmed;
  const fillerRegex = /^(?:okay|ok|yes|yeah|yep|sure|alright|right|well|so|and|then|now|perfect|great|um|uh|hello|hi|hey|good morning|good afternoon|good evening|also|actually|basically|like)\b\s*[,.\-?!:;]*\s*/i;
  let prevText = '';
  while (cleanTextForCheck !== prevText) {
    prevText = cleanTextForCheck;
    cleanTextForCheck = cleanTextForCheck.replace(fillerRegex, '');
  }
  const checkTrimmed = cleanTextForCheck.trim();
  if (isPureFillerOrGreeting(checkTrimmed)) {
    return false;
  }

  // Recheck greetings on the cleaned text to handle double-fillers like "okay hello everyone"
  if (GREETINGS_AND_SALUTATIONS.test(checkTrimmed)) {
    return false;
  }

  if (checkTrimmed.length < 5) return false;

  // Conversational / Clarification Questions to ignore
  const CONVERSATIONAL_QUESTIONS = [
    /\b(are you asking me|did you ask|you asking me)\b/i,
    /\b(can you hear me|am i audible|can you see my screen|is my screen visible)\b/i,
    /\b(can you repeat|could you repeat|did you say|what did you say)\b/i,
    /\b(are we good to (start|go))\b/i,
    /\b(do you have any questions for me|any questions for me)\b/i,
    /\b(are you there|you there)\b/i,
    /\bwhat are (you|u) doing\b/i,
    /\bwhat are (you|u) talking\b/i,
    /\bwhat are (you|u) saying\b/i,
    /\bwhat are (you|u) up to\b/i,
    /^what is (this|that|it)\s*[,.!?]?\s*$/i,
    /\bwhat do (you|u) mean\b/i,
    /^what do (you|u) want\s*[,.!?]?\s*$/i,
    /\bwhat is going on\b/i,
    /\bwhat is happening\b/i,
    /\bcan i work\b/i,
    /\bhow are (you|u)\b/i,
    /\bhow are (you|u) doing\b/i,
    /\bhow is it going\b/i,
    /\bhow's it going\b/i,
    /\bis it working\b/i,
    /^did you get it\s*[,.!?]?\s*$/i,
    /^did you (see|hear)(?: that| it)?\s*[,.!?]?\s*$/i,
    /\bare you (ready|there|okay|ok)\b/i,
    /\bwho are (you|u)\b/i,
    /\bwho is (this|that)\b/i,
    /\bwho's (this|that)\b/i,
    /\bhow is everything\b/i,
    /\bhow is your (day|week)\b/i,
    /\bhow was your (day|week)\b/i,
    /\bare (you|u) (ready|okay|ok)\b/i,
    /\bis everything (ok|okay)\b/i,
    /\bcan we (start|begin)\b/i,
    /\bshall we (start|begin)\b/i,
    /\blet's (start|begin)\b/i,
    /\bhow about (you|u|yourself|urself)\b/i,
    /\bwhat about (you|u|yourself|urself)\b/i,
    /\band (you|u)\b/i,
    /\bnice to meet (you|u)\b/i,
    /\bgood to meet (you|u)\b/i,
    /\bhow do (you|u) do\b/i,
    /\bwhere are (you|u) (from|located|based|calling from)\b/i,
    /\bdo you know\s+(?:the\s+answers?|if|whether)\b/i,
    /\bdo you know\s*$/i,
    /\btell me the (answer|answers)\b/i,
    /\bgive me the (answer|answers)\b/i,
    /\bwhat is the answer\b/i,
    /\bcan you answer\b/i,
    /\bdo you have the answer\b/i,
    /\bany questions\b/i,
    /\bdo you have questions\b/i
  ];

  if (CONVERSATIONAL_QUESTIONS.some((p) => p.test(trimmed))) {
    const hasStrongQuestion = STRONG_QUESTION_CONTAINS.some((p) => p.test(checkTrimmed));
    const isLong = trimmed.length > 40;
    if (!(hasStrongQuestion && isLong)) {
      return false;
    }
  }

  // 1. If it contains a question mark, it's a question!
  if (trimmed.includes('?')) {
    if (isPureFillerOrGreeting(trimmed) || isPureFillerOrGreeting(checkTrimmed)) {
      return false;
    }
    // Exception: check if it's just filler like "yeah?" or "okay?"
    if (trimmed.length < 15 && /^(okay|ok|yeah|yes|right|really)\?$/i.test(trimmed)) {
      return false;
    }
    return true;
  }

  // 3b. If the text has no question mark and is very short (word count < 3):
  // It must contain at least one tech / programming keyword or personal question keyword to be considered a question.
  // Otherwise, it is just a question starter or conversational filler (e.g. "what is", "how to", "explain").
  if (!trimmed.includes('?')) {
    const wordCount = checkTrimmed.split(/\s+/).length;
    if (wordCount < 3) {
      const techKeywords = /\b(python|java|javascript|js|c\+\+|cpp|c#|golang|go|rust|typescript|ts|sql|nosql|react|html|css|node|git|docker|aws|oop|api|rest|json|db|database|code|programming|bug|function|class|method|variable|array|list|map|dict|object|string|integer|float|boolean|loop|recursion|algorithm|sorting|search|binary|tree|stack|queue|hash|index|key|query|table|schema|server|client|network|protocol|thread|process|memory|cpu|disk|cloud|hosting|deploy|commit|push|pull|merge|branch|repo|repository|yourself|myself|background|experience|strengths|weaknesses|resume|profile|intro|introduction|role|overview|projects?)\b/i;
      if (!techKeywords.test(checkTrimmed) && !isPersonalQuestion(checkTrimmed)) {
        return false;
      }
    }
  }

  // 4. Reject known greetings, filler, or short replies first
  if (NON_QUESTION_INDICATORS.some((p) => p.test(checkTrimmed))) {
    return false;
  }

  // 5. Reject statements (candidate speaking or acknowledging) if they don't have a question mark
  const startsWithStatement = STATEMENT_STARTERS.some((p) => p.test(checkTrimmed));
  if (startsWithStatement) {
    const hasStrongQuestion = STRONG_QUESTION_CONTAINS.some((p) => p.test(checkTrimmed));
    if (!hasStrongQuestion) {
      return false;
    }
  }

  // 6. Check if it starts with standard question words (Multi-language!)
  const startsWithQuestionWord = Q_STARTERS.test(checkTrimmed);
  if (startsWithQuestionWord) {
    // If it doesn't end with a question mark, reject statement/relative clause starters
    if (!trimmed.includes('?')) {
      const relativeClauseStarters = [
        /^(what|how|why|when|where|who|which)\s+(?:i|we|you|they|he|she|it|its|it's|my|our|your|their|his|her|first)\b/i,
        /^(what|how|why|when|where|who|which)\s+(?:this|that|these|those)\s+(?:means|is|was|are|were)\b/i,
        /^(what|how|why|when|where|who|which)\s+is\s+(?:going on|happening|needed|required)\b/i,
        /^(what|how|why|when|where|who|which)\s+the\s+\w+\s+(?:does|is|was|are|were|has|have|had)\b/i,
      ];
      if (relativeClauseStarters.some(p => p.test(checkTrimmed))) {
        return false;
      }
      
      // Require at least 2 words for standard question word starts if there is no question mark
      const wordCount = checkTrimmed.split(/\s+/).length;
      if (wordCount < 2) {
        return false;
      }
    }
    return true;
  }

  // 7. Check if it contains strong question/command words anywhere
  if (STRONG_QUESTION_CONTAINS.some((p) => p.test(checkTrimmed))) {
    return true;
  }

  // 8. Check if it starts with interview command prompt words (Multi-language!)
  const startsWithCommand = CMD_STARTERS.test(checkTrimmed);
  if (startsWithCommand) {
    // Make sure it has enough content (e.g. "write code" vs "write a function to reverse a binary tree")
    if (checkTrimmed.split(' ').length >= 2) {
      return true;
    }
  }

  // 9. Check for strong comparison or trade-off indicators
  // For example: "difference between SQL and NoSQL", "pros and cons of REST"
  const hasTradeoffIndicator = /\b(difference between|differences between|compare and contrast|versus|vs|pros and cons|advantages and disadvantages)\b/i.test(checkTrimmed);
  if (hasTradeoffIndicator && checkTrimmed.split(' ').length >= 3) {
    return true;
  }

  return false;
}

/** US English — matches Answer A panel (Suggested Reply): concise, 2-line points matching reference screenshot */
const SYSTEM_PROMPT_A = `You are a seasoned human software engineer answering an interview question directly.
Your response MUST sound 100% human-generated, conversational, and practical. The candidate must be able to read and speak your answer quickly and effortlessly during a live interview.

STRUCTURE AND FORMAT (STRICTLY MATCH THE REFERENCE):
Line 1: Direct one-sentence answer (1 to 2 lines):
Answer: [Direct, clear definition or answer to the question in 1 to 2 lines]

Followed immediately by exactly 2 (or for comparisons 3) clean bullet points, where each point is strictly around 2 lines (20 to 28 words):
• [First key point: primary real-world use cases, practical purpose, or how it works in production (strictly 2 lines, 20-28 words)]
• [Second key point: core technical feature, advantage, or why engineers choose it (strictly 2 lines, 20-28 words)]

FOR COMPARISON / DIFFERENCE QUESTIONS (e.g. "Difference between Python and Java"):
Line 1: Answer: [Direct high-level summary comparing the two subjects in 1 to 2 lines]
• [First subject: its core model, typing, or architecture in 2 lines (20-28 words)]
• [Second subject: its core model, typing, or architecture in 2 lines (20-28 words)]
• [Key practical difference or when to choose which in 2 lines (20-28 words)]

STRICT RULES:
1. POINT LENGTH: Every bullet point must be around 2 lines (20 to 28 words). Never write large, overwhelming paragraphs or long essays. Keep it punchy, clear, and easy to read aloud.
2. ACCURACY & DIRECT RELEVANCE: The answer must perfectly match and directly answer the exact question asked by the interviewer.
3. NO AI CLICHÉS OR CREATOR/HISTORY TRIVIA: Never mention who created the language, library, or tool (e.g. NEVER say "created by Guido van Rossum", "created by Brendan Eich", release years, or Wikipedia trivia). Real engineers never cite creator trivia in interviews.
4. NO MARKDOWN FORMATTING: Do NOT use markdown bold asterisks (**) or headers (###). Present the text cleanly with plain "Answer: ..." on the first line, followed by bullet points starting with "• ".
5. IF FOLLOW-UP OR PRONOUNS: If the question uses pronouns like "it", "this", "both", or "them" (e.g. 'advantages of it', 'difference between both'), resolve the subject from the conversation history and state the subject clearly.
6. IF MATHEMATICAL / QUANTITATIVE: State the calculated answer on line 1 (e.g. "Answer: 8 + 1 = 9"), followed by 1-2 brief 2-line explanation points.
7. IF MULTIPLE QUESTIONS: Provide this exact clean structure for each question asked, separated by a blank line.`;

const SYSTEM_PROMPT_B = `You are a senior software engineer speaking directly to an interviewer, providing a deeper technical response (Go Deeper).
Your response must sound 100% human-generated, professional, and practical (never cite Wikipedia creator trivia like "created by Guido van Rossum").
Rules:
1. Provide a clear, medium-length technical explanation of the concept (around 100 words).
2. If applicable or possible for the question (programming, algorithms, databases, web development, syntax, technical concepts), you MUST provide a clean, practical code snippet demonstrating the concept, labeled under a plain "Code Example:" heading.
3. For non-coding or behavioral questions, provide a concrete real-world scenario example labeled under a plain "Example:" heading.
4. Keep the total explanation and example focused, medium length, and easy to understand (not an overwhelming essay).
5. If the question is a follow-up or uses pronouns/contextual references (e.g., 'say me the advantages of it', 'advantages of it', 'what are its advantages', 'explain its features', 'difference between both', 'difference between them', 'compare both', 'which one is better', 'what about that', 'how to use it', 'why use it'), resolve the subject or subjects from the preceding conversation context in the message history and provide a direct answer naming the subject (e.g. 'Advantages of Python include:...', 'Differences between Python and Java include:...').
6. If the question is a mathematical, arithmetic, or quantitative calculation (e.g., '8 + 1', 'what is 25 * 4'), state the direct calculated answer immediately and concisely on the first line (e.g. '8 + 1 = 9'), followed by the formula and example calculation or code.
7. Do NOT use markdown symbols like asterisks (**) or headers (###). Present text cleanly using plain text with line breaks and indented code where appropriate.
8. If multiple questions are asked, answer each question clearly using a numbered format (e.g., 1., 2.), keeping each explanation to ~100 words with its corresponding code or example.`;

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

/**
 * @param {'a'|'b'} panel
 */
function systemPromptForPanel(panel) {
  if (panel === 'teleprompter') {
    return `You are a helpful interview coach and software engineering assistant with 7-8 years of experience.
Analyze the input text. If the input contains interview questions, you MUST answer EVERY single question asked in the exact sequential order without skipping, merging, or omitting any question.
If the question is a follow-up (e.g., 'difference between both', 'what are its advantages'), resolve the subject from the preceding conversation context in the message history.

You MUST format your output strictly as a sequential numbered list (1., 2., 3., 4., 5., 6., etc.) corresponding to each question asked:
- Provide exactly one cohesive, well-explained paragraph answer (3-5 sentences) for each question.
- If programming code is requested or provided, show the clean code implementation and 1-2 sentence explanation under its corresponding sequential number.
- Do NOT use labels like "A1", "A2", "Answer 1", or "A:". Just use the plain number (e.g., "1.", "2.", "3.", etc.).
- Put clean double line breaks between numbered items so they are clear and easy to read.`;
  }
  return panel === 'b' ? SYSTEM_PROMPT_B : SYSTEM_PROMPT_A;
}

/**
 * Generate a short interview answer using GPT with streaming.
 * Retries on network errors for slow/unstable connections.
 * @param {string} question - The interview question
 * @param {'a'|'b'} panel - Answer A vs B (different system prompts)
 * @param {function(string): void} onChunk - Callback for each streamed chunk
 * @param {function(string): void} onRetry - Callback when retrying (e.g. "Retrying...")
 * @param {string} mode - Mode ('normal', 'improvise', 'example', 'code', 'star', 'design', 'compare')
 * @param {Array} history - Previous questions & answers for conversation context
 * @param {string} resumeContext - Candidate resume or tech background context
 * @param {string} language - Interview language
 * @returns {Promise<string>} - Full generated answer
 */
async function generateAnswer(question, panel, onChunk = null, onRetry = null, mode = 'normal', history = [], resumeContext = '', language = 'en') {
  refreshClients();
  let systemPrompt = systemPromptForPanel(panel);
  let maxTokens = panel === 'b' ? 900 : 700;
  let queryText = question;
  
  const lines = question.split('\n').map(l => l.trim()).filter(Boolean);
  const questionStarters = /(?:^|\s)(?:what|how|why|who|which|can|could|would|explain|describe|tell me|give me|walk me|write|reversing)\b/gi;
  const starterMatches = question.match(questionStarters) || [];
  
  // Detect if input contains programming code
  const hasCodeBlock = /\b(def|class|function|let|const|var|for|while|import|return|print|input|public|static|void|int|double|float|char|string|boolean|lambda)\b/i.test(question) || /[{}[\]()=;:]/.test(question);
  
  const hasQuestions = starterMatches.length > 0 || (question.match(/\?/g) || []).length > 0 || /\b(what|how|why|difference|explain|describe|write)\b/i.test(question);
  const isMultiQuestion = (starterMatches.length > 1 || (question.match(/\?/g) || []).length > 1 || /1\..+2\./.test(question.replace(/\s+/g, ' ')) || lines.length > 1) || (hasCodeBlock && hasQuestions);

  if (panel === 'teleprompter') {
    let sentenceCount = '3-5 sentences';
    let exampleRule = 'Do NOT use the phrase "For example" or write alternative coding examples. Just show the code directly.';
    let answerDescription = 'One cohesive paragraph answer';
    
    if (mode === 'improvise') {
      sentenceCount = '4-6 sentences explaining the concept clearly';
    } else if (mode === 'example') {
      sentenceCount = '4-6 sentences showing a concrete real-world example in practice';
      exampleRule = 'You can use the phrase "For example" to show coding examples.';
      answerDescription = 'One cohesive paragraph showing a concrete example';
    }

    if (isMultiQuestion) {
      maxTokens = 3000;
      queryText = `The user has provided multiple questions or code requests. You MUST answer EVERY question individually and handle any code blocks in sequential order (1., 2., 3., 4., 5., 6., etc.). Do NOT omit, skip, or merge any question.

Input:
${question}

Instructions:
1. Provide a direct, cohesive answer for each question (${sentenceCount}) prefixed with its corresponding number (1., 2., 3., 4., 5., 6., etc.).
2. If code is requested (e.g. "write code for sum of two numbers"), show the clean code block under its corresponding number.
3. Put clean double line breaks between numbered items so they are easy to read.
4. ${exampleRule}`;
    } else {
      queryText = `${question}

Instructions:
1. Provide exactly one medium-sized cohesive paragraph answer (${sentenceCount}). Do NOT split it into multiple paragraphs.
2. If the question in the input has a number prefix (e.g. "1. what is python"), prefix the answer with that exact number. Otherwise, do NOT prepend any number.
3. If code is requested, show the clean code block, explain it in 1-2 sentences.
4. ${exampleRule}`;
    }
  } else {
    if (isMultiQuestion) {
      maxTokens = 3000;
      queryText = `The user has asked multiple questions or provided code. You MUST answer each question individually and handle any code blocks. Do not combine them. Answer them in order, prefixing each answer with its number.

Input:
${question}

Instructions:
1. Provide a clear, separate answer for each question.
2. Prefix each answer with its corresponding number (e.g., "1. [Answer]", "2. [Answer]").
3. Put clean double line breaks between sections so they are easy to read.
4. If code is requested or provided, write clean code blocks.`;
    }
  }

  if (mode === 'improvise') {
    if (panel === 'teleprompter') {
      systemPrompt = `You are a helpful interview coach and software engineering assistant with 7-8 years of experience.
Analyze the input text. If the input contains interview questions, you MUST answer EVERY question in sequential order (1., 2., 3., etc.). Do NOT skip or ignore any question.

Format your output as a sequential numbered list:
- For each question, provide one cohesive paragraph answer (4-6 sentences explaining the concept clearly in US English).
- For coding questions, provide the clean code block under its corresponding number.
- Prefix each answer with its plain sequential number (1., 2., 3., etc.).`;
    } else {
      systemPrompt = `You are an expert interview coach. Give a highly detailed, very lengthy, comprehensive, deeply understanding, and improvised answer to the question. Focus on explaining the "why" and "how" in maximum depth, and write an extensive, thorough response elaborating on key technical trade-offs, architecture, design patterns, and concepts to provide a very large amount of detailed content. Do NOT use markdown formatting symbols such as asterisks (**) or headers (###). Present text cleanly using standard capitalized headings and line breaks, with no markup tags. If multiple questions are asked, you MUST answer each question clearly and in detail, prefixing each answer with its corresponding number (e.g. 1. [Detailed answer for question 1], 2. [Detailed answer for question 2]) with clean line breaks between them.`;
    }
    maxTokens = isMultiQuestion ? 3000 : 1500;
  } else if (mode === 'example') {
    if (panel === 'teleprompter') {
      systemPrompt = `You are a helpful interview coach and software engineering assistant with 7-8 years of experience.
Analyze the input text. If the input contains interview questions, you MUST answer EVERY question in sequential order (1., 2., 3., etc.). Do NOT skip or ignore any question.

Format your output as a sequential numbered list:
- For each question, provide one cohesive paragraph showing a concrete real-world example in practice (4-6 sentences).
- For coding questions, provide the clean code block under its corresponding number.
- Prefix each answer with its plain sequential number (1., 2., 3., etc.).`;
    } else {
      systemPrompt = `You are an expert interview coach. Provide a highly detailed, extensive, step-by-step concrete real-world scenario example that shows a deep understanding of the question. Make it extremely practical, comprehensive, exhaustive, and easy to understand with deep technical details. Do NOT use markdown formatting symbols such as asterisks (**) or headers (###). Present text cleanly using simple line breaks and plain layout. If multiple questions are asked, you MUST provide examples for each of them, prefixing each example with its corresponding number (e.g. 1. [Example for question 1], 2. [Example for question 2]) with clean line breaks between them.`;
    }
    maxTokens = isMultiQuestion ? 3000 : 1500;
  } else if (mode === 'code') {
    if (panel === 'a') {
      systemPrompt = `You are an expert software engineer. Provide ONLY the clean, optimized, production-ready code implementation for the question, followed by a brief 1-2 sentence explanation of the time and space complexity (Big O). Do NOT write any verbose introductory paragraphs or long text explanations. Keep all text extremely minimal and focus almost entirely on presenting the code directly. Do NOT wrap the code in markdown code block backticks (like \`\`\`). Simply write the code directly as raw plain text with proper indentation and line breaks.`;
    } else {
      systemPrompt = `You are an expert software engineer. Provide an alternative clean, optimized, and robust code implementation (e.g. using a different data structure, iterative instead of recursive, or functional style). Include ONLY the code block and a brief 1-2 sentence trade-off analysis. Keep all extra explanation text to a minimum. Do NOT wrap the code in markdown code block backticks (like \`\`\`). Simply write the code directly as raw plain text with proper indentation and line breaks.`;
    }
    maxTokens = isMultiQuestion ? 1500 : 800;
  } else if (mode === 'star') {
    if (panel === 'a') {
      systemPrompt = `You are an expert interview coach. Structure your answer strictly using the STAR method (Situation, Task, Action, Result). You MUST separate each section with double line breaks so they are in completely separate, distinct paragraphs, and start each section on a new line with clear headers in all caps (SITUATION:\n[content]\n\nTASK:\n[content]\n\nACTION:\n[content]\n\nRESULT:\n[content]). Focus on high personal impact, leadership, and quantitative results. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly using plain layout.`;
    } else {
      systemPrompt = `You are an expert interview coach. Structure your answer strictly using the STAR method (Situation, Task, Action, Result). You MUST separate each section with double line breaks so they are in completely separate, distinct paragraphs, and start each section on a new line with clear headers in all caps (SITUATION:\n[content]\n\nTASK:\n[content]\n\nACTION:\n[content]\n\nRESULT:\n[content]). Focus on technical challenges, collaboration, lessons learned, and system impact. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly using plain layout.`;
    }
    maxTokens = isMultiQuestion ? 1500 : 800;
  } else if (mode === 'design') {
    if (panel === 'a') {
      systemPrompt = `You are a principal systems architect. Provide a high-level system design or software architecture response. Focus on component breakdown, data flows, scalability, fault tolerance, API design, database choices, trade-offs, and design patterns. Separate different system layers and components clearly using double line breaks. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly in plain layout.`;
    } else {
      systemPrompt = `You are a principal systems architect. Provide a deep-dive system design or software architecture response. Focus on caching strategies, low latency mechanisms, microservices vs monolith, message queues, database partitioning, trade-offs, and design patterns. Separate different system layers and components clearly using double line breaks. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly in plain layout.`;
    }
    maxTokens = isMultiQuestion ? 1500 : 800;
  } else if (mode === 'compare') {
    if (panel === 'a') {
      systemPrompt = `You are a senior technical interviewer. Provide a comprehensive comparison or difference analysis for the concepts mentioned. Break it down into key dimensions (e.g. Performance, Syntax, Use Cases, Memory) and present the differences side-by-side. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly using plain layout.`;
    } else {
      systemPrompt = `You are a senior technical interviewer. Provide a comprehensive comparison or difference analysis for the concepts mentioned focusing on the underlying memory model, internal execution, and deep technical pros/cons of each approach. Do NOT use markdown asterisks (**) or headers (###). Present text cleanly using plain layout.`;
    }
    maxTokens = isMultiQuestion ? 1500 : 800;
  }

  let providers = [];
  const groqModel = panel === 'b' ? 'openai/gpt-oss-20b' : 'groq/compound-mini';
  if (groqClient && openaiClient) {
    if (openaiFailed) {
      providers = [{ client: groqClient, model: groqModel, name: 'Groq' }];
    } else if (groqFailed) {
      providers = [{ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' }];
    } else {
      providers = [
        { client: groqClient, model: groqModel, name: 'Groq' },
        { client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' }
      ];
    }
  } else if (groqClient && !groqFailed) {
    providers = [{ client: groqClient, model: groqModel, name: 'Groq' }];
  } else if (openaiClient && !openaiFailed) {
    providers = [{ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' }];
  } else {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  // Build full message context with conversation history and candidate resume context
  const resumePrompt = buildResumeContextPrompt(question, resumeContext);
  let languagePrompt = '';
  if (language && language !== 'en') {
    const langNames = {
      te: 'Telugu (తెలుగు)',
      hi: 'Hindi (हिन्दी)',
      ta: 'Tamil (தமிழ்)',
      mr: 'Marathi (मराठी)',
      gu: 'Gujarati (ગુજરાતી)',
      kn: 'Kannada (ಕನ್ನಡ)',
      ml: 'Malayalam (മലയാളം)',
      pa: 'Punjabi (ਪੰਜਾਬੀ)',
      bn: 'Bengali (বাংলা)',
      es: 'Spanish',
      fr: 'French',
      de: 'German'
    };
    const targetLang = langNames[language.toLowerCase()] || language;
    languagePrompt = `\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST provide the response in ${targetLang} language (using clear, natural ${targetLang} script / vocabulary suitable for technical job interviews).`;
  }

  const apiMessages = [
    { role: 'system', content: `${systemPrompt}${resumePrompt}${languagePrompt}` }
  ];

  if (history && Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-6);
    for (const item of recentHistory) {
      if (item && (item.question || item.text)) {
        const qText = (item.question || item.text).trim();
        if (qText && qText !== question.trim()) {
          apiMessages.push({ role: 'user', content: qText });
          const ans = (panel === 'b' ? (item.answerB || item.answer) : (item.answerA || item.answer)) || item.answer;
          if (ans && typeof ans === 'string' && ans.trim()) {
            const snippet = ans.length > 800 ? ans.slice(0, 800) + '...' : ans;
            apiMessages.push({ role: 'assistant', content: snippet.trim() });
          }
        }
      }
    }
  }

  apiMessages.push({ role: 'user', content: queryText });

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const stream = await client.chat.completions.create({
          model: model,
          messages: apiMessages,
          max_tokens: maxTokens,
          temperature: 0.5,
          stream: true,
        });

        let full = '';
        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content ?? '';
          if (content) {
            full += content;
            if (onChunk) onChunk(full);
          }
        }
        return full.trim();
      } catch (err) {
        lastError = err;
        const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
        if (isAuthError) {
          console.warn(`[ai] Provider ${name} failed with auth/key error, trying fallback...`);
          if (name === 'OpenAI') openaiFailed = true;
          if (name === 'Groq') groqFailed = true;
          break; // Try next provider
        }

        const isRetryable = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE|ENETUNREACH|network|fetch|socket hang up/i.test(String(err.message || err));
        if (attempt < MAX_RETRIES && isRetryable) {
          if (onRetry) onRetry(`Retrying (${attempt}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          break; // Try next provider
        }
      }
    }
  }
  throw lastError;
}

/**
 * Extract the active question(s) from OCR text.
 * Uses the active text LLM (Groq llama-3.3-70b-versatile or OpenAI gpt-4o-mini).
 * @param {string} ocrText - Recognized text from the screen
 * @returns {Promise<string>} - The extracted question(s) text
 */
async function extractQuestionFromOcrText(ocrText) {
  if (!ocrText || !ocrText.trim()) return '';

  let providers = [];
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set or working');
  }

  const systemPrompt = `You are a helpful assistant. You will be given OCR text recognized from a user's screen.
Your goal is to look at the OCR text and extract ALL the actual questions/queries that are written on the screen.

Exclude any user interface text from the Teleprompter/Notepad application itself. For example, you MUST ignore:
- "Type a question below or click Capture Background Question to begin"
- "Capture Background Question"
- "Type custom question here"
- "Ask AI", "Clear", "Improvise", "Example"
- Any other button text, titles, or placeholder text from the overlay UI itself.

Exclude any questions or parts of questions that are located in window title bars, browser or editor tab headers (for example, tab names like "what i...", "Untitled", "what is python"), browser URLs, taskbar items, or desktop icon names. Only extract actual questions/queries written inside the main document body, text editor contents, or main page area.
Do NOT construct questions by combining random words from separate desktop icon names or background labels (e.g., if the screen has desktop icons named "What is" and "python" or "Flask", do NOT combine them to extract "what is python"). Only extract questions that are written as continuous, coherent sentences or list items in the main document content.

If the same question appears multiple times on the screen (for example, once in a tab title/header and once in the document body), you MUST deduplicate it and return it only ONCE in the list.

Correct any obvious OCR typos, missing characters, or recognition errors in the questions (for example, if OCR misreads 'javascript' as 'avascri t' or '🗲avascri t', or 'django' as 'djangq', or 'palindrom' as 'alindrom', you MUST correct them to their proper standard spelling like 'javascript', 'django', 'palindrome'). 
When correcting typos, you MUST preserve the original query structure and intent exactly (do NOT change "give me code of..." to "what is..."). Do NOT invent, assume, or add any new questions that were not actually written on the screen (do NOT add "Give me code of an anagram"). Do NOT include any annotations, commentary, or explanation of your corrections (such as "corrected to", "corrected spelling of", or "Note:..."). Just output the final corrected question text directly.

The output MUST contain ONLY the final corrected questions, one per line. Do NOT include any introductory text (like "Here are the questions:"), explanatory text, notes (like "Note: ..."), bullet points, or formatting. You MUST output each question on its own separate line using a newline character. Do NOT join them into a single line or paragraph. If you cannot find any questions, return an empty string.`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the OCR text from the screen:\n\n${ocrText}` },
        ],
        max_tokens: 250,
        temperature: 0.1,
      });

      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      lastError = err;
      console.warn(`[ocr] Provider ${name} failed to extract question:`, err.message);
      const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
      if (isAuthError) {
        if (name === 'OpenAI') openaiFailed = true;
        if (name === 'Groq') groqFailed = true;
      }
      // Try next provider
    }
  }
  throw lastError;
}

/**
 * Generate notes from the transcript in the target language.
 * @param {string} transcript - The transcribed speech text
 * @param {string} spokenLanguage - Spoken language name/code
 * @param {string} targetLanguage - Target notes language name/code
 * @returns {Promise<string>} - Generated notes
 */
async function generateNotes(transcript, spokenLanguage, targetLanguage) {
  refreshClients();
  if (!transcript || !transcript.trim()) {
    return 'No transcript available to generate notes.';
  }

  let providers = [];
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  const systemPrompt = `You are an expert AI meeting assistant and note taker.
Your job is to read the transcript of what was spoken and generate concise, professional meeting notes completely in "${targetLanguage}".
CRITICAL INSTRUCTIONS:
1. Do NOT output "You:", "Speaker:", "Interviewer:", or conversational filler (such as "hi", "okay", "what happened").
2. Do NOT output raw transcript lines.
3. Generate structured bullet points completely in "${targetLanguage}" summarizing key discussion topics, decisions, and technical updates.`;

  const queryText = `Spoken Language: ${spokenLanguage}
Target Notes Language: ${targetLanguage}

Transcript:
${transcript}

Generate professional meeting notes completely in ${targetLanguage}:`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: queryText },
          ],
          max_tokens: 1500,
          temperature: 0.5,
        });

        return response.choices?.[0]?.message?.content?.trim() || '';
      } catch (err) {
        lastError = err;
        const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
        if (isAuthError) {
          if (name === 'OpenAI') openaiFailed = true;
          if (name === 'Groq') groqFailed = true;
          break;
        }

        const isRetryable = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE|ENETUNREACH|network|fetch|socket hang up/i.test(String(err.message || err));
        if (attempt < MAX_RETRIES && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          break;
        }
      }
    }
  }

  // Direct Groq fetch fallback to guarantee 100% LLM note generation with zero raw transcript fallback
  try {
    const fallbackKey = process.env.GROQ_API_KEY || '';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fallbackKey}`
      },
      body: JSON.stringify({
        model: 'groq/compound-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: queryText }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });
    const data = await res.json();
    if (res.ok && data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    }
  } catch (e) {
    console.error('[aiAnswerGenerator] Direct Groq fetch fallback error:', e.message);
  }

  throw lastError || new Error('Failed to generate LLM notes');
}

/**
 * Generate constructive feedback from the transcript in the target language.
 * @param {string} transcript - The transcribed speech text
 * @param {string} spokenLanguage - Spoken language name/code
 * @param {string} targetLanguage - Target notes language name/code
 * @returns {Promise<string>} - Generated feedback
 */
async function generateFeedback(transcript, spokenLanguage, targetLanguage) {
  refreshClients();
  if (!transcript || !transcript.trim()) {
    return 'No transcript available to generate feedback.';
  }

  let providers = [];
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  const systemPrompt = `You are an expert interview coach.
Analyze the transcript of the user's speech (spoken in "${spokenLanguage}").
Provide constructive feedback with Key Strengths and Areas to Improve in "${targetLanguage}".
Do NOT use asterisks (**) or markdown headers with hashes (###) if they break plain layout. Present the feedback clearly using standard plain text layout.`;

  const queryText = `Here is the transcript of the user's speech:\n\n${transcript}\n\nPlease analyze it and return the feedback in "${targetLanguage}".`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: queryText },
          ],
          max_tokens: 800,
          temperature: 0.5,
        });

        return response.choices?.[0]?.message?.content?.trim() || '';
      } catch (err) {
        lastError = err;
        const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
        if (isAuthError) {
          if (name === 'OpenAI') openaiFailed = true;
          if (name.includes('Gro') || name.includes('xAI')) groqFailed = true;
          break;
        }

        const isRetryable = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE|ENETUNREACH|network|fetch|socket hang up/i.test(String(err.message || err));
        if (attempt < MAX_RETRIES && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}

/**
 * Generate structured meeting summary notes from the transcript in the target language.
 * @param {string} transcript - The transcribed speech text
 * @param {string} spokenLanguage - Spoken language name/code
 * @param {string} targetLanguage - Target notes language name/code
 * @returns {Promise<string>} - Generated structured meeting summary notes
 */
async function generateAiNotes(transcript, spokenLanguage, targetLanguage) {
  refreshClients();
  if (!transcript || !transcript.trim()) {
    return 'No transcript available to generate AI notes.';
  }

  let providers = [];
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  const systemPrompt = `You are an expert AI secretary and meeting assistant.
Your goal is to analyze the meeting transcript and generate structured, comprehensive meeting notes.
The transcript was spoken in "${spokenLanguage}".
You MUST generate the notes completely in "${targetLanguage}".

Please structure the notes with the following sections:
1. Executive Summary: A high-level overview of what was discussed.
2. Key Points & Details: A detailed bulleted list of the main points, concepts, and details mentioned.
3. Summary of QA / Discussion: A summary of any discussions held, questions asked, or self-directed statements.
4. Action Items & Next Steps: A list of any proposed tasks, decisions, or action items discussed.`;

  const queryText = `Here is the transcript of what was spoken:\n\n${transcript}\n\nPlease generate the structured meeting notes in "${targetLanguage}".`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: queryText },
          ],
          max_tokens: 1500,
          temperature: 0.5,
        });

        return response.choices?.[0]?.message?.content?.trim() || '';
      } catch (err) {
        lastError = err;
        const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
        if (isAuthError) {
          if (name === 'OpenAI') openaiFailed = true;
          if (name.includes('Gro') || name.includes('xAI')) groqFailed = true;
          break;
        }

        const isRetryable = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE|ENETUNREACH|network|fetch|socket hang up/i.test(String(err.message || err));
        if (attempt < MAX_RETRIES && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}

/**
 * Extract active question(s) or code block from OCR text for Teleprompter.
 * Uses the active text LLM (Groq llama-3.3-70b-versatile or OpenAI gpt-4o-mini).
 * @param {string} ocrText - Recognized text from the screen
 * @returns {Promise<string>} - The extracted question(s) or code text
 */
async function extractQuestionOrCodeFromOcrText(ocrText) {
  if (!ocrText || !ocrText.trim()) return '';

  let providers = [];
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set or working');
  }

  const systemPrompt = `You are an expert OCR text extraction assistant. You will be given raw OCR text recognized from a user's screen.
Your goal is to extract ALL interview questions, tasks, prompts, or existing code blocks visible on the screen.

Rules:
1. Extract EVERY single question or task written on the screen in sequential numbered order (e.g., 1., 2., 3., 4., 5., 6., etc.). Do NOT skip, drop, or merge any question.
2. Carefully repair any OCR artifacts, typos, or split numbering (for example, if OCR reads "coc what is tuple" or split numbers like "6." on adjacent lines, reconstruct it properly as "6. What is a tuple?").
3. Do NOT generate answers or code solutions during this extraction step. If a question says "write the code for...", output the question itself as a numbered prompt. Do NOT generate code for it.
4. If there is an existing code snippet already written on the screen to be reviewed or analyzed, extract that code block.
5. Exclude UI elements, button names, window titles, tabs, or system clock text.
6. Output only the clean extracted list of questions / code directly, with no introductory or concluding text.`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model, name } = provider;
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the OCR text from the screen:\n\n${ocrText}` },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      lastError = err;
      console.warn(`[ocr-tele] Provider ${name} failed:`, err.message);
      const isAuthError = err.status === 401 || err.status === 429 || /key|auth|unauthorized|api_key|quota|exceeded|billing/i.test(err.message || '');
      if (isAuthError) {
        if (name === 'OpenAI') openaiFailed = true;
        if (name.includes('Gro') || name.includes('xAI')) groqFailed = true;
      }
    }
  }
  throw lastError;
}

/**
 * Generate AI reply for Notetaker chat input, using conversation history.
 * @param {string} message - Current message
 * @param {Array} history - Array of { sender, text } chat messages
 * @returns {Promise<string>} - AI response text
 */
async function generateNotetakerChatReply(message, history) {
  refreshClients();
  if (!message || !message.trim()) return '';

  let providers = [];
  if (groqClient && !groqFailed) {
    const groqModel = groqClient._isXai ? 'grok-4.20-0309-non-reasoning' : 'llama-3.3-70b-versatile';
    providers.push({ client: groqClient, model: groqModel, name: groqClient._isXai ? 'xAI Grok' : 'Groq' });
  }
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  const systemPrompt = `You are a helpful AI Interview Copilot. The user is in the middle of a job interview or preparing for one. Answer their question or request clearly, concisely, and professionally to help them succeed. Do not use markdown formatting like asterisks (**) or hashes (###). Present text cleanly in plain layout.`;

  const apiMessages = [
    { role: 'system', content: systemPrompt }
  ];

  if (history && Array.isArray(history)) {
    // Take last 10 messages to keep context window small but sufficient
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.sender === 'user') {
        apiMessages.push({ role: 'user', content: msg.text });
      } else if (msg.sender === 'ai') {
        apiMessages.push({ role: 'assistant', content: msg.text });
      }
    });
  }

  apiMessages.push({ role: 'user', content: message });

  let lastError = null;
  for (const provider of providers) {
    const { client, model } = provider;
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 600,
      });
      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Translate text segment from one language to another.
 * @param {string} text - Segment of text
 * @param {string} fromLanguage - Source language
 * @param {string} toLanguage - Target language
 * @returns {Promise<string>} - Translated text
 */
function getLanguageCode(langName) {
  if (!langName) return 'en';
  const name = langName.toLowerCase().trim();
  if (name.includes('english')) return 'en';
  if (name.includes('hindi')) return 'hi';
  if (name.includes('telugu')) return 'te';
  if (name.includes('tamil')) return 'ta';
  if (name.includes('marathi')) return 'mr';
  if (name.includes('gujarati')) return 'gu';
  if (name.includes('kannada')) return 'kn';
  if (name.includes('malayalam')) return 'ml';
  if (name.includes('punjabi')) return 'pa';
  if (name.includes('bengali')) return 'bn';
  if (name.includes('spanish')) return 'es';
  if (name.includes('french')) return 'fr';
  if (name.includes('german')) return 'de';
  if (name.includes('italian')) return 'it';
  if (name.includes('portuguese')) return 'pt';
  if (name.includes('russian')) return 'ru';
  if (name.includes('chinese')) return 'zh';
  if (name.includes('japanese')) return 'ja';
  if (name.includes('korean')) return 'ko';
  return 'en';
}

function mapToSarvamLangCode(langName) {
  const code = getLanguageCode(langName);
  return `${code}-IN`;
}

async function translateText(text, fromLanguage, toLanguage, engine = 'google') {
  if (!text || !text.trim()) return '';
  if (fromLanguage === toLanguage) return text;

  const selectedEngine = engine || 'google';

  if (selectedEngine === 'google') {
    try {
      const sl = getLanguageCode(fromLanguage);
      const tl = getLanguageCode(toLanguage);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const translated = json[0].map(x => x[0]).join('');
        if (translated) return translated;
      }
    } catch (err) {
      console.error('[Google Translation] failed:', err.message);
    }
  }

  if (selectedEngine === 'sarvam') {
    try {
      const sl = mapToSarvamLangCode(fromLanguage);
      const tl = mapToSarvamLangCode(toLanguage);
      const apiKey = process.env.SARVAM_API_KEY || 'sk_9y0xx8c7_f48eRnJp5MD5laaQOVJWb1Yy';
      const res = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey
        },
        body: JSON.stringify({
          input: text,
          source_language_code: sl,
          target_language_code: tl,
          model: 'mayura:v1'
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.translated_text) {
          return json.translated_text;
        }
      } else {
        const errorText = await res.text();
        console.error('[Sarvam API] request failed with status:', res.status, errorText);
      }
    } catch (err) {
      console.error('[Sarvam Translation] failed:', err.message);
    }
  }

  // Fallback to OpenAI / Groq (Deepgram / default translation)
  let providers = [];
  if (groqClient && !groqFailed) {
    providers.push({ client: groqClient, model: 'llama-3.3-70b-versatile', name: 'Groq' });
  }
  if (openaiClient && !openaiFailed) {
    providers.push({ client: openaiClient, model: 'gpt-4o-mini', name: 'OpenAI' });
  }

  if (providers.length === 0) {
    throw new Error('Neither GROQ_API_KEY nor OPENAI_API_KEY environment variable is set');
  }

  const systemPrompt = `You are a professional real-time translator.
Translate the input text from "${fromLanguage}" to "${toLanguage}".
Output ONLY the final translated text. Do NOT include any explanations, notes, metadata, or extra characters. Maintain the original capitalization, formatting, and tone exactly.`;

  let lastError = null;
  for (const provider of providers) {
    const { client, model } = provider;
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Validates if the text is a valid interview question or a block of programming code.
 * @param {string} text - The input text to check.
 * @returns {boolean}
 */
function isQuestionOrCode(text) {
  if (!text || !text.trim()) return false;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('whatsapp') || lower.includes('what app') || lower.includes('whats app') || lower.includes("what's app") || lower.includes('what up') || lower.includes('whats up') || lower.includes("what's up")) {
    return false;
  }

  // 1. If it's a valid interview question
  if (isInterviewQuestion(text)) {
    return true;
  }

  // 2. Check if it contains a block of programming code
  const codeIndicators = [
    /\b(def|class|import|function|const|let|var|return|public|private|void|static|struct|package|namespace)\b/,
    /[\{\}\[\]\(\)]/,
    /\b(print|console\.log|sys\.stdout|printf)\b/,
    /=/,
    /(\n|\r)/, // Multiple lines
  ];

  // If it has multiple lines and code keywords, count as code
  const hasMultipleLines = trimmed.includes('\n');
  const matchCount = codeIndicators.filter(regex => regex.test(trimmed)).length;

  if (hasMultipleLines && matchCount >= 2) {
    return true;
  }

  // If it is a single-line coding statement
  if (matchCount >= 3) {
    return true;
  }

  return false;
}

module.exports = {
  isInterviewQuestion,
  isQuestionOrCode,
  isPersonalQuestion,
  buildResumeContextPrompt,
  generateAnswer,
  extractQuestionFromOcrText,
  extractQuestionOrCodeFromOcrText,
  generateNotes,
  generateFeedback,
  generateAiNotes,
  generateNotetakerChatReply,
  translateText,
};
