# Open decisions

These do not block Phase 1 bootstrap. They must be resolved before the named phase and recorded by ADR amendment/new ADR.

| ID    | Decision                                                 | Needed by         | Safe current default                                                  |
| ----- | -------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| OD-01 | production/staging domains and hosting provider          | Phase 2           | placeholders; production config fails closed                          |
| OD-02 | guest checkout business policy                           | Phase 6           | architecture supports it; feature disabled                            |
| OD-03 | production password policy and bcrypt cost benchmark     | before production | minimum 12 characters; configurable cost 10–15, default 12            |
| OD-04 | JWT asymmetric algorithm/KMS and rotation operator       | before production | fixed HS256 verifier with independent external secret; no key in code |
| OD-05 | staff OAuth/SSO and MFA provider                         | admin launch      | password realm with MFA-ready hooks; public OAuth denied              |
| OD-06 | payment provider, deposits, refund rules                 | Phase 7           | provider-neutral states only; no fake confirmations                   |
| OD-07 | tax, shipping zones/carriers and currency scope          | Phase 7           | integer VND-ready money model; policy uncommitted                     |
| OD-08 | Cloudinary cloud/account, allowed formats and moderation | Phase 4           | no upload without valid server config                                 |
| OD-09 | email provider and templates                             | Phase 2/5         | adapter boundary; no production fake send                             |
| OD-10 | observability vendors, retention and PII residency       | deployment        | console JSON in dev; provider hooks disabled                          |
| OD-11 | exact inventory reservation TTL                          | Phase 7           | typed policy, no magic constant in domain code                        |
| OD-12 | legal privacy/retention/cancellation policy              | before production | minimize collection; prevent destructive purge of audit/order records |

No decision may silently weaken realm separation, object authorization, inventory atomicity, payment authenticity or the AI boundary.
