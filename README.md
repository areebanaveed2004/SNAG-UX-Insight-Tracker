# Snag - UX Insight Tracker

Snag is a dependency-free usability tracker built with plain HTML, CSS and JavaScript for my HCI course. It records how a participant completes a task on a test website, then turns the raw interaction data into a **usability score** and **plain-English findings with suggested fixes**.

Most trackers stop at showing numbers. This one explains what the numbers mean.

## What it does

1. A participant is given one task on a sample website ("Northlight").
2. The tracker silently records clicks, mouse movement, scrolling, keystrokes and form errors.
3. When the session ends, a rule-based analyser produces a score, a metrics summary, a click heatmap and a list of findings, each with evidence and a suggested fix.
4. Optionally, an AI model writes a short narrative report from the same data.

## The task

> Create an account on Northlight: enter a name and a valid email, choose a plan, accept the terms, then press **Create account**.

The sign-up form deliberately includes two look-alike decoy buttons ("Create profile" and "Sign up later") next to the real one, so wrong clicks can be measured.

## Quick start

No build step and no install.

```bash
git clone https://github.com/<your-username>/snag-ux-insight-tracker.git
cd snag-ux-insight-tracker
```

Then either open `index.html` in a browser, or serve the folder locally:

```bash
python -m http.server 8000
# visit http://localhost:8000
```

## How to run a session

1. Click **Start session** in the bar at the top.
2. Complete the task on the page.
3. The report appears below the page when the task is completed, or when you click **Give up**.
4. Click **Show heatmap on page** to see where clicks landed.
5. Export the results as JSON or the raw event log as CSV.

The researcher bar at the top is excluded from tracking, so only the test website is measured.

## What is measured

| Metric | Meaning | Why it matters |
| --- | --- | --- |
| Time on task | Seconds from start to finish | Efficiency |
| Misclicks | Clicks on the decoy buttons | Error rate |
| Dead clicks | Clicks on non-interactive elements | Elements that look clickable but are not |
| Rage clicks | 3 or more clicks on the same element within 1 second | Frustration |
| Form errors | Failed submit attempts | Unclear validation or labels |
| Idle time | Gaps over 3 seconds with no interaction | Hesitation or confusion |
| Cursor distance | Total pixels the cursor travelled | Directness of the path |
| Scroll depth | Furthest point reached, as a percentage | Attention and discoverability |
| Keystrokes | Number of key presses | Input effort |
| Click position (x, y) | Pixel coordinates of every click on the page | Powers the heatmap and shows where users actually click |

## Click heatmap

Every click is saved with its **x and y pixel coordinates**: how many pixels from the left edge (x) and from the top of the page (y) the click landed. These appear in the CSV export (`x` and `y` columns) and in the JSON export.

After a session, click **Show heatmap on page** in the report. The tracker draws a soft blob at each saved position and colours it by how many clicks overlap: blue for a single click, through green and yellow, to red where clicks cluster. This quickly shows whether users are hitting the right button, the decoys, or dead space.

Notes:
- Positions are page coordinates, so keep the browser window the same size as during the session or the overlay will be misaligned.
- Only clicks are drawn. Mouse movement is summarised as cursor distance, not plotted.

## How the score works

The score starts at 100 and subtracts penalties:

| Penalty | Amount | Cap |
| --- | --- | --- |
| Task not completed | 30 | 30 |
| Misclick ratio (misclicks / clicks) | ratio × 40 | 30 |
| Rage clicks | 10 each | 20 |
| Dead clicks | 2 each | 10 |
| Form errors | 5 each | 10 |
| Idle time | 1 per second | 10 |
| Time over 30 seconds | 1 per 6 seconds | 10 |

| Score | Label |
| --- | --- |
| 80 to 100 | Smooth |
| 60 to 79 | Some friction |
| 40 to 59 | Frustrating |
| 0 to 39 | Failing |

## How findings are generated

The analyser in `tracker.js` (`analyze()`) applies simple, transparent rules. Each finding includes a severity, the evidence behind it and a suggested fix.

| Rule | Triggers when | Severity |
| --- | --- | --- |
| Task not completed | The participant gives up | High |
| Look-alike buttons clicked | Any misclick (high if over 25% of clicks) | Medium or high |
| Rage clicks | One or more bursts | High |
| Non-interactive elements clicked | 2 or more dead clicks | Medium |
| Form validation tripped the user | 1 or more failed submits (medium from 2) | Low or medium |
| Hesitation | 2 or more pauses, or over 8 seconds idle | Medium |
| Slow task | Over 45 seconds (high over 90) | Medium or high |
| Long cursor path | Over 6000 px | Low |

## Optional AI report

Paste your own Google Gemini API key into the report panel and click **Generate AI report**. The model receives the metrics, findings and the first 40 events, and writes a short report with prioritised fixes.

- The key is held in memory for that tab only and is never saved or committed.
- Do not hard-code a key into the code, and do not publish a version that contains one.
- Everything else works without a key.
- The model name is editable in the box under the key field. If you see a model error, type a current Gemini Flash model name there.
- If the model reports high demand, Snag retries automatically up to 4 times before giving up. The rule-based report is unaffected either way.

## Project structure

```
snag-ux-insight-tracker/
├── index.html    # test website, researcher bar and report layout
├── style.css     # styling for the site and report
├── tracker.js    # event tracking, analysis, export, optional AI report
└── README.md
```

## Limitations and next steps

- One task and one participant per session. Data is not saved between sessions, so export it if you need it.
- Rule thresholds are reasonable defaults, not validated benchmarks.
- Possible extensions: multiple tasks, comparing several participants, a standard questionnaire such as SUS, and a mouse-path overlay.

## Author

[Your name] - HCI project.
