# Agentic Wallet V1 (Legacy / Superseded)

> Status: legacy. Replaced by [TON Agent Wallet V1](./TON_AGENT_WALLET_V1.md) and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

The V1 implementation of the Agentic Wallet operates strictly in **Observation Mode** (Level 0). The system does not generate, store, or manage any private keys or seed phrases on behalf of the user.

## Format Validation
The system supports linking public TON addresses via `POST /agents/:agentId/wallet/link`. The address format is strictly validated on the backend:
- **User-friendly address**: Base64 URL-safe string, exactly 48 characters long, starting with `E` or `k`.
- **Raw address**: Hexadecimal string, exactly 64 characters long.
Any invalid format will be rejected immediately with `400 Bad Request`.

## Level 0 Boundaries
1. **Link, Do Not Generate**: The backend only binds the user's public address profile. It does not generate dummy addresses or dummy private keys.
2. **Read-only Policies**: Spending limits and contract whitelist fields are purely configurations for policy observation and simulation. They do not trigger real on-chain transaction execution or intercept transfers.
3. **Transaction History Payload**: The transaction history API `/agents/:agentId/wallet/transactions` returns structured mode metadata:
   ```json
   {
     "supported": false,
     "mode": "observation",
     "reason": "Agentic Wallet is currently in Level 0 (Observation Mode) and does not perform active on-chain transactions.",
     "transactions": []
   }
   ```

## UI Disclosure & Warnings
The miniapp and admin interfaces must display clear warnings to the user:
- **No custody**: The application does not manage user funds.
- **No automated signatures**: No automated transactions or signing services are provided.
- **No private key storage**: No seed phrases or keys are requested or saved.
- **Limits Disclaimer**: Daily limits and policies are purely declarative for observation purposes.
