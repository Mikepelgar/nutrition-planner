CREATE VIRTUAL TABLE IF NOT EXISTS food_fts USING fts5(
  description,
  brand_owner,
  content = 'food',
  content_rowid = 'fdc_id',
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS food_fts_insert AFTER INSERT ON food BEGIN
  INSERT INTO food_fts(rowid, description, brand_owner)
  VALUES (new.fdc_id, new.description, COALESCE(new.brand_owner, ''));
END;
