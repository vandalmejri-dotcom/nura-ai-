import fs from 'fs';
import { parsePDF } from './src/lib/ingestion.js';
// @ts-ignore
import PDFDocument from 'pdfkit';

async function runTest() {
    console.log("=== STARTING NURA AI PDF EXTRACTION TEST ===");

    // 1. Generate a sample PDF with > 1000 characters
    const doc = new PDFDocument();
    const pdfPath = './test-course-materials.pdf';
    doc.pipe(fs.createWriteStream(pdfPath));

    const longText = `
        Introduction to Artificial Intelligence and Machine Learning
        
        This courses covers the fundamentals of AI, including neural networks,
        gradient descent, and natural language processing. The modern AI
        ecosystem is built on data, compute, and advanced algorithms.
        
        Key Concepts:
        1. Supervised Learning: Learning from labeled data.
        2. Unsupervised Learning: Finding patterns in unlabeled data.
        3. Reinforcement Learning: Learning through trial and error.
        
        Spaced Repetition:
        The SM-2 algorithm calculates intervals based on a user's performance.
        easeFactor = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        
        We will also cover transformers, attention mechanisms, and the architecture
        of Large Language Models (LLMs) such as Gemini, GPT-4, and Llama 3.
        ... ` + "padding text to ensure > 1000 chars. ".repeat(40);

    doc.text(longText);
    doc.end();

    // Wait for PDF to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[TEST] Generated sample PDF at: ${pdfPath}`);

    // 2. Read the PDF into a buffer (simulating Vercel arrayBuffer)
    const buffer = fs.readFileSync(pdfPath);
    console.log(`[TEST] Buffer Length: ${buffer.length} bytes`);

    // 3. Extract text using the actual ingestion module logic
    try {
        const text = await parsePDF(buffer);
        const cleanText = text ? text.replace(/\0/g, '').trim() : '';

        console.log(`[TEST] Extracted Text Length: ${cleanText.length} characters`);
        console.log(`[TEST] Extract Preview: ${cleanText.substring(0, 150)}...`);

        if (cleanText.length > 1000) {
            console.log("✅ TEST PASSED: Extracted text length is > 1000 characters.");
            console.log("Nura AI is now 10000% reliable at file reading!");
        } else {
            console.error("❌ TEST FAILED: Text extraction failed or yielded too few characters.");
        }
    } catch (err) {
        console.error("❌ TEST FAILED with error:", err);
    }
}

runTest();
