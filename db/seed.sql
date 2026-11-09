-- Fiktivní ukázková data pro demo
INSERT INTO clients (id, name, salutation, therapist, focus, next_session, plan) VALUES
('petra', 'Petra K.', 'Petro', 'Mgr. Jana Dvořáková', 'KBT, úzkost v práci', 'Čtvrtek 14:00',
 E'Cíl: zvládat úzkost před poradami a prezentacemi v práci (KBT).\nÚkoly: 1) Deník myšlenek po každé úzkostné situaci. 2) Dýchání 4-4-6, když úzkost stoupá. 3) Procházka 20 minut denně.\nNa co dát pozor: katastrofické myšlenky („všechno zkazím“), vyhýbání se poradám, horší spánek.\nNepodporovat omlouvání se z porad. Pochválit každý pokus.'),
('tomas', 'Tomáš R.', 'Tomáši', 'Mgr. Jana Dvořáková', 'Vyhoření', 'Pátek 9:00',
 E'Cíl: obnovit rytmus spánku a odpočinku.\nÚkoly: 1) Večerní rutina bez obrazovek. 2) Jedna příjemná aktivita denně.'),
('lucie', 'Lucie M.', 'Lucie', 'Mgr. Jana Dvořáková', 'Sociální úzkost', 'Pondělí 16:30',
 E'Cíl: postupná expozice v sociálních situacích.\nÚkoly: 1) Jedna krátká konverzace denně. 2) Zápis očekávání a skutečnosti.');

INSERT INTO clients (id, name, salutation, therapist, focus, next_session, plan, waiting) VALUES
('cekarna', 'Čekárna (4)', '', 'Mgr. Jana Dvořáková', 'Noví klienti před 1. sezením', 'Nejdéle čeká 6 týdnů',
 E'Podpora před prvním sezením: check-iny, techniky zvládání stresu, krizové linky.', TRUE);

INSERT INTO checkins (client_id, mood, anxiety, note, created_at) VALUES
('petra', 3, 6, NULL,                                     now() - interval '6 days'),
('petra', 2, 7, 'Porada se šéfem, celý den stažený žaludek', now() - interval '5 days'),
('petra', 2, 7, NULL,                                     now() - interval '4 days'),
('petra', 3, 5, NULL,                                     now() - interval '3 days'),
('petra', 4, 4, 'Výlet s kamarádkou',                      now() - interval '2 days'),
('petra', 2, 8, 'Zítra porada s vedením',                  now() - interval '1 day'),
('tomas', 2, 6, NULL,                                     now() - interval '4 days'),
('lucie', 4, 3, NULL,                                     now() - interval '1 day');

INSERT INTO tasks (client_id, title, hint, week_done, week_goal) VALUES
('petra', 'Deník myšlenek',     'Zapiš situaci, myšlenku a jak silná byla.', 3, 5),
('petra', 'Dýchání 4-4-6',      'Když úzkost stoupne nad 6.',                4, 7),
('petra', 'Procházka 20 minut', 'Ideálně po práci.',                         5, 7),
('tomas', 'Večer bez obrazovek','Hodinu před spaním.',                       1, 7),
('lucie', 'Krátká konverzace',  'Třeba s prodavačkou nebo kolegou.',         4, 5);

INSERT INTO events (client_id, text, created_at) VALUES
('petra', 'Splněno: procházka 20 minut.',                                  now() - interval '2 days'),
('petra', 'Check-in: nálada 2/5, úzkost 8/10. „Zítra porada s vedením.“',    now() - interval '1 day'),
('petra', 'Parťák: dýchání 4-4-6 a zápis do deníku myšlenek.',             now() - interval '1 day' + interval '12 minutes'),
('tomas', 'Poslední check-in před 4 dny.',                                 now() - interval '4 days');

INSERT INTO messages (client_id, role, content, created_at) VALUES
('petra', 'assistant', 'Ahoj Petro, jak se máš před zítřejší poradou? Klidně mi napiš, co se ti honí hlavou.', now() - interval '10 minutes');
