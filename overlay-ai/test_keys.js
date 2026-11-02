const OpenAI = require('openai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

async function testKeys() {
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('Testing OpenAI key...');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5
      });
      console.log('OpenAI OK:', res.choices[0].message.content);
    } catch (err) {
      console.error('OpenAI Error:', err.message);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      console.log('Testing Groq key...');
      const groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5
      });
      console.log('Groq OK:', res.choices[0].message.content);
    } catch (err) {
      console.error('Groq Error:', err.message);
    }
  }
}

testKeys();
