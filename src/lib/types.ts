export interface QuoteRequest {
  projectName: string;
  labTypeId: number;
  area: number;
  cleanLevel: string;
  budgetLevel: string;
  specialRequirements?: string;
}

export interface EquipmentItem {
  id: number;
  equipmentName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isRequired: boolean;
  sortOrder: number;
}

export interface ConstructionItem {
  id: number;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  category: string;
  sortOrder: number;
}

export interface QuoteResult {
  projectName: string;
  labTypeName: string;
  labTypeParams: {
    cleanLevelDefault: string;
    pressureRequirement: string;
    tempHumidity: string;
    airChangesPerHour: number;
    illuminationLux: number;
    notes: string | null;
  };
  area: number;
  cleanLevel: string;
  budgetLevel: string;
  specialRequirements?: string;
  equipmentList: EquipmentItem[];
  equipmentTotal: number;
  constructionList: ConstructionItem[];
  constructionTotal: number;
  constructionByCategory: {
    category: string;
    subtotal: number;
  }[];
  managementFee: number;
  profit: number;
  grandTotal: number;
  quoteComparison: QuoteLevelComparison[];
  generatedAt: string;
}

export interface QuoteLevelComparison {
  levelName: string;
  equipmentTotal: number;
  constructionTotal: number;
  managementFee: number;
  profit: number;
  grandTotal: number;
}
