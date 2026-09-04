import { prisma } from './db';
import type {
  QuoteRequest,
  QuoteResult,
  EquipmentItem,
  ConstructionItem,
  QuoteLevelComparison,
} from './types';

export async function generateQuote(request: QuoteRequest): Promise<QuoteResult> {
  const { labTypeId, area, budgetLevel, projectName, cleanLevel, specialRequirements } = request;

  const labType = await prisma.labType.findUnique({
    where: { id: labTypeId },
    include: {
      equipmentTemplates: { orderBy: { sortOrder: 'asc' } },
      constructionFactors: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!labType) {
    throw new Error(`实验室类型不存在: ${labTypeId}`);
  }

  const priceLevels = await prisma.priceLevel.findMany({
    orderBy: { id: 'asc' },
  });

  if (priceLevels.length === 0) {
    throw new Error('报价档位未配置，请先运行种子数据');
  }

  const selectedLevel = priceLevels.find((p) => p.levelName === budgetLevel);
  if (!selectedLevel) {
    throw new Error(`报价档位不存在: ${budgetLevel}`);
  }

  const equipmentList: EquipmentItem[] = labType.equipmentTemplates.map((template) => {
    const qtyPer100Area = Number(template.qtyPer100Area);
    const baseUnitPrice = Number(template.baseUnitPrice);
    const equipmentMultiplier = Number(selectedLevel.equipmentMultiplier);

    let quantity: number;
    if (template.isRequired) {
      quantity = Math.max(1, Math.round((area / 100) * qtyPer100Area));
    } else {
      quantity = Math.round((area / 100) * qtyPer100Area);
    }

    const unitPrice = Math.round(baseUnitPrice * equipmentMultiplier);
    const subtotal = quantity * unitPrice;

    return {
      id: template.id,
      equipmentName: template.equipmentName,
      specification: template.specification,
      unit: template.unit,
      quantity,
      unitPrice,
      subtotal,
      isRequired: template.isRequired,
      sortOrder: template.sortOrder,
    };
  });

  const equipmentTotal = equipmentList.reduce((sum, item) => sum + item.subtotal, 0);

  const constructionList: ConstructionItem[] = labType.constructionFactors.map((factor) => {
    const factorPerArea = Number(factor.factorPerArea);
    const baseUnitPrice = Number(factor.baseUnitPrice);
    const constructionMultiplier = Number(selectedLevel.constructionMultiplier);

    const quantity = Math.round(area * factorPerArea * 100) / 100;
    const unitPrice = Math.round(baseUnitPrice * constructionMultiplier);
    const subtotal = Math.round(quantity * unitPrice);

    return {
      id: factor.id,
      itemName: factor.itemName,
      unit: factor.unit,
      quantity,
      unitPrice,
      subtotal,
      category: factor.category,
      sortOrder: factor.sortOrder,
    };
  });

  const constructionTotal = constructionList.reduce((sum, item) => sum + item.subtotal, 0);

  const categoryMap = new Map<string, number>();
  for (const item of constructionList) {
    const current = categoryMap.get(item.category) || 0;
    categoryMap.set(item.category, current + item.subtotal);
  }
  const constructionByCategory = Array.from(categoryMap.entries()).map(([category, subtotal]) => ({
    category,
    subtotal,
  }));

  const managementFeeRate = Number(selectedLevel.managementFeeRate);
  const profitRate = Number(selectedLevel.profitRate);

  const baseTotal = equipmentTotal + constructionTotal;
  const managementFee = Math.round(baseTotal * managementFeeRate);
  const profit = Math.round((baseTotal + managementFee) * profitRate);
  const grandTotal = baseTotal + managementFee + profit;

  const quoteComparison: QuoteLevelComparison[] = priceLevels.map((level) => {
    const eqMultiplier = Number(level.equipmentMultiplier);
    const consMultiplier = Number(level.constructionMultiplier);
    const mgmtRate = Number(level.managementFeeRate);
    const profRate = Number(level.profitRate);

    const eqTotal = Math.round(
      labType.equipmentTemplates.reduce((sum, template) => {
        const qtyPer100Area = Number(template.qtyPer100Area);
        const baseUnitPrice = Number(template.baseUnitPrice);
        let quantity: number;
        if (template.isRequired) {
          quantity = Math.max(1, Math.round((area / 100) * qtyPer100Area));
        } else {
          quantity = Math.round((area / 100) * qtyPer100Area);
        }
        return sum + quantity * baseUnitPrice * eqMultiplier;
      }, 0)
    );

    const consTotal = Math.round(
      labType.constructionFactors.reduce((sum, factor) => {
        const factorPerArea = Number(factor.factorPerArea);
        const baseUnitPrice = Number(factor.baseUnitPrice);
        const quantity = Math.round(area * factorPerArea * 100) / 100;
        return sum + quantity * baseUnitPrice * consMultiplier;
      }, 0)
    );

    const baseTotalLevel = eqTotal + consTotal;
    const mgmtFee = Math.round(baseTotalLevel * mgmtRate);
    const prof = Math.round((baseTotalLevel + mgmtFee) * profRate);
    const grandTotalLevel = baseTotalLevel + mgmtFee + prof;

    return {
      levelName: level.levelName,
      equipmentTotal: eqTotal,
      constructionTotal: consTotal,
      managementFee: mgmtFee,
      profit: prof,
      grandTotal: grandTotalLevel,
    };
  });

  const result: QuoteResult = {
    projectName,
    labTypeName: labType.typeName,
    labTypeParams: {
      cleanLevelDefault: labType.cleanLevelDefault,
      pressureRequirement: labType.pressureRequirement,
      tempHumidity: labType.tempHumidity,
      airChangesPerHour: labType.airChangesPerHour,
      illuminationLux: labType.illuminationLux,
      notes: labType.notes,
    },
    area,
    cleanLevel,
    budgetLevel,
    specialRequirements,
    equipmentList,
    equipmentTotal,
    constructionList,
    constructionTotal,
    constructionByCategory,
    managementFee,
    profit,
    grandTotal,
    quoteComparison,
    generatedAt: new Date().toISOString(),
  };

  return result;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
