# Credora Frontend

Modern, accessible, institutional-grade interface for the **Credora (REBOUND)** academic micro-lending protocol. Designed and maintained by **Owner C (Frontend / Quality)**.

## Core Features

- **Dual Theme Support**: System-aware and user-toggleable Light/Dark modes using customized institutional palettes (Cobalt, Deep Obsidian, Spruce Emerald, and Warm Amber).
- **Persona Context Switcher**: Seamless switching between **Borrower**, **Lender**, and **Reviewer** perspectives.
- **Explainable Credit Studio**: 5-factor interactive slider simulator with live radar charts, factor explainability notes, and formal assessment disputes.
- **Micro-Loan Marketplace**: Live quotation simulator (30–365 days), fixed 12% APR calculation, and exact-cent amortized repayment schedules.
- **Lending Pool & Liquidity Desk**: Real-time TVL, pool utilization gauge, supply/redeem actions, and lender position tracking.
- **Reviewer Adjudication Desk**: Protected reviewer queue to evaluate credit disputes with audit logging.
- **Dual Mode Transparency**: Clear visible indicators distinguishing **Demo Mode** from live **Sepolia Testnet** transactions.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Tailwind-merge + Clsx
- **Icons**: Lucide React
- **Data Visualization**: Recharts (Radar, Progress & Amortization)
- **API Architecture**: Typed API client mirroring FastAPI Pydantic models with automatic offline demo store fallback.

## Quickstart

```powershell
# 1. Install dependencies
cd frontend
npm install

# 2. Configure environment
Copy-Item .env.example .env

# 3. Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173).

## Quality & Verification Commands

```powershell
# Type check and production build
npm run build
```
