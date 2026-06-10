# Citizen Status Lookup

```mermaid
sequenceDiagram
    actor Citizen
    participant Portal
    participant DTS

    Citizen->>Portal: Enter Tracking Number

    Portal->>DTS: Lookup Tracking Status

    alt Publicly Visible
        DTS-->>Portal: Current Status
        Portal-->>Citizen: Display Timeline
    else Restricted
        Portal-->>Citizen: Limited Information
    end
```