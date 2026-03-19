# CrowdLens

CrowdLens is a real-time incident intelligence platform that turns crowd reports into structured, ranked, map-visible events.

## Stack

- React Native / Expo mobile app
- FastAPI API + worker
- Firestore persistence
- Cloud Tasks async processing
- Cloud Run deployment
- Cloud Storage signed media uploads
- Gemini-powered structured briefings
- WebSocket-based realtime updates

## Features

- submit incident reports with optional media
- direct media upload to Cloud Storage with signed URLs
- async worker processing with Cloud Tasks
- event clustering and deduplication
- ranking, lifecycle decay, and map view
- AI-generated briefings with incident type, tags, and actions

## Architecture

Mobile App → FastAPI API → Firestore + Cloud Tasks → Worker → Firestore → WebSocket updates → Mobile App

## Local Development

Run API:
make dev-api

Run Worker:
make dev-worker

Run Mobile App:
From apps/mobile directory run :
npm run start
Choose an emulator or open on expo app on your phone