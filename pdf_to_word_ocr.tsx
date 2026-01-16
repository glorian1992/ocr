import React, { useState, useRef } from 'react';
import { FileText, Upload, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function PDFToWordConverter() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setFile(selectedFile);
        setError('');
        setResult('');
        setProgress('');
      } else {
        setError('Ju lutem zgjidhni një skedar PDF');
        setFile(null);
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf'))) {
      setFile(droppedFile);
      setError('');
      setResult('');
      setProgress('');
    } else {
      setError('Ju lutem zgjidhni një skedar PDF');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processPDF = async () => {
    if (!file) {
      setError('Ju lutem zgjidhni një skedar PDF');
      return;
    }

    setProcessing(true);
    setError('');
    setResult('');
    setProgress('Duke lexuar skedarin...');
    
    try {
      // Lexojmë PDF-në si Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      setProgress('Duke konvertuar në base64...');
      
      // Konvertojmë në base64
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      setProgress('Duke dërguar për OCR... (Kjo mund të zgjasë disa sekonda)');

      // Përdorim API-në e Claude me parametra të optimizuar për dokumente të mëdha
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 32000, // Maksimumi i lejuar për përmbajtje të gjatë
          temperature: 0, // Për rezultate konsistente
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64
                  }
                },
                {
                  type: "text",
                  text: `Ekstrakto TË GJITHË tekstin nga ky dokument PDF. Kjo është një kërkesë KRITIKE:

1. Lexo dhe ekstrakto përmbajtjen e ÇDO faqeje nga fillimi deri në fund
2. Mos anashkalo ASNJË faqe - edhe nëse dokumenti është i gjatë
3. Ruaj formatimin origjinal:
   - Titujt dhe nëntitujt
   - Paragrafët dhe hapësirat
   - Listat me numra ose simbole
   - Tabelat (përpiqu t'i ruash me hapësira)
   - Datat, emrat, numrat, adresat
4. Nëse dokumenti ka 12 faqe, duhet të ekstraktosh të gjitha 12 faqet
5. Fillo nga faqja e parë dhe vazhdo deri në faqen e fundit pa u ndalur

Kthe tekstin e plotë të dokumentit në formatin më të lexueshëm të mundshëm për Word.`
                }
              ]
            }
          ]
        })
      });

      setProgress('Duke përpunuar rezultatet...');

      const data = await response.json();
      
      if (data.content && data.content.length > 0) {
        const extractedText = data.content
          .filter(item => item.type === "text")
          .map(item => item.text)
          .join("\n\n");
        
        if (extractedText.trim()) {
          setResult(extractedText);
          setProgress('');
          
          // Numërojmë fjalët për të dhënë një ide të madhësisë
          const wordCount = extractedText.trim().split(/\s+/).length;
          console.log(`Ekstraktuar: ${wordCount} fjalë`);
        } else {
          setError('Nuk u gjet tekst në këtë PDF. Mund të jetë bosh ose të ketë vetëm imazhe.');
          setProgress('');
        }
      } else {
        setError('Nuk u gjet përmbajtje në PDF');
        setProgress('');
      }
    } catch (err) {
      setError('Gabim gjatë përpunimit: ' + err.message);
      setProgress('');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const downloadAsWord = () => {
    if (!result) return;
    
    // Krijojmë një dokument HTML që Word mund ta hapë me formatim më të mirë
    const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Dokument i Konvertuar</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      margin: 2.54cm;
    }
    body { 
      font-family: 'Calibri', 'Arial', sans-serif; 
      font-size: 11pt;
      line-height: 1.5; 
      margin: 0;
      padding: 0;
    }
    p { 
      margin: 0 0 10pt 0; 
    }
    pre {
      white-space: pre-wrap;
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      margin: 0;
    }
  </style>
</head>
<body>
  <pre>${result.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    
    const blob = new Blob(['\ufeff', htmlContent], { 
      type: 'application/msword' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = file.name.replace('.pdf', '') + '_konvertuar.doc';
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      alert('✓ Teksti u kopjua në clipboard!');
    } catch (err) {
      alert('Gabim gjatë kopjimit');
    }
  };

  const getWordCount = () => {
    if (!result) return 0;
    return result.trim().split(/\s+/).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                PDF në Word - OCR Profesional
              </h1>
              <p className="text-sm text-gray-500">Deri në 12+ faqe, ekstraktim i plotë</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* File Upload Zone */}
            <div 
              onClick={handleClick}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-indigo-300 rounded-xl p-8 md:p-12 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {!file ? (
                <>
                  <Upload className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-700 font-medium mb-2">
                    Kliko këtu ose zvarrit PDF-në
                  </p>
                  <p className="text-sm text-gray-500">
                    Pranon PDF deri në 12+ faqe
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="text-lg font-semibold text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Process Button */}
            <button
              onClick={processPDF}
              disabled={!file || processing}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {progress || 'Duke përpunuar...'}
                </span>
              ) : (
                'Konverto në Word (Max 32,000 tokens)'
              )}
            </button>

            {/* Progress indicator */}
            {processing && progress && (
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                <p className="text-blue-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-800">
                        Ekstraktimi u krye me sukses!
                      </h3>
                    </div>
                    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                      ~{getWordCount()} fjalë
                    </span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                      {result}
                    </pre>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={downloadAsWord}
                    className="bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Download className="w-5 h-5" />
                    Shkarko si Word (.doc)
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    📋 Kopjo në Clipboard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              💡 Veçoritë e reja:
            </h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✅ <strong>Deri në 32,000 tokens</strong> - përballon dokumente deri në 12+ faqe</li>
              <li>✅ <strong>OCR i plotë</strong> - ekstrakton tekst nga të gjitha faqet</li>
              <li>✅ <strong>Ruajtje formatimi</strong> - tituj, paragrafe, lista, tabela</li>
              <li>✅ <strong>Export në Word</strong> - gati për editim të mëtejshëm</li>
              <li>✅ <strong>Progres në kohë reale</strong> - shikon se çfarë po ndodh</li>
            </ul>
          </div>

          {/* Warning for very large documents */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Shënim:</strong> Për dokumente shumë të mëdha (15+ faqe me shumë tekst), procesi mund të zgjasë 30-60 sekonda. 
              Nëse dokumenti ka më shumë se 32,000 tokens përmbajtje, mund të duhet ta ndash në pjesë më të vogla.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}