import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { OpenAIError, ParsedForecastQuery } from '../types';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Interprets a natural language forecast request
 * Simplified: Just validates if the user wants to run a forecast
 * @param query User's natural language query
 * @returns Parsed forecast parameters (just confidence validation)
 */
export async function interpretForecastQuery(query: string): Promise<ParsedForecastQuery | null> {
  const systemPrompt = `
You are an AI assistant for SAP Analytics Cloud (SAC) predictive forecasting.
Your job is to validate if the user's request is asking for a forecast or prediction.

All forecast parameters are hardcoded in SAC. You just need to validate if this is a forecast request.

**Common Query Patterns:**
- "Create forecast"
- "Generate prediction"
- "Run forecast"
- "Make a forecast"
- "Execute forecast"

**Rules:**
- Set confidence to 0.9 or higher if it's clearly a forecast/prediction request
- Set confidence to 0.5 or lower if it's NOT a forecast request
- Always return glAccount as empty string (not used)
- Always return forecastPeriod as 6 (not used)
- Always return versionName as "01_JAN" (hardcoded in SAC Multi-Action)

Respond ONLY with a JSON object. Do not add explanations.

**Response Format:**
{
  "glAccount": "",
  "forecastPeriod": 6,
  "versionName": "01_JAN",
  "confidence": number
}
`;

  try {
    logger.debug('Sending forecast query to OpenAI for interpretation');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    if (response.choices && response.choices[0] && response.choices[0].message.content) {
      const result = JSON.parse(response.choices[0].message.content);
      
      // Validate it's a forecast request
      if (result.confidence && result.confidence < 0.7) {
        logger.warn('Query does not appear to be a forecast request (confidence < 0.7)');
        return null;
      }
      
      logger.info('Successfully validated forecast query. Confidence:', result.confidence);
      return result;
    }

    logger.warn('OpenAI returned empty response for forecast query');
    return null;
  } catch (error: any) {
    logger.error('Error interpreting forecast query with OpenAI:', error.message);
    throw new OpenAIError(`Failed to interpret forecast query: ${error.message}`);
  }
}
