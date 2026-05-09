# AI Engine Architecture: The "Neural Pipeline"

## 1. Unified Intelligence Orchestrator
The Hospyn 2.0 Engine is an **Asynchronous Priority-Based Hub**. It doesn't rely on a single LLM; instead, it orchestrates multiple providers to ensure sub-10s latency even during provider outages.

### 1.1 The "Unified AI Engine" Logic Flow
```mermaid
graph TD
    subgraph "Ingress & Pre-processing"
        IN[Input: PDF/Image/Text] --> OPT[Image Optimizer: Resizing/JPEG]
        OPT --> OCR[OCR Pipeline Start]
    end

    subgraph "The Orchestrator (unified_ai_engine)"
        OCR --> Q_GROQ{Try Groq?}
        Q_GROQ -->|Success| RES[Parse Result]
        Q_GROQ -->|Rate Limit / Fail| Q_GEMINI{Try Gemini?}
        Q_GEMINI -->|Success| RES
        Q_GEMINI -->|Fail| ERR[ERROR: SERVICE_UNAVAILABLE]
    end

    subgraph "Clinical Intelligence Extraction"
        RES --> EXT[Extract Medical Entities]
        EXT --> PYD{Pydantic Validation}
        PYD -->|Invalid JSON| RET[Auto-Retry Loop]
        RET --> RES
        PYD -->|Valid| ENT[MedicalEntities Model]
    end

    subgraph "Parallel Summary Generation"
        ENT --> DOC[Task: Doctor Clinical Summary]
        ENT --> PAT[Task: Patient Warm Explanation]
        DOC --> SYNC[Async Gather]
        PAT --> SYNC
    end

    subgraph "Persistence & Privacy"
        SYNC --> ENC[AES-256 Field Encryption]
        ENC --> DB[(PostgreSQL Storage)]
    end
```

## 2. Technical Component Breakdown
| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Orchestration** | `AsyncAIService` | Manages state, httpx clients, and fallback logic. |
| **Speed Layer** | Groq (Llama 3) | Optimized for raw text extraction and speed. |
| **Vision Layer** | Gemini 1.5 Flash | Reserved for complex OCR and vision tasks. |
| **Validation Layer** | Pydantic V2 | Ensures clinical data matches strict medical schemas. |
| **Privacy Layer** | Cryptography (Fernet) | Encrypts SSN, Conditions, and Medications at rest. |

## 3. Parallel Execution Sequence
```mermaid
sequenceDiagram
    participant P as Pipeline
    participant G as Groq/Gemini Hub
    participant E as Entity Extractor
    participant D as Doctor Service
    participant PT as Patient Service

    P->>G: Perform OCR (Image -> Text)
    G-->>P: Raw Content
    P->>E: JSON Extraction Request
    E->>G: Prompt: "Extract Entities"
    G-->>E: Structured JSON
    Note over E: Validate via MedicalEntities Model
    par Concurrent Generations
        E->>D: Generate Physician Summary
        E->>PT: Generate Patient Explanation
    and
        D->>G: Context: Clinical findings
        PT->>G: Context: Warm Tone / No Jargon
    end
    D-->>P: Summary Doc
    PT-->>P: Explanation Doc
    P->>P: Package as Unified Report
```
