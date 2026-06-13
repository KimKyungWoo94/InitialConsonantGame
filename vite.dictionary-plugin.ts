import type { Plugin } from 'vite';
import { lookupWordInDictionary } from './lib/dictionary-lookup';

export function dictionaryApiPlugin(apiKey?: string): Plugin {
  return {
    name: 'dictionary-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/validate-word')) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const word = url.searchParams.get('word')?.trim();

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!word) {
          res.statusCode = 400;
          res.end(JSON.stringify({ exists: false, reason: '단어가 없습니다.' }));
          return;
        }

        if (!apiKey) {
          res.statusCode = 503;
          res.end(JSON.stringify({ exists: false, reason: '사전 API 키가 설정되지 않았습니다.' }));
          return;
        }

        try {
          const result = await lookupWordInDictionary(word, apiKey);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              exists: result.exists,
              definition: result.definition,
              reason: result.exists
                ? undefined
                : (result.reason ?? '사전에 없는 단어예요! 다른 단어를 입력해주세요.'),
            })
          );
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ exists: false, reason: '사전 검색에 실패했습니다.' }));
        }
      });
    },
  };
}
