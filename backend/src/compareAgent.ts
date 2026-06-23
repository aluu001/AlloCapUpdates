import { ai, config } from './config';
import { Type } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const GEMINI_MODEL = 'gemini-3.5-flash';

// Define the JSON schema for an individual page comparison report
const pageComparisonSchema = {
  type: Type.OBJECT,
  properties: {
    textChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of content and text changes for this page.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the change was found.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., added, modified, deleted).' },
          description: { type: Type.STRING, description: 'Detailed explanation of the change.' },
          originalText: { type: Type.STRING, description: 'Original text or clause (if applicable).' },
          revisedText: { type: Type.STRING, description: 'Revised text or clause (if applicable).' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' },
          potentialImpact: { type: Type.STRING, description: 'A brief two-sentence explanation of the potential impact (risk, liability, compliance, or operations) of this change.' }
        },
        required: ['page', 'type', 'description', 'severity', 'potentialImpact']
      }
    },
    tableChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of structural or value changes in tables for this page.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the table is located.' },
          tableName: { type: Type.STRING, description: 'Name or description of the table.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., row_added, value_modified, structure_altered).' },
          description: { type: Type.STRING, description: 'Detailed explanation of table changes.' },
          originalText: { type: Type.STRING, description: 'Verbatim content or cell value before the change.' },
          revisedText: { type: Type.STRING, description: 'Verbatim content or cell value after the change.' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' },
          potentialImpact: { type: Type.STRING, description: 'A brief two-sentence explanation of the potential impact (risk, liability, compliance, or operations) of this change.' }
        },
        required: ['page', 'tableName', 'type', 'description', 'severity', 'potentialImpact']
      }
    },
    visualChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of visual changes, charts, logos, or layout shifts for this page.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the visual element is located.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., logo_replaced, diagram_updated, layout_shifted).' },
          description: { type: Type.STRING, description: 'Detailed explanation of visual changes.' },
          originalText: { type: Type.STRING, description: 'The visual state or text representation before the change.' },
          revisedText: { type: Type.STRING, description: 'The visual state or text representation after the change.' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' },
          potentialImpact: { type: Type.STRING, description: 'A brief two-sentence explanation of the potential impact (risk, liability, compliance, or operations) of this change.' }
        },
        required: ['page', 'type', 'description', 'severity', 'potentialImpact']
      }
    }
  },
  required: ['textChanges', 'tableChanges', 'visualChanges']
};

// Define the JSON schema for the standard (overall) comparison report
const comparisonSchema = {
  type: Type.OBJECT,
  properties: {
    overallSummary: {
      type: Type.STRING,
      description: 'An executive summary of the overall changes between the two documents.'
    },
    riskRating: {
      type: Type.STRING,
      description: 'Risk assessment of the changes: low, medium, or high.'
    },
    textChanges: pageComparisonSchema.properties.textChanges,
    tableChanges: pageComparisonSchema.properties.tableChanges,
    visualChanges: pageComparisonSchema.properties.visualChanges
  },
  required: ['overallSummary', 'riskRating', 'textChanges', 'tableChanges', 'visualChanges']
};

// Define the JSON schema for the final overall summary generation
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    overallSummary: {
      type: Type.STRING,
      description: 'An executive summary of the overall changes between the two documents.'
    },
    riskRating: {
      type: Type.STRING,
      description: 'Risk assessment of the changes: low, medium, or high.'
    }
  },
  required: ['overallSummary', 'riskRating']
};

// Define the JSON schema for document compatibility/alignment validation
const documentValidationSchema = {
  type: Type.OBJECT,
  properties: {
    related: {
      type: Type.BOOLEAN,
      description: 'True only if the two files are revisions, drafts, amendments, or different versions of the EXACT SAME base agreement, contract, or project document. False if they are different agreements/contracts entirely (even if they are of the same type like two different lease agreements), or cover completely different subject matters.'
    },
    reason: {
      type: Type.STRING,
      description: 'A detailed reason explaining why they are related or why they are completely unrelated.'
    }
  },
  required: ['related', 'reason']
};

/**
 * Polls the Gemini Files API until the uploaded file state is ACTIVE.
 */
async function waitForFileActive(fileName: string, onProgress?: (msg: string) => void): Promise<void> {
  const maxRetries = 30; // 60 seconds max
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const file = await ai.files.get({ name: fileName });
    if (file.state === 'ACTIVE') {
      return;
    }
    if (file.state === 'FAILED') {
      throw new Error(`File processing failed on Gemini servers: ${fileName}`);
    }
    if (onProgress) {
      onProgress(`Processing file on Gemini servers (attempt ${attempt + 1}/${maxRetries}, status: ${file.state})...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timeout waiting for file ${fileName} to be processed.`);
}

/**
 * Splits a PDF file into individual single-page PDF files locally.
 * Returns an array of absolute paths to the split PDF files.
 */
async function splitPdf(inputPath: string, outputDir: string, filePrefix: string): Promise<string[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const data = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(data);
  const pageCount = pdfDoc.getPageCount();
  const pagePaths: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    
    const outputPath = path.join(outputDir, `${filePrefix}_page_${i + 1}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);
    pagePaths.push(outputPath);
  }

  return pagePaths;
}

/**
 * Recursively deletes a directory and all of its contents.
 */
function cleanupTempDir(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to clean up temp directory ${dirPath}:`, err);
  }
}

/**
 * Compares two uploaded documents using Gemini 3.5 Flash supporting both Standard (fast single-pass) 
 * and Thorough (page-by-page chunks) comparison modes.
 */
export async function compareDocumentsStream(
  fileAPath: string,
  fileBPath: string,
  fileAName: string,
  fileBName: string,
  onThought: (thought: string) => void,
  onProgress: (msg: string) => void,
  mode: 'standard' | 'thorough' = 'standard'
) {
  let fileARef: any = null;
  let fileBRef: any = null;
  const geminiFilesToDelete: string[] = [];
  let tempDirPath: string | null = null;

  try {
    // 5. STANDARD MODE: Fast Single-Pass Comparison
    if (mode === 'standard') {
      onProgress(`Uploading Original Document (${fileAName}) to Gemini Files API...`);
      fileARef = await ai.files.upload({
        file: fileAPath,
        config: {
          mimeType: 'application/pdf',
          displayName: `Original_${fileAName}`
        }
      });
      geminiFilesToDelete.push(fileARef.name);

      onProgress(`Uploading Revised Document (${fileBName}) to Gemini Files API...`);
      fileBRef = await ai.files.upload({
        file: fileBPath,
        config: {
          mimeType: 'application/pdf',
          displayName: `Revised_${fileBName}`
        }
      });
      geminiFilesToDelete.push(fileBRef.name);

      // Wait for both files to become ACTIVE
      onProgress('Waiting for Original Document to process...');
      await waitForFileActive(fileARef.name, onProgress);

      onProgress('Waiting for Revised Document to process...');
      await waitForFileActive(fileBRef.name, onProgress);

      // Verify that the two documents are actually related before auditing
      onProgress('Verifying document alignment and compatibility...');
      const validationResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            text: `You are an expert document comparison auditor. You must analyze the content, titles, subject matter, entities/parties, and structure of these two uploaded documents and determine if they are compatible for comparison.

            CRITICAL COMPATIBILITY RULES:
            1. The documents MUST be revisions, drafts, amendments, or different versions of the EXACT SAME underlying agreement, contract, report, or specific project.
            2. If the documents are different agreements entirely—even if they are of the same type (for example, two different lease agreements for different properties/tenants, or two different employment contracts for different people)—they are NOT compatible. You MUST flag them as mismatched (related = false).
            3. If the documents cover completely different subject matters, programs, states, or purposes (for example, Georgia DHS CAP program vs a corporate handbook, or an expenditure audit vs a payroll data format), they are NOT compatible. You MUST flag them as mismatched (related = false).
            4. Perform a rigorous, conservative assessment. If they are not versions of the same document, they are mismatched.`
          },
          { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
          { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } }
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: documentValidationSchema,
          temperature: 0.1
        }
      });

      let isRelated = true;
      let mismatchReason = '';
      try {
        const valData = JSON.parse(validationResponse.text || '{}');
        if (valData.related === false) {
          isRelated = false;
          mismatchReason = valData.reason || 'The selected documents represent completely unrelated content.';
        }
      } catch (e) {
        console.error('Failed to parse document relationship validation, continuing comparison', e);
      }

      if (!isRelated) {
        throw new Error(`Document Mismatch: ${mismatchReason}`);
      }

      onProgress('Comparing documents textually and visually in Standard Mode...');
      const responseStream = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: [
          {
            text: `You are an expert document auditor. Compare the following two documents in detail.
            Document A is the Original document (name: "${fileAName}").
            Document B is the Revised document (name: "${fileBName}").
            
            Perform a highly detailed comparison and identify every difference:
            1. **Text Content**: Identify modifications, deletions, and additions in the text. Look for changes in names, definitions, percentages, dates, and clauses.
               - For 'added' items: Set 'originalText' to null or an empty string, and populate 'revisedText' with the exact verbatim text that was added.
               - For 'deleted' items: Populate 'originalText' with the exact verbatim text that was deleted, and set 'revisedText' to null or an empty string.
               - For 'modified' items: Verbatim before (originalText) and after (revisedText) segments must be provided.
               - Never paraphrase or summarize inside the originalText or revisedText fields; extract the exact segments verbatim.
            2. **Tables**: Identify any changes in tables (structure, new rows, new columns, value updates). Be highly specific about the columns, row headers, or cells modified.
               - For table changes, always extract the verbatim content/value of the table section or row before (originalText) and after (revisedText) the change. If the row or cell did not exist in one of the documents, set that field to an empty string.
            3. **Visuals & Layout**: Identify any changes in images, charts, flowchart diagrams, headers/footers, or layout styles.
               - For visual changes, provide a clear text description of the visual element or layout before (originalText) and after (revisedText) the change (e.g. old logo description vs new logo description).
            
            For each and every identified change in text, tables, and visuals, provide a brief two-sentence explanation (in the 'potentialImpact' field) of the potential impact of the change in terms of document compliance, operational risk, or liability.
            
            Generate a structured JSON output according to the requested schema.`
          },
          { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
          { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } }
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: comparisonSchema,
          temperature: 0.1,
          thinkingConfig: {
            thinkingBudget: 4096, // Set thinking tokens budget
            includeThoughts: true,
          }
        }
      });

      let fullJsonText = '';
      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.thought || (part as any).thought) {
              if (part.text) {
                onThought(part.text);
              }
            } else {
              fullJsonText += part.text || '';
            }
          }
        }
      }

      onProgress('Parsing comparison results...');
      if (!fullJsonText.trim()) {
        throw new Error('Gemini returned an empty response.');
      }

      return JSON.parse(fullJsonText);
    }

    // 6. THOROUGH MODE: Local Page-Splitting & Single-Page Targeted Comparisons
    onProgress('Analyzing page counts of documents locally...');
    const dataA = fs.readFileSync(fileAPath);
    const pdfDocA = await PDFDocument.load(dataA);
    const pageCountA = pdfDocA.getPageCount();

    const dataB = fs.readFileSync(fileBPath);
    const pdfDocB = await PDFDocument.load(dataB);
    const pageCountB = pdfDocB.getPageCount();

    const maxPages = Math.max(pageCountA, pageCountB);
    onProgress(`Detected ${pageCountA} pages (Original) vs ${pageCountB} pages (Revised). Preparing comparative scan over ${maxPages} pages...`);

    onProgress('Splitting documents locally page-by-page...');
    const sessionId = `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    tempDirPath = path.join(config.storageDir, 'temp_split', sessionId);
    
    const pagePathsA = await splitPdf(fileAPath, tempDirPath, 'original');
    const pagePathsB = await splitPdf(fileBPath, tempDirPath, 'revised');

    onProgress('Uploading Page 1 segments to verify alignment...');
    const page1PathA = pagePathsA[0];
    const page1PathB = pagePathsB[0];

    let page1RefA: any = null;
    let page1RefB: any = null;

    if (page1PathA && fs.existsSync(page1PathA)) {
      page1RefA = await ai.files.upload({
        file: page1PathA,
        config: { mimeType: 'application/pdf', displayName: `Original_Page_1` }
      });
      geminiFilesToDelete.push(page1RefA.name);
    }

    if (page1PathB && fs.existsSync(page1PathB)) {
      page1RefB = await ai.files.upload({
        file: page1PathB,
        config: { mimeType: 'application/pdf', displayName: `Revised_Page_1` }
      });
      geminiFilesToDelete.push(page1RefB.name);
    }

    if (page1RefA) await waitForFileActive(page1RefA.name, onProgress);
    if (page1RefB) await waitForFileActive(page1RefB.name, onProgress);

    onProgress('Verifying document alignment and compatibility on Page 1...');
    const validationContents: any[] = [
      {
        text: `You are an expert document comparison auditor. You must analyze the content, titles, subject matter, entities/parties, and structure of these two uploaded Page 1 segments and determine if they are compatible for comparison.

        CRITICAL COMPATIBILITY RULES:
        1. The documents MUST be revisions, drafts, amendments, or different versions of the EXACT SAME underlying agreement, contract, report, or specific project.
        2. If the documents are different agreements entirely—even if they are of the same type (for example, two different lease agreements for different properties/tenants, or two different employment contracts for different people)—they are NOT compatible. You MUST flag them as mismatched (related = false).
        3. If the documents cover completely different subject matters, programs, states, or purposes (for example, Georgia DHS CAP program vs a corporate handbook, or an expenditure audit vs a payroll data format), they are NOT compatible. You MUST flag them as mismatched (related = false).
        4. Perform a rigorous, conservative assessment. If they are not versions of the same document, they are mismatched.`
      }
    ];

    if (page1RefA) validationContents.push({ fileData: { fileUri: page1RefA.uri, mimeType: page1RefA.mimeType } });
    if (page1RefB) validationContents.push({ fileData: { fileUri: page1RefB.uri, mimeType: page1RefB.mimeType } });

    const validationResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: validationContents,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: documentValidationSchema,
        temperature: 0.1
      }
    });

    let isRelated = true;
    let mismatchReason = '';
    try {
      const valData = JSON.parse(validationResponse.text || '{}');
      if (valData.related === false) {
        isRelated = false;
        mismatchReason = valData.reason || 'The selected documents represent completely unrelated content.';
      }
    } catch (e) {
      console.error('Failed to parse document relationship validation, continuing comparison', e);
    }

    if (!isRelated) {
      throw new Error(`Document Mismatch: ${mismatchReason}`);
    }

    // Helper function to compare an individual page using content streams
    async function comparePage(pageNumber: number): Promise<any> {
      let pageRefA: any = null;
      let pageRefB: any = null;
      try {
        if (pageNumber === 1) {
          pageRefA = page1RefA;
          pageRefB = page1RefB;
        } else {
          const pagePathA = pagePathsA[pageNumber - 1];
          if (pagePathA && fs.existsSync(pagePathA)) {
            pageRefA = await ai.files.upload({
              file: pagePathA,
              config: { mimeType: 'application/pdf', displayName: `Original_Page_${pageNumber}` }
            });
          }

          const pagePathB = pagePathsB[pageNumber - 1];
          if (pagePathB && fs.existsSync(pagePathB)) {
            pageRefB = await ai.files.upload({
              file: pagePathB,
              config: { mimeType: 'application/pdf', displayName: `Revised_Page_${pageNumber}` }
            });
          }

          if (pageRefA) await waitForFileActive(pageRefA.name);
          if (pageRefB) await waitForFileActive(pageRefB.name);
        }

        const contents: any[] = [
          {
            text: `You are an expert document auditor. Compare the contents of this page of the Original document ("${fileAName}") with this page of the Revised document ("${fileBName}").
            
            CRITICAL REQUIREMENT: Identify and report every single difference on this specific page. Even if a modification is a single-letter change (e.g. spelling fixes, punctuation updates, singular vs. plural, one-letter edits, or formatting corrections), you MUST report it. Absolutely do NOT omit, skip, summarize, or group any changes on this page.
            
            Identify every difference:
            1. **Text Content**: Identify modifications, deletions, and additions in the text on this page.
               - For 'added' items: Set 'originalText' to null or empty, and populate 'revisedText' with the verbatim text that was added.
               - For 'deleted' items: Populate 'originalText' with the verbatim text that was deleted, and set 'revisedText' to null or empty.
               - For 'modified' items: Verbatim before (originalText) and after (revisedText) segments must be provided.
               - Never paraphrase or summarize inside originalText/revisedText; extract the exact segments verbatim.
            2. **Tables**: Identify any changes in tables (structure, new rows, new columns, value updates) on this page. Always extract the verbatim content/value of the table section or row before (originalText) and after (revisedText) the change.
            3. **Visuals & Layout**: Identify any changes in images, charts, flowchart diagrams, headers/footers, or layout styles on this page. Provide a clear text description of the visual element or layout before (originalText) and after (revisedText).
            
            For each and every identified change in text, tables, and visuals, provide a brief two-sentence explanation (in the 'potentialImpact' field) of the potential impact of the change in terms of compliance, operational risk, or liability.
            
            If this page only exists in one of the documents (because it is an extra page in the other), treat all content on this page as entirely added or deleted.
            
            Generate a structured JSON output according to the requested schema.`
          }
        ];

        if (pageRefA) contents.push({ fileData: { fileUri: pageRefA.uri, mimeType: pageRefA.mimeType } });
        if (pageRefB) contents.push({ fileData: { fileUri: pageRefB.uri, mimeType: pageRefB.mimeType } });

        const responseStream = await ai.models.generateContentStream({
          model: GEMINI_MODEL,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: pageComparisonSchema,
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 2048,
              includeThoughts: true
            }
          }
        });

        let pageJson = '';
        for await (const chunk of responseStream) {
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.thought || (part as any).thought) {
                if (part.text) {
                  onThought(`[Page ${pageNumber} Analysis]: ${part.text}`);
                }
              } else {
                pageJson += part.text || '';
              }
            }
          }
        }

        if (!pageJson.trim()) return { textChanges: [], tableChanges: [], visualChanges: [] };
        const parsed = JSON.parse(pageJson);

        // Standardize page values as string page numbers
        if (parsed.textChanges) parsed.textChanges.forEach((c: any) => c.page = String(pageNumber));
        if (parsed.tableChanges) parsed.tableChanges.forEach((c: any) => c.page = String(pageNumber));
        if (parsed.visualChanges) parsed.visualChanges.forEach((c: any) => c.page = String(pageNumber));

        return parsed;
      } catch (err: any) {
        console.error(`Error comparing page ${pageNumber}:`, err);
        return { textChanges: [], tableChanges: [], visualChanges: [] };
      } finally {
        // Clean up Gemini Files for this page immediately (except Page 1, which is deleted in outer finally)
        if (pageNumber > 1) {
          const toDelete = [];
          if (pageRefA?.name) toDelete.push(ai.files.delete({ name: pageRefA.name }));
          if (pageRefB?.name) toDelete.push(ai.files.delete({ name: pageRefB.name }));
          await Promise.all(toDelete).catch(err => console.error(`Failed to delete page ${pageNumber} files from Gemini:`, err));
        }
      }
    }

    const aggregated = {
      textChanges: [] as any[],
      tableChanges: [] as any[],
      visualChanges: [] as any[]
    };

    // Loop through all pages using a controlled concurrency of 3
    const concurrency = 3;
    for (let i = 1; i <= maxPages; i += concurrency) {
      const batch = [];
      for (let j = 0; j < concurrency && (i + j) <= maxPages; j++) {
        const pageNum = i + j;
        batch.push((async () => {
          onProgress(`Auditing page ${pageNum} of ${maxPages}...`);
          const res = await comparePage(pageNum);
          return res;
        })());
      }
      const batchResults = await Promise.all(batch);
      for (const res of batchResults) {
        if (res.textChanges) aggregated.textChanges.push(...res.textChanges);
        if (res.tableChanges) aggregated.tableChanges.push(...res.tableChanges);
        if (res.visualChanges) aggregated.visualChanges.push(...res.visualChanges);
      }
    }

    // 7. Generate overall executive summary and risk assessment for Thorough mode
    onProgress('Generating overall summary and risk assessment...');
    const summaryResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          text: `You are an expert document auditor. Below is a compiled list of all changes identified between two documents:
          
          TEXT CHANGES:
          ${JSON.stringify(aggregated.textChanges, null, 2)}
          
          TABLE CHANGES:
          ${JSON.stringify(aggregated.tableChanges, null, 2)}
          
          VISUAL CHANGES:
          ${JSON.stringify(aggregated.visualChanges, null, 2)}
          
          Based on this compiled list, generate:
          1. A comprehensive, executive-friendly overall summary of the changes.
          2. A risk assessment rating (low, medium, or high) reflecting the cumulative severity and impact of these changes.
          
          Generate a structured JSON output according to the requested schema.`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: summarySchema,
        temperature: 0.1
      }
    });

    let overallSummary = 'A detailed comparison was performed. No major changes detected.';
    let riskRating = 'low';

    try {
      const summaryData = JSON.parse(summaryResponse.text || '{}');
      if (summaryData.overallSummary) overallSummary = summaryData.overallSummary;
      if (summaryData.riskRating) riskRating = summaryData.riskRating;
    } catch (e) {
      console.error('Failed to parse overall summary response', e);
    }

    return {
      overallSummary,
      riskRating,
      textChanges: aggregated.textChanges,
      tableChanges: aggregated.tableChanges,
      visualChanges: aggregated.visualChanges
    };

  } finally {
    // 8. Cleanup remaining files from Gemini storage
    const cleanupPromises: Promise<any>[] = [];
    for (const fileName of geminiFilesToDelete) {
      onProgress(`Cleaning up file ${fileName} from Gemini storage...`);
      cleanupPromises.push(ai.files.delete({ name: fileName }).catch(err => {
        // Silently catch if already deleted
      }));
    }
    await Promise.all(cleanupPromises);

    // Cleanup local temp split files
    if (tempDirPath) {
      onProgress('Cleaning up local temporary files...');
      cleanupTempDir(tempDirPath);
    }
  }
}
