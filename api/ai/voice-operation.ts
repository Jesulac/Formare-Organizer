import { processVoiceOperationRequest } from '../../src/server/voiceAiService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (!body.audioBase64 && !(body.transcriptText && String(body.transcriptText).trim())) {
      return res.status(400).json({
        error: 'No se recibió audio ni texto para procesar.',
      });
    }

    const result = await processVoiceOperationRequest(body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Vercel /api/ai/voice-operation error:', err);
    return res.status(500).json({
      error:
        err?.message ||
        'No se pudo procesar el dictado por voz en este momento. Inténtalo de nuevo.',
    });
  }
}
