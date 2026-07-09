import * as React from "react";

export interface QRCodeDisplayProps {
  /** UUID tracking ID from the DTS tracking record — the QR payload */
  trackingId: string;
  /** Formatted document number for display below the QR, e.g. "7SP 2026-001" */
  documentNumber: string;
  /** Document title for display below the number */
  title: string;
  /** "screen" = standard with shadow; "print" = no shadow, min 200×200px */
  variant?: "screen" | "print";
  className?: string;
}

export function QRCodeDisplay({
  trackingId,
  documentNumber,
  title,
  variant = "screen",
  className = "",
}: QRCodeDisplayProps) {
  // Construct QR image URL using api.qrserver.com.
  // The QR encodes the tracking lookup URL: {QR_BASE_URL}/{trackingId}
  const qrBaseUrl = "https://portal.batac.gov.ph/track";
  const qrPayload = `${qrBaseUrl}/${trackingId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    qrPayload
  )}&ecc=M`;

  const containerClasses =
    variant === "print"
      ? "bg-white border border-border-strong p-2 shadow-none min-w-[200px] min-h-[200px] flex flex-col items-center justify-between"
      : "bg-white rounded-lg border border-border-default shadow-sm p-4 flex flex-col items-center justify-between";

  return (
    <div className={`${containerClasses} ${className}`}>
      {/* 
        ARIA Requirement:
        1. Container carries role="img" and aria-label="QR code for document {documentNumber}" exactly.
        2. Sibling-not-descendant rule: document-number <p> and title <p> must be siblings of,
           not descendants of, the role="img" container. This ensures screen readers read them correctly
           instead of flattening them inside the role="img" container.
        3. Non-interactive: No tabIndex is assigned, so it is not part of the tab order.
      */}
      <div
        role="img"
        aria-label={`QR code for document ${documentNumber}`}
        className="w-full aspect-square flex items-center justify-center overflow-hidden"
      >
        <img
          src={qrImageUrl}
          alt=""
          className="w-full h-full object-contain"
        />
      </div>

      <p className="font-mono text-xs font-medium text-text-primary text-center mt-3 w-full">
        {documentNumber}
      </p>

      <p
        className="text-sm text-text-secondary text-center line-clamp-2 w-full mt-1"
        title={title}
      >
        {title}
      </p>
    </div>
  );
}
