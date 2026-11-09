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

UPDATE clients SET reminders = (SELECT jsonb_agg(r) FROM jsonb_array_elements(reminders) r WHERE r->>'title' <> 'Příprava na sezení') WHERE id = 'nikola';

-- Knihovna psychologa (ukázková data) a výběr na tento týden pro Petru
INSERT INTO materials (kind, title, body, week_goal)
SELECT * FROM (VALUES
 ('kbt','Katastrofizace: tři scénáře','Když přijde myšlenka „bude to katastrofa“, napiš si: 1) nejhorší možný výsledek, 2) nejlepší možný výsledek, 3) nejpravděpodobnější výsledek. Pak se zeptej: Co bych v téhle situaci řekl/a kamarádovi?',3),
 ('kbt','Behaviorální experiment: porada','Před poradou: Co přesně se stane, když řeknu jednu větu? Jak moc tomu věřím (0–100 %)? Po poradě: Co se stalo doopravdy? Jak moc teď věřím původní předpovědi?',2),
 ('kbt','Seznam vyhýbání','Sepiš situace, kterým se kvůli úzkosti vyhýbáš, a ohodnoť každou 0–10 podle toho, jak moc se jí bojíš. Na sezení z nich postavíme žebříček expozic.',1),
 ('ukol','Jedna věta na poradě','Na každé poradě řekni aspoň jednu větu nebo polož otázku. Nemusí být chytrá, stačí, že zazní.',3),
 ('ukol','Tři dobré věci','Večer si zapiš tři věci, které se ten den povedly nebo tě potěšily, i kdyby byly malé.',5),
 ('ukol','Telefonát místo zprávy','Jednou za týden vyřiď něco telefonem místo e-mailu nebo zprávy.',1),
 ('technika','Bezpečné místo','Zavři oči a představ si místo, kde se cítíš v bezpečí. Všimni si, co tam vidíš, slyšíš a cítíš. Zůstaň tam 2–3 minuty a pomalu dýchej. Hodí se před usnutím nebo po náročné situaci.',3),
 ('technika','Progresivní svalová relaxace (krátká)','Postupně na 5 vteřin zatni a pak uvolni svaly: ruce, ramena, obličej, břicho, nohy. Všimni si rozdílu mezi napětím a uvolněním. Celé trvá asi 5 minut.',3),
 ('poznamka','Po sezení 5. 11.','Petro, minulý týden jste zvládla víc, než si myslíte: šla jste na poradu, i když se vám nechtělo. Úzkost před poradou je normální a sama odezní. Cílem není, aby zmizela, ale abyste neutíkala.',0),
 ('poznamka','Když se nedaří','Jeden horší den neznamená, že se nic nezlepšuje. Zapište si, co se stalo, a přineste to na sezení. Nemusíte to řešit sama.',0)
) v(kind, title, body, week_goal)
WHERE NOT EXISTS (SELECT 1 FROM materials);

INSERT INTO client_materials (client_id, material_id)
SELECT 'petra', id FROM materials WHERE title IN ('Katastrofizace: tři scénáře','Jedna věta na poradě','Bezpečné místo','Po sezení 5. 11.')
AND NOT EXISTS (SELECT 1 FROM client_materials WHERE client_id = 'petra');

INSERT INTO tasks (client_id, title, hint, week_done, week_goal, material_id)
SELECT 'petra', m.title, m.body, 1, m.week_goal, m.id FROM materials m
WHERE m.title = 'Jedna věta na poradě' AND NOT EXISTS (SELECT 1 FROM tasks WHERE client_id = 'petra' AND material_id = m.id);
