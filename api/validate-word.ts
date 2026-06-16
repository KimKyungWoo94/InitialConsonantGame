interface StdictSense {
  definition?: string;
}

interface StdictItem {
  word?: string;
  sense?: StdictSense | StdictSense[];
}

interface StdictResponse {
  channel?: {
    item?: StdictItem | StdictItem[];
    total?: number | string;
  };
}

export interface WordLookupResult {
  exists: boolean;
  definition?: string;
  reason?: string;
}

function normalizeDictWord(word: string): string {
  return word.replace(/\([^)]*\)/g, '').replace(/-/g, '').replace(/[0-9]/g, '').trim();
}

function briefDefinition(raw: string): string {
  const text = raw
    .replace(/\^/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= 80) return text;
  return `${text.slice(0, 79)}…`;
}

function extractDefinition(item: StdictItem): string | undefined {
  const sense = item.sense;
  if (!sense) return undefined;

  const raw = Array.isArray(sense) ? sense[0]?.definition : sense.definition;
  return raw ? briefDefinition(raw) : undefined;
}

async function lookupWord(word: string, apiKey: string): Promise<WordLookupResult> {
  const url = new URL('https://stdict.korean.go.kr/api/search.do');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('q', word);
  url.searchParams.set('type_search', 'search');

  const apiRes = await fetch(url.toString());
  const text = await apiRes.text();

  let data: StdictResponse;
  try {
    data = JSON.parse(text) as StdictResponse;
  } catch {
    return { exists: false, reason: '사전에 없는 단어예요! 다른 단어를 입력해주세요.' };
  }

  const total = Number(data?.channel?.total ?? 0);
  if (!total) {
    return { exists: false, reason: '사전에 없는 단어예요! 다른 단어를 입력해주세요.' };
  }

  const items = data?.channel?.item;
  const list: StdictItem[] = items ? (Array.isArray(items) ? items : [items]) : [];
  const match = list.find((item) => normalizeDictWord(item.word ?? '') === word);

  if (!match) {
    return { exists: false, reason: '사전에 없는 단어예요! 다른 단어를 입력해주세요.' };
  }

  return {
    exists: true,
    definition: extractDefinition(match),
  };
}

export default async function handler(
  request: { method?: string; query: { word?: string } },
  response: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (key: string, value: string) => void;
  }
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

  if (request.method === 'OPTIONS') {
    return response.status(200).json({});
  }

  const word = request.query.word?.trim();
  if (!word) {
    return response.status(400).json({ exists: false, reason: '단어가 없습니다.' });
  }

  const key = process.env.STDICT_API_KEY;
  if (!key) {
    return response.status(503).json({
      exists: false,
      reason: '사전 API 키가 설정되지 않았습니다.',
    });
  }

  try {
    const result = await lookupWord(word, key);
    return response.status(200).json({
      exists: result.exists,
      definition: result.definition,
      reason: result.exists ? undefined : result.reason,
    });
  } catch {
    return response.status(200).json({
      exists: false,
      reason: '사전에 없는 단어예요! 다른 단어를 입력해주세요.',
    });
  }
}
