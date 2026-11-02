'use strict';

const OpenAI = require('openai');

function getAvailableAiClients() {
  const clients = [];

  try {
    const path = require('path');
    const dotenv = require('dotenv');
    const envCandidates = [
      path.join(__dirname, '../.env'),
      path.join(__dirname, '../../.env'),
      path.join(__dirname, '../../../.env')
    ];
    for (const cand of envCandidates) {
      try {
        dotenv.config({ path: cand, override: false });
      } catch (_) {}
    }
  } catch (_) {}

  // 1. xAI Grok
  const grokKey = process.env.GROK_UPLOAD_API_KEY || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('xai-') ? process.env.GROQ_API_KEY : null) || (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('xai-') ? process.env.OPENAI_API_KEY : null);
  if (grokKey) {
    clients.push({
      name: 'Grok',
      client: new OpenAI({ apiKey: grokKey, baseURL: 'https://api.x.ai/v1', timeout: 45000, maxRetries: 2 }),
      model: 'grok-4.20-0309-non-reasoning'
    });
  }

  // 2. Groq Cloud
  const groqKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_') ? process.env.GROQ_API_KEY : null;
  if (groqKey) {
    clients.push({
      name: 'Groq',
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 45000, maxRetries: 2 }),
      model: 'llama-3.3-70b-versatile'
    });
  }

  // 3. OpenAI GPT
  const openaiKey = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('xai-') && !process.env.OPENAI_API_KEY.startsWith('gsk_') ? process.env.OPENAI_API_KEY : null;
  if (openaiKey) {
    clients.push({
      name: 'OpenAI',
      client: new OpenAI({ apiKey: openaiKey, timeout: 45000, maxRetries: 2 }),
      model: 'gpt-4o-mini'
    });
  }

  return clients;
}

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  tr: 'Turkish',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  ta: 'Tamil',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  de: 'German'
};

function resolveLanguageName(codeOrName) {
  if (!codeOrName) return 'English';
  const norm = String(codeOrName).trim();
  const lower = norm.toLowerCase();
  if (LANGUAGE_NAMES[lower]) return LANGUAGE_NAMES[lower];
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    if (name.toLowerCase() === lower) return name;
  }
  return norm;
}

/**
 * Parses numbered lines from LLM output (e.g. "1. Hello\n2. World")
 * Guarantees exact count matching expectedCount.
 */
function parseNumberedLines(rawText, expectedCount) {
  if (!rawText) return null;
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const result = [];
  const isNumbered = lines.some(l => /^\d+[.)]/.test(l));

  for (let i = 0; i < expectedCount; i++) {
    const num = i + 1;
    if (isNumbered) {
      const targetPrefix = new RegExp(`^${num}[.)]\\s*(.*)$`);
      const found = lines.find(l => targetPrefix.test(l));
      if (found) {
        const match = found.match(targetPrefix);
        result.push(match[1].trim());
      } else {
        result.push(lines[i] ? lines[i].replace(/^\d+[.)]\s*/, '').trim() : '');
      }
    } else {
      result.push(lines[i] ? lines[i].trim() : '');
    }
  }

  return result;
}

/**
 * Translates a single batch of numbered utterances.
 * Tries available LLM providers in order.
 */
async function translateBatch(batch, targetLangName) {
  if (!batch || batch.length === 0) return [];
  const numbered = batch.map((u, i) => `${i + 1}. ${(u.text || '').replace(/\r?\n+/g, ' ').trim()}`).join('\n');
  const systemPrompt = `You are an expert multilingual translator. Translate each numbered dialogue line into ${targetLangName} accurately, fluently and naturally.
Preserve the exact line numbering:
1. [translated line 1]
2. [translated line 2]
Do NOT skip any numbers. Output ONLY the numbered translated lines. No explanations, no markdown headers or bullet points.`;

  const clients = getAvailableAiClients();

  for (const prov of clients) {
    try {
      const res = await prov.client.chat.completions.create({
        model: prov.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: numbered }
        ],
        temperature: 0.2
      });
      const raw = res.choices?.[0]?.message?.content?.trim();
      const parsed = parseNumberedLines(raw, batch.length);
      if (parsed && parsed.length === batch.length && parsed.some(t => t.length > 0)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[translation.service] ${prov.name} batch failed: ${err.message}`);
    }
  }

  // Fallback: preserve original text so pipeline never crashes
  return batch.map(u => u.text || '');
}

/**
 * Translates an array of utterance objects with concurrency and live progress updates.
 */
async function translateUtterances(utterances, targetLangName, onProgress = null) {
  if (!utterances || utterances.length === 0) return [];
  const BATCH_SIZE = 12;
  const CONCURRENCY = 4;

  const batches = [];
  for (let i = 0; i < utterances.length; i += BATCH_SIZE) {
    batches.push({
      startIndex: i,
      items: utterances.slice(i, i + BATCH_SIZE)
    });
  }

  const translatedUtterances = new Array(utterances.length);
  let completedCount = 0;

  for (let b = 0; b < batches.length; b += CONCURRENCY) {
    const chunkOfBatches = batches.slice(b, b + CONCURRENCY);
    await Promise.all(chunkOfBatches.map(async (batchObj) => {
      const { startIndex, items } = batchObj;
      const translatedTexts = await translateBatch(items, targetLangName);

      for (let j = 0; j < items.length; j++) {
        translatedUtterances[startIndex + j] = {
          ...items[j],
          text: translatedTexts[j] || items[j].text || ''
        };
      }

      completedCount += items.length;
      if (typeof onProgress === 'function') {
        const percent = Math.min(100, Math.round((completedCount / utterances.length) * 100));
        onProgress(percent, completedCount, utterances.length);
      }
    }));
  }

  return translatedUtterances;
}

/**
 * Translates a single raw text string by splitting into manageable sentences.
 */
async function translateText(text, targetLangName) {
  if (!text || !text.trim()) return '';
  const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 50) {
    const dummyUtterances = sentences.map((s, i) => ({ text: s }));
    const translated = await translateBatch(dummyUtterances, targetLangName);
    return translated.join(' ');
  }

  const dummyUtterances = sentences.map((s, i) => ({ text: s }));
  const translatedUtterances = await translateUtterances(dummyUtterances, targetLangName);
  return translatedUtterances.map(u => u.text).join(' ');
}

/**
 * Full Pipeline: Translates both transcript and utterances.
 * Supports both object signature ({ transcript, utterances, ... }) and positional signature (transcript, utterances, langName).
 */
async function translateTranscriptAndUtterances(arg1, arg2, arg3, arg4) {
  let transcript = '';
  let utterances = [];
  let targetLanguage = 'English';
  let targetLangName = '';
  let onProgress = null;

  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    transcript = arg1.transcript || '';
    utterances = arg1.utterances || [];
    targetLanguage = arg1.targetLanguage || arg1.targetLangName || 'English';
    targetLangName = arg1.targetLangName || '';
    onProgress = arg1.onProgress || null;
  } else {
    transcript = typeof arg1 === 'string' ? arg1 : '';
    utterances = Array.isArray(arg2) ? arg2 : [];
    targetLanguage = typeof arg3 === 'string' ? arg3 : (typeof arg4 === 'string' ? arg4 : 'English');
    targetLangName = typeof arg3 === 'string' ? arg3 : '';
    onProgress = typeof arg4 === 'function' ? arg4 : null;
  }

  const resolvedName = targetLangName || resolveLanguageName(targetLanguage);
  console.log(`[translation.service] Starting translation into "${resolvedName}" for ${utterances.length} utterances...`);
  const t0 = Date.now();

  let finalUtterances = [];
  let finalText = '';

  if (Array.isArray(utterances) && utterances.length > 0) {
    finalUtterances = await translateUtterances(utterances, resolvedName, onProgress);
    finalText = finalUtterances.map(u => u.text).filter(Boolean).join(' ');
  } else if (transcript && transcript.trim()) {
    finalText = await translateText(transcript, resolvedName);
    const sentences = finalText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    let timeOffset = 1;
    finalUtterances = sentences.map((s, idx) => {
      const mins = Math.floor(timeOffset / 60);
      const secs = timeOffset % 60;
      const turnObj = {
        id: idx + 1,
        speaker: 'Speaker 1',
        timecode: `${mins}:${secs < 10 ? '0' : ''}${secs}`,
        start: timeOffset,
        end: timeOffset + 3,
        text: s.trim()
      };
      timeOffset += Math.max(3, Math.min(8, Math.round(s.split(' ').length * 0.4)));
      return turnObj;
    });
  }

  console.log(`[translation.service] Completed translation into "${resolvedName}" in ${Date.now() - t0}ms.`);
  return {
    translatedText: finalText,
    translatedUtterances: finalUtterances
  };
}

module.exports = {
  LANGUAGE_NAMES,
  resolveLanguageName,
  parseNumberedLines,
  translateBatch,
  translateUtterances,
  translateText,
  translateTranscriptAndUtterances
};
