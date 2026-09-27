# Capacity Connect: 5-minute demo

**The story:** NCPOR Goa keeps weather stations running at polar stations, but its trainees are below
the required level in **AWS Calibration** and nobody at Goa is qualified to teach it. Capacity Connect
shows the gap, finds the best trainer with an explained score, and proves the improvement with a
competency-tagged assessment, all on one shared competency framework, with no AI.

## Before the demo (on the day)

1. **Reset the demo data** (about 3 minutes on the live site), because the check-up used in scene 4
   closes 20 hours after seeding:
   - live site: `npm run hosted:seed -w apps/api` (reads `apps/api/.env.deploy`)
   - local: `npm run db:seed`
2. Open the site **2 minutes early**: the free API host sleeps after 15 minutes idle and takes up to a
   minute to wake. Opening the login page wakes it.
3. Use two browser windows: a normal one for the admin and trainer, and a **phone-sized** one (or a
   real phone) for the trainee.

## Accounts

| Role | Email | Used in |
| --- | --- | --- |
| Admin | `admin@moes.example` | scenes 1, 2, 5 |
| Trainer (Sanjay Iyer, IMD Pune) | `sanjay.iyer@imd.example` | scene 4 |
| Trainee (Pooja Menon, NCPOR Goa) | `pooja.menon@ncpor.example` | scene 3 |

**Password:** locally `Demo@2026`. On the live site: the private `SEED_DEMO_PASSWORD` chosen when
seeding (never the public one; it is not written in this repository).

## Script

### 0:00 Homepage (20 s)
- Open the site. *"Capacity Connect is the MoES training portal: announcements, achievements and new
  learning content for everyone."*
- Point at **Achievements** and **New learning content**.

### 0:20 Scene 1: the dashboard and the gap (1 min 10 s)
1. **Sign in** as the admin → the **Dashboard** opens.
   *"Trainees, trainers, enrolments, completions, certifications, participation."* Point at
   **Participation** (per institute at the bottom).
2. Click **Skill gaps** → choose **National Centre for Polar and Ocean Research** in the station filter.
3. The top card is **AWS Calibration: 7 trainees below L3, no qualified trainer at this station, 1
   across MoES.**
   *"Demand is trainees below the target level. Supply is trainers whose evidence is at least 0.8
   trust: verified documents, experience or teaching. Self-declared skills don't count."*

### 1:30 Scene 2: the matched trainer (50 s)
1. On the AWS card click **Find trainers: AWS Installation and Calibration →**.
2. **Sanjay Iyer (IMD Pune) ranks #1 at 77%**. Click **Why this trainer?**.
   *"Every point is explained: coverage = min(level ÷ required level, 1) × evidence trust, times the
   weight. Sanjay's AWS work is backed by experience (trust 0.8), so AWS gives 0.5 × 0.8 = 40 of his
   77 points. His Linux skill is only self-declared, so it counts 0.5."*
3. Mention: *"He already teaches the AWS course, and good course feedback would count as teaching
   evidence too."*

### 2:20 Scene 3: the trainee improves (1 min 10 s), phone window
1. **Sign in** as Pooja. The **bell** shows 1 unread: *"Due within 24 hours: AWS calibration check-up"*.
   Tap it → it opens the assessment.
2. **Start assessment**. Point at the timer and the competency label on each question. Answer:

   | Question | Correct answer |
   | --- | --- |
   | Before calibrating a pressure sensor… | Let it reach the same temperature as the reference |
   | A calibration certificate for a reference instrument must be… | Traceable and still in date |
   | After calibration, the correction you found should be… | Recorded in the station log with date and reference used |
   | Wind speed stuck at zero during a known storm… | The anemometer is jammed or iced |
   | Data from a sensor under repair should be… | Flagged as suspect for that period |

3. **Submit answers** → the result: **100%, strong in AWS Calibration**, and under *Your skill levels*:
   **AWS Calibration L2 → L3 Proficient**.
   *"Scored on the server; the answers never reached the phone before submitting. Each question is
   tagged with a competency, so the result says what she is strong or weak in, not just a total."*

### 3:30 Scene 4: the trainer's view (40 s)
1. **Sign in** as Sanjay → **My teaching** → **AWS Installation and Field Calibration** →
   **Class progress** tab.
2. Pooja's row shows **100%** on the check-up. Point at **Weakest competencies** (class-wide).
3. Click **Mark completed** for Pooja → *"She gets a verified course certificate."*

### 4:10 Scene 5: the gap closes (30 s)
1. **Sign in** as the admin → **Skill gaps** → NCPOR Goa.
2. **AWS Calibration: 6 below target** (was 7). *"One trainee closer. The rest of the Goa trainees
   are enrolled in Sanjay's course."*
3. Optional: the **Dashboard** now shows one more completion and certification.

### 4:40 Wrap-up (20 s)
*"One competency framework links profiles, trainers, courses, questions and the skill-gap view.
Matching is transparent arithmetic that anyone can check, verified evidence counts more, and it
works on a phone."*

## If something goes wrong

| Problem | Fix |
| --- | --- |
| First click is slow / login spins | The free API was asleep; wait up to a minute and retry. |
| No "due within 24 hours" reminder, or the check-up says the deadline passed | The seed ran more than 20 hours ago: re-run the seed (step 1). |
| Pooja already has a result | The demo ran before: re-run the seed. |
| Login says "Too many attempts" | 10 wrong passwords for that account in 15 minutes: wait, or use the local site. |

## Extra scenes (if there is time)
- **Verifications** (admin): verify Sanjay's network-security certificate claim; his cybersecurity fit
  rises from 23.3% to 36.7%.
- **Trainer applications** (admin): approve Rohan Patil → he becomes a trainer.
- **Library** (any trainee): watch *How a Doppler Weather Radar scans* (HTML5 video, no transcoding).
- **Announcements** (admin): publish a notice and show it on the homepage.
