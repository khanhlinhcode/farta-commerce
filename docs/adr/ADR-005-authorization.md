# ADR-005: Authorization model

Status: Accepted

Use permission guards plus object/domain policy services. Roles provide permission sets; `STAFF` assignments can narrow them. Backend policy checks ownership/assignment and state transitions. Frontend hiding is not authorization. `OWNER` authority cannot be granted by ordinary admin flows.
