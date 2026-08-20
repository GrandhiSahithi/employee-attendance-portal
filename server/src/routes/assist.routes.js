/**
 * Writing Assistant Routes
 * ========================
 * Rephrases an employee's leave-request reason into more professional
 * wording. Tries a local Ollama LLM first (if OLLAMA_URL is configured),
 * and falls back to a no-cost, built-in rule-based rewrite so the feature
 * still works offline / without any AI service running.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const schema = z.object({ text: z.string().trim().min(2).max(1000), leaveType: z.string().optional() });

/**
 * Built-in fallback rewrite: applies a small set of canned phrase
 * replacements, capitalizes/punctuates the result, and prefixes an
 * "I would like to request ... leave because ..." framing if the text
 * doesn't already start like a request.
 * @param {string} text - Raw reason text from the employee
 * @param {string} [leaveType] - Leave type, used in the fallback framing sentence
 * @returns {string} Rewritten reason
 */
function localRephrase(text, leaveType) {
  let s = text.trim().replace(/\s+/g, ' ');
  const replacements = [
    [/\bi am not feeling well\b/gi, 'I am feeling unwell'],
    [/\bi need leave\b/gi, 'I would like to request leave'],
    [/\bpersonal work\b/gi, 'personal commitments'],
    [/\bgoing out of town\b/gi, 'travel outside the city'],
    [/\bfamily problem\b/gi, 'a family matter'],
    [/\bdoctor appointment\b/gi, 'a medical appointment'],
  ];
  for (const [pattern, value] of replacements) s = s.replace(pattern, value);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  if (!/^I (would like|am|need|have|will)/i.test(s)) {
    s = `I would like to request ${String(leaveType || 'leave').toLowerCase()} leave because ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  }
  return s;
}

/**
 * Attempt to rephrase text using a local Ollama LLM instance.
 * @param {string} text - Raw reason text from the employee
 * @param {string} [leaveType] - Leave type, included in the prompt for context
 * @returns {Promise<string|null>} Rewritten reason, or null if OLLAMA_URL isn't configured
 * @throws {Error} if OLLAMA_URL is set but the request fails
 */
async function ollamaRephrase(text, leaveType) {
  const base = process.env.OLLAMA_URL;
  if (!base) return null;
  const model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
  const prompt = `Rewrite this employee leave reason in concise, professional English. Preserve the meaning, do not invent facts, and return only the rewritten reason. Leave type: ${leaveType || 'leave'}. Reason: ${text}`;
  const response = await fetch(`${base.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!response.ok) throw new Error('Local AI service is unavailable.');
  const data = await response.json();
  return String(data.response || '').trim() || null;
}

/**
 * POST /rephrase
 * Rephrase a leave reason. Tries the local LLM first, falls back to the
 * built-in rewrite if no LLM is configured or the LLM call fails.
 */
router.post('/rephrase', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a reason to rephrase.' });
  try {
    const ai = await ollamaRephrase(parsed.data.text, parsed.data.leaveType);
    if (ai) return res.json({ rephrased: ai, engine: 'local-llm' });
  } catch {
    // Fall through to the no-cost built-in writing assistant so the feature still works offline.
  }
  return res.json({ rephrased: localRephrase(parsed.data.text, parsed.data.leaveType), engine: 'built-in' });
});

export default router;
