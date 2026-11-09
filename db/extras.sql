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

-- Uživatelka bez psychologa (samostatný režim)
INSERT INTO clients (id, name, salutation, therapist, focus, next_session, plan, solo, allowed_techniques)
SELECT 'nikola', 'Nikola V.', 'Nikolo', '', 'Bez psychologa', '',
 E'Program „Zvládání stresu“ (bez psychologa).\nCíl: zvládat běžný stres a úzkost a všimnout si včas, kdy je potřeba odborník.\nKaždý den: krátký check-in. Když úzkost stoupá: dýchání 4-4-6 nebo uzemnění 5-4-3-2-1.\nTýdně: 4× procházka, 3× zápis do deníku myšlenek, večerní rutina pro spánek.\nKdyž potíže trvají přes 2 týdny nebo se zhoršují: najít psychologa.',
 TRUE, ARRAY['dech-446','uzemneni-54321','zaznam-myslenek','prochazka','spankova-hygiena','laskava-veta','cas-na-starosti']
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id = 'nikola');

INSERT INTO tasks (client_id, title, hint, week_done, week_goal)
SELECT * FROM (VALUES ('nikola','Dýchání 4-4-6','Když úzkost stoupne nad 6.',2,5), ('nikola','Procházka 20 minut','Kdykoli během dne.',1,4), ('nikola','Deník myšlenek','Po situaci, která tě rozhodila.',0,3)) v
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE client_id = 'nikola');

INSERT INTO checkins (client_id, mood, anxiety, note, created_at)
SELECT * FROM (VALUES ('nikola',3,6,NULL::text, now() - interval '3 days'), ('nikola',2,7,'Zkouškové, nespím', now() - interval '2 days'), ('nikola',3,6,NULL, now() - interval '1 day')) v
WHERE NOT EXISTS (SELECT 1 FROM checkins WHERE client_id = 'nikola');

INSERT INTO questionnaires (client_id, kind, score, item9, created_at)
SELECT * FROM (VALUES ('nikola','gad7',11,NULL::int, now() - interval '3 days'), ('nikola','phq9',9,0, now() - interval '3 days')) v
WHERE NOT EXISTS (SELECT 1 FROM questionnaires WHERE client_id = 'nikola');

INSERT INTO messages (client_id, role, content)
SELECT 'nikola', 'assistant', 'Ahoj Nikolo, jsem tu pro tebe. S čím ti můžu dnes pomoct?'
WHERE NOT EXISTS (SELECT 1 FROM messages WHERE client_id = 'nikola');

UPDATE clients SET reminders = (SELECT reminders FROM clients WHERE id = 'petra') WHERE id = 'nikola' AND reminders = '[]'::jsonb;
