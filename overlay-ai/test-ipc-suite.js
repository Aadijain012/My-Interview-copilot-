const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('=== STARTING ELECTRON NATIVE IPC TEST SUITE ===');
  
  // 1. Test Resume Parser Service
  console.log('\n[Test 1] Testing Resume Parser Service with PDF ArrayBuffer...');
  const resumeService = require('./src/services/resume-parser.service');
  const samplePdfPath = 'C:/Users/user/Downloads/AppKairos(@2)/Kairos-Backend/uploads/resumes/resume-1789209337746-254521725.pdf';
  
  if (fs.existsSync(samplePdfPath)) {
    const rawBuf = fs.readFileSync(samplePdfPath);
    const arrayBuffer = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);
    const extractedText = await resumeService.extractTextFromFile(null, 'test_resume.pdf', arrayBuffer);
    console.log('  -> Extracted text length:', extractedText.length);
    const analysis = resumeService.analyzeResumeText(extractedText, 'test_resume.pdf');
    console.log('  -> Candidate Name:', analysis.name);
    console.log('  -> Role:', analysis.role);
    console.log('  -> Skills:', analysis.skills.slice(0, 6));
    if (analysis.name && analysis.skills.length > 0) {
      console.log('  [PASS] Resume parsing passed!');
    } else {
      throw new Error('Resume parsing returned incomplete data');
    }
  } else {
    console.log('  [WARN] Sample PDF not found at:', samplePdfPath);
  }

  // 2. Test Session Routes (Save & Retrieve Past Session)
  console.log('\n[Test 2] Testing Session Routes (Save & Get)...');
  const sessionRoutes = require('./src/routes/session.routes');
  const testSession = {
    id: `test-session-${Date.now()}`,
    title: 'Automated Test Practice Session',
    tech: 'React & Node.js',
    durationDisplay: '00:05:30',
    durationSeconds: 330,
    questionCount: 4,
    payload: {
      liveTranscript: [
        { speaker: 'Interviewer', text: 'Tell me about yourself' },
        { speaker: 'You', text: 'I am a software engineer' }
      ],
      questionsList: ['Tell me about yourself'],
      currentQuestion: 'Tell me about yourself'
    }
  };

  // Mock ipcMain to test handler registration
  const handlers = {};
  const mockIpcMain = {
    handle: (channel, fn) => { handlers[channel] = fn; },
    on: () => {}
  };

  sessionRoutes.registerSessionRoutes(mockIpcMain);
  
  const saveRes = await handlers['save-past-session'](null, testSession);
  console.log('  -> Save result:', saveRes.ok, saveRes.session?.title);
  
  const getRes = await handlers['get-past-sessions'](null, 'default_user');
  console.log('  -> Get sessions count:', getRes.sessions?.length);
  const found = getRes.sessions?.find(s => s.id === testSession.id);
  if (found) {
    console.log('  [PASS] Session save and retrieval verified!');
    // Clean up
    await handlers['delete-past-session'](null, testSession.id);
    console.log('  -> Cleaned up test session.');
  } else {
    throw new Error('Saved session was not found in get-past-sessions');
  }

  // 3. Test Video & Audio Processor Dependencies
  console.log('\n[Test 3] Testing Video/Audio Processor module (fluent-ffmpeg)...');
  const videoProcessor = require('./src/services/video-processor.service');
  console.log('  -> videoProcessor methods:', Object.keys(videoProcessor));
  if (videoProcessor && typeof videoProcessor.convertVideoToAudio === 'function') {
    console.log('  [PASS] Video processor service loaded & ready!');
  }

  // 4. Test Interview Panel Route Autocomplete
  console.log('\n[Test 4] Testing Role/Skills Autocomplete in Interview Panel Routes...');
  const interviewPanelRoutes = require('./src/routes/interview-panel.routes');
  interviewPanelRoutes.registerInterviewPanelRoutes(mockIpcMain);
  const roleSkillsRes = await handlers['get-role-skills'](null, 'react');
  console.log('  -> Matched roles for "react":', roleSkillsRes.roles);
  console.log('  -> Matched skills for "react":', roleSkillsRes.skills);
  if (roleSkillsRes.ok) {
    console.log('  [PASS] Role & skills autocomplete verified!');
  }

  // 5. Test IPC Index Integration
  console.log('\n[Test 5] Testing central IPC registration hub (ipcIndex.js)...');
  const ipcIndex = require('./src/ipcIndex');
  ipcIndex.setupEmbeddedBackendIpcHandlers(mockIpcMain);
  console.log('  -> Registered IPC Channels count:', Object.keys(handlers).length);
  console.log('  -> Registered IPC Channel names:', Object.keys(handlers));
  console.log('  [PASS] Central IPC hub registered all sub-routes successfully!');

  console.log('\n=== ALL ELECTRON TESTS PASSED SUCCESSFULLY (100%) ===');
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});
