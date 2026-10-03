# RBAC and object authorization

Legend: `A` allowed, `S` scoped/assigned, `O` own resources only, `-` denied.

| Permission                      | CUSTOMER | STAFF | ADMIN | OWNER |
| ------------------------------- | :------: | :---: | :---: | :---: |
| `product.read`                  |    A     |   A   |   A   |   A   |
| `product.create/update/archive` |    -     |   S   |   A   |   A   |
| `inventory.read`                |    -     |   S   |   A   |   A   |
| `inventory.adjust`              |    -     |   S   |   A   |   A   |
| `order.read`                    |    O     |   S   |   A   |   A   |
| `order.update`                  |    -     |   S   |   A   |   A   |
| `order.cancel`                  |    O     |   S   |   A   |   A   |
| `customer.read/update`          |    O     |   S   |   A   |   A   |
| `media.manage`                  |    -     |   S   |   A   |   A   |
| `banner.manage`                 |    -     |   S   |   A   |   A   |
| `audit.read`                    |    -     |   -   |   A   |   A   |
| `staff.manage`                  |    -     |   -   |   A   |   A   |
| `role.manage`                   |    -     |   -   |   S   |   A   |
| `owner.manage`                  |    -     |   -   |   -   |   A   |

`STAFF` capabilities are explicit assignments, not the union of all staff permissions. `ADMIN` cannot grant or revoke `OWNER` and cannot change owner-only controls.

## Enforcement model

1. Authentication guard verifies signature, issuer, audience, realm, expiry and active session.
2. Permission guard resolves effective permissions by stable role/assignment version.
3. Policy service verifies object ownership, assignment and current domain state.
4. Domain service enforces state transition invariants.
5. Audit interceptor records privileged mutations after outcome is known.

Controllers do not contain scattered role comparisons. They declare required permissions and call policies with the loaded resource. Resource lookup never trusts a `userId` from a customer payload; it derives the principal from the verified session.

Representative invariant: `Customer A` requesting `Customer B`'s order/session/address receives the same safe not-found/denied contract and no resource data. Automated tests cover read, update and cancellation paths.
