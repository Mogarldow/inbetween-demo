-- Data pro dotazníky, připomínky a čekárnu (spouští se po seed.sql; idempotentní)
UPDATE clients SET reminders = '[{"title":"Check-in","when":"20:00","on":true},{"title":"Deník myšlenek","when":"po check-inu s úzkostí 6+","on":true},{"title":"Procházka","when":"17:30","on":true},{"title":"Příprava na sezení","when":"den před sezením","on":true}]'
 WHERE reminders = '[]'::jsonb;

UPDATE clients SET plan = E'Cíl: obnovit rytmus a radost z běžných věcí (behaviorální aktivace při vyhoření).\nÚkoly: 1) Jedna malá příjemná aktivita denně. 2) Večerní rutina bez obrazovek.\nNa co dát pozor: stažení se, sebeobviňování („zase jsem nic nestihl“). Tón: krátce, bez tlaku.'
 WHERE id = 'tomas' AND plan LIKE 'Cíl: obnovit rytmus spánku%';

INSERT INTO questionnaires (client_id, kind, score, item9, created_at)
SELECT * FROM (VALUES
  ('petra','gad7',15,NULL::int, now() - interval '28 days'),
  ('petra','gad7',12,NULL, now() - interval '14 days'),
  ('petra','phq9', 9,0, now() - interval '28 days'),
  ('petra','phq9', 8,0, now() - interval '14 days'),
  ('tomas','phq9',16,0, now() - interval '28 days'),
  ('tomas','phq9',14,0, now() - interval '14 days'),
  ('tomas','phq9',13,0, now() - interval '1 days'),
  ('lucie','gad7',11,NULL, now() - interval '20 days'),
  ('lucie','gad7', 8,NULL, now() - interval '6 days')
) v WHERE NOT EXISTS (SELECT 1 FROM questionnaires);

INSERT INTO waitlist (name, weeks, gad7, phq9, item9, modules_done, note)
SELECT * FROM (VALUES
  ('Karolína S.', 6, 16, 18, 1, 2, 'Otázka 9 kladná'),
  ('Eva P.',      3, 13, 11, 0, 3, NULL),
  ('Jan B.',      1,  6, 14, 0, 1, 'Nevyplnil 2 check-iny'),
  ('Martin H.',   5,  9,  7, 0, 5, 'Program mu pomáhá')
) v WHERE NOT EXISTS (SELECT 1 FROM waitlist);
