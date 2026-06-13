interface StdictItem {
  word?: string;
}

interface StdictResponse {
  channel?: {
    item?: StdictItem | StdictItem[];
  };
}

function normalizeDictWord(word: string): string {
  return word.replace(/\([^)]*\)/g, '').replace(/[0-9]/g, '').trim();
}

async function lookupWord(word: string, apiKey: string): Promise<boolean> {
  const url = new URL('https://stdict.korean.go.kr/api/search.do');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('q', word);
  url.searchParams.set('type_search', 'search');

  const apiRes = await fetch(url.toString());
  const data = (await apiRes.json()) as StdictResponse;
  const items = data?.channel?.item;
  const list: StdictItem[] = items ? (Array.isArray(items) ? items : [items]) : [];

  return list.some((item) => normalizeDictWord(item.word ?? '') === word);
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
    const exists = await lookupWord(word, key);
    return response.status(200).json({
      exists,
      reason: exists ? undefined : '사전에 없는 단어예요! 다른 단어를 입력해주세요.',
    });
  } catch {
    return response.status(500).json({
      exists: false,
      reason: '사전 검색에 실패했습니다.',
    });
  }
}
