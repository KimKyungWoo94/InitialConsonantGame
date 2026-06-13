-- Realtime DELETE 이벤트에서 삭제된 행 정보를 받기 위해 필요
ALTER TABLE answers REPLICA IDENTITY FULL;
