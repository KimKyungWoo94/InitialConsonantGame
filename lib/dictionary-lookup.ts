interface StdictItem {
  word?: string;
}

interface StdictResponse {
  channel?: {
    item?: StdictItem | StdictItem[];
    total?: number;
  };
}

function normalizeDictWord(word: string): string {
  return word.replace(/\([^)]*\)/g, '').replace(/[0-9]/g, '').trim();
}

export async function lookupWordInDictionary(
  word: string,
  apiKey: string
): Promise<{ exists: boolean; reason?: string }> {
  const url = new URL('https://stdict.korean.go.kr/api/search.do');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('q', word);
  url.searchParams.set('type_search', 'search');

  const apiRes = await fetch(url.toString());
  const data = (await apiRes.json()) as StdictResponse;

  const items = data?.channel?.item;
  const list: StdictItem[] = items ? (Array.isArray(items) ? items : [items]) : [];

  const exists = list.some((item) => normalizeDictWord(item.word ?? '') === word);

  return { exists };
}
