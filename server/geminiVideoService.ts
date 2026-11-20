import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface GlossaryRuleInput {
  sourceTerm: string;
  targetVi: string;
  targetEn: string;
  keepOriginal?: boolean;
  notes?: string;
}

export interface TopicOptionInput {
  id: string;
  titleVi: string;
  titleEn: string;
}

export interface OptimizeVideoRequest {
  youtubeId: string;
  rawTitle: string;
  rawDescription: string;
  channelName: string;
  currentTopicId?: string;
  topics: TopicOptionInput[];
  glossary: GlossaryRuleInput[];
}

export interface OptimizedVideoAIResult {
  detectedSourceLang: 'vi' | 'en';
  titleVi: string;
  titleEn: string;
  summaryVi: string;
  summaryEn: string;
  descriptionVi: string;
  descriptionEn: string;
  highlightsVi: string[];
  highlightsEn: string[];
  seoTitleVi: string;
  seoTitleEn: string;
  seoDescriptionVi: string;
  seoDescriptionEn: string;
  slugVi: string;
  slugEn: string;
  keywordsVi: string[];
  keywordsEn: string[];
  suggestedTopicId: string;
}

export interface TranslateTopicsRequest {
  channelName: string;
  topics: Array<{ id: string; rawTitle: string }>;
  glossary: GlossaryRuleInput[];
}

export interface TranslatedTopicAIItem {
  id: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  slug: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY chưa được cấu hình trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets hoặc biến môi trường Cloud Run.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function slugifyAscii(input: string, fallback: string): string {
  const cleaned = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return cleaned || fallback;
}

function formatGlossaryBlock(glossary: GlossaryRuleInput[]): string {
  if (!glossary || glossary.length === 0) {
    return 'No custom glossary rules provided. Preserve proper nouns, Boston landmarks, and brand names naturally.';
  }
  return glossary
    .slice(0, 60)
    .map((g) => {
      const rule = g.keepOriginal
        ? `KEEP ORIGINAL "${g.sourceTerm}" in both VI and EN`
        : `VI: "${g.targetVi}" | EN: "${g.targetEn}"`;
      const note = g.notes ? ` (Note: ${g.notes})` : '';
      return `- ${g.sourceTerm} => ${rule}${note}`;
    })
    .join('\n');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

export async function optimizeVideoWithGemini(
  req: OptimizeVideoRequest
): Promise<OptimizedVideoAIResult> {
  const ai = getGeminiClient();

  const topicsList =
    req.topics.length > 0
      ? req.topics
          .map((t) => `- id: "${t.id}" | VI: "${t.titleVi}" | EN: "${t.titleEn}"`)
          .join('\n')
      : '(No existing topics provided; return empty string for suggestedTopicId)';

  const systemInstruction = `You are a senior bilingual (Vietnamese & English) editorial director and technical SEO strategist for Meet Boston and destination video libraries.
Your mission is to transform raw YouTube metadata into publication-ready, context-aware Vietnamese AND English video library entries.

STRICT RULES:
1. Context-Aware Translation: Never translate word-for-word. Write natural, vivid editorial Vietnamese and polished native English appropriate for destination, culture, lifestyle, and educational video guides.
2. Clean Titles: Strip spam hashtags (#shorts, #fyp, #viral), excessive emojis, and clickbait ALL-CAPS. Keep titles crisp (<= 110 characters) and informative.
3. Respect the Admin Glossary strictly for terminology consistency.
4. SEO Precision:
   - seoTitleVi & seoTitleEn: compelling search title <= 60 characters.
   - seoDescriptionVi & seoDescriptionEn: 120 to 155 characters, natural keyword integration.
   - slugVi & slugEn: lowercase ASCII hyphenated URL slugs without diacritics (e.g. "kham-pha-quincy-market-boston", "exploring-quincy-market-boston").
   - keywordsVi & keywordsEn: 4 to 8 high-intent search keywords each.
5. Highlights: Extract 3 to 5 crisp, factual bullet takeaways in both Vietnamese and English.
6. Topic Classification: If currentTopicId is already provided and fits well, keep it. Otherwise pick the single best matching topic "id" from the provided Topics list (never invent a new ID).`;

  const prompt = `CHANNEL: ${req.channelName}
YOUTUBE VIDEO ID: ${req.youtubeId}
CURRENT TOPIC ID: ${req.currentTopicId || '(none)'}

RAW YOUTUBE TITLE:
${req.rawTitle}

RAW YOUTUBE DESCRIPTION:
${req.rawDescription || '(No description provided on YouTube — infer a helpful, accurate, non-hallucinated summary and editorial framing strictly from the title and channel context.)'}

AVAILABLE TOPICS:
${topicsList}

ADMIN GLOSSARY (MANDATORY TERMINOLOGY):
${formatGlossaryBlock(req.glossary)}

Return strictly valid JSON matching the requested schema.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedSourceLang: {
              type: Type.STRING,
              description: 'Primary language of raw input: "vi" or "en".',
            },
            titleVi: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            summaryVi: {
              type: Type.STRING,
              description: '1-2 sentence engaging Vietnamese summary (<= 320 chars).',
            },
            summaryEn: {
              type: Type.STRING,
              description: '1-2 sentence engaging English summary (<= 320 chars).',
            },
            descriptionVi: {
              type: Type.STRING,
              description: 'Clean editorial Vietnamese description (<= 1800 chars).',
            },
            descriptionEn: {
              type: Type.STRING,
              description: 'Clean editorial English description (<= 1800 chars).',
            },
            highlightsVi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 key takeaways in Vietnamese.',
            },
            highlightsEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 key takeaways in English.',
            },
            seoTitleVi: { type: Type.STRING },
            seoTitleEn: { type: Type.STRING },
            seoDescriptionVi: { type: Type.STRING },
            seoDescriptionEn: { type: Type.STRING },
            slugVi: { type: Type.STRING },
            slugEn: { type: Type.STRING },
            keywordsVi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keywordsEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedTopicId: { type: Type.STRING },
          },
          required: [
            'detectedSourceLang',
            'titleVi',
            'titleEn',
            'summaryVi',
            'summaryEn',
            'descriptionVi',
            'descriptionEn',
            'highlightsVi',
            'highlightsEn',
            'seoTitleVi',
            'seoTitleEn',
            'seoDescriptionVi',
            'seoDescriptionEn',
            'slugVi',
            'slugEn',
            'keywordsVi',
            'keywordsEn',
            'suggestedTopicId',
          ],
        },
      },
    })
  );

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Gemini không trả về nội dung JSON hợp lệ.');
  }

  const parsed = JSON.parse(text) as Partial<OptimizedVideoAIResult>;
  const validTopicIds = new Set(req.topics.map((t) => t.id));
  const pickedTopic =
    parsed.suggestedTopicId && validTopicIds.has(parsed.suggestedTopicId)
      ? parsed.suggestedTopicId
      : req.currentTopicId && validTopicIds.has(req.currentTopicId)
        ? req.currentTopicId
        : req.topics[0]?.id || '';

  const titleVi = (parsed.titleVi || req.rawTitle).trim().slice(0, 180);
  const titleEn = (parsed.titleEn || req.rawTitle).trim().slice(0, 180);

  return {
    detectedSourceLang: parsed.detectedSourceLang === 'en' ? 'en' : 'vi',
    titleVi,
    titleEn,
    summaryVi: (parsed.summaryVi || titleVi).trim().slice(0, 420),
    summaryEn: (parsed.summaryEn || titleEn).trim().slice(0, 420),
    descriptionVi: (parsed.descriptionVi || req.rawDescription || titleVi)
      .trim()
      .slice(0, 2400),
    descriptionEn: (parsed.descriptionEn || req.rawDescription || titleEn)
      .trim()
      .slice(0, 2400),
    highlightsVi: Array.isArray(parsed.highlightsVi)
      ? parsed.highlightsVi
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    highlightsEn: Array.isArray(parsed.highlightsEn)
      ? parsed.highlightsEn
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    seoTitleVi: (parsed.seoTitleVi || titleVi).trim().slice(0, 90),
    seoTitleEn: (parsed.seoTitleEn || titleEn).trim().slice(0, 90),
    seoDescriptionVi: (parsed.seoDescriptionVi || parsed.summaryVi || titleVi)
      .trim()
      .slice(0, 220),
    seoDescriptionEn: (parsed.seoDescriptionEn || parsed.summaryEn || titleEn)
      .trim()
      .slice(0, 220),
    slugVi: slugifyAscii(parsed.slugVi || titleVi, `video-${req.youtubeId.toLowerCase()}`),
    slugEn: slugifyAscii(parsed.slugEn || titleEn, `video-${req.youtubeId.toLowerCase()}`),
    keywordsVi: Array.isArray(parsed.keywordsVi)
      ? parsed.keywordsVi
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    keywordsEn: Array.isArray(parsed.keywordsEn)
      ? parsed.keywordsEn
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    suggestedTopicId: pickedTopic,
  };
}

export async function translateTopicsWithGemini(
  req: TranslateTopicsRequest
): Promise<TranslatedTopicAIItem[]> {
  if (!req.topics.length) return [];
  const ai = getGeminiClient();

  const list = req.topics
    .map((t) => `- id: "${t.id}" | rawTitle: "${t.rawTitle}"`)
    .join('\n');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `CHANNEL: ${req.channelName}
GLOSSARY:
${formatGlossaryBlock(req.glossary)}

PLAYLIST TOPICS TO LOCALIZE (Vietnamese & English):
${list}

Convert each playlist name into clean, Title-Case Vietnamese and English category labels (remove ALL-CAPS screaming), add a concise 1-sentence bilingual topic description, and create an ASCII URL slug.`,
      config: {
        systemInstruction:
          'You are a bilingual VI/EN editorial curator structuring YouTube playlists into a refined destination video library. Preserve exact topic IDs.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              titleVi: { type: Type.STRING },
              titleEn: { type: Type.STRING },
              descriptionVi: { type: Type.STRING },
              descriptionEn: { type: Type.STRING },
              slug: { type: Type.STRING },
            },
            required: [
              'id',
              'titleVi',
              'titleEn',
              'descriptionVi',
              'descriptionEn',
              'slug',
            ],
          },
        },
      },
    })
  );

  const text = (response.text ?? '[]').trim();
  const parsed = JSON.parse(text) as Array<Partial<TranslatedTopicAIItem>>;
  const byId = new Map<string, Partial<TranslatedTopicAIItem>>();
  for (const item of parsed) {
    if (item.id) byId.set(item.id, item);
  }

  return req.topics.map((orig) => {
    const aiItem = byId.get(orig.id);
    const titleVi = (aiItem?.titleVi || orig.rawTitle).trim().slice(0, 120);
    const titleEn = (aiItem?.titleEn || orig.rawTitle).trim().slice(0, 120);
    return {
      id: orig.id,
      titleVi,
      titleEn,
      descriptionVi: (aiItem?.descriptionVi || '').trim().slice(0, 320),
      descriptionEn: (aiItem?.descriptionEn || '').trim().slice(0, 320),
      slug: slugifyAscii(aiItem?.slug || titleEn || titleVi, orig.id.toLowerCase()),
    };
  });
}
