# ADR-004: Mongo query safety

Status: Accepted

Controllers validate DTOs and services explicitly map allowed scalar fields into server-authored filters/updates. Client Mongo operators, arbitrary filters, update documents and recursive object merges are forbidden. Security-sensitive DTOs reject unknown and pollution/operator keys.
