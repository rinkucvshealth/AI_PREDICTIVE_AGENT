import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { OpenAIError, ParsedForecastQuery } from '../types';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Interprets a natural language forecast request
 * @param query User's natural language query
 * @returns Parsed forecast parameters
 */
export async function interpretForecastQuery(query: string): Promise<ParsedForecastQuery | null> {
  const systemPrompt = `
You are an AI assistant for SAP Analytics Cloud (SAC) predictive forecasting.
Your job is to interpret user requests for running predictive scenarios and extract key parameters.

**Available Parameters:**
1. **GL Account** (required): The General Ledger account number to forecast (e.g., "41000000", "50000000")
2. **Forecast Period** (required): Number of months to forecast (1-12)
3. **Version Name** (optional): Name for saving the forecast (e.g., "Q1_Forecast", "Nov2024_Forecast")

**Common Query Patterns:**
- "Forecast GL account 41000000 for the next 6 months"
  → { glAccount: "41000000", forecastPeriod: 6 }
  
- "Run prediction for GL 50000000 for 3 months in version Q1_Forecast"
  → { glAccount: "50000000", forecastPeriod: 3, versionName: "Q1_Forecast" }
  
- "Generate 12-month forecast for account 41000000"
  → { glAccount: "41000000", forecastPeriod: 12 }
  
- "Predict next quarter for GL account 60000000"
  → { glAccount: "60000000", forecastPeriod: 3 }

**Rules:**
- Always extract GL account number (remove any leading zeros if more than 8 digits)
- Convert time periods: "quarter" = 3 months, "year" = 12 months, "half year" = 6 months
- If version name not specified, leave it empty (system will auto-generate)
- Include confidence score (0.0-1.0) for your interpretation

Respond ONLY with a JSON object. Do not add explanations.

**Response Format:**
{
  "glAccount": "string",
  "forecastPeriod": number,
  "versionName": "string (optional)",
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
      logger.info('Successfully interpreted forecast query:', result);
      return result;
    }

    logger.warn('OpenAI returned empty response for forecast query');
    return null;
  } catch (error: any) {
    logger.error('Error interpreting forecast query with OpenAI:', error.message);
    throw new OpenAIError(`Failed to interpret forecast query: ${error.message}`);
  }
}
