import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// Prisma 7 需要 driver adapter 连接 SQLite（dev.db 位于项目根目录）
const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 创建PCR实验室
  const pcrLab = await prisma.labType.create({
    data: {
      typeName: 'PCR实验室',
      cleanLevelDefault: '十万级',
      pressureRequirement: '试剂准备区正压+10Pa，标本制备区负压-10Pa，扩增区负压-15Pa',
      tempHumidity: '18-26℃，45-65%RH',
      airChangesPerHour: 15,
      illuminationLux: 300,
      notes: 'PCR实验室需严格分区：试剂准备区→标本制备区→扩增区→产物分析区，单向流设计，各区之间设置传递窗。',
    },
  });

  // 创建理化实验室
  const chemLab = await prisma.labType.create({
    data: {
      typeName: '理化实验室',
      cleanLevelDefault: '普通',
      pressureRequirement: '通风橱区域负压-5Pa，仪器室微正压',
      tempHumidity: '20-26℃，40-60%RH',
      airChangesPerHour: 8,
      illuminationLux: 300,
      notes: '理化实验室需重点考虑通风系统，配置万向排气罩、通风橱，根据实验内容考虑耐腐蚀台面。',
    },
  });

  // 创建微生物实验室
  const microLab = await prisma.labType.create({
    data: {
      typeName: '微生物实验室',
      cleanLevelDefault: '万级',
      pressureRequirement: '无菌室正压+15Pa，阳性对照室负压-15Pa',
      tempHumidity: '18-26℃，45-65%RH',
      airChangesPerHour: 20,
      illuminationLux: 300,
      notes: '微生物实验室需设置无菌室和阳性对照室，配备生物安全柜，人流物流分开，设置缓冲间。',
    },
  });

  // 创建通用实验室
  const generalLab = await prisma.labType.create({
    data: {
      typeName: '通用实验室',
      cleanLevelDefault: '普通',
      pressureRequirement: '无特殊压差要求',
      tempHumidity: '18-28℃，自然湿度',
      airChangesPerHour: 6,
      illuminationLux: 300,
      notes: '通用实验室按标准实验台配置，考虑基本通风和水电需求即可。',
    },
  });

  // PCR实验室设备
  const pcrEquipment = [
    { equipmentName: '超净工作台', specification: '双人单面，水平流', unit: '台', qtyPer100Area: 1.5, baseUnitPrice: 12000, isRequired: true, sortOrder: 1 },
    { equipmentName: '生物安全柜', specification: 'BSC-II A2型，双人操作', unit: '台', qtyPer100Area: 1, baseUnitPrice: 45000, isRequired: true, sortOrder: 2 },
    { equipmentName: '实时荧光定量PCR仪', specification: '96孔，4通道', unit: '台', qtyPer100Area: 1, baseUnitPrice: 280000, isRequired: true, sortOrder: 3 },
    { equipmentName: '高速冷冻离心机', specification: '15000rpm，24×1.5ml', unit: '台', qtyPer100Area: 1, baseUnitPrice: 35000, isRequired: true, sortOrder: 4 },
    { equipmentName: '超低温冰箱', specification: '-86℃，728L', unit: '台', qtyPer100Area: 1, baseUnitPrice: 55000, isRequired: true, sortOrder: 5 },
    { equipmentName: '高压蒸汽灭菌器', specification: '100L，全自动', unit: '台', qtyPer100Area: 1, baseUnitPrice: 28000, isRequired: true, sortOrder: 6 },
    { equipmentName: '传递窗', specification: '600×600×600，紫外杀菌', unit: '个', qtyPer100Area: 3, baseUnitPrice: 3500, isRequired: true, sortOrder: 7 },
    { equipmentName: '纯水机', specification: '20L/h，超纯水', unit: '台', qtyPer100Area: 1, baseUnitPrice: 18000, isRequired: true, sortOrder: 8 },
    { equipmentName: '移液器套装', specification: '0.5-1000μL，8支装', unit: '套', qtyPer100Area: 3, baseUnitPrice: 4500, isRequired: false, sortOrder: 9 },
    { equipmentName: '涡旋混合器', specification: '3000rpm', unit: '台', qtyPer100Area: 2, baseUnitPrice: 1500, isRequired: false, sortOrder: 10 },
  ];

  for (const eq of pcrEquipment) {
    await prisma.equipmentTemplate.create({ data: { ...eq, labTypeId: pcrLab.id } });
  }

  // 理化实验室设备
  const chemEquipment = [
    { equipmentName: '实验台（中央台）', specification: '3000×1500×850，理化板台面', unit: '组', qtyPer100Area: 4, baseUnitPrice: 8500, isRequired: true, sortOrder: 1 },
    { equipmentName: '通风橱', specification: '1500×850×2350，全钢', unit: '台', qtyPer100Area: 2, baseUnitPrice: 15000, isRequired: true, sortOrder: 2 },
    { equipmentName: '万向排气罩', specification: 'PP材质，可旋转', unit: '个', qtyPer100Area: 4, baseUnitPrice: 1200, isRequired: true, sortOrder: 3 },
    { equipmentName: '试剂柜', specification: '900×450×1800，PP耐腐蚀', unit: '个', qtyPer100Area: 3, baseUnitPrice: 3200, isRequired: true, sortOrder: 4 },
    { equipmentName: '分析天平', specification: '0.1mg，220g', unit: '台', qtyPer100Area: 1, baseUnitPrice: 8500, isRequired: true, sortOrder: 5 },
    { equipmentName: 'pH计', specification: '台式，±0.01pH', unit: '台', qtyPer100Area: 1, baseUnitPrice: 3200, isRequired: false, sortOrder: 6 },
    { equipmentName: '磁力搅拌器', specification: '加热型，280℃', unit: '台', qtyPer100Area: 2, baseUnitPrice: 1800, isRequired: false, sortOrder: 7 },
    { equipmentName: '超声波清洗器', specification: '10L，40kHz', unit: '台', qtyPer100Area: 1, baseUnitPrice: 2800, isRequired: false, sortOrder: 8 },
    { equipmentName: '纯水机', specification: '20L/h，超纯水', unit: '台', qtyPer100Area: 1, baseUnitPrice: 18000, isRequired: true, sortOrder: 9 },
    { equipmentName: '气瓶柜', specification: '双瓶位，带报警', unit: '个', qtyPer100Area: 1, baseUnitPrice: 3500, isRequired: false, sortOrder: 10 },
  ];

  for (const eq of chemEquipment) {
    await prisma.equipmentTemplate.create({ data: { ...eq, labTypeId: chemLab.id } });
  }

  // 微生物实验室设备
  const microEquipment = [
    { equipmentName: '生物安全柜', specification: 'BSC-II A2型，双人操作', unit: '台', qtyPer100Area: 2, baseUnitPrice: 45000, isRequired: true, sortOrder: 1 },
    { equipmentName: '超净工作台', specification: '双人单面，垂直流', unit: '台', qtyPer100Area: 1.5, baseUnitPrice: 12000, isRequired: true, sortOrder: 2 },
    { equipmentName: '高压蒸汽灭菌器', specification: '150L，全自动', unit: '台', qtyPer100Area: 1, baseUnitPrice: 32000, isRequired: true, sortOrder: 3 },
    { equipmentName: '恒温培养箱', specification: '室温+5~80℃，250L', unit: '台', qtyPer100Area: 2, baseUnitPrice: 6800, isRequired: true, sortOrder: 4 },
    { equipmentName: '霉菌培养箱', specification: '5~60℃，250L', unit: '台', qtyPer100Area: 1, baseUnitPrice: 9500, isRequired: false, sortOrder: 5 },
    { equipmentName: '菌落计数器', specification: '半自动，LED光源', unit: '台', qtyPer100Area: 1, baseUnitPrice: 1800, isRequired: true, sortOrder: 6 },
    { equipmentName: '显微镜', specification: '三目，1000倍', unit: '台', qtyPer100Area: 1, baseUnitPrice: 15000, isRequired: true, sortOrder: 7 },
    { equipmentName: '传递窗', specification: '600×600×600，紫外杀菌', unit: '个', qtyPer100Area: 3, baseUnitPrice: 3500, isRequired: true, sortOrder: 8 },
    { equipmentName: '超低温冰箱', specification: '-86℃，728L', unit: '台', qtyPer100Area: 1, baseUnitPrice: 55000, isRequired: false, sortOrder: 9 },
    { equipmentName: '纯水机', specification: '20L/h，超纯水', unit: '台', qtyPer100Area: 1, baseUnitPrice: 18000, isRequired: true, sortOrder: 10 },
  ];

  for (const eq of microEquipment) {
    await prisma.equipmentTemplate.create({ data: { ...eq, labTypeId: microLab.id } });
  }

  // 通用实验室设备
  const generalEquipment = [
    { equipmentName: '实验台（中央台）', specification: '3000×1500×850，理化板台面', unit: '组', qtyPer100Area: 4, baseUnitPrice: 8500, isRequired: true, sortOrder: 1 },
    { equipmentName: '实验台（边台）', specification: '3000×750×850，理化板台面', unit: '组', qtyPer100Area: 4, baseUnitPrice: 6500, isRequired: true, sortOrder: 2 },
    { equipmentName: '试剂柜', specification: '900×450×1800，PP耐腐蚀', unit: '个', qtyPer100Area: 3, baseUnitPrice: 3200, isRequired: true, sortOrder: 3 },
    { equipmentName: '万向排气罩', specification: 'PP材质，可旋转', unit: '个', qtyPer100Area: 3, baseUnitPrice: 1200, isRequired: false, sortOrder: 4 },
    { equipmentName: '通风橱', specification: '1500×850×2350，全钢', unit: '台', qtyPer100Area: 1, baseUnitPrice: 15000, isRequired: false, sortOrder: 5 },
    { equipmentName: '器皿柜', specification: '900×450×1800', unit: '个', qtyPer100Area: 2, baseUnitPrice: 2800, isRequired: false, sortOrder: 6 },
    { equipmentName: '水槽台', specification: '1500×750×850，带滴水架', unit: '组', qtyPer100Area: 1, baseUnitPrice: 4200, isRequired: true, sortOrder: 7 },
    { equipmentName: '纯水机', specification: '20L/h，超纯水', unit: '台', qtyPer100Area: 1, baseUnitPrice: 18000, isRequired: false, sortOrder: 8 },
  ];

  for (const eq of generalEquipment) {
    await prisma.equipmentTemplate.create({ data: { ...eq, labTypeId: generalLab.id } });
  }

  // PCR实验室工程量
  const pcrConstruction = [
    { itemName: '彩钢板隔断', unit: '㎡', factorPerArea: 2.8, baseUnitPrice: 260, category: '装修', sortOrder: 1 },
    { itemName: '彩钢板吊顶', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 220, category: '装修', sortOrder: 2 },
    { itemName: 'PVC地面', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 120, category: '装修', sortOrder: 3 },
    { itemName: '净化空调机组', unit: '套', factorPerArea: 0.01, baseUnitPrice: 180000, category: '暖通', sortOrder: 4 },
    { itemName: '高效送风口', unit: '个', factorPerArea: 0.08, baseUnitPrice: 1800, category: '暖通', sortOrder: 5 },
    { itemName: '排风系统', unit: '套', factorPerArea: 0.01, baseUnitPrice: 45000, category: '暖通', sortOrder: 6 },
    { itemName: '配电系统（含UPS）', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 180, category: '电气', sortOrder: 7 },
    { itemName: '照明系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 80, category: '电气', sortOrder: 8 },
    { itemName: '给排水点位', unit: '点', factorPerArea: 0.06, baseUnitPrice: 2500, category: '给排水', sortOrder: 9 },
    { itemName: '传递窗安装', unit: '个', factorPerArea: 0.03, baseUnitPrice: 3500, category: '装修', sortOrder: 10 },
  ];

  for (const cf of pcrConstruction) {
    await prisma.constructionFactor.create({ data: { ...cf, labTypeId: pcrLab.id } });
  }

  // 理化实验室工程量
  const chemConstruction = [
    { itemName: '轻钢龙骨隔断', unit: '㎡', factorPerArea: 1.8, baseUnitPrice: 180, category: '装修', sortOrder: 1 },
    { itemName: '矿棉板吊顶', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 85, category: '装修', sortOrder: 2 },
    { itemName: '环氧树脂地面', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 150, category: '装修', sortOrder: 3 },
    { itemName: '通风系统（含风机）', unit: '套', factorPerArea: 0.01, baseUnitPrice: 65000, category: '暖通', sortOrder: 4 },
    { itemName: '空调系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 220, category: '暖通', sortOrder: 5 },
    { itemName: '配电系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 120, category: '电气', sortOrder: 6 },
    { itemName: '照明系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 70, category: '电气', sortOrder: 7 },
    { itemName: '给排水点位', unit: '点', factorPerArea: 0.08, baseUnitPrice: 2500, category: '给排水', sortOrder: 8 },
  ];

  for (const cf of chemConstruction) {
    await prisma.constructionFactor.create({ data: { ...cf, labTypeId: chemLab.id } });
  }

  // 微生物实验室工程量
  const microConstruction = [
    { itemName: '彩钢板隔断', unit: '㎡', factorPerArea: 2.5, baseUnitPrice: 260, category: '装修', sortOrder: 1 },
    { itemName: '彩钢板吊顶', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 220, category: '装修', sortOrder: 2 },
    { itemName: 'PVC地面', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 120, category: '装修', sortOrder: 3 },
    { itemName: '净化空调机组', unit: '套', factorPerArea: 0.01, baseUnitPrice: 160000, category: '暖通', sortOrder: 4 },
    { itemName: '高效送风口', unit: '个', factorPerArea: 0.07, baseUnitPrice: 1800, category: '暖通', sortOrder: 5 },
    { itemName: '排风系统', unit: '套', factorPerArea: 0.01, baseUnitPrice: 40000, category: '暖通', sortOrder: 6 },
    { itemName: '配电系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 150, category: '电气', sortOrder: 7 },
    { itemName: '照明系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 80, category: '电气', sortOrder: 8 },
    { itemName: '给排水点位', unit: '点', factorPerArea: 0.05, baseUnitPrice: 2500, category: '给排水', sortOrder: 9 },
  ];

  for (const cf of microConstruction) {
    await prisma.constructionFactor.create({ data: { ...cf, labTypeId: microLab.id } });
  }

  // 通用实验室工程量
  const generalConstruction = [
    { itemName: '轻钢龙骨隔断', unit: '㎡', factorPerArea: 1.2, baseUnitPrice: 180, category: '装修', sortOrder: 1 },
    { itemName: '矿棉板吊顶', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 85, category: '装修', sortOrder: 2 },
    { itemName: '环氧树脂地面', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 150, category: '装修', sortOrder: 3 },
    { itemName: '通风系统', unit: '套', factorPerArea: 0.01, baseUnitPrice: 35000, category: '暖通', sortOrder: 4 },
    { itemName: '空调系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 200, category: '暖通', sortOrder: 5 },
    { itemName: '配电系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 100, category: '电气', sortOrder: 6 },
    { itemName: '照明系统', unit: '㎡', factorPerArea: 1.0, baseUnitPrice: 60, category: '电气', sortOrder: 7 },
    { itemName: '给排水点位', unit: '点', factorPerArea: 0.05, baseUnitPrice: 2500, category: '给排水', sortOrder: 8 },
  ];

  for (const cf of generalConstruction) {
    await prisma.constructionFactor.create({ data: { ...cf, labTypeId: generalLab.id } });
  }

  // 报价档位
  await prisma.priceLevel.create({
    data: {
      levelName: '经济型',
      equipmentMultiplier: 0.75,
      constructionMultiplier: 0.8,
      managementFeeRate: 0.10,
      profitRate: 0.08,
      isDefault: false,
    },
  });

  await prisma.priceLevel.create({
    data: {
      levelName: '标准型',
      equipmentMultiplier: 1.0,
      constructionMultiplier: 1.0,
      managementFeeRate: 0.12,
      profitRate: 0.10,
      isDefault: true,
    },
  });

  await prisma.priceLevel.create({
    data: {
      levelName: '高端型',
      equipmentMultiplier: 1.5,
      constructionMultiplier: 1.35,
      managementFeeRate: 0.15,
      profitRate: 0.12,
      isDefault: false,
    },
  });

  console.log('种子数据创建完成');
}

main()
  .catch((e) => {
    console.error('种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
