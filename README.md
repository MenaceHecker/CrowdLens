CrowdLens - Real-time Incident Intelligence Platform

CrowdLens is a real-time, crowd-powered incident reporting platform that
aggregates signals from users, detects emerging events, and surfaces
high-priority situations with AI-assisted summaries.

What it does

-   Users submit reports with text and media
-   Reports are clustered into incidents based on location and
    similarity
-   Incidents are ranked using severity, confidence, freshness, and
    report velocity
-   AI generates summaries and recommended actions
-   Feed updates in real time via WebSockets
-   Map view shows incident hotspots with contextual callouts

Architecture Overview

Mobile App (Expo / React Native) | Cloud Run API (FastAPI) | Firestore
(events and reports) | Cloud Storage (media) | Cloud Tasks (async
processing) | Worker Service (AI and aggregation) | Gemini API
(summaries and actions)

Tech Stack

Frontend (Mobile) - React Native (Expo) - TypeScript - Expo Router -
WebSockets

Backend - FastAPI (Python) - Firestore - Cloud Storage - Cloud Tasks -
Cloud Run

AI Layer - Gemini

Pipeline

1.  User submits a report with optional media
2.  App requests a signed upload URL
3.  Media uploads directly to Cloud Storage
4.  Report is stored in Firestore
5.  Cloud Task is triggered
6.  Worker processes the report, updates events, recalculates ranking,
    and generates AI summary
7.  Feed updates in real time

Features

Live Incident Feed - Ranked feed - Media thumbnails - Real-time updates

Event Detail View - AI summary - Recommended actions - Media-rich
reports

Map View - Severity-based markers - Contextual callouts - Navigation to
event detail

Media Pipeline - Direct upload using signed URLs - Image and video
support

Why this project stands out

Most systems treat reports independently. CrowdLens aggregates signals
into evolving incidents, ranks importance, and adds AI-generated context
in real time.

Running locally

Mobile: cd apps/mobile npm install npm run start

API: cd apps/api pip install -r requirements.txt uvicorn main:app
–reload

Worker: cd apps/worker python main.py

Deployment

-   API on Cloud Run
-   Worker on Cloud Run
-   Storage on Google Cloud Storage
-   Database on Firestore
-   Authentication via Firebase Auth

Future improvements

-   improved clustering using machine learning
-   user trust scoring
-   anomaly detection
-   push notifications
-   map heatmaps
