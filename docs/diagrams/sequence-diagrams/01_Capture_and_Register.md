# Capture and Register Incoming Documents

```mermaid
sequenceDiagram
    actor Sender as Citizen/Barangay/Agency
    participant RO as Receiving Officer
    participant DMS as DMS
    participant DTS as DTS
    participant WMS as WMS
    participant Routing as Mayor's Office/SP Secretariat

    Sender->>RO: Submit document

    RO->>DMS: Register document metadata
    RO->>DMS: Upload scan/attachments

    DMS-->>RO: Metadata validation

    alt Invalid Metadata
        DMS-->>RO: Validation error
        RO->>Sender: Request correction
    else Valid
        DTS->>DTS: Generate Tracking ID
        DTS->>DTS: Generate QR Code
        DTS-->>RO: Tracking Number

        WMS->>WMS: Create Workflow Instance

        RO->>Routing: Forward for assessment
        Routing->>WMS: Select workflow route

        WMS-->>RO: Workflow started
    end
```