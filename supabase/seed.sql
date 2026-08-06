-- Starter catalog. Channels are seeded by *handle*; the ingest script resolves
-- the real channel ID via the YouTube API on first run (1 quota unit each).
--
-- IMPORTANT: verify each handle by visiting youtube.com/@thehandle before your
-- first ingest — handles change, and a wrong handle just skips with a warning.
-- Placeholder channel IDs below get overwritten by the resolver.

insert into languages (code, name, flag) values
  ('es', 'Spanish',    '🇪🇸'),
  ('pt', 'Portuguese', '🇧🇷'),
  ('it', 'Italian',    '🇮🇹'),
  ('fr', 'French',     '🇫🇷'),
  ('de', 'German',     '🇩🇪'),
  ('ja', 'Japanese',   '🇯🇵')
on conflict (code) do nothing;

insert into channels (id, handle, language_code, name, level_prior) values
  -- Spanish
  ('pending:es1', '@DreamingSpanish',        'es', 'Dreaming Spanish',        2),
  ('pending:es2', '@EspanolconJuan',         'es', 'Español con Juan',        4),
  ('pending:es3', '@SpanishAfterHours',      'es', 'Spanish After Hours',     3),
  ('pending:es4', '@HowtoSpanishOfficial',   'es', 'How to Spanish',          4),
  -- Portuguese
  ('pending:pt1', '@SpeakingBrazilian',      'pt', 'Speaking Brazilian',      3),
  ('pending:pt2', '@PortugueseWithLeo',      'pt', 'Portuguese With Leo',     4),
  -- Italian
  ('pending:it1', '@PodcastItaliano',        'it', 'Podcast Italiano',        4),
  ('pending:it2', '@ItalianoAutomatico',     'it', 'Italiano Automatico',     4),
  -- French
  ('pending:fr1', '@FrenchComprehensibleInput', 'fr', 'French Comprehensible Input', 2),
  ('pending:fr2', '@innerFrench',            'fr', 'innerFrench',             4),
  -- German
  ('pending:de1', '@EasyGerman',             'de', 'Easy German',             4),
  ('pending:de2', '@NaturalGerman',          'de', 'Natürlich German',        3),
  -- Japanese
  ('pending:ja1', '@cijapanese',             'ja', 'Comprehensible Japanese', 2),
  ('pending:ja2', '@SpeakJapaneseNaturally', 'ja', 'Speak Japanese Naturally', 3)
on conflict (id) do nothing;
