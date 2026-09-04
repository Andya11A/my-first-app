// 标准版本台账种子：62 条实验室建设相关标准
// status: current=现行有效 / unknown=需人工去官方平台核实 / superseded=已被替代
// 幂等：按 standardNo upsert，重复执行合并更新
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

interface StandardItem {
  standardNo: string;
  name: string;
  currentVersion: string;
  status: 'current' | 'unknown' | 'superseded';
  note?: string;
}

const STANDARDS: StandardItem[] = [
  { standardNo: 'JGJ 91', name: '科研建筑设计标准', currentVersion: '2019', status: 'unknown' },
  { standardNo: 'GB 50881', name: '疾病预防控制中心建筑技术规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 19489', name: '实验室生物安全通用要求', currentVersion: '2008', status: 'unknown' },
  { standardNo: 'GB 50346', name: '生物安全实验室建筑技术规范', currentVersion: '2011', status: 'unknown' },
  { standardNo: 'WS 233', name: '病原微生物实验室生物安全通用准则', currentVersion: '2017', status: 'unknown' },
  { standardNo: 'GB 14925', name: '实验动物环境及设施', currentVersion: '2010', status: 'unknown' },
  { standardNo: 'GB 50447', name: '实验动物设施建筑技术规范', currentVersion: '2008', status: 'unknown' },
  { standardNo: 'GB 50073', name: '洁净厂房设计规范', currentVersion: '2013', status: 'current' },
  { standardNo: 'GB 50457', name: '医药工业洁净厂房设计标准', currentVersion: '2019', status: 'current' },
  { standardNo: 'GB 50591', name: '洁净室施工及验收规范', currentVersion: '2010', status: 'current' },
  { standardNo: 'GB 50333', name: '医院洁净手术部建筑技术规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB/T 51466', name: '医药工业洁净厂房施工与验收标准', currentVersion: '2025', status: 'current' },
  { standardNo: 'GB/T 13554', name: '高效空气过滤器', currentVersion: '2020', status: 'unknown' },
  { standardNo: 'GB/T 25915', name: '洁净室及相关受控环境', currentVersion: '系列', status: 'unknown', note: '系列标准，各部分版本需分别核实' },
  { standardNo: 'GB 50016', name: '建筑设计防火规范', currentVersion: '2014(2018版)', status: 'unknown' },
  { standardNo: 'GB 50009', name: '建筑结构荷载规范', currentVersion: '2012', status: 'unknown' },
  { standardNo: 'GB 50011', name: '建筑抗震设计规范', currentVersion: '2010(2016版)', status: 'unknown' },
  { standardNo: 'GB 50736', name: '民用建筑供暖通风与空气调节设计规范', currentVersion: '2012', status: 'unknown' },
  { standardNo: 'GB 50019', name: '工业建筑供暖通风与空气调节设计规范', currentVersion: '2015', status: 'unknown' },
  { standardNo: 'GB 50243', name: '通风与空调工程施工质量验收规范', currentVersion: '2016', status: 'unknown' },
  { standardNo: 'GB 50189', name: '公共建筑节能设计标准', currentVersion: '2015', status: 'unknown' },
  { standardNo: 'GB 50052', name: '供配电系统设计规范', currentVersion: '2009', status: 'unknown' },
  { standardNo: 'GB 50054', name: '低压配电设计规范', currentVersion: '2011', status: 'unknown' },
  { standardNo: 'GB 51348', name: '民用建筑电气设计标准', currentVersion: '2019', status: 'current' },
  { standardNo: 'GB 50057', name: '建筑物防雷设计规范', currentVersion: '2010', status: 'unknown' },
  { standardNo: 'GB 50034', name: '建筑照明设计标准', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 51309', name: '消防应急照明和疏散指示系统技术标准', currentVersion: '2018', status: 'current' },
  { standardNo: 'GB 50303', name: '建筑电气工程施工质量验收规范', currentVersion: '2015', status: 'unknown' },
  { standardNo: 'GB 50174', name: '数据中心设计规范', currentVersion: '2017', status: 'current' },
  { standardNo: 'GB 50217', name: '电力工程电缆设计标准', currentVersion: '2018', status: 'current' },
  { standardNo: 'GB 50116', name: '火灾自动报警系统设计规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 50140', name: '建筑灭火器配置设计规范', currentVersion: '2005', status: 'current' },
  { standardNo: 'GB 50974', name: '消防给水及消火栓系统技术规范', currentVersion: '2014', status: 'current' },
  { standardNo: 'GB 51251', name: '建筑防烟排烟系统技术标准', currentVersion: '2017', status: 'current' },
  { standardNo: 'GB 50084', name: '自动喷水灭火系统设计规范', currentVersion: '2017', status: 'current' },
  { standardNo: 'GB 50015', name: '建筑给水排水设计标准', currentVersion: '2019', status: 'current' },
  { standardNo: 'GB 50014', name: '室外排水设计标准', currentVersion: '2021', status: 'current' },
  { standardNo: 'GB 50242', name: '建筑给水排水及采暖工程施工质量验收规范', currentVersion: '2002', status: 'unknown' },
  { standardNo: 'GB 50029', name: '压缩空气站设计规范', currentVersion: '2014', status: 'unknown' },
  { standardNo: 'GB 50030', name: '氧气站设计规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 50031', name: '乙炔站设计规范', currentVersion: '2014', status: 'unknown' },
  { standardNo: 'GB 50316', name: '工业金属管道设计规范', currentVersion: '2000(2008版)', status: 'unknown' },
  { standardNo: 'GB 50184', name: '工业金属管道工程施工质量验收规范', currentVersion: '2011', status: 'unknown' },
  { standardNo: 'GB 50493', name: '石油化工可燃气体和有毒气体检测报警设计标准', currentVersion: '2019', status: 'current' },
  { standardNo: 'GB 16297', name: '大气污染物综合排放标准', currentVersion: '1996', status: 'unknown' },
  { standardNo: 'GB 37822', name: '挥发性有机物无组织排放控制标准', currentVersion: '2019', status: 'current' },
  { standardNo: 'GB 14554', name: '恶臭污染物排放标准', currentVersion: '1993', status: 'unknown' },
  { standardNo: 'HJ 2026', name: '吸附法工业有机废气治理工程技术规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'HJ 2000', name: '大气污染治理工程技术导则', currentVersion: '2010', status: 'unknown' },
  { standardNo: 'HJ 819', name: '排污单位自行监测技术指南 总则', currentVersion: '2017', status: 'unknown' },
  { standardNo: 'GB 8978', name: '污水综合排放标准', currentVersion: '1996', status: 'unknown' },
  { standardNo: 'GB 18466', name: '医疗机构水污染物排放标准', currentVersion: '2005', status: 'unknown' },
  { standardNo: 'GB/T 31962', name: '污水排入城镇下水道水质标准', currentVersion: '2015', status: 'current' },
  { standardNo: 'GB 50314', name: '智能建筑设计标准', currentVersion: '2015', status: 'unknown' },
  { standardNo: 'GB 50339', name: '智能建筑工程质量验收规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 50348', name: '安全防范工程技术标准', currentVersion: '2018', status: 'current' },
  { standardNo: 'GB 50395', name: '视频安防监控系统工程设计规范', currentVersion: '2007', status: 'unknown' },
  { standardNo: 'GB/T 51212', name: '建筑信息模型应用统一标准', currentVersion: '2016', status: 'current' },
  { standardNo: 'GB 50087', name: '工业企业噪声控制设计规范', currentVersion: '2013', status: 'unknown' },
  { standardNo: 'GB 8624', name: '建筑材料及制品燃烧性能分级', currentVersion: '2012', status: 'unknown' },
  { standardNo: 'GB/T 7106', name: '建筑外门窗气密水密抗风压性能检测方法', currentVersion: '2008', status: 'unknown' },
  { standardNo: 'GB 50300', name: '建筑工程施工质量验收统一标准', currentVersion: '2013', status: 'current' },
];

async function main() {
  for (const s of STANDARDS) {
    await prisma.standardVersion.upsert({
      where: { standardNo: s.standardNo },
      update: {
        name: s.name,
        currentVersion: s.currentVersion,
        status: s.status,
        note: s.note ?? null,
      },
      create: {
        standardNo: s.standardNo,
        name: s.name,
        currentVersion: s.currentVersion,
        status: s.status,
        note: s.note ?? null,
      },
    });
  }

  const byStatus = {
    current: STANDARDS.filter((s) => s.status === 'current').length,
    unknown: STANDARDS.filter((s) => s.status === 'unknown').length,
    superseded: STANDARDS.filter((s) => s.status === 'superseded').length,
  };
  console.log(
    `标准版本灌入完成：共 ${STANDARDS.length} 条（current=${byStatus.current}, unknown=${byStatus.unknown}, superseded=${byStatus.superseded}）`
  );
}

main()
  .catch((e) => {
    console.error('标准版本灌入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
