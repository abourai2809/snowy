# Pan Workflow Flowchart

This flowchart is for tracking the pan lifecycle features. Staff guides are in separate files in this folder.

```mermaid
flowchart LR
  START([Start]) --> L1

  subgraph LAB["Lab Staff / Lab Manager"]
    direction TB
    L1["Save production"]
    L2["App creates one pan record per pan"]
    L3["Pan ID is shown for labelling"]
    L4["Pan enters lab available stock"]
    L5["Dispatch selected pans to store"]
    L6["Receive empty-pan return"]
  end

  subgraph STORE_RECEIVE["Store Staff: Receive Pans"]
    direction TB
    R1{"Incoming dispatch correct?"}
    R2["Accept dispatch"]
    R3["Reject dispatch"]
    R4{"Rejected by mistake?"}
    R5["Overturn rejection and accept"]
    R6["Wait for lab/admin resolution"]
  end

  subgraph DISPLAY["Store Staff: Display Movement"]
    direction TB
    D1["Choose flavour"]
    D2["App recommends FIFO pan"]
    D3{"Eligible pan exists?"}
    D4["No move; restock needed"]
    D5{"Active display pan already exists?"}
    D6["Move recommended pan to display"]
    D7["Guided swap"]
    D8{"Old pan condition?"}
    D9["Empty: mark depleted"]
    D10["Too low: treat as empty"]
    D11{"Still usable partial allowed?"}
    D12["Keep as one open/partial pan"]
    D13["Block or manager/admin review"]
  end

  subgraph EOD["Store Staff / Store Manager: EOD"]
    direction TB
    E1["Enter EOD gelato weight by flavour"]
    E2{"Active display pan count?"}
    E3["No active pan: save flavour row and flag review"]
    E4["One active pan: assign weight to pan"]
    E5["Multiple active pans: allocate FIFO and flag review"]
    E6{"Weight valid?"}
    E7["Over capacity: flag review"]
    E8{"Weight is 0 kg?"}
    E9["Close pan as depleted/empty"]
    E10["Return pan to deep as partial/open"]
    E11["Store Manager can correct same-day EOD"]
  end

  subgraph EMPTY["Store Staff: Empty Pans"]
    direction TB
    P1["App empty-pan count increases"]
    P2["Enter physical empty-pan count at BOD/EOD"]
    P3{"Physical count matches app count?"}
    P4["No discrepancy"]
    P5["Flag discrepancy"]
    P6["Send empty pans to lab"]
    P7["Return is in transit; store count decreases"]
  end

  subgraph REVIEW["Admin / Store Manager Review"]
    direction TB
    A1["Review unmatched EOD rows"]
    A2["Review over-capacity EOD rows"]
    A3["Review physical empty-pan mismatch"]
    A4["Review disputed empty-pan return"]
  end

  START --> L1 --> L2 --> L3 --> L4 --> L5 --> R1

  R1 -- "Yes" --> R2 --> D1
  R1 -- "No" --> R3 --> R4
  R4 -- "Yes" --> R5 --> D1
  R4 -- "No" --> R6 --> A4

  D1 --> D2 --> D3
  D3 -- "No" --> D4
  D3 -- "Yes" --> D5
  D5 -- "No" --> D6
  D5 -- "Yes" --> D7 --> D8
  D8 -- "Empty" --> D9 --> P1
  D8 -- "Too low" --> D10 --> P1
  D8 -- "Partial" --> D11
  D11 -- "Yes" --> D12 --> D6
  D11 -- "No" --> D13 --> A3
  P1 --> D6
  D6 --> E1

  E1 --> E2
  E2 -- "None" --> E3 --> A1
  E2 -- "One" --> E4 --> E6
  E2 -- "Multiple" --> E5 --> A1
  E5 --> E6
  E6 -- "No" --> E7 --> A2
  E6 -- "Yes" --> E8
  E8 -- "Yes" --> E9 --> P1
  E8 -- "No" --> E10
  E11 -. "Correction path" .-> E1

  P1 --> P2 --> P3
  P3 -- "Yes" --> P4
  P3 -- "No" --> P5 --> A3
  P1 --> P6 --> P7 --> L6
  L6 -- "Accept" --> END([Done])
  L6 -- "Dispute" --> A4

  classDef lab fill:#dff3ff,stroke:#0284c7,color:#0f172a;
  classDef store fill:#dcfce7,stroke:#16a34a,color:#0f172a;
  classDef manager fill:#fef3c7,stroke:#d97706,color:#0f172a;
  classDef admin fill:#fae8ff,stroke:#a855f7,color:#0f172a;
  classDef decision fill:#fff7ed,stroke:#f97316,color:#0f172a;
  classDef warning fill:#fee2e2,stroke:#dc2626,color:#0f172a;
  classDef endNode fill:#ecfccb,stroke:#65a30d,color:#0f172a;

  class L1,L2,L3,L4,L5,L6 lab;
  class R2,R3,R5,D1,D2,D4,D6,D7,D9,D10,D12,E1,E3,E4,E5,E7,E9,E10,P1,P2,P4,P6,P7 store;
  class E11 manager;
  class A1,A2,A3,A4 admin;
  class R1,R4,D3,D5,D8,D11,E2,E6,E8,P3 decision;
  class R6,D13,P5 warning;
  class START,END endNode;
```

