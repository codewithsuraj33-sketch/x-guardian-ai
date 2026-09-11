# X-Guardian — AI-Powered Industrial Safety Monitoring & Response System

**Problem Statement: PS06** — AI system for detecting safety gear compliance and industrial safety violations.

---

> ### ⚠️ Project Status: Phase 2B Completed
> - **Phase 1 (Virtual Factory Foundation)**: Completed with interactive 2D floor plan, simulated worker RFID tracking, and deterministic safety rules.
> - **Phase 2A (Live Camera & Video Foundation)**: Completed with real browser camera streaming (desktop webcam & mobile browser camera via MediaDevices API), optical HUD overlay, and video element hooks.
> - **Phase 2B (AI Vision & PPE Detection Foundation)**: Completed with decoupled FastAPI Python computer vision backend (`backend/`), modular `VisionDetector` interface, Pydantic & TypeScript schemas, configurable inference rate (5/10/15 FPS), and live backend health telemetry.
> - **Phase 2C Roadmap**: Download & benchmark vetted YOLOv8-PPE weights for live automated inference.
> - **Note on AI**: Actual PPE AI inference is **NOT** considered complete until the vetted model weights are installed, tested, and validated with real video feeds in Phase 2C. Phase 2B establishes the full client-server vision foundation.

---

## 🏭 Overview & Phase 1 Scope

X-Guardian is an enterprise-grade industrial safety control center built to monitor worker personal protective equipment (PPE) compliance, track spatial factory zone hazards, and automate incident reporting.

### Phase 1 Features:
1. **Industrial Command Center Dashboard**:
   - Real-time KPI statistics: *Workers Monitored*, *Safe Workers*, *Active Violations*, *Critical Alerts*.
   - Overall Safety Health gauge with dynamic risk scoring (0–100 scale).
   - Zone safety matrix and live surveillance grid status.
   - Live incident alert feed with severity tags and status lifecycle.
2. **Interactive 2D/2.5D Virtual Factory**:
   - 5 defined factory zones:
     - **ZONE-01**: Entry Sector
     - **ZONE-02**: Main Assembly Line
     - **ZONE-03**: High-Temperature Welding
     - **ZONE-04**: Warehouse & Storage
     - **ZONE-05**: High-Hazard Restricted Zone
   - Autonomous worker movement simulation across zones.
   - Dynamic worker density counts and safety status per zone.
   - Optical camera markers mapped to each sector (`CAM-01` to `CAM-05`).
3. **PPE Compliance & Deterministic Safety Engine**:
   - PPE gear tracked per worker: **Helmet**, **Safety Vest**, **Gloves**, **Safety Shoes**.
   - Modular risk scoring engine (`services/safetyEngine.ts`):
     - Missing Helmet: `+30`
     - Missing Safety Vest: `+20`
     - Missing Gloves: `+20`
     - Missing Shoes: `+10`
     - Restricted Zone Intrusion: `+25`
   - Risk Thresholds:
     - `0–30`: **LOW**
     - `31–60`: **MEDIUM**
     - `61–80`: **HIGH**
     - `81+`: **CRITICAL**
4. **Automated Incident Logging**:
   - Incident lifecycle tracking (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`).
   - Incident engine (`services/incidentEngine.ts`) that automatically generates tickets on violation detection.
5. **Interactive Entity Inspectors**:
   - Click any zone to view zone details, camera feed status, and active violations.
   - Click any worker marker to view RFID tracker ID, live PPE checklist (✓/✕), risk score, and active violations.
6. **Enterprise Navigation & Secondary Views**:
   - `/factory`: Full-page virtual factory with zone filters and personnel roster.
   - `/cameras`: CCTV surveillance grid with simulated optical reticles and RTSP stream metadata.
   - `/workers`: Comprehensive searchable/filterable worker registry.
   - `/incidents`: Filterable incident audit log.
   - `/analytics`: Safety compliance metrics and future AI pipeline architecture blueprint.

---

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` plugin, modern CSS-based theme tokens)
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Architecture**: Modular Services, React Context + `useReducer` state management, zero bloated libraries

---

## 📂 Project Structure

```
X-Guardian/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── index.ts               # Core TypeScript definitions (Worker, Zone, Camera, Incident, PPE)
    ├── data/
    │   ├── workers.ts             # Initial mock personnel (W-1001 to W-1005)
    │   ├── zones.ts               # 5 factory zones
    │   ├── cameras.ts             # 5 camera nodes (CAM-01 to CAM-05)
    │   └── incidents.ts           # Mock safety incident log
    ├── services/
    │   ├── safetyEngine.ts        # Pure function deterministic risk calculation
    │   ├── incidentEngine.ts      # Automated incident generation & deduplication
    │   └── workerSimulation.ts    # Timer-based worker movements and PPE state toggling
    ├── hooks/
    │   ├── useFactoryState.ts     # Central state reducer and KPI derivations
    │   └── useSimulation.ts       # Simulation timer controller
    ├── context/
    │   └── FactoryContext.tsx     # Global React Context provider
    ├── components/
    │   ├── Layout.tsx             # Shell layout (Sidebar + Header + Content)
    │   ├── Sidebar.tsx            # Navigation sidebar with status footer
    │   ├── Header.tsx             # Top bar with live status badge & clock
    │   ├── StatCard.tsx           # Reusable KPI card
    │   ├── SafetyGauge.tsx        # SVG arc gauge for safety health
    │   ├── IncidentList.tsx       # Live incident feed
    │   ├── ZoneStatusGrid.tsx     # Matrix of zone safety cards
    │   ├── FactoryMap.tsx         # Interactive 2D factory floor plan
    │   ├── FactoryZone.tsx        # Room representation with camera & worker dots
    │   ├── WorkerMarker.tsx       # Interactive worker avatar with pulse animations
    │   ├── CameraMarker.tsx       # Interactive optical camera badge
    │   ├── ZoneDetails.tsx        # Zone telemetry inspection drawer
    │   ├── WorkerDetails.tsx      # Worker PPE compliance drawer
    │   └── PPEStatusDisplay.tsx   # Detailed & compact PPE ✓/✕ status
    ├── pages/
    │   ├── Dashboard.tsx          # Main industrial command center
    │   ├── Factory.tsx            # Full-screen interactive digital twin
    │   ├── Cameras.tsx            # CCTV surveillance grid
    │   ├── Workers.tsx            # Searchable personnel registry
    │   ├── Incidents.tsx          # Incident audit log
    │   └── Analytics.tsx          # Compliance metrics & Phase 2 roadmap
    └── utils/
        ├── constants.ts           # Scoring penalties, colors, simulation constants
        └── formatters.ts          # Timestamps, badge styles, color helpers
```

---

## 🚀 Installation & Running

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm

### 1. Clone & Navigate to Project
```bash
cd X-Guardian
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Frontend Development Server
```bash
npm run dev
```
Accessible at: `http://localhost:5173/`

### 4. Start Python FastAPI Vision Service (Phase 2B)
In a separate terminal:
```bash
pip install -r backend/requirements.txt
python backend/main.py
```
Vision backend accessible at:
- **Health Probe**: `http://127.0.0.1:8000/health`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

### 5. Build for Production
```bash
npm run build
```

---

## 🔮 Target Future Architecture (Phase 2+)

In subsequent phases, simulated data will be replaced by real-time AI microservices:

```
RTSP Camera Feeds (CCTV / Edge Nodes)
  │
  ▼
Computer Vision Service (YOLOv8 / OpenCV)
  ├── Person Detection & Tracking (ByteTrack)
  ├── Multi-Class PPE Classifier (Helmet, Vest, Gloves, Footwear)
  └── Hazard Boundary Intrusion Detection
  │
  ▼
FastAPI Backend Services
  ├── Safety Engine Microservice
  ├── PostgreSQL Database (Audit Logs & Incident State)
  └── WebSocket Broadcast Server
  │
  ▼
X-Guardian Command Center (React Frontend)
  ├── Real-time Video Stream Overlays with Bounding Boxes
  ├── Push Notifications & Hardware Alarm Triggers (ESP32 / Buzzers)
  └── Automated Supervisor SMS / WhatsApp / Email Alerts
```

---

## ⚠️ Current Phase 1 Limitations

- Camera streams are mock representations with simulated optical reticles.
- Worker positioning is simulated via timer events rather than computer vision tracking.
- Safety violations and incidents are computed deterministically via local state rather than cloud AI microservices.
- No database or backend API server is connected yet (uses local mock data).
