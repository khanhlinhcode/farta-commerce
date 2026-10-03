# ADR-012: Catalog publication and money

Status: Accepted

Products and sellable variants remain separate aggregates. Prices are integer VND values. Slugs and SKU values have database unique indexes. Public visibility requires active categories, verified cover media and at least one active valid variant; status alone is insufficient. Public DTOs are allowlisted read models, not serialized Mongoose documents.
