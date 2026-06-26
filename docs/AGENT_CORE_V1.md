# Agent Core V1 Specification (Legacy / Superseded)

> Status: legacy. Replaced by [Real Asset Agent V1](./REAL_ASSET_AGENT_V1.md) and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

This document details the V1 specifications of the GrowthBot (GBot) Agent Core system, including configuration, registration, and initial claim state.

## Core Characteristics
1. **Free Initial Claim**: Every unique user has the right to claim one free Agent exactly once.
2. **Deterministic Initial Attributes**:
   - **Level**: 1
   - **Status**: `idle` (Idle/閑置)
   - **Energy**: Starts fully recharged matching `maxEnergy` (100).
   - **Pending Points (GP)**: 0
   - **Rank Tier**: `unranked`
3. **No Mock Override**: Production registration and initial claims must write directly to the database. Silent mock failover is strictly forbidden on registration and claim actions.

## Database Integrity
- `agents` table fields:
  - `id`: unique identifier prefixed with `ag_`
  - `user_id`: foreign key referencing the `users.id`
  - `name`: user chosen name or default username
  - `level`: integer, starting at 1
  - `energy`: integer
  - `max_energy`: integer (default 100)
  - `pending_points`: integer (default 0)
  - `rank_tier`: string (default `unranked`)
  - `status`: string (default `idle`)
  - `created_at`: timestamp in UTC
  - `updated_at`: timestamp in UTC

## Claim Logic
The claiming endpoint `POST /agents/claim` performs the following operations atomically:
1. Ensures user session is valid.
2. Verifies that the user has not claimed an agent yet (`users.has_agent` is false/0).
3. Creates a new agent record in `agents` table.
4. Updates user profile `has_agent` to `1` / true.
5. Grants one Starter Box to user inventory (`inventory` table) as the initial bootstrap item.
6. Returns the claimed agent profile.
