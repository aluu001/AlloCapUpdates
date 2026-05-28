import { ai } from './config';
import { Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3.5-flash';

// Define the JSON schema for the comparison report
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
    textChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of content and text changes.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the change was found.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., added, modified, deleted).' },
          description: { type: Type.STRING, description: 'Detailed explanation of the change.' },
          originalText: { type: Type.STRING, description: 'Original text or clause (if applicable).' },
          revisedText: { type: Type.STRING, description: 'Revised text or clause (if applicable).' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' }
        },
        required: ['page', 'type', 'description', 'severity']
      }
    },
    tableChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of structural or value changes in tables.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the table is located.' },
          tableName: { type: Type.STRING, description: 'Name or description of the table.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., row_added, value_modified, structure_altered).' },
          description: { type: Type.STRING, description: 'Detailed explanation of table changes.' },
          originalText: { type: Type.STRING, description: 'Verbatim content or cell value before the change (originalText).' },
          revisedText: { type: Type.STRING, description: 'Verbatim content or cell value after the change (revisedText).' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' }
        },
        required: ['page', 'tableName', 'type', 'description', 'severity']
      }
    },
    visualChanges: {
      type: Type.ARRAY,
      description: 'Detailed list of visual changes, including charts, logos, diagrams, or structural layout shifts.',
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING, description: 'Page number where the visual element is located.' },
          type: { type: Type.STRING, description: 'Type of change (e.g., logo_replaced, diagram_updated, layout_shifted).' },
          description: { type: Type.STRING, description: 'Detailed explanation of visual changes.' },
          originalText: { type: Type.STRING, description: 'The visual state or text representation before the change (originalText).' },
          revisedText: { type: Type.STRING, description: 'The visual state or text representation after the change (revisedText).' },
          severity: { type: Type.STRING, description: 'Severity of the change (low, medium, high).' }
        },
        required: ['page', 'type', 'description', 'severity']
      }
    }
  },
  required: ['overallSummary', 'riskRating', 'textChanges', 'tableChanges', 'visualChanges']
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
 * Compares two uploaded documents using Gemini 3.5 Flash and returns a structured JSON report.
 */
export async function compareDocumentsStream(
  fileAPath: string,
  fileBPath: string,
  fileAName: string,
  fileBName: string,
  onThought: (thought: string) => void,
  onProgress: (msg: string) => void
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

    // 4. Generate comparison content stream
    onProgress('Comparing documents textually and visually using Gemini 3.5 Flash...');
    const responseStream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
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
                 - For visual changes, provide a clear text description of the visual element or layout before (originalText) and after (revisedText) the change (e.g. description of old logo vs new logo, or signature block placement).
              
              Generate a structured JSON output according to the requested schema.`
            },
            { fileData: { fileUri: fileARef.uri, mimeType: fileARef.mimeType } },
            { fileData: { fileUri: fileBRef.uri, mimeType: fileBRef.mimeType } }
          ]
        }
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

  } finally {
    // 5. Cleanup files from Gemini storage
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
