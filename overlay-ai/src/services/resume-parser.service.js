// Stub browser canvas/DOM primitives for headless pdf.js in Node/Electron environment
if (typeof process !== 'undefined' && !process.getBuiltinModule) {
  process.getBuiltinModule = (mod) => { try { return require(mod); } catch (_) { return null; } };
}
if (typeof global !== 'undefined') {
  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.ImageData === 'undefined') global.ImageData = class ImageData {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};
}

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function safeRequire(pkgName) {
  try {
    return require(pkgName);
  } catch (_) {
    const candidates = [
      path.resolve(__dirname, '../../node_modules', pkgName),
      path.resolve(__dirname, '../../../Kairos-Backend/node_modules', pkgName),
      path.resolve(process.cwd(), 'node_modules', pkgName),
      path.resolve(process.cwd(), '../Kairos-Backend/node_modules', pkgName),
      path.resolve('c:/Users/user/Downloads/AppKairos(@2)/Kairos-Backend/node_modules', pkgName)
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          return require(candidate);
        }
      } catch (e) {}
    }
  }
  return null;
}

let pdfParse = safeRequire('pdf-parse');
let mammoth = safeRequire('mammoth');
let tesseract = safeRequire('tesseract.js');
let createWorker = tesseract ? tesseract.createWorker : null;
let PNG;
try {
  const pngjs = safeRequire('pngjs');
  PNG = pngjs ? (pngjs.PNG || pngjs) : null;
} catch (_) {
  PNG = null;
}

function getPDFParserClass() {
  if (!pdfParse) {
    pdfParse = safeRequire('pdf-parse');
  }
  if (!pdfParse) return null;
  if (pdfParse.PDFParse) return pdfParse.PDFParse;
  if (pdfParse.default && pdfParse.default.PDFParse) return pdfParse.default.PDFParse;
  return null;
}

function getPDFParseFunction() {
  if (!pdfParse) {
    pdfParse = safeRequire('pdf-parse');
  }
  if (!pdfParse) return null;
  if (typeof pdfParse === 'function') return pdfParse;
  if (typeof pdfParse.default === 'function') return pdfParse.default;
  return null;
}

const TECH_TAXONOMY = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', '.NET', 'Go', 'Golang',
  'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Dart', 'R', 'SQL', 'PL/SQL', 'MATLAB',
  'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'SCSS', 'Bootstrap', 'Tailwind CSS', 'Tailwind',
  'React', 'React.js', 'Next.js', 'Vue', 'Vue.js', 'Angular', 'AngularJS', 'Svelte', 'Redux',
  'Node.js', 'Express', 'Express.js', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Spring',
  'Hibernate', 'JDBC', 'JPA', 'MERN Stack', 'MEAN Stack',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB', 'SQLite', 'Oracle DB', 'Prisma',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Google Cloud', 'Azure', 'Terraform', 'CI/CD', 'Git', 'GitHub', 'GitLab',
  'Jenkins', 'Linux', 'Unix', 'Bash', 'Shell Scripting',
  'Kafka', 'RabbitMQ', 'GraphQL', 'REST APIs', 'RESTful APIs', 'Microservices', 'System Design',
  'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Keras', 'Scikit-learn', 'Pandas', 'NumPy',
  'LLM', 'LLMs', 'Gen-AI', 'Generative AI', 'NLP', 'Computer Vision', 'OpenCV',
  'Power BI', 'Tableau', 'Excel',
  'OOP', 'Object-Oriented Programming', 'Data Structures', 'Algorithms', 'JSON', 'XML',
  'Agile', 'Scrum', 'Jira', 'Unit Testing', 'Jest', 'Cypress', 'Mocha', 'Selenium', 'Postman',
  'Problem Solving', 'Analytical Thinking', 'Communication', 'Teamwork'
];
const COMMON_SKILLS = TECH_TAXONOMY;

async function extractTextFromScannedPdf(dataBuffer, maxPages = Infinity) {
  const ParserClass = getPDFParserClass();
  if (!ParserClass) {
    return '';
  }
  if (!createWorker && tesseract) {
    createWorker = tesseract.createWorker;
  }
  if (!createWorker) return '';

  let parser = null;
  let worker = null;
  try {
    parser = new ParserClass({ data: dataBuffer });
    const screenshots = await parser.getScreenshot({ scale: 1.5 });
    if (!screenshots || !screenshots.pages || screenshots.pages.length === 0) return '';
    worker = await createWorker('eng');
    const pageTexts = [];
    for (const page of (screenshots.pages || []).slice(0, maxPages)) {
      const result = await worker.recognize(Buffer.from(page.data));
      pageTexts.push(result.data.text || '');
    }
    return pageTexts.join('\n\n');
  } catch (err) {
    console.warn('[ResumeParser] OCR extraction error:', err.message);
    return '';
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    if (parser) {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

/**
 * Fast OCR fallback for PDF header banners.
 * Graphic resume templates (e.g. Canva, Novoresume) often render candidate name & title
 * inside an image banner at the top of page 1 while the body is regular vector text.
 */
async function extractTopHeaderOcrText(dataBuffer) {
  if (!PNG || !pdfParse || !pdfParse.PDFParse) return '';
  let parser = null;
  let worker = null;
  try {
    parser = new pdfParse.PDFParse({ data: dataBuffer });
    const screenshots = await parser.getScreenshot({ scale: 2.0 });
    if (!screenshots || !screenshots.pages || screenshots.pages.length === 0) {
      return '';
    }

    const pagePngBuffer = Buffer.from(screenshots.pages[0].data);
    const png = PNG.sync.read(pagePngBuffer);

    // Header banner is typically within the top 16-18% of the page
    const bannerHeight = Math.min(Math.round(png.height * 0.18), 260);
    const cropped = new PNG({ width: png.width, height: bannerHeight });

    for (let y = 0; y < bannerHeight; y++) {
      for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) << 2;
        cropped.data[idx] = png.data[idx];
        cropped.data[idx + 1] = png.data[idx + 1];
        cropped.data[idx + 2] = png.data[idx + 2];
        cropped.data[idx + 3] = png.data[idx + 3];
      }
    }

    const croppedBuffer = PNG.sync.write(cropped);
    worker = await createWorker('eng');
    const res = await worker.recognize(croppedBuffer);
    return (res.data && res.data.text) ? res.data.text.trim() : '';
  } catch (err) {
    console.warn('[ResumeParser] Header banner OCR failed:', err.message);
    return '';
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    if (parser) {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

function joinLineItems(lineItems) {
  if (!lineItems || lineItems.length === 0) return '';
  let lineStr = lineItems[0].str;
  let lastRight = lineItems[0].x + (lineItems[0].width || 0);
  let lastHeight = lineItems[0].height || 10;

  for (let idx = 1; idx < lineItems.length; idx++) {
    const cur = lineItems[idx];
    const gap = cur.x - lastRight;
    const curHeight = cur.height || 10;
    // Scale the space threshold to the font size in play. A fixed
    // absolute threshold works for normal body text but is far too
    // small for larger headings/names, causing a space to be
    // inserted between every letter (e.g. "G R A N D H I").
    const spaceThreshold = Math.max(1.8, Math.max(lastHeight, curHeight) * 0.16);
    const noSpaceBefore = /^[,.:;!?\)\-\/]/.test(cur.str);
    const noSpaceAfter = /[\(\-\/]$/.test(lineStr);
    if (gap > spaceThreshold && !lineStr.endsWith(' ') && !cur.str.startsWith(' ') && !noSpaceBefore && !noSpaceAfter) {
      lineStr += ' ';
    }
    lineStr += cur.str;
    lastRight = Math.max(lastRight, cur.x + (cur.width || 0));
    lastHeight = curHeight;
  }
  return lineStr.trim();
}

/**
 * Sorts a set of PDF text items (top-to-bottom, left-to-right) and joins
 * them into logical lines, adapting row/space thresholds to font size.
 */
function buildLinesFromItems(items) {
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  let currentY = null;
  const lines = [];
  let currentLine = [];

  for (const item of sorted) {
    // Scale the row-grouping tolerance to font size too, so a single
    // large heading line isn't split across multiple detected rows.
    const yThreshold = Math.max(4, (item.height || 10) * 0.4);
    if (currentY === null || Math.abs(currentY - item.y) > yThreshold) {
      if (currentLine.length > 0) {
        lines.push(joinLineItems(currentLine));
      }
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) {
    lines.push(joinLineItems(currentLine));
  }
  return lines.filter(Boolean);
}

/**
 * Detects a stable vertical gutter separating a two-column layout (e.g. a
 * sidebar resume). Returns the split X coordinate, or null if the page
 * appears to be single-column.
 */
function detectColumnSplit(items) {
  if (!items || items.length < 6) return null;

  const minX = Math.min(...items.map(i => i.x));
  const maxX = Math.max(...items.map(i => i.x + (i.width || 0)));
  const pageWidth = maxX - minX;
  if (pageWidth < 100) return null;

  // Group items into rows using the same y-clustering as buildLinesFromItems,
  // then look at each row's horizontal span rather than raw word gaps -
  // word gaps within a column's own text otherwise look like false gutters.
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });
  const rows = [];
  let currentY = null;
  let currentRow = [];
  for (const item of sorted) {
    const yThreshold = Math.max(4, (item.height || 10) * 0.4);
    if (currentY === null || Math.abs(currentY - item.y) > yThreshold) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    } else {
      currentRow.push(item);
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  if (rows.length < 4) return null;

  const rowSpans = rows.map(row => ({
    minX: Math.min(...row.map(i => i.x)),
    maxX: Math.max(...row.map(i => i.x + (i.width || 0)))
  }));

  // Scan candidate gutters across the central band and pick the one where
  // the most rows sit entirely to one side (a real two-column layout).
  const bandStart = minX + pageWidth * 0.2;
  const bandEnd = minX + pageWidth * 0.8;
  const step = Math.max(4, pageWidth * 0.01);

  let best = null;
  for (let x = bandStart; x <= bandEnd; x += step) {
    let leftRows = 0;
    let rightRows = 0;
    let straddling = 0;
    for (const span of rowSpans) {
      if (span.maxX <= x) leftRows++;
      else if (span.minX >= x) rightRows++;
      else straddling++;
    }
    const compatRatio = (leftRows + rightRows) / rowSpans.length;
    if (leftRows >= 2 && rightRows >= 2 && compatRatio >= 0.6) {
      if (!best || compatRatio > best.compatRatio || (compatRatio === best.compatRatio && straddling < best.straddling)) {
        best = { x, compatRatio, straddling };
      }
    }
  }

  return best ? best.x : null;
}

const zlib = require('zlib');

function extractPdfTextWithZlib(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return '';
  try {
    const str = buf.toString('binary');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    const allText = [];

    while ((match = streamRegex.exec(str)) !== null) {
      const rawStream = Buffer.from(match[1], 'binary');
      let decompressed = '';
      try {
        decompressed = zlib.inflateSync(rawStream).toString('latin1');
      } catch (_) {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString('latin1');
        } catch (_) {
          decompressed = rawStream.toString('latin1');
        }
      }

      if (decompressed) {
        const tjRegex = /\(([^)]+)\)\s*Tj/g;
        let m;
        while ((m = tjRegex.exec(decompressed)) !== null) {
          allText.push(m[1]);
        }
        const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
        while ((m = tjArrayRegex.exec(decompressed)) !== null) {
          const sub = /\(([^)]+)\)/g;
          let sm;
          while ((sm = sub.exec(m[1])) !== null) {
            allText.push(sm[1]);
          }
        }
      }
    }
    return allText.join(' ').replace(/\\([()\\\\])/g, '$1').replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.warn('[ResumeParser] zlib stream extraction error:', err.message);
    return '';
  }
}

/**
 * Extracts raw text from PDF, DOCX, or DOC file.
 */
async function extractTextFromFile(filePath, originalName = '', buffer = null) {
  const ext = (path.extname(originalName || filePath || '') || '').toLowerCase();

  let dataBuffer = null;
  if (filePath && fs.existsSync(filePath)) {
    try {
      dataBuffer = fs.readFileSync(filePath);
    } catch (_) {}
  }
  if (!dataBuffer && buffer) {
    if (Buffer.isBuffer(buffer)) {
      dataBuffer = Buffer.from(buffer);
    } else if (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer)) {
      dataBuffer = Buffer.from(new Uint8Array(buffer.buffer ? buffer.buffer : buffer));
    } else if (buffer.data && Array.isArray(buffer.data)) {
      dataBuffer = Buffer.from(buffer.data);
    } else {
      try {
        dataBuffer = Buffer.from(buffer);
      } catch (e) {}
    }
  }

  let text = '';
  const isPdf = ext === '.pdf' || (dataBuffer && dataBuffer.slice(0, 5).toString('ascii').startsWith('%PDF'));

  if (isPdf) {
    if (!dataBuffer || dataBuffer.length === 0) {
      throw new Error('No PDF file data provided.');
    }

    const ParserClass = getPDFParserClass();
    const parseFn = getPDFParseFunction();

    if (ParserClass) {
      try {
        const parser = new ParserClass({ data: dataBuffer });
        const doc = await parser.load();
        const numPages = doc.numPages;
        const pageTexts = [];

        for (let p = 1; p <= numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();

          const items = (content.items || [])
            .filter(it => it && it.str && it.str.trim())
            .map(it => ({
              str: it.str,
              x: it.transform[4],
              y: it.transform[5],
              width: it.width || 0,
              height: it.height || 10
            }));

          const columnSplit = detectColumnSplit(items);
          let lines;
          if (columnSplit !== null && items.length > 0) {
            const maxY = Math.max(...items.map(i => i.y));
            const minY = Math.min(...items.map(i => i.y));
            const headerCutoffY = maxY - (maxY - minY) * 0.15;
            const headerItems = items.filter(i => i.y >= headerCutoffY);
            const bodyItems = items.filter(i => i.y < headerCutoffY);
            lines = [
              ...buildLinesFromItems(headerItems),
              ...buildLinesFromItems(bodyItems.filter(i => i.x < columnSplit)),
              ...buildLinesFromItems(bodyItems.filter(i => i.x >= columnSplit))
            ];
          } else {
            lines = buildLinesFromItems(items);
          }

          pageTexts.push(lines.filter(Boolean).join('\n'));
        }
        text = pageTexts.join('\n\n');
        try { await parser.destroy(); } catch (_) {}
      } catch (err) {
        console.warn('[ResumeParser] Spatial extraction failed, falling back to default getText:', err.message);
        try {
          const parser = new ParserClass({ data: dataBuffer });
          const parsed = await parser.getText();
          text = parsed?.text || '';
          try { await parser.destroy(); } catch (_) {}
        } catch (e2) {
          console.warn('[ResumeParser] Default getText failed:', e2.message);
        }
      }
    } else if (parseFn) {
      try {
        const parsed = await parseFn(dataBuffer);
        text = parsed?.text || '';
      } catch (e3) {
        console.warn('[ResumeParser] parse function failed:', e3.message);
      }
    }

    // Tier 3: Built-in zlib text stream decompression
    if (!text || text.trim().length < 20) {
      try {
        const zlibText = extractPdfTextWithZlib(dataBuffer);
        if (zlibText && zlibText.trim().length > 20) {
          text = zlibText;
        }
      } catch (zErr) {
        console.warn('[ResumeParser] zlib fallback error:', zErr.message);
      }
    }

    // Tier 4: Scanned PDF OCR fallback
    if (!text || text.trim().length < 20) {
      try {
        const ocrText = await extractTextFromScannedPdf(dataBuffer);
        if (ocrText && ocrText.trim().length > 20) {
          text = ocrText;
        }
      } catch (ocrErr) {
        console.warn('[ResumeParser] Scanned PDF OCR fallback failed:', ocrErr.message);
      }
    }

    if (!text) {
      throw new Error('PDF parsing library could not extract text from the file.');
    }
  } else if (ext === '.docx') {
    if (!mammoth) mammoth = safeRequire('mammoth');
    if (mammoth) {
      if (dataBuffer) {
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        text = result.value || '';
      } else if (filePath && fs.existsSync(filePath)) {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value || '';
      }
    }
  } else if (ext === '.doc') {
    if (dataBuffer) {
      const latin = dataBuffer.toString('latin1').replace(/[^\x20-\x7E\r\n\t]/g, ' ');
      text = latin.split(/\s{2,}/).filter(chunk => chunk.length > 2).join(' ');
    } else if (filePath && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const latin = buf.toString('latin1').replace(/[^\x20-\x7E\r\n\t]/g, ' ');
      text = latin.split(/\s{2,}/).filter(chunk => chunk.length > 2).join(' ');
    }
  } else {
    throw new Error(`Unsupported file type: ${ext}. Supported formats are .pdf, .docx, and .doc.`);
  }

  // Mac-authored resumes (Pages, TextEdit, legacy .doc converters) often use
  // a bare \r line break, which collapses every line into one blob if left
  // unnormalized.
  let cleanedText = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();

  // Some resumes are scanned images with no PDF text layer. OCR only when
  // normal extraction produced no usable text, keeping text PDFs fast.
  if (ext === '.pdf' && cleanedText.length < 50 && dataBuffer) {
    try {
      const ocrText = await extractTextFromScannedPdf(dataBuffer);
      if (ocrText && ocrText.trim().length > 0) {
        cleanedText = ocrText.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
      }
    } catch (err) {
      console.warn('[ResumeParser] OCR extraction failed:', err.message);
    }
  }

  // If this is a PDF with text, but no candidate name is detected in the text layer
  // (e.g. name was rendered inside a top banner graphic/image), perform a fast OCR on page 1 header
  if (ext === '.pdf' && cleanedText.length >= 50 && dataBuffer) {
    const hasName = hasConfidentCandidateName(cleanedText, originalName);
    if (!hasName) {
      try {
        const headerText = await extractTopHeaderOcrText(dataBuffer);
        if (headerText) {
          cleanedText = `${headerText}\n${cleanedText}`;
        }
      } catch (e) {
        console.warn('[ResumeParser] Header OCR check skipped:', e.message);
      }
    }
  }

  if (!cleanedText || cleanedText.length < 50) {
    throw new Error('The uploaded document does not appear to be a resume. Please upload a valid resume.');
  }

  return cleanedText;
}

const RESUME_SECTIONS = [
  {
    name: 'Professional Summary',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:professional\s+summary|executive\s+summary|career\s+summary|summary\s+of\s+qualifications|professional\s+profile|career\s+objective|summary|objective|about\s+me|personal\s+statement|profile)\b/i
  },
  {
    name: 'Education',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:education|educational\s+background|academic\s+background|academics|academic\s+history|educational\s+qualifications?|qualifications|bachelor(?:'s)?|master(?:'s)?|b\.?tech|m\.?tech|b\.?s\.?|m\.?s\.?|b\.?e\.?|ph\.?d|degree|university|college|gpa|cgpa)\b/i
  },
  {
    name: 'Skills',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:technical\s+skills?|core\s+competencies|key\s+skills?|skills?\s*(?:&|and)\s*(?:tools?|technologies)|technologies|tech\s+stack|programming\s+languages|skills|proficiencies|areas\s+of\s+expertise|tools\s*(?:&|and)\s*frameworks)\b/i
  },
  {
    name: 'Experience',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|career\s+history|experience|internships?|employment|relevant\s+experience)\b/i
  },
  {
    name: 'Projects',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:projects?|key\s+projects?|personal\s+projects?|academic\s+projects?|technical\s+projects?|selected\s+projects?|notable\s+projects?|side\s+projects?)\b/i
  },
  {
    name: 'Certifications',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:certifications?|certificates?|licenses?\s*(?:&|and)\s*certifications?|credentials?|courses?\s*(?:&|and)\s*certifications?|professional\s+certifications?)\b/i
  },
  {
    name: 'Achievements',
    regex: /(?:^|\n|[\r\n\t•\-\*#|0-9.]\s*)(?:achievements?|accomplishments?|awards?\s*(?:&|and)\s*honors?|honors?|key\s+achievements?|notable\s+achievements?|recognitions?)\b/i
  }
];

const PROFILE_SECTION_ALIASES = {
  professionalSummary: /^(?:professional\s+summary|executive\s+summary|career\s+summary|summary|objective|about\s+me|profile|professional\s+profile)$/i,
  workExperience: /^(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|experience|internships?|employment|relevant\s+experience)$/i,
  education: /^(?:education|educational\s+background|academic\s+background|academics|academic\s+history|educational\s+qualifications?|qualifications)$/i,
  skills: /^(?:technical\s+skills?|core\s+competencies|key\s+skills?|skills|technologies|tech\s+stack|proficiencies|areas\s+of\s+expertise)$/i,
  projects: /^(?:projects?|key\s+projects?|personal\s+projects?|academic\s+projects?|technical\s+projects?|selected\s+projects?|notable\s+projects?|side\s+projects?)$/i,
  certifications: /^(?:certifications?|certificates?|credentials?|licenses?\s*(?:&|and)\s*certifications?|certifications?\s*(?:&|and)\s*(?:online\s+)?courses?|certificates?\s*(?:&|and)\s*(?:online\s+)?courses?|online\s+courses?|training)$/i,
  achievements: /^(?:achievements?|accomplishments?|awards?|honors?|recognitions?)$/i,
  languages: /^(?:languages?|languages\s+known)$/i,
  additionalInformation: /^(?:additional\s+information|interests?|hobbies|publications?|references?|declaration)$/i
};

function normalizeProfileHeader(line) {
  return String(line || '').replace(/^[\s•\-*#|\d.)]+/, '').replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim();
}

function extractResumeProfile(resumeText) {
  const sections = {
    name: '', personalInformation: '', professionalSummary: '', workExperience: '', education: '', skills: '',
    projects: '', certifications: '', achievements: '', languages: '', additionalInformation: ''
  };
  const lines = String(resumeText || '').split('\n').map(line => line.trim()).filter(Boolean);
  const headingIndexes = [];
  lines.forEach((line, index) => {
    const header = normalizeProfileHeader(line);
    const headerName = header.split(':')[0].trim();
    for (const [key, regex] of Object.entries(PROFILE_SECTION_ALIASES)) {
      if (regex.test(header) || regex.test(headerName)) { headingIndexes.push({ index, key }); break; }
    }
  });
  headingIndexes.forEach((heading, position) => {
    const nextIndex = headingIndexes[position + 1]?.index ?? lines.length;
    const content = lines.slice(heading.index + 1, nextIndex);
    const headerLine = lines[heading.index];
    const inlineValue = headerLine.replace(/^[\s•\-*#|\d.)]+/, '').replace(/^[^:]+:\s*/, '').trim();
    if (inlineValue && inlineValue !== headerLine.trim()) content.unshift(inlineValue);
    sections[heading.key] = content.join('\n').trim();
  });
  const firstBodyIndex = headingIndexes.length > 0 ? headingIndexes[0].index : Math.min(lines.length, 8);
  const headerLines = lines.slice(0, firstBodyIndex);
  const summaryIndex = sections.professionalSummary
    ? -1
    : headerLines.findIndex(line => line.length > 60 && !/@|https?:\/\//.test(line));
  if (summaryIndex >= 0) sections.professionalSummary = headerLines[summaryIndex];
  sections.personalInformation = headerLines.filter((_, index) => index !== summaryIndex).join('\n').trim();
  return sections;
}

/**
 * Validates that extracted text matches candidate resume structure.
 */
const NON_RESUME_DOC_PATTERNS = [
  /\b(?:implementation|technical|system|software|api|product)\s+specifications?\b/i,
  /\b(?:software\s+requirements?(?:\s+specification)?|system\s+requirements?(?:\s+specification)?|srs)\b/i,
  /\b(?:system\s+architecture|software\s+architecture|architecture\s+(?:document|specification|overview))\b/i,
  /\b(?:technical\s+design\s+document|system\s+design\s+document|design\s+document|tdd|prd)\b/i,
  /\b(?:product\s+requirements?\s+document|project\s+charter|statement\s+of\s+work|sow)\b/i,
  /\b(?:api\s+(?:documentation|reference|specification|guide)|endpoints?\s+specification)\b/i,
  /\b(?:user\s+manual|admin\s+guide|developer\s+guide|installation\s+guide|configuration\s+guide|user\s+guide|setup\s+guide)\b/i,
  /\b(?:terms\s+of\s+service|terms\s+(?:&|and)\s+conditions|privacy\s+policy|service\s+agreement|license\s+agreement|non[- ]disclosure\s+agreement|nda)\b/i,
  /\b(?:tax\s+invoice|commercial\s+invoice|purchase\s+order|billing\s+statement|payment\s+receipt|invoice\s+(?:#|no|number))\b/i,
  /\b(?:meeting\s+minutes|meeting\s+notes|release\s+notes|changelog)\b/i,
  /\b(?:course\s+syllabus|curriculum\s+overview|lecture\s+notes|lab\s+manual|homework\s+assignment|exam\s+paper)\b/i,
  /\b(?:white\s*paper|research\s+paper|executive\s+whitepaper)\b/i
];

const NON_RESUME_FILENAME_REGEX = /(?:^|[._\-\s])(?:specification|specifications|specs?|architecture|design[-_ ]?doc|system[-_ ]?requirements?|srs|prd|tdd|api[-_ ]?(?:doc|spec|reference)|manual|guide|user[-_ ]?guide|developer[-_ ]?guide|admin[-_ ]?guide|whitepaper|proposal|invoice|receipt|statement|agreement|contract|nda|terms|policy|meeting[-_ ]?notes?|minutes|release[-_ ]?notes?|changelog|syllabus|curriculum[-_ ]?overview|assignment|homework|thesis|paper|case[-_ ]?study|presentation|slides?|roadmap|audit[-_ ]?log)(?:$|[._\-\s])/i;

const TECHNICAL_DOC_STRUCTURAL_PATTERNS = [
  /\b(?:table\s+of\s+contents|revision\s+history|document\s+control|document\s+version|document\s+history|version\s+control)\b/i,
  /\b(?:functional\s+requirements?|non-functional\s+requirements?|system\s+architecture|database\s+schema|api\s+endpoints?|implementation\s+details?|data\s+flow\s+diagram|wireframes?\s*(?:&|and)\s*mockups?)\b/i,
  /\b(?:confidential\s+and\s+proprietary|all\s+rights\s+reserved|bill\s+to|invoice\s+date|due\s+date|amount\s+due)\b/i
];

function validateIsResume(text, originalName = '') {
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    throw new Error('The uploaded document does not appear to be a resume. Please upload a valid resume.');
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerLines = lines.slice(0, 15);
  const cleanFilename = String(originalName || '').replace(/[._-]+/g, ' ').toLowerCase();

  // 1. Explicit non-resume document disqualifiers
  const hasResumeInFilename = /\b(?:resume|cv|curriculum\s+vitae|biodata)\b/i.test(cleanFilename);
  const isNonResumeFilename = !hasResumeInFilename && NON_RESUME_FILENAME_REGEX.test(originalName || '');

  const hasNonResumeHeader = headerLines.some(line =>
    NON_RESUME_DOC_PATTERNS.some(pattern => pattern.test(line))
  );

  const technicalDocMatches = TECHNICAL_DOC_STRUCTURAL_PATTERNS.filter(pattern => pattern.test(text)).length;

  // 2. Candidate Identity Signals
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const isPersonalEmail = Boolean(emailMatch && !/^(?:noreply|support|info|admin|contact|sales|help|billing|careers|jobs|hr)@/i.test(emailMatch[0]));
  const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\+?\d{10,12}/.test(text);
  const hasLinkedIn = /linkedin\.com\/(?:in|pub)\/[\w-]+/i.test(text);
  const hasPersonalGithub = /github\.com\/[a-zA-Z0-9_-]{2,}(?:[\s/)]|$)(?!orgs\/|repos\/)/i.test(text);
  const hasCandidateContact = Boolean(isPersonalEmail || hasPhone || hasLinkedIn || hasPersonalGithub);

  // 3. Education Signals
  const hasDegree = /\b(?:b\.?tech|m\.?tech|b\.?s|m\.?s|b\.?e|m\.?e|bca|mca|bba|mba|ph\.?d|bachelor(?:'s)?|master(?:'s)?|associate(?:'s)?\s+degree|diploma|secondary|higher\s+secondary|matriculation)\b/i.test(text);
  const hasInstitution = /\b(?:university|college|institute\s+of\s+technology|school|polytechnic|academy)\b/i.test(text);
  const hasAcademicScore = /\b(?:cgpa|gpa|\b\d{1,2}(?:\.\d{1,2})?\s*(?:\/\s*10|\/\s*4\.0?)|percentage|\b\d{2,3}%\b|graduat(?:ed|ion))\b/i.test(text);
  const hasEducation = (hasDegree && (hasInstitution || hasAcademicScore || hasCandidateContact)) || (hasInstitution && (hasAcademicScore || hasDegree));

  // 4. Work Experience & Role Signals
  const hasRoleTitle = /\b(?:software\s+engineer|full\s*stack\s+developer|frontend\s+developer|backend\s+developer|web\s+developer|mobile\s+developer|devops\s+engineer|cloud\s+engineer|data\s+scientist|data\s+engineer|machine\s+learning\s+engineer|qa\s+engineer|intern(?:ship)?|software\s+developer|engineer|developer|consultant|analyst|associate|lead|manager|architect|programmer)\b/i.test(text);
  const hasEmploymentDateRange = /(?:19\d{2}|20\d{2})\s*(?:[-–—to\/]+|\s+to\s+)\s*(?:19\d{2}|20\d{2}|present|current)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19\d{2}|20\d{2})/i.test(text);
  const hasWorkExperience = (hasRoleTitle && hasEmploymentDateRange) || (hasRoleTitle && hasCandidateContact) || (hasEmploymentDateRange && hasCandidateContact);

  // 5. Skills Signals
  const detectedSkills = extractSkillsFromResume(text);
  const hasSkillsSection = lines.some(l => {
    const clean = l.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return /^(?:technical\s+|key\s+|core\s+|professional\s+)?(?:skills|competencies|technologies|proficiencies|tech\s+stack)(?:\s*(?:&|and)\s*tools)?$/i.test(clean);
  });
  const hasStrongSkills = hasSkillsSection || detectedSkills.length >= 3;

  // 6. Section Matches
  const matchedSections = [];
  for (const sec of RESUME_SECTIONS) {
    if (sec.regex.test(text)) {
      matchedSections.push(sec.name);
    }
  }

  // 7. Disqualification Decision
  if (isNonResumeFilename || hasNonResumeHeader || technicalDocMatches >= 2) {
    const hasOverwhelmingCandidateProof = hasCandidateContact && (hasEducation || hasWorkExperience) && hasStrongSkills;
    if (!hasOverwhelmingCandidateProof) {
      throw new Error('The uploaded document does not appear to be a resume. Please upload a valid resume.');
    }
  }

  // 8. Positive Decision: Must show genuine candidate resume characteristics
  const isCandidateResume = (
    (hasCandidateContact && (hasEducation || hasWorkExperience || hasStrongSkills || matchedSections.length >= 1)) ||
    (hasEducation && hasWorkExperience) ||
    (hasEducation && (hasStrongSkills || matchedSections.includes('Projects') || matchedSections.includes('Skills'))) ||
    (hasWorkExperience && hasStrongSkills) ||
    (matchedSections.length >= 2 && (hasEducation || hasWorkExperience || hasStrongSkills || hasCandidateContact)) ||
    (matchedSections.length >= 3) ||
    (hasStrongSkills && detectedSkills.length >= 4 && (hasDegree || hasRoleTitle || hasCandidateContact))
  );

  if (!isCandidateResume) {
    throw new Error('The uploaded document does not appear to be a resume. Please upload a valid resume.');
  }

  return {
    valid: true,
    matchedSections
  };
}

const INVALID_NAME_TERMS = new Set([
  'resume', 'curriculum vitae', 'curriculum', 'vitae', 'cv', 'biodata', 'bio data', 'bio-data', 'profile',
  'summary', 'professional summary', 'executive summary', 'career summary', 'summary of qualifications',
  'professional profile', 'career objective', 'objective', 'about me', 'about', 'personal profile', 'personal details',
  'contact', 'contact info', 'contact information', 'contact details',
  'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history',
  'career history', 'relevant experience', 'internship', 'internships',
  'education', 'educational background', 'academic background', 'academics', 'academic history', 'qualifications',
  'educational qualifications',
  'skills', 'technical skills', 'core competencies', 'key skills', 'technologies', 'tech stack',
  'programming languages', 'proficiencies', 'expertise', 'areas of expertise', 'tools & frameworks', 'tools and frameworks',
  'projects', 'academic projects', 'personal projects', 'key projects', 'notable projects', 'technical projects', 'selected projects',
  'certifications', 'certification', 'certificates', 'certificate', 'online courses', 'courses',
  'certifications & online courses', 'certifications and online courses', 'courses & certifications',
  'licenses & certifications', 'credentials', 'training',
  'achievements', 'accomplishments', 'awards', 'honors', 'awards & honors', 'awards and honors',
  'key achievements', 'notable achievements', 'recognitions',
  'publications', 'research', 'languages', 'languages known', 'hobbies', 'interests', 'declaration', 'references', 'page',
  'software engineer', 'software developer', 'full stack developer', 'full stack engineer', 'fullstack developer', 'fullstack engineer',
  'frontend developer', 'frontend engineer', 'backend developer', 'backend engineer', 'web developer', 'mobile developer',
  'ios developer', 'android developer', 'devops engineer', 'cloud engineer', 'cloud architect', 'data scientist',
  'data analyst', 'data engineer', 'machine learning engineer', 'ai engineer', 'qa engineer', 'system administrator',
  'product manager', 'project manager', 'solution architect', 'technical lead', 'team lead', 'developer', 'engineer',
  'architect', 'consultant', 'specialist', 'associate',
  // Document, specification, and architectural titles
  'specification', 'specifications', 'spec', 'specs',
  'implementation', 'implementations',
  'architecture', 'architectures',
  'requirement', 'requirements',
  'overview', 'documentation', 'document', 'documents',
  'proposal', 'proposals', 'guide', 'manual', 'reference',
  'report', 'reports', 'release', 'notes', 'whitepaper', 'whitepapers',
  'syllabus', 'curriculum overview',
  'system architecture', 'software architecture', 'system design', 'technical design',
  'design document', 'software requirements', 'system requirements', 'requirements specification',
  'implementation specification', 'technical specification', 'software specification', 'system specification', 'api specification',
  'product requirements', 'product specification',
  'project overview', 'project scope', 'project charter', 'project plan', 'sprint plan',
  'statement of work', 'terms of service', 'terms and conditions', 'privacy policy',
  'user manual', 'developer guide', 'admin guide', 'release notes', 'meeting minutes',
  'table of contents', 'revision history', 'version control', 'executive summary',
  'kairos admin panel', 'admin panel', 'backend architecture', 'api documentation', 'api reference',
  'test plan', 'test case', 'case study', 'invoice', 'receipt', 'bill', 'contract', 'agreement', 'nda'
]);

const NON_NAME_TOKENS = new Set([
  'and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'from', 'about',
  'as', 'an', 'a', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'be', 'been', 'being',
  'my', 'me', 'our', 'your', 'his', 'her', 'their', 'its', 'who', 'which', 'that', 'this',
  'resume', 'curriculum', 'vitae', 'cv', 'biodata', 'profile', 'summary', 'objective',
  'education', 'educational', 'academic', 'academics', 'qualification', 'qualifications',
  'experience', 'employment', 'career', 'intern', 'internship', 'internships', 'work',
  'projects', 'project', 'skills', 'skill', 'competencies', 'expertise', 'proficiencies',
  'certifications', 'certification', 'certified', 'certificates', 'certificate',
  'courses', 'course', 'online', 'training', 'credentials', 'licenses',
  'achievements', 'achievement', 'accomplishments', 'accomplishment', 'awards', 'award',
  'honors', 'honor', 'publications', 'publication', 'activities', 'activity',
  'interests', 'interest', 'hobbies', 'hobby', 'references', 'reference', 'declaration',
  'languages', 'language', 'page',
  'contact', 'details', 'personal', 'info', 'information', 'phone', 'mobile', 'tel', 'telephone',
  'cell', 'email', 'mail', 'gmail', 'yahoo', 'hotmail', 'outlook', 'linkedin', 'github',
  'gitlab', 'portfolio', 'website', 'address', 'city', 'state', 'country', 'zip', 'postal',
  'india', 'usa', 'street', 'road', 'lane',
  'engineer', 'engineering', 'developer', 'development', 'architect', 'architecture',
  'programmer', 'programming', 'coder', 'coding', 'designer', 'designing', 'analyst',
  'consultant', 'specialist', 'manager', 'management', 'lead', 'leader', 'leadership',
  'senior', 'junior', 'associate', 'executive', 'officer', 'director', 'founder', 'student',
  'candidate', 'applicant', 'member', 'head', 'coordinator', 'administrator', 'admin',
  'experienced', 'skilled', 'built', 'building', 'developed', 'developing', 'designed',
  'implemented', 'implementing', 'created', 'creating', 'managed', 'managing', 'working',
  'solutions', 'services', 'systems', 'system', 'technologies', 'technology', 'tech',
  'api', 'apis', 'rest', 'restful', 'graphql', 'grpc', 'soap',
  'sql', 'nosql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'mongodb', 'redis', 'cassandra', 'dynamodb',
  'python', 'java', 'javascript', 'typescript', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart',
  'react', 'redux', 'angular', 'vue', 'svelte', 'nextjs', 'next', 'express', 'nestjs', 'django', 'flask', 'fastapi',
  'spring', 'springboot', 'bootstrap', 'tailwind', 'html', 'html5', 'css', 'css3', 'sass', 'scss',
  'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'cloud', 'devops', 'ci', 'cd', 'cicd',
  'git', 'linux', 'unix', 'bash', 'shell', 'windows', 'macos', 'android', 'ios', 'web', 'mobile',
  'ai', 'ml', 'nlp', 'llm', 'llms', 'data', 'database', 'databases', 'backend', 'frontend', 'fullstack',
  'machine', 'learning', 'deep', 'neural', 'intelligence', 'artificial', 'model', 'models',
  'algorithm', 'algorithms', 'structures', 'pipeline', 'pipelines',
  'university', 'college', 'school', 'institute', 'institution', 'department', 'campus',
  'bachelor', 'bachelors', 'master', 'masters', 'doctor', 'doctorate', 'phd',
  'btech', 'mtech', 'bsc', 'msc', 'bca', 'mca', 'be', 'me', 'mba', 'bba',
  'degree', 'diploma', 'cgpa', 'gpa', 'percentage', 'grade', 'score', 'marks', 'division',
  'science', 'sciences', 'arts', 'commerce', 'engineering', 'ltd', 'inc', 'corp', 'company',
  // Document, specification, and architectural tokens
  'specification', 'specifications', 'spec', 'specs',
  'implementation', 'implementations',
  'architecture', 'architectures', 'architectural',
  'requirement', 'requirements',
  'overview', 'documentation', 'document', 'documents',
  'proposal', 'proposals', 'guide', 'manual', 'reference',
  'report', 'reports', 'release', 'releases', 'notes',
  'whitepaper', 'whitepapers', 'syllabus', 'scope', 'plan', 'planning',
  'feature', 'features', 'version', 'build',
  'panel', 'dashboard',
  'schema', 'schemas', 'migration', 'migrations',
  'endpoint', 'endpoints', 'route', 'routes', 'router', 'routers',
  'controller', 'controllers',
  'platform', 'platforms', 'application', 'applications', 'app', 'apps',
  'component', 'components', 'module', 'modules',
  'kairos', 'sprint', 'epic', 'milestone', 'ticket', 'task', 'tasks',
  'invoice', 'invoices', 'receipt', 'receipts', 'bill', 'bills',
  'contract', 'contracts', 'agreement', 'agreements', 'statement', 'statements',
  'policy', 'policies', 'terms'
]);

function isValidCandidateName(str) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean.length > 35) return false;
  if (/[0-9@&_:+*#=<>\\\/;!?[\]{}()~^$]/.test(clean)) return false;

  const lower = clean.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  if (INVALID_NAME_TERMS.has(lower)) return false;

  // Check alphanumeric collapsed string (rejects spaced-out section titles like "SUMMAR Y" or "S U M M A R Y")
  const noSpace = clean.toLowerCase().replace(/[^a-z]/g, '');
  if (INVALID_NAME_TERMS.has(noSpace)) return false;

  for (const term of INVALID_NAME_TERMS) {
    if (lower === term || lower.startsWith(term + ' ') || lower.endsWith(' ' + term)) {
      return false;
    }
  }

  const words = clean.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;

  // For a 2-word name, ensure at least one word is not an initial (avoids abbreviations like "C V")
  if (words.length === 2 && words[0].replace(/['.-]/g, '').length < 2 && words[1].replace(/['.-]/g, '').length < 2) {
    return false;
  }

  for (const w of words) {
    if (!/^[A-Za-z][A-Za-z'.-]*$/.test(w)) return false;
    const wLower = w.toLowerCase().replace(/['.-]/g, '');
    // Check against non-name vocabulary only if token is multi-character (preserves valid initials like "A.")
    if (wLower.length > 1 && NON_NAME_TOKENS.has(wLower)) return false;
  }

  const allCapitalized = words.every(w => /^[A-Z]/.test(w));
  if (!allCapitalized) return false;

  return true;
}

function toTitleCase(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .split(/\s+/)
    .map(w => {
      if (/^[A-Z]\.?$/i.test(w)) return w.toUpperCase();
      if (w.includes('-')) {
        return w.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
      }
      if (w.includes("'")) {
        return w.split("'").map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("'");
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function isBodySectionHeader(line) {
  if (!line || line.length > 50) return false;
  const clean = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const noSpace = clean.replace(/\s+/g, '');
  
  const sectionKeywords = [
    'summary', 'professionalsummary', 'executivesummary', 'careersummary', 'objective', 'careerobjective', 'aboutme',
    'education', 'educationalbackground', 'academicbackground', 'academics', 'qualifications',
    'experience', 'workexperience', 'professionalexperience', 'employment', 'employmenthistory', 'workhistory',
    'skills', 'technicalskills', 'corecompetencies', 'keyskills', 'technologies', 'techstack',
    'projects', 'academicprojects', 'personalprojects', 'keyprojects',
    'certifications', 'certification', 'certificates', 'onlinecourses',
    'achievements', 'accomplishments', 'awards', 'honors',
    // Document sections that should stop candidate name extraction immediately:
    'implementation', 'specification', 'implementationspecification', 'technicalspecification',
    'systemarchitecture', 'databaseschema', 'apiendpoints', 'requirements', 'tableofcontents',
    'revisionhistory', 'overview', 'projectscope'
  ];

  if (sectionKeywords.includes(noSpace) || sectionKeywords.includes(clean)) {
    return true;
  }

  return RESUME_SECTIONS.some(sec => sec.regex.test(line) && line.split(/\s+/).length <= 5);
}

function extractNameFromLine(rawLine) {
  if (!rawLine) return null;
  let line = rawLine.replace(/\s+/g, ' ').trim();

  // Strip prefixes like "Name:", "Candidate Name:", "Full Name:"
  const prefixMatch = line.match(/^(?:candidate\s+name|full\s+name|name)\s*:\s*(.+)$/i);
  if (prefixMatch) {
    line = prefixMatch[1].trim();
  }

  // Check direct valid name
  if (isValidCandidateName(line)) return line;

  // Split by header separators (pipes, bullets, em-dash, en-dash, spaced hyphens, slashes)
  const parts = line.split(/\s*[|•—–]\s*|\s+[-/]\s+/).map(p => p.trim());
  if (parts.length > 1) {
    for (const part of parts) {
      if (isValidCandidateName(part)) {
        return part;
      }
    }
  }

  // Reject long lines / sentences immediately
  if (line.split(/\s+/).length > 5) return null;

  // Reject lines containing sentence conjunctions, prepositions, or verbs
  if (/\b(with|in|and|or|for|at|to|from|by|on|about|experienced|developed|building|focus|using)\b/i.test(line)) {
    return null;
  }

  // Check "LastName, FirstName" format
  const commaMatch = line.match(/^([A-Z][a-z]+),\s*([A-Z][a-z]+)$/);
  if (commaMatch) {
    const candidate = `${commaMatch[2]} ${commaMatch[1]}`;
    if (isValidCandidateName(candidate)) return candidate;
  }

  return null;
}

function extractNameFromFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') return null;
  const baseName = path.basename(originalName, path.extname(originalName))
    .replace(/[_-]?[A-Za-z0-9]*\d{4,}$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  const words = baseName.split(' ').filter(Boolean);
  if (words.length < 2) return null;

  // Filter out resume keywords/stopwords so "Rohith_Babu_Resume.pdf" resolves to "Rohith Babu"
  const resumeStopWords = new Set([
    'resume', 'resumes', 'cv', 'curriculum', 'vitae', 'biodata', 'profile',
    'updated', 'update', 'latest', 'final', 'draft', 'new', 'copy',
    'developer', 'engineer', 'fullstack', 'frontend', 'backend', 'intern', 'internship',
    'aiml', 'ai', 'ml', 'software', 'tech', 'v1', 'v2', 'v3'
  ]);
  const candidateWords = words.filter(w => !resumeStopWords.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
  if (candidateWords.length >= 2 && candidateWords.length <= 4) {
    const candidate = candidateWords.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    if (isValidCandidateName(candidate)) return candidate;
  }

  const directCandidate = words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  return isValidCandidateName(directCandidate) ? directCandidate : null;
}

function hasConfidentCandidateName(text, originalName = '') {
  if (!text || typeof text !== 'string') return false;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 18); i++) {
    const line = lines[i];
    if (isBodySectionHeader(line)) continue;
    const extracted = extractNameFromLine(line);
    if (extracted && isValidCandidateName(extracted)) {
      return true;
    }
  }
  const fromFilename = extractNameFromFilename(originalName);
  return Boolean(fromFilename);
}

function extractCandidateNameFromContact(resumeText) {
  if (!resumeText || typeof resumeText !== 'string') return null;

  // 1. Try personal LinkedIn handle: linkedin.com/in/john-doe or linkedin.com/in/n-rohith-babu
  const linkedInMatch = resumeText.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-\.]+)/i);
  if (linkedInMatch) {
    const handle = linkedInMatch[1]
      .replace(/[-_]?[0-9a-f]{5,}$/i, '')
      .replace(/[0-9]+$/, '')
      .replace(/[-_.]+/g, ' ')
      .trim();
    const candidate = toTitleCase(handle);
    if (isValidCandidateName(candidate)) {
      return candidate;
    }
  }

  // 2. Try email username prefix with clear first.last or first_last format
  const emailMatch = resumeText.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
  if (emailMatch) {
    const userPart = emailMatch[0].split('@')[0];
    if (/[._-]/.test(userPart)) {
      const parts = userPart.split(/[._-]+/).filter(p => /^[a-zA-Z]{2,}$/.test(p));
      if (parts.length >= 2 && parts.length <= 3) {
        const candidate = toTitleCase(parts.join(' '));
        if (isValidCandidateName(candidate)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

/**
 * Scans the entire resume text and dynamically extracts all technical and soft skills,
 * including programming languages, web/backend technologies, machine learning/AI,
 * databases, tools/platforms, software engineering concepts, and soft skills.
 */
function extractSkillsFromResume(resumeText) {
  if (!resumeText || typeof resumeText !== 'string') return [];

  const detectedSkills = [];
  const seenLower = new Set();

  function addSkill(skill) {
    if (!skill || typeof skill !== 'string') return;
    let s = skill.trim().replace(/^[-–—•\*\s,;:()]+|[-–—•\*\s,;:()]+$/g, '');
    if (!s || s.length < 2 || s.length > 45) return;

    // Normalize casing for common acronyms and technical names
    if (/^my\s*sql$/i.test(s)) s = 'MySQL';
    else if (/^python$/i.test(s)) s = 'Python';
    else if (/^java$/i.test(s)) s = 'Java';
    else if (/^javascript$/i.test(s)) s = 'JavaScript';
    else if (/^typescript$/i.test(s)) s = 'TypeScript';
    else if (/^html5?$/i.test(s)) s = s.toUpperCase();
    else if (/^css3?$/i.test(s)) s = s.toUpperCase();
    else if (/^rest(?:\s*apis?)?$/i.test(s)) s = 'REST APIs';
    else if (/^scikit-?learn$/i.test(s)) s = 'Scikit-learn';
    else if (/^pandas$/i.test(s)) s = 'Pandas';
    else if (/^numpy$/i.test(s)) s = 'NumPy';
    else if (/^gen-?ai$/i.test(s)) s = 'Gen-AI';
    else if (/^power\s*bi$/i.test(s)) s = 'Power BI';
    else if (/^git$/i.test(s)) s = 'Git';
    else if (/^github$/i.test(s)) s = 'GitHub';
    else if (/^mongodb$/i.test(s)) s = 'MongoDB';
    else if (/^data\s*structures?$/i.test(s)) s = 'Data Structures';
    else if (/^oop$/i.test(s)) s = 'OOP';
    else if (/^object-oriented\s*programming$/i.test(s)) s = 'Object-Oriented Programming';
    else if (/^json$/i.test(s)) s = 'JSON';
    else if (/^jdbc$/i.test(s)) s = 'JDBC';
    else if (/^sql$/i.test(s)) s = 'SQL';
    else if (/^nosql$/i.test(s)) s = 'NoSQL';
    else if (/^mern(?:\s*stack)?$/i.test(s)) s = 'MERN Stack';
    else if (/^spring\s*boot$/i.test(s)) s = 'Spring Boot';
    else if (/^flask$/i.test(s)) s = 'Flask';
    else if (/^django$/i.test(s)) s = 'Django';

    const key = s.toLowerCase();
    const noise = new Set([
      'overview', 'features', 'key features', 'project', 'projects', 'technologies',
      'used', 'frontend', 'backend', 'db', 'database', 'details', 'aug', 'apr', 'may',
      'jun', 'jul', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'year', 'years',
      'b.tech', 'cgpa', 'gpa', 'developer', 'engineer', 'intern', 'experience'
    ]);
    if (noise.has(key)) return;

    if (!seenLower.has(key)) {
      seenLower.add(key);
      detectedSkills.push(s);
    }
  }

  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. DYNAMIC SKILLS SECTION PARSER
  // Extracts any and all skills explicitly listed under Skills / Technical Skills / Tech Stack sections
  const sectionStopKeywords = [
    'experience', 'work experience', 'professional experience', 'employment', 'employment history',
    'education', 'academic background', 'academics', 'qualifications',
    'projects', 'academic projects', 'key projects', 'notable projects', 'technical projects',
    'certifications', 'certifications & online courses', 'certifications and online courses', 'certificates',
    'achievements', 'accomplishments', 'awards', 'honors', 'publications', 'languages known'
  ];

  const skillHeaderIdx = lines.findIndex(l => {
    const clean = l.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return /^(?:technical\s+|key\s+|core\s+)?(?:skills|competencies|technologies|proficiencies|tech\s+stack)(?:\s*(?:&|and)\s*tools)?$/i.test(clean) ||
           /^skills\s*&?\s*technologies$/i.test(clean);
  });

  if (skillHeaderIdx !== -1) {
    for (let i = skillHeaderIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      const cleanHeaderTest = line.replace(/[^a-zA-Z\s&]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const noSpace = cleanHeaderTest.replace(/\s+/g, '');
      const isHeader = sectionStopKeywords.some(kw => {
        const kwNoSpace = kw.replace(/\s+/g, '');
        return cleanHeaderTest === kw || cleanHeaderTest.startsWith(kw + ' ') || noSpace === kwNoSpace || noSpace.startsWith(kwNoSpace);
      });
      if (isHeader) break;

      let content = line.replace(/^[\s•\-\*·►▪▫\d.]+\s*/, '').trim();
      const colonIdx = content.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 40) {
        content = content.slice(colonIdx + 1).trim();
      } else {
        const dashMatch = content.match(/^([A-Za-z\s\/&|]{3,35})\s+[–—-]\s+(.+)$/);
        if (dashMatch) content = dashMatch[2].trim();
      }

      const items = content.split(/[,•|;·]|\s+\/\s+/);
      for (const rawItem of items) {
        const item = rawItem.trim();
        if (!item) continue;
        const parenMatch = item.match(/^([^(]+)\s*\(([^)]+)\)$/);
        if (parenMatch) {
          addSkill(parenMatch[2].trim()); // e.g. OOP
          addSkill(parenMatch[1].trim()); // e.g. Object-Oriented Programming
        } else {
          addSkill(item);
        }
      }
    }
  }

  // 2. DYNAMIC PROJECT & EXPERIENCE TECH LINES
  for (const line of lines) {
    const techMatch = line.match(/(?:technologies\s+used|tech\s+stack|tools\s+used|environment)\s*[:–—-]\s*(.+)$/i);
    if (techMatch) {
      const content = techMatch[1];
      const parenRegex = /(?:frontend|backend|database|db|tools|frameworks)?\s*\(([^)]+)\)/gi;
      let m;
      while ((m = parenRegex.exec(content)) !== null) {
        m[1].split(/[,/|]/).forEach(t => addSkill(t.trim()));
      }
      const remaining = content.replace(parenRegex, ' ')
        .replace(/\b(frontend|backend|database|db|tools|frameworks|technologies|stack)\b/gi, ' ');
      remaining.split(/[,/|;•]/).forEach(t => addSkill(t.trim()));
    }
  }

  // 3. FULL RESUME TAXONOMY SCAN
  // Scans all resume text (summary, experience bullets, project descriptions, certifications)
  const normalizedFullText = ` ${resumeText.replace(/[\n,;()]/g, ' ')} `;

  for (const skill of TECH_TAXONOMY) {
    let pattern;
    if (skill === 'C++') {
      pattern = /(?:^|\s)C\+\+(?:$|\s|[\.,;])/i;
    } else if (skill === 'C#') {
      pattern = /(?:^|\s)C#(?:$|\s|[\.,;])/i;
    } else if (skill === '.NET') {
      pattern = /(?:^|\s)\.NET(?:$|\s|[\.,;])/i;
    } else if (skill === 'R') {
      pattern = /(?:^|\s)R(?:$|\s|[\.,;])/;
    } else if (skill === 'AI') {
      pattern = /(?:^|\s)AI(?:$|\s|[\.,;])/;
    } else {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    }

    if (pattern.test(normalizedFullText)) {
      addSkill(skill);
    }
  }

  return detectedSkills;
}

/**
 * Extracts candidate metadata and skills from resume text.
 */
function analyzeResumeText(resumeText, originalName = '') {
  // Validate that document has valid resume structure before parsing
  validateIsResume(resumeText, originalName);

  const lines = resumeText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 1. Detect candidate name using document header/top section
  let detectedName = '';
  let nameFromFilename = false;
  // Check top 18 lines for candidate name; skip section headers
  for (let i = 0; i < Math.min(lines.length, 18); i++) {
    const line = lines[i];

    if (isBodySectionHeader(line)) {
      continue;
    }

    const extracted = extractNameFromLine(line);
    if (extracted) {
      detectedName = toTitleCase(extracted);
      break;
    }
  }

  // If not found in document header lines, check contact fallbacks (LinkedIn, email)
  if (!detectedName) {
    const contactName = extractCandidateNameFromContact(resumeText);
    if (contactName) {
      detectedName = contactName;
    }
  }

  // If the name cannot be confidently detected, show "Candidate" instead of an incorrect section heading
  if (!detectedName) {
    const filenameName = extractNameFromFilename(originalName);
    detectedName = filenameName || 'Candidate';
    nameFromFilename = Boolean(filenameName);
  }

  // 2. Detect technical and soft skills dynamically across the entire resume
  const uniqueSkills = extractSkillsFromResume(resumeText);
  const profileSections = extractResumeProfile(resumeText);

  profileSections.name = detectedName || 'Candidate';
  profileSections.personalInformation = (profileSections.personalInformation || '')
    .split('\n')
    .filter(line => line.trim().toLowerCase() !== (detectedName || '').trim().toLowerCase())
    .join('\n')
    .trim();

  // 3. Detect headline / role
  let detectedRole = '';
  const roleKeywords = [
    'Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
    'DevOps Engineer', 'Cloud Architect', 'Data Scientist', 'Data Engineer', 'Machine Learning Engineer',
    'AI Engineer', 'System Architect', 'Mobile Developer', 'iOS Developer', 'Android Developer',
    'QA Engineer', 'Product Manager'
  ];

  for (const rk of roleKeywords) {
    const reg = new RegExp(`\\b${rk}\\b`, 'i');
    if (reg.test(resumeText)) {
      detectedRole = rk;
      break;
    }
  }
  if (!detectedRole) {
    detectedRole = uniqueSkills.length > 0 ? `${uniqueSkills[0]} Developer` : 'Software Professional';
  }

  // 4. Brief summary preview
  let summary = '';
  const summaryHeaderIdx = lines.findIndex(l => /^(summary|profile|about me|objective|professional summary)/i.test(l));
  if (summaryHeaderIdx !== -1 && lines[summaryHeaderIdx + 1]) {
    summary = lines.slice(summaryHeaderIdx + 1, summaryHeaderIdx + 4).join(' ');
  } else {
    // Pick first substantial paragraph
    const paragraph = lines.find(l => l.length > 60 && !/@|http|\+?\d/.test(l));
    summary = paragraph ? paragraph : lines.slice(0, 3).join(' ');
  }
  if (summary.length > 250) {
    summary = summary.slice(0, 247) + '...';
  }

  // 5. Build personalized greeting
  const isGeneric = (!detectedName || detectedName.toLowerCase() === 'candidate');
  const nameParts = detectedName.split(' ');
  let preferredName = nameParts[0];
  // If first token is a single initial (e.g. "N Rohith Babu" or "P Sai"), address candidate by first given name
  if (nameParts[0].replace(/['.-]/g, '').length === 1 && nameParts.length > 1) {
    preferredName = nameParts[1];
  }
  const nameSalutation = isGeneric ? 'Candidate' : (nameFromFilename ? nameParts[nameParts.length - 1] : preferredName);
  const topSkillStr = uniqueSkills.slice(0, 3).join(', ');
  const greeting = `Hello ${nameSalutation}! I've reviewed your resume and noted your experience${topSkillStr ? ` with ${topSkillStr}` : ''}. Welcome to your AI technical interview. Whenever you're ready, let's start with a brief introduction about yourself and your background.`;

  // 6. Dynamic suggestions for the UI "Try saying:"
  const suggestedQuestions = [];
  if (uniqueSkills.length > 0) {
    suggestedQuestions.push(`"Can we discuss my experience with ${uniqueSkills[0]}?"`);
  }
  if (uniqueSkills.length > 1) {
    suggestedQuestions.push(`"Ask me a technical question about ${uniqueSkills[1]}."`);
  }
  suggestedQuestions.push('"Give me a scenario-based system design question."');
  suggestedQuestions.push('"Ask me a behavioral question about teamwork."');

  return {
    name: detectedName || 'Candidate',
    role: detectedRole,
    skills: uniqueSkills,
    summary,
    sections: profileSections,
    greeting,
    suggestedQuestions
  };
}

module.exports = {
  extractTextFromFile,
  analyzeResumeText,
  validateIsResume,
  extractSkillsFromResume
};

