export interface ProcessRule {
  id: string;
  name: string;
  description: string;
  labTypes: string[];      // 适用实验室类型
  category: 'partition' | 'equipment' | 'flow' | 'buffer' | 'safety';
  checkType: 'count' | 'distance' | 'presence';
  target: string;          // 检查目标（如"缓冲间"、"生物安全柜"）
  requirement: string;     // 要求描述
  threshold?: number;      // 阈值（距离类）
  violation: string;       // 违规提示
  suggestion: string;      // 建议措施
  regulation?: string;     // 规范依据
}

export const PROCESS_RULES: ProcessRule[] = [
  // ========== PCR实验室 ==========
  {
    id: 'PCR-001',
    name: '四区完整性',
    description: 'PCR实验室必须有试剂准备、标本制备、扩增、产物分析四个独立区域',
    labTypes: ['PCR实验室'],
    category: 'partition',
    checkType: 'count',
    target: '独立功能区',
    requirement: '≥4个独立区域',
    threshold: 4,
    violation: '功能区划分不完整',
    suggestion: '增设缺失的功能区，确保四区物理隔断',
    regulation: 'GB/T 19495.1-2004',
  },
  {
    id: 'PCR-002',
    name: '缓冲间设置',
    description: '各功能区之间应设置缓冲间',
    labTypes: ['PCR实验室'],
    category: 'buffer',
    checkType: 'presence',
    target: '缓冲间',
    requirement: '各区之间设置缓冲间',
    violation: '缺少缓冲间',
    suggestion: '在功能区间增设缓冲间（≥3㎡）',
    regulation: '《医疗机构临床基因扩增检验实验室管理办法》',
  },
  // ========== BSL-2实验室 ==========
  {
    id: 'BSL2-001',
    name: '生物安全柜配备',
    description: 'BSL-2实验室必须配备生物安全柜',
    labTypes: ['生物安全P2实验室', '微生物实验室'],
    category: 'equipment',
    checkType: 'presence',
    target: '生物安全柜',
    requirement: '至少1台II级生物安全柜',
    violation: '未检测到生物安全柜',
    suggestion: '配备II级A2型生物安全柜',
    regulation: 'GB 19489-2008',
  },
  {
    id: 'BSL2-002',
    name: '灭菌器配备',
    description: 'BSL-2实验室应配备高压灭菌器',
    labTypes: ['生物安全P2实验室'],
    category: 'equipment',
    checkType: 'presence',
    target: '灭菌器',
    requirement: '至少1台高压蒸汽灭菌器',
    violation: '未检测到灭菌器',
    suggestion: '配备高压蒸汽灭菌器，用于废弃物处理',
    regulation: 'GB 19489-2008',
  },
  {
    id: 'BSL2-003',
    name: '负压要求',
    description: 'BSL-2实验室应保持负压',
    labTypes: ['生物安全P2实验室'],
    category: 'safety',
    checkType: 'presence',
    target: '负压设计',
    requirement: '核心区相对相邻区域负压',
    violation: '未标注负压设计',
    suggestion: '设计排风量大于送风量，维持-5Pa~-10Pa负压',
    regulation: 'GB 19489-2008',
  },
  // ========== 动物实验室 ==========
  {
    id: 'ANIMAL-001',
    name: '双走廊设计',
    description: 'SPF级动物实验室应采用双走廊（清洁/污物分开）',
    labTypes: ['动物实验室SPF级'],
    category: 'flow',
    checkType: 'presence',
    target: '双走廊',
    requirement: '清洁走廊与污物走廊分开',
    violation: '未设置双走廊',
    suggestion: '设置清洁走廊和污物走廊，物流单向',
    regulation: 'GB 50447-2008',
  },
  {
    id: 'ANIMAL-002',
    name: '洗消间设置',
    description: '动物实验室应设置洗消间',
    labTypes: ['动物实验室SPF级', '动物实验室普通级'],
    category: 'buffer',
    checkType: 'presence',
    target: '洗消间',
    requirement: '独立洗消间',
    violation: '缺少洗消间',
    suggestion: '设置独立洗消间，配消毒设备',
    regulation: 'GB 50447-2008',
  },
  // ========== 通用洁净室 ==========
  {
    id: 'CLEAN-001',
    name: '设备离墙距离',
    description: '设备应离墙至少150mm',
    labTypes: ['*'],  // 所有洁净类
    category: 'equipment',
    checkType: 'distance',
    target: '设备离墙距离',
    requirement: '≥150mm',
    threshold: 150,
    violation: '设备离墙过近',
    suggestion: '调整设备位置，离墙≥150mm',
    regulation: 'GB 50073-2013',
  },
  {
    id: 'CLEAN-002',
    name: '设备间距',
    description: '设备之间应保持≥300mm间距',
    labTypes: ['*'],
    category: 'equipment',
    checkType: 'distance',
    target: '设备间距',
    requirement: '≥300mm',
    threshold: 300,
    violation: '设备间距过近',
    suggestion: '调整设备布局，间距≥300mm',
    regulation: 'GB 50073-2013',
  },
  // ========== 恒温恒湿 ==========
  {
    id: 'HTH-001',
    name: '缓冲间要求',
    description: '恒温恒湿实验室入口应设缓冲间',
    labTypes: ['恒温恒湿实验室'],
    category: 'buffer',
    checkType: 'presence',
    target: '缓冲间',
    requirement: '入口缓冲间',
    violation: '缺少入口缓冲间',
    suggestion: '在入口设置缓冲间，减少温湿度波动',
    regulation: 'GB/T 28849-2012',
  },
  // ========== 细胞培养室 ==========
  {
    id: 'CELL-001',
    name: 'CO2培养箱配备',
    description: '细胞培养室必须配备CO2培养箱',
    labTypes: ['细胞培养室'],
    category: 'equipment',
    checkType: 'presence',
    target: 'CO2培养箱',
    requirement: '至少1台CO2培养箱',
    violation: '未检测到CO2培养箱',
    suggestion: '配备CO2培养箱（5% CO2，37℃）',
    regulation: 'GB/T 38736-2020',
  },
  {
    id: 'CELL-002',
    name: '正压要求',
    description: '细胞培养室核心区应保持正压',
    labTypes: ['细胞培养室'],
    category: 'safety',
    checkType: 'presence',
    target: '正压设计',
    requirement: '核心区正压≥10Pa',
    violation: '未标注正压设计',
    suggestion: '设计送风量大于排风量，维持正压',
    regulation: 'GB 50073-2013',
  },
  // ========== 理化实验室 ==========
  {
    id: 'CHEM-001',
    name: '通风柜配备',
    description: '理化实验室应配备通风柜',
    labTypes: ['理化实验室', '化学合成实验室'],
    category: 'equipment',
    checkType: 'presence',
    target: '通风柜',
    requirement: '至少1台通风柜',
    violation: '未检测到通风柜',
    suggestion: '配备通风柜，面风速0.4-0.6m/s',
    regulation: 'JGJ 91-2019',
  },
  {
    id: 'CHEM-002',
    name: '紧急冲淋',
    description: '使用危险化学品的实验室应设紧急冲淋装置',
    labTypes: ['化学合成实验室', '危化品检测实验室'],
    category: 'safety',
    checkType: 'presence',
    target: '紧急冲淋',
    requirement: '紧急冲淋+洗眼器',
    violation: '缺少紧急冲淋装置',
    suggestion: '在15m范围内设置紧急冲淋和洗眼器',
    regulation: 'GB/T 38144-2019',
  },
  // ========== 医院检验科 ==========
  {
    id: 'LAB-001',
    name: '采血窗口',
    description: '医院检验科应设独立采血区',
    labTypes: ['医院检验科'],
    category: 'flow',
    checkType: 'presence',
    target: '采血区',
    requirement: '独立采血区',
    violation: '缺少采血区',
    suggestion: '设置独立采血区，靠近候检区',
    regulation: 'WS/T 404-2012',
  },
  // ========== 洁净厂房 ==========
  {
    id: 'CLEAN-003',
    name: '换鞋更衣',
    description: '洁净室入口应设换鞋、更衣、缓冲三连间',
    labTypes: ['半导体洁净室', '恒温恒湿实验室'],
    category: 'buffer',
    checkType: 'presence',
    target: '更衣',
    requirement: '换鞋间+更衣间+缓冲间',
    violation: '缺少人员净化设施',
    suggestion: '入口设置换鞋间→更衣间→缓冲间',
    regulation: 'GB 50073-2013',
  },
];

// 检查结果类型
export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  violation?: string;
  suggestion?: string;
  regulation?: string;
}

// 执行检查
export function checkDesign(
  labType: string,
  designData: {
    devices: { name: string; x: number; y: number; width: number; height: number }[];
    walls: { x1: number; y1: number; x2: number; y2: number }[];
    rooms?: { name: string }[];
  }
): RuleCheckResult[] {
  const results: RuleCheckResult[] = [];
  const applicableRules = PROCESS_RULES.filter(
    (rule) => rule.labTypes.includes(labType) || rule.labTypes.includes('*')
  );

  for (const rule of applicableRules) {
    let passed = true;
    let violation = '';
    let suggestion = '';

    if (rule.checkType === 'presence') {
      const found = designData.devices.some((d) =>
        d.name.toLowerCase().includes(rule.target.toLowerCase())
      ) || designData.rooms?.some((r) =>
        r.name.toLowerCase().includes(rule.target.toLowerCase())
      );
      passed = !!found;
      if (!passed) {
        violation = rule.violation;
        suggestion = rule.suggestion;
      }
    } else if (rule.checkType === 'count' && rule.threshold) {
      const count = designData.rooms?.length || 0;
      passed = count >= rule.threshold;
      if (!passed) {
        violation = `${rule.violation}（当前${count}个，要求${rule.threshold}个）`;
        suggestion = rule.suggestion;
      }
    } else if (rule.checkType === 'distance' && rule.threshold) {
      if (rule.target === '设备离墙距离') {
        // 计算设备到墙线的最短距离
        for (const device of designData.devices) {
          let minDist = Infinity;
          const deviceCorners = [
            { x: device.x, y: device.y },
            { x: device.x + device.width, y: device.y },
            { x: device.x, y: device.y + device.height },
            { x: device.x + device.width, y: device.y + device.height },
          ];
          for (const wall of designData.walls) {
            for (const corner of deviceCorners) {
              const dist = pointToSegmentDistance(corner, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
              minDist = Math.min(minDist, dist);
            }
          }
          if (minDist < rule.threshold) {
            passed = false;
            violation = `${rule.violation}：${device.name} 离墙 ${Math.round(minDist)}mm`;
            suggestion = rule.suggestion;
            break;
          }
        }
      } else {
        // 设备间距检查（原有逻辑）
        for (let i = 0; i < designData.devices.length; i++) {
          const d1 = designData.devices[i];
          for (let j = i + 1; j < designData.devices.length; j++) {
            const d2 = designData.devices[j];
            const gapX = Math.abs(d1.x - d2.x);
            const gapY = Math.abs(d1.y - d2.y);
            const gap = Math.min(gapX, gapY);
            if (gap < rule.threshold) {
              passed = false;
              violation = `${rule.violation}：${d1.name} 与 ${d2.name} 间距 ${Math.round(gap)}mm`;
              suggestion = rule.suggestion;
              break;
            }
          }
          if (!passed) break;
        }
      }
    }

    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      violation: passed ? undefined : violation,
      suggestion: passed ? undefined : suggestion,
      regulation: rule.regulation,
    });
  }

  return results;
}

// 计算点到线段的最短距离
function pointToSegmentDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
}
