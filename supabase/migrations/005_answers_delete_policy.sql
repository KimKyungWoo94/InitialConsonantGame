-- 다시 하기 시 answers 삭제를 클라이언트에서 수행할 수 있도록 허용
CREATE POLICY "answers_delete" ON answers FOR DELETE USING (true);
