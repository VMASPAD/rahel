# No qualifying NASA dataset found

Date of search: 2026-11-14.

Goal: an openly downloadable NASA-published (or NASA-hosted) dataset with human
physiological time series (heart rate, ideally with a second reference source,
plus sleep/activity/respiration) that needs no login, credentials or data-use
agreement. No `dataset.json` was produced because no such dataset was found.
Nothing was fabricated, simulated or taken from a non-NASA source.

## What was checked

### 1. NASA Open Science Data Repository (OSDR)
- Endpoint: `https://osdr.nasa.gov/osdr/data/search?term=...` (public, no login).
- Searched for: heart rate, heart rate variability, ECG, wearable, Astroskin,
  actigraphy, accelerometer, Fitbit, HERA, sleep, exercise, bed rest,
  physiological, Inspiration4, human spaceflight.
- Pulled the study index (5000 records returned of about 138k indexed entries,
  which include external GEO/PRIDE/MG-RAST records) and grepped titles and
  measurement types for cardiac, ECG, actigraphy, wearable, sleep, HERA,
  telemetry and similar terms.
- Result: the repository is almost entirely omics (transcriptomics,
  proteomics, metagenomics, epigenomics), imaging and rodent/plant/microbe
  studies. Hits for "heart rate" were gene-expression studies of heart tissue.
  "Wearable", "actigraphy", "ECG", "Astroskin" and "HERA" returned 0 studies.
- Inspiration4 (OSD-569 to OSD-575, OSD-630, OSD-687): blood, plasma, skin,
  microbiome and similar assays. No wearable or heart-rate time series.
  OSD-575 is a serum/cytokine panel, not a heart-rate series.
- OSD-680/OSD-681 (head-down tilt, intracranial/intraocular pressure
  telemetry): rats, not humans, and not heart rate. Rejected.

### 2. NASA Open Data Portal catalogue (data.nasa.gov)
- Downloaded the full DCAT catalogue `https://data.nasa.gov/data.json`
  (36,518 entries) and searched titles and descriptions for heart rate, ECG,
  actigraphy, wearable, Astroskin, HERA, NEEMO, astronaut, sleep, bed rest,
  cardiovascular, vital sign, photoplethysmography, HRV and biometric.
- Result: no human physiological time series. Matches were OSDR/GeneLab omics
  records, Apollo heat-flow and gravimeter data, and astronaut photography.
  The "Extra-vehicular Activity (EVA)" table is a list of spacewalks, not
  physiology.

### 3. NASA Life Sciences Data Archive (LSDA) via NASA Life Sciences Portal
- Portal: `https://nlsp.nasa.gov` (formerly `lsda.jsc.nasa.gov`).
- Its metadata API answers without login
  (`https://nlsp.nasa.gov/api/v1/data/datasets?search=heart`; 149 records).
  I listed the records with human heart-rate parameters.
- Records are historical summaries: Apollo, Shuttle DSO and Mir tilt/LBNP
  studies, Kentavr and midodrine countermeasure tables, and UTMB bed-rest
  campaign results. They are mostly scanned or plotted TIFF/PDF figures or
  small Excel tables of group means (for example "Heart Rate and Arterial
  Pressure Response to Midodrine ... During Tilt Test" is four group-mean
  points, and "Hemodynamic variables" is a table from a journal article).
  The UTMB bed-rest items are per-test summary measures (peak exercise,
  tilt tests, blood hormones), not continuous recordings.
- I could not find an unauthenticated file-download route for these records.
  The portal's own interface marks datasets as online, via data request, or
  unavailable, and offers a "data request" workflow for restricted material.
  The few tables that exist would not be continuous wearable-style series
  anyway.
- Rejected: aggregate or summary tables, no usable time series, download path
  not confirmed open.

### 4. HERA / Astroskin / analog-mission data
- NASA documents (NTRS) describe Astroskin garment tests during 30-day HERA
  missions and a 2024 NASA R package (HeaRRt) validated on HERA C5/C6 heart
  rate data. They are papers and software descriptions. I found no public
  download of the underlying heart-rate recordings, and the HERA facility
  document says research data is accessed by investigators.
- NASA project pages (TechPort) for wearable sleep/health monitors are project
  summaries with no time series.
- Rejected: no open raw data located.

### 5. Other sources (not NASA)
Web searches surfaced non-NASA open heart-rate/PPG datasets (for example on
PhysioNet), and some analog-mission papers (EMMPOL 6, SIRIUS-19, HI-SEAS) with
no confirmed open deposit. I did not use any of them, because the requirement
is NASA-published data. I found no PhysioNet record described as NASA-funded
for this purpose.

## Not verified
- The LSDA download mechanism (the portal front end is a JavaScript app; no
  open file route was found, which is not proof that none exists).
- Whether individual NASA investigators have released HERA or ISS wearable
  data elsewhere (for example a journal supplement). None was found by search.

## Suggestions for the web page (no data fabricated)
- Use NASA material for context rather than as a data source: cite the OSDR
  and the NASA HERA/Astroskin wearable work, and the NASA-related heart-rate
  agreement tolerance the product already references, as documented
  references with links, not as a plotted dataset.
- If a plotted validation series is still wanted, use a clearly labelled,
  openly licensed non-NASA dataset (for example a PhysioNet wrist-PPG vs
  chest-ECG exercise recording), and label it as such. Do not label it NASA.
