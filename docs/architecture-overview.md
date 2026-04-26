# AVIA — Architecture Overview (Visual)

A picture-first reference. For prose-level architecture see `architecture.md`;
for per-agent prompts see `agents.md`; for MCP tool contracts see
`mcp-contracts.md`.

## End-to-end pipeline

```mermaid
flowchart TD
    User([👤 You — pick a<br/>work item])
    ADO[(Azure DevOps<br/>work item #1234)]

    User --> ADO

    subgraph AVIA["AVIA — runs as <code>avia --work-item 1234</code>"]
      direction TB
      Orch{{"Orchestrator<br/>(state-machine reducer,<br/>not an LLM)"}}

      subgraph Agents["4 specialized agents — one Anthropic call per turn"]
        direction LR
        Sum["📋 Summary<br/>→ WorkItemIntent"]
        Arc["🧠 Architect<br/>→ DesignProposal"]
        Dev["⚙️ Developer<br/>→ BuildArtifact<br/>(.sln + .rnrproj)"]
        Tst["🧪 Tester<br/>→ TestReport"]
      end

      Approve{{"❓ Human<br/>approves design<br/>y / N"}}

      Orch --> Sum --> Arc --> Approve
      Approve -- "y" --> Dev
      Approve -- "N" --> Reject([rejected])
      Dev --> Tst
      Tst -- "pass" --> Done([✅ done])
      Tst -- "fail (≤3x)" --> Dev
      Tst -- "fail (>3x)" --> Failed([❌ failed])
    end

    ADO --> Orch

    subgraph MCP["External MCP servers — AVIA writes none of these"]
      direction LR
      AdoMcp[["azure-devops<br/>(Microsoft)"]]
      Nav[["d365fo-nav<br/>(dynamics365ninja)"]]
      Sem[["fo-semantic<br/>(xplusplusai)"]]
      Erp[["erp<br/>(Microsoft<br/>D365 ERP MCP)"]]
    end

    Sum -.uses.-> AdoMcp
    Arc -.read.-> Nav
    Arc -.read.-> Sem
    Arc -.read.-> AdoMcp
    Dev -.read+write.-> Nav
    Dev -.read.-> Sem
    Tst -.live F&O.-> Erp
    Tst -.read.-> Nav

    UDE[("🪟 Windows UDE<br/>VS2022 + D365 dev tools<br/>+ PackagesLocalDirectory")]
    Nav -.runs MSBuild on.-> UDE
    Erp -.HTTPS to.-> Tenant[("☁️ Live F&O tenant")]

    classDef agent fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef mcp fill:#fef3c7,stroke:#a16207,color:#713f12
    classDef terminal fill:#dcfce7,stroke:#166534,color:#14532d
    classDef bad fill:#fee2e2,stroke:#991b1b,color:#7f1d1d
    classDef gate fill:#fce7f3,stroke:#9d174d,color:#831843
    class Sum,Arc,Dev,Tst agent
    class AdoMcp,Nav,Sem,Erp mcp
    class Done terminal
    class Reject,Failed bad
    class Approve,Orch gate
```

## Task lifecycle (state machine)

```mermaid
stateDiagram-v2
    [*] --> created
    created --> summarizing : START
    summarizing --> designing : SUMMARY_COMPLETED
    designing --> awaiting_user_approval : DESIGN_COMPLETED
    awaiting_user_approval --> developing : USER_APPROVED
    awaiting_user_approval --> rejected : USER_REJECTED
    developing --> testing : DEV_COMPLETED
    testing --> done : TEST_COMPLETED (pass)
    testing --> developing : TEST_COMPLETED (fail, < 3 loops)
    testing --> failed : TEST_COMPLETED (fail, ≥ 3 loops)
    rejected --> [*]
    done --> [*]
    failed --> [*]
    note right of awaiting_user_approval
      Hard gate — no code is written
      until a human approves the design.
    end note
    note right of testing
      Tester drives live F&O via the
      Microsoft ERP MCP — opens forms,
      creates records, verifies rules.
    end note
```

## Tool surface per agent (least-privilege)

```mermaid
flowchart LR
    subgraph S[Summary]
      direction TB
      S1[azure-devops only]
    end
    subgraph A[Architect]
      direction TB
      A1[d365fo-nav<br/>read-only]
      A2[fo-semantic]
      A3[azure-devops<br/>read-only]
    end
    subgraph D[Developer]
      direction TB
      D1[d365fo-nav<br/>read + write]
      D2[fo-semantic]
    end
    subgraph T[Tester]
      direction TB
      T1[erp<br/>live F&O ops]
      T2[d365fo-nav<br/>read-only]
    end

    classDef agent fill:#dbeafe,stroke:#1e40af
    class S,A,D,T agent
```

Filtering happens at construction: each agent calls
`registry.toolsFor(...)` with only the servers it's allowed to touch.
The other tools are literally not visible to that agent's LLM.

## Output contract (the "VS2022-shaped" promise)

```mermaid
flowchart TB
    Dev[⚙️ Developer agent] --> BA[BuildArtifact]
    BA --> SP[solutionPath:<br/>absolute .sln path]
    BA --> Pj[projects[]:<br/>one .rnrproj per touched model]
    BA --> Cfg[configuration:<br/>Debug | Release]
    BA --> CL[compileLog:<br/>full MSBuild output]
    BA --> DI[deploymentId<br/>+ deployedAt]
    SP --> Reviewer[👀 Human reviewer<br/>opens .sln in VS2022<br/>just like any PR]
    Pj --> Reviewer
    classDef out fill:#fef3c7,stroke:#a16207
    class BA out
```

The `BuildArtifact` Zod schema (in `packages/shared-types/src/index.ts`)
forces every successful run to emit a **standard VS2022 solution + Dynamics
365 F&O project**. A reviewer can open the `.sln` and see exactly what
AVIA built — no special tooling needed.
