# Runbook 6: Break-Glass Procedure

**Status:** CONFIRMED
**Applies to:** Production Database only
**Revision:** 1.0

This runbook outlines the physical envelope procedure and operational checklist for "break-glass" emergency access. 

**CRITICAL SCOPE LIMITATION:** Break-glass credentials are for **emergency direct database access only**. They are not to be used for general maintenance, reporting, or day-to-day operations.

---

## 1. Prerequisites and Authorization

Before opening the physical break-glass envelope, the following condition MUST be met:

- [ ] **Two-Person Authorization:** Two authorized individuals (e.g., the IT Director and a senior database administrator/ops lead) must be present and provide explicit authorization to open the physical envelope containing the emergency credentials.

---

## 2. Opening the Envelope

- [ ] Open the sealed physical envelope together.
- [ ] Record the date, time, and the names of the two authorizing individuals on the envelope log attached to the physical safe.
- [ ] Use the extracted credentials to connect directly to the primary database instance as the emergency administrator role.

---

## 3. During the Incident

- [ ] Address the emergency (e.g., repairing data corruption, killing a locked transaction that the application cannot resolve, etc.).
- [ ] Maintain a local text file or scratchpad on the operator's machine detailing the exact SQL commands executed during the session (to be included in the incident report).

---

## 4. Post-Incident & Credential Rotation

Once the emergency is resolved and direct access is no longer required, the exposed service credentials must be rotated to invalidate any potential lingering unauthorized access.

- [ ] Execute the credential rotation script:
  ```bash
  ./tools/scripts/ops/rotate-credentials-after-breakglass.sh
  ```
- [ ] Manually transcribe the newly generated passwords printed by the script into the corresponding files in the `./secrets/` directory on the deployment host.
- [ ] Restart the application stack (`docker compose restart server web-build`) so that the services connect with the new credentials.
- [ ] Ensure that the old credentials no longer authenticate.
- [ ] Seal the new emergency admin credentials in a *new* envelope, sign across the seal (both authorized individuals), and return it to the physical safe.

---

## 5. Audit Logging

- [ ] **Mandatory Audit Entry:** Within **1 hour** of the application coming back online (if it was offline during the procedure), an official incident log must be recorded in the audit system, documenting:
  - The nature of the emergency.
  - The names of the two authorizing individuals.
  - A summary of the actions taken using the break-glass credentials.
  - Confirmation that the credentials have been successfully rotated.
