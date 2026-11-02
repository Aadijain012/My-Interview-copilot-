const { app, desktopCapturer, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testOCR() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const captureWidth = Math.round(width * scaleFactor);
    const captureHeight = Math.round(height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: captureWidth, height: captureHeight },
    });

    if (sources.length === 0) {
      console.log('No sources found.');
      app.quit();
      return;
    }

    const imageBuffer = sources[0].thumbnail.toJPEG(90);
    const uniqueId = `${Date.now()}`;
    const tempImgPath = path.join(app.getPath('temp'), `test_ocr_${uniqueId}.jpg`);
    fs.writeFileSync(tempImgPath, imageBuffer);

    console.log('Saved screenshot to:', tempImgPath);

    const psScript = `
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.RandomAccessStreamReference, Windows.Storage, ContentType = WindowsRuntime] | Out-Null

$file = Get-Item "${tempImgPath.replace(/\\/g, '\\\\')}"
$stream = [Windows.Storage.Streams.RandomAccessStreamReference]::CreateFromFile($file).OpenReadAsync().GetResults()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetResults()
$softwareBitmap = $decoder.GetSoftwareBitmapAsync().GetResults()

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrResult = $engine.RecognizeAsync($softwareBitmap).GetResults()
Write-Output $ocrResult.Text
`;

    const tempScriptPath = path.join(app.getPath('temp'), `test_ocr_script_${uniqueId}.ps1`);
    fs.writeFileSync(tempScriptPath, psScript, 'utf8');

    const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath]);
    let stdout = '';
    child.stdout.on('data', (d) => stdout += d.toString());
    child.on('close', () => {
      console.log('--- OCR RESULT ---');
      console.log(stdout.trim());
      console.log('------------------');
      
      try {
        fs.unlinkSync(tempImgPath);
        fs.unlinkSync(tempScriptPath);
      } catch(e) {}
      app.quit();
    });
  } catch (err) {
    console.error(err);
    app.quit();
  }
}

app.whenReady().then(testOCR);
