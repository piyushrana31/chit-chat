# Secure Chat

## Phase 1: Project initialization

This repository is being scaffolded for a Signal-style encrypted messaging demo built with React, Vite, Express, WebSockets, and a maintained Signal Protocol implementation.

## Current architecture decision

The official `@signalapp/libsignal-client` package is the canonical Signal implementation, but it is a Rust-backed Node library with native binaries and no browser/Vite-first build target. That makes it a poor fit for the browser client in a plain React + Vite app without additional native packaging.

The browser-safe path used for this project will be a maintained TypeScript Signal protocol library that runs in JavaScript, with a dedicated crypto abstraction layer so the implementation can be swapped to the official library later if a browser-compatible integration becomes available.

## Planned stack

- Client: React + Vite + Tailwind + React Router
- Server: Express + ws + MongoDB + Mongoose + JWT
- Crypto: maintained Signal Protocol library with isolated session abstractions
- Persistence: IndexedDB for client session state and metadata

## Phase 1 deliverables

- Project structure initialized
- Root and app-level package manifests prepared
- Security-first architecture captured in documentation
- Remaining implementation phases will follow in order after confirmation

## Next steps

The project will continue with UI scaffolding only after review of this architecture decision.

## Security Model and Known Limits

- Client-side encryption uses `@privacyresearch/libsignal-protocol-typescript@0.0.16`; this is a maintained TypeScript implementation, not the official Signal `libsignal` package.
- Identity keys, prekeys, trust records, and Signal session records stay on the client. Browser persistence uses IndexedDB; private key material is not placed in `localStorage`.
- The server authenticates users with JWT, stores public key bundles, and relays ciphertext over authenticated WebSockets. It does not decrypt messages or receive plaintext.
- Delivery and read receipts are metadata-only events. The lifecycle is `SENT -> DELIVERED -> READ`, with authorization derived from the authenticated receiver and stored message metadata.
- The installed library supports consecutive and out-of-order messages through skipped message keys. Consumed message keys are removed, so replayed messages raise `MessageCounterError`.
- Offline ciphertext is queued in memory until the recipient reconnects. Pending receipts for an offline sender are not persisted.
- The browser UI currently finds contacts by username. The client crypto dependency produces non-fatal Vite browser externalization and bundle-size warnings.
- This project does not claim every security property of Signal Messenger. Production deployment would still require HTTPS/WSS, secure cookie/token policy, durable queues, rate limits, abuse controls, device verification, and a formal security review.
