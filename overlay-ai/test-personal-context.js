const { generateAnswer, isPersonalQuestion } = require('./src/aiAnswerGenerator');

async function testPersonalQuestions() {
  console.log('--- Testing Personal Question Recognition & Candidate Context ---');
  
  const personalQuestions = [
    'Tell me about yourself.',
    'introduce yourself',
    'walk me through your resume',
    'what is your background and experience',
    'tell me about your schooling',
    'tell me about your education',
    'where did you study',
    'tell me about your internship',
    'describe your internship experience',
    'what projects have you worked on'
  ];

  for (const q of personalQuestions) {
    console.log(`isPersonalQuestion("${q}") ->`, isPersonalQuestion(q));
  }

  const sampleResumeContext = JSON.stringify({
    profile: {
      name: 'Alex Mercer',
      role: 'Full Stack Developer',
      professionalSummary: 'Software engineer specializing in React, Node.js, and cloud architecture.',
      skills: 'JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, AWS',
      experience: 'Software Engineering Intern at TechCorp (Summer 2023): Built real-time analytics dashboards using React and Node.js. Optimized SQL queries improving load time by 35%.',
      education: 'B.Tech in Computer Science from State University (2020-2024, GPA: 3.8/4.0). High School from St. Xavier School (2018-2020, 92%).',
      projects: 'E-commerce Microservices Platform: Architected high-throughput checkout service using Node.js, Kafka, and Redis.'
    },
    resumeText: 'Alex Mercer - Full Stack Developer\nEducation: B.Tech CS at State University (2020-2024), St. Xavier School (2018-2020)\nInternship: Software Engineering Intern at TechCorp (Summer 2023)\nProjects: E-commerce Platform with Node.js and Redis.'
  });

  console.log('\n--- Test 1: "Tell me about your schooling" (Answer A) ---');
  try {
    const answerSchooling = await generateAnswer('Tell me about your schooling and education background.', 'a', null, null, 'normal', [], sampleResumeContext);
    console.log(answerSchooling);

    console.log('\n--- Test 2: "Tell me about your internship" (Answer B) ---');
    const answerInternship = await generateAnswer('Tell me about your internship experience.', 'b', null, null, 'normal', [], sampleResumeContext);
    console.log(answerInternship);

    console.log('\n--- Test 3: "Tell me about yourself" (Answer A) ---');
    const answerIntro = await generateAnswer('Tell me about yourself.', 'a', null, null, 'normal', [], sampleResumeContext);
    console.log(answerIntro);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testPersonalQuestions();

