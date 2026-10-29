declare const content: readonly {
  readonly sourceType:
    "SHIPPING_POLICY" | "RETURN_POLICY" | "SIZE_GUIDE" | "FAQ";
  readonly sourceId: string;
  readonly title: string;
  readonly canonicalPath: string;
  readonly sections: readonly string[];
  readonly approvedAt: string;
}[];

export = content;
