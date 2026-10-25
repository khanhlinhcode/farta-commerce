import type { RagLocale, RagSourceType } from "../rag.constants";

export const RAG_EVALUATION_DATASET_VERSION = "farta-rag-eval-v1" as const;
export const RAG_EVALUATION_TENANT = "farta-eval" as const;

export type RagEvaluationDocument = {
  tenantId: string;
  sourceType: RagSourceType;
  sourceId: string;
  locale: RagLocale;
  title: string;
  canonicalPath: string;
  content: string;
  categoryIds: readonly string[];
  tags: readonly string[];
};

export type RagEvaluationCase = {
  caseId: string;
  query: string;
  tenantId: string;
  locale: RagLocale;
  sourceTypes: readonly RagSourceType[];
  categoryIds?: readonly string[];
  tags?: readonly string[];
  relevantSourceIds: readonly string[];
  validatesFilter?: boolean;
};

// Synthetic public content only. These fixtures test the retrieval contract;
// they are not FARTA business policy and must never be indexed into a runtime corpus.
export const RAG_EVALUATION_CORPUS: readonly RagEvaluationDocument[] = [
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "PRODUCT",
    sourceId: "eval-essential-tee",
    locale: "vi",
    title: "Áo thun Essential thử nghiệm",
    canonicalPath: "/__eval__/product/essential-tee",
    content:
      "Áo cotton phom relaxed màu đen dùng trong bộ dữ liệu đánh giá cục bộ.",
    categoryIds: ["eval-tops"],
    tags: ["cotton", "essential"],
  },
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "PRODUCT",
    sourceId: "eval-linen-midi-dress",
    locale: "vi",
    title: "Đầm linen midi thử nghiệm",
    canonicalPath: "/__eval__/product/linen-midi-dress",
    content:
      "Đầm linen dáng midi màu kem dùng trong bộ dữ liệu đánh giá cục bộ.",
    categoryIds: ["eval-dresses"],
    tags: ["linen", "midi"],
  },
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "PRODUCT",
    sourceId: "eval-wide-leg-trousers",
    locale: "en",
    title: "Evaluation wide leg trousers",
    canonicalPath: "/__eval__/product/wide-leg-trousers",
    content:
      "Black wide leg trousers for the deterministic local evaluation dataset.",
    categoryIds: ["eval-bottoms"],
    tags: ["black", "wide-leg"],
  },
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "SHIPPING_POLICY",
    sourceId: "eval-shipping-standard",
    locale: "vi",
    title: "Chính sách giao hàng thử nghiệm",
    canonicalPath: "/__eval__/policies/shipping",
    content:
      "Giao hàng tiêu chuẩn trong ba đến năm ngày cho kịch bản đánh giá cục bộ.",
    categoryIds: [],
    tags: ["shipping"],
  },
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "RETURN_POLICY",
    sourceId: "eval-return-standard",
    locale: "vi",
    title: "Chính sách đổi trả thử nghiệm",
    canonicalPath: "/__eval__/policies/returns",
    content:
      "Đổi trả trong ba mươi ngày là dữ liệu giả lập dành riêng cho đánh giá cục bộ.",
    categoryIds: [],
    tags: ["returns"],
  },
  {
    tenantId: RAG_EVALUATION_TENANT,
    sourceType: "SIZE_GUIDE",
    sourceId: "eval-size-guide",
    locale: "vi",
    title: "Hướng dẫn kích thước thử nghiệm",
    canonicalPath: "/__eval__/guides/size",
    content:
      "Hướng dẫn chọn size theo vòng ngực cho bộ dữ liệu đánh giá cục bộ.",
    categoryIds: [],
    tags: ["size"],
  },
  {
    tenantId: "another-eval-tenant",
    sourceType: "FAQ",
    sourceId: "eval-cross-tenant-only",
    locale: "vi",
    title: "Tài liệu thuộc tenant khác",
    canonicalPath: "/__eval__/other-tenant/moonstone",
    content:
      "Cross tenant moonstone manual chỉ tồn tại trong tenant đánh giá khác.",
    categoryIds: [],
    tags: ["isolation"],
  },
] as const;

export const RAG_EVALUATION_CASES: readonly RagEvaluationCase[] = [
  {
    caseId: "FARTA-RAG-V1-001",
    query: "áo cotton relaxed màu đen",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    relevantSourceIds: ["eval-essential-tee"],
  },
  {
    caseId: "FARTA-RAG-V1-002",
    query: "dam linen midi mau kem",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    relevantSourceIds: ["eval-linen-midi-dress"],
  },
  {
    caseId: "FARTA-RAG-V1-003",
    query: "black wide leg trousers",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "en",
    sourceTypes: ["PRODUCT"],
    relevantSourceIds: ["eval-wide-leg-trousers"],
  },
  {
    caseId: "FARTA-RAG-V1-004",
    query: "giao hàng tiêu chuẩn ba đến năm ngày",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["SHIPPING_POLICY"],
    relevantSourceIds: ["eval-shipping-standard"],
  },
  {
    caseId: "FARTA-RAG-V1-005",
    query: "đổi trả trong ba mươi ngày",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["RETURN_POLICY"],
    relevantSourceIds: ["eval-return-standard"],
  },
  {
    caseId: "FARTA-RAG-V1-006",
    query: "hướng dẫn chọn size theo vòng ngực",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["SIZE_GUIDE"],
    relevantSourceIds: ["eval-size-guide"],
  },
  {
    caseId: "FARTA-RAG-V1-007",
    query: "cotton",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    categoryIds: ["eval-tops"],
    tags: ["cotton"],
    relevantSourceIds: ["eval-essential-tee"],
    validatesFilter: true,
  },
  {
    caseId: "FARTA-RAG-V1-008",
    query: "linen",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    categoryIds: ["eval-dresses"],
    tags: ["linen"],
    relevantSourceIds: ["eval-linen-midi-dress"],
    validatesFilter: true,
  },
  {
    caseId: "FARTA-RAG-V1-009",
    query: "bảo hành thiết bị điện tử",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["FAQ"],
    relevantSourceIds: [],
    validatesFilter: true,
  },
  {
    caseId: "FARTA-RAG-V1-010",
    query: "cross tenant moonstone manual",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["FAQ"],
    relevantSourceIds: [],
    validatesFilter: true,
  },
  {
    caseId: "FARTA-RAG-V1-011",
    query: "black wide leg trousers",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    relevantSourceIds: [],
    validatesFilter: true,
  },
  {
    caseId: "FARTA-RAG-V1-012",
    query: "giao hàng tiêu chuẩn",
    tenantId: RAG_EVALUATION_TENANT,
    locale: "vi",
    sourceTypes: ["PRODUCT"],
    relevantSourceIds: [],
    validatesFilter: true,
  },
] as const;
