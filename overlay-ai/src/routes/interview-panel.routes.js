const fs = require('fs');
const resumeService = require('../services/resume-parser.service');

const TECH_TAXONOMY = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', '.NET', 'Go', 'Golang',
  'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Dart', 'R', 'SQL', 'PL/SQL',
  'HTML', 'CSS', 'Tailwind CSS', 'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Redux',
  'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB', 'SQLite', 'Prisma',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'CI/CD', 'Git', 'GitHub',
  'Kafka', 'RabbitMQ', 'GraphQL', 'REST APIs', 'Microservices', 'System Design',
  'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'LLMs', 'Gen-AI',
  'Data Structures', 'Algorithms', 'Agile', 'Scrum'
];

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Fullstack Engineer',
  'Java Developer', 'Python Developer', 'DevOps Engineer',
  'Data Engineer', 'Machine Learning Engineer', 'Cloud Architect',
  'Software Engineer', 'React Developer', 'Node.js Developer'
];

function getRoleSkillsData(query = '') {
  const q = String(query || '').toLowerCase().trim();
  const matchedRoles = ROLES.filter(r => !q || r.toLowerCase().includes(q));
  const matchedSkills = TECH_TAXONOMY.filter(s => !q || s.toLowerCase().includes(q));
  return { ok: true, roles: matchedRoles, skills: matchedSkills };
}

function registerInterviewPanelRoutes(ipcMain) {
  // Parse Resume File (PDF, DOCX, DOC, OCR)
  ipcMain.handle('parse-resume-file', async (event, { filePath, fileName, buffer }) => {
    try {
      let buf = null;
      if (filePath && fs.existsSync(filePath)) {
        try {
          buf = fs.readFileSync(filePath);
        } catch (_) {}
      }
      if (!buf && buffer) {
        if (Buffer.isBuffer(buffer)) {
          buf = Buffer.from(buffer);
        } else if (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer)) {
          buf = Buffer.from(new Uint8Array(buffer.buffer ? buffer.buffer : buffer));
        } else if (buffer.data && Array.isArray(buffer.data)) {
          buf = Buffer.from(buffer.data);
        } else {
          buf = Buffer.from(buffer);
        }
      }
      const extractedText = await resumeService.extractTextFromFile(filePath, fileName, buf);
      const analysis = resumeService.analyzeResumeText(extractedText, fileName);
      return { ok: true, data: analysis, extractedText: extractedText, resumeText: extractedText };
    } catch (err) {
      console.error('[interview-panel.routes] Resume parsing error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Get Role / Skills Autocomplete
  ipcMain.handle('get-role-skills', async (event, query) => {
    return getRoleSkillsData(query);
  });
}

module.exports = {
  registerInterviewPanelRoutes,
  getRoleSkillsData
};
