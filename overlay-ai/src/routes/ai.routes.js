const OpenAI = require('openai');

function getAiClient() {
  const grokKey = process.env.GROK_UPLOAD_API_KEY || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('xai-') ? process.env.GROQ_API_KEY : null);
  if (grokKey) {
    return {
      client: new OpenAI({ apiKey: grokKey, baseURL: 'https://api.x.ai/v1', timeout: 60000 }),
      model: 'grok-4.20-0309-non-reasoning'
    };
  }
  const groqKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_') ? process.env.GROQ_API_KEY : null;
  if (groqKey) {
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 60000 }),
      model: 'llama-3.3-70b-versatile'
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 }),
      model: 'gpt-4o-mini'
    };
  }
  return null;
}

function registerAiRoutes(ipcMain) {
  ipcMain.handle('ai-generate-completion', async (event, { systemPrompt, prompt, temperature = 0.4 }) => {
    try {
      const ai = getAiClient();
      if (!ai) throw new Error('No AI API key found.');
      const completion = await ai.client.chat.completions.create({
        model: ai.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature
      });
      return { ok: true, text: completion.choices[0]?.message?.content || '' };
    } catch (err) {
      console.error('[ai.routes] ai-generate-completion error:', err);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = {
  registerAiRoutes
};
