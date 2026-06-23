import { ai } from './config';
import { Type } from '@google/genai';

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

  try {
    // 1. Upload original document
    onProgress(`Uploading Original Document (${fileAName}) to Gemini Files API...`);
    fileARef = await ai.files.upload({
      file: fileAPath,
      config: {
        mimeType: 'application/pdf',
        displayName: `Original_${fileAName}`
      }
    });

    // 2. Upload revised document
    onProgress(`Uploading Revised Document (${fileBName}) to Gemini Files API...`);
    fileBRef = await ai.files.upload({
      file: fileBPath,
      config: {
        mimeType: 'application/pdf',
        displayName: `Revised_${fileBName}`
      }
    });

    // 3. Wait for both files to become ACTIVE
    onProgress('Waiting for Original Document to process...');
    await waitForFileActive(fileARef.name, onProgress);

    onProgress('Waiting for Revised Document to process...');
    await waitForFileActive(fileBRef.name, onProgress);

    // 4. Verify that the two documents are actually related before auditing
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

    // 5. STANDARD MODE: Fast Single-Pass Comparison
    if (mode === 'standard') {
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

    // 6. THOROUGH MODE: Page-by-Page Batched Loops
    onProgress('Analyzing page count of original document...');
    const pageCountAResp = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
        { text: 'Return a JSON object containing the total page count of this PDF document. Format: { "pageCount": <number> }. Do not include markdown brackets.' }
      ],
      config: { responseMimeType: 'application/json' }
    });

    let pageCountA = 1;
    try {
      const data = JSON.parse(pageCountAResp.text || '{}');
      if (data.pageCount) pageCountA = Number(data.pageCount);
    } catch (e) {
      console.error('Failed to parse page count for original document, defaulting to 1', e);
    }

    onProgress('Analyzing page count of revised document...');
    const pageCountBResp = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } },
        { text: 'Return a JSON object containing the total page count of this PDF document. Format: { "pageCount": <number> }. Do not include markdown brackets.' }
      ],
      config: { responseMimeType: 'application/json' }
    });

    let pageCountB = 1;
    try {
      const data = JSON.parse(pageCountBResp.text || '{}');
      if (data.pageCount) pageCountB = Number(data.pageCount);
    } catch (e) {
      console.error('Failed to parse page count for revised document, defaulting to 1', e);
    }

    const maxPages = Math.max(pageCountA, pageCountB);
    onProgress(`Detected ${pageCountA} pages (Original) vs ${pageCountB} pages (Revised). Preparing comparative scan over ${maxPages} pages...`);

    // Helper function to compare an individual page using content streams
    async function comparePage(pageNumber: number): Promise<any> {
      try {
        const responseStream = await ai.models.generateContentStream({
          model: GEMINI_MODEL,
          contents: [
            {
              text: `You are an expert document auditor. Focus ONLY on Page ${pageNumber} of both documents. Compare the contents on Page ${pageNumber} of the Original document ("${fileAName}") with Page ${pageNumber} of the Revised document ("${fileBName}").
              
              CRITICAL REQUIREMENT: Identify and report every single difference on this specific page. Even if a modification is a single-letter change (e.g. spelling fixes, punctuation updates, singular vs. plural, one-letter edits, or formatting corrections), you MUST report it. Absolutely do NOT omit, skip, summarize, or group any changes on Page ${pageNumber}.
              
              Identify every difference:
              1. **Text Content**: Identify modifications, deletions, and additions in the text on Page ${pageNumber}.
                 - For 'added' items: Set 'originalText' to null or empty, and populate 'revisedText' with the verbatim text that was added.
                 - For 'deleted' items: Populate 'originalText' with the verbatim text that was deleted, and set 'revisedText' to null or empty.
                 - For 'modified' items: Verbatim before (originalText) and after (revisedText) segments must be provided.
                 - Never paraphrase or summarize inside originalText/revisedText; extract the exact segments verbatim.
              2. **Tables**: Identify any changes in tables (structure, new rows, new columns, value updates) on Page ${pageNumber}. Always extract the verbatim content/value of the table section or row before (originalText) and after (revisedText) the change.
              3. **Visuals & Layout**: Identify any changes in images, charts, flowchart diagrams, headers/footers, or layout styles on Page ${pageNumber}. Provide a clear text description of the visual element or layout before (originalText) and after (revisedText).
              
              For each and every identified change in text, tables, and visuals, provide a brief two-sentence explanation (in the 'potentialImpact' field) of the potential impact of the change in terms of compliance, operational risk, or liability.
              
              If one of the documents does not have a Page ${pageNumber} (because it has fewer pages), treat all content on Page ${pageNumber} of the other document as entirely added or deleted.
              
              Generate a structured JSON output according to the requested schema.`
            },
            { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
            { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } }
          ],
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
    // 8. Cleanup files from Gemini storage
    const cleanupPromises: Promise<any>[] = [];
    if (fileARef?.name) {
      onProgress(`Cleaning up original file from Gemini storage...`);
      cleanupPromises.push(ai.files.delete({ name: fileARef.name }).catch(err => {
        console.error(`Failed to delete temporary file ${fileARef.name}:`, err);
      }));
    }
    if (fileBRef?.name) {
      onProgress(`Cleaning up revised file from Gemini storage...`);
      cleanupPromises.push(ai.files.delete({ name: fileBRef.name }).catch(err => {
        console.error(`Failed to delete temporary file ${fileBRef.name}:`, err);
      }));
    }
    await Promise.all(cleanupPromises);
  }
}
