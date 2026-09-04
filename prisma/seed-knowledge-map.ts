// 知识地图索引层种子：12大模块 → 66个子主题 → 国标清单
// 幂等：按 subTopic / moduleCode upsert，重复执行合并更新
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

interface SubTopic {
  name: string;
  regulations: string[];
}

interface Module {
  moduleName: string;
  subTopics: SubTopic[];
}

const KNOWLEDGE_MAP: Module[] = [
  {
    moduleName: '实验室分类与合规架构',
    subTopics: [
      { name: '实验室分级分类', regulations: ['GB 19489', 'GB 50346', 'WS 233', 'GB 50881', 'JGJ 91'] },
      { name: '合规架构', regulations: ['GB 19489', 'GB 50346', 'CNAS-CL01', 'GMP附录'] },
      { name: '备案与认证', regulations: ['CNAS-CL01', 'GB/T 27025', '病原微生物实验室生物安全管理条例'] },
    ],
  },
  {
    moduleName: '建筑与结构',
    subTopics: [
      { name: '结构荷载', regulations: ['GB 50009', 'GB 50011'] },
      { name: '防火分区', regulations: ['GB 50016'] },
      { name: '房间净高与改造', regulations: ['行业做法'] },
      { name: '防震', regulations: ['GB 50011'] },
    ],
  },
  {
    moduleName: '洁净技术与空调',
    subTopics: [
      { name: '洁净等级体系', regulations: ['GB 50073', 'GB 50457', 'GB 50333', 'GB/T 25915'] },
      { name: '气流组织', regulations: ['GB 50073'] },
      { name: '压差梯度', regulations: ['GB 50073', 'GB 50457'] },
      { name: '换气次数与自净时间', regulations: ['GB 50073'] },
      { name: '过滤器系统', regulations: ['GB 50073', 'GB/T 13554'] },
      { name: '冷热源', regulations: ['GB 50736'] },
      { name: '焓湿与送风状态', regulations: ['GB 50019', 'GB 50736'] },
      { name: '风管水力', regulations: ['GB 50243'] },
      { name: '排风与补风平衡', regulations: ['GB 19489', 'GB 50073'] },
      { name: '节能', regulations: ['GB 50189'] },
    ],
  },
  {
    moduleName: '电气',
    subTopics: [
      { name: '供配电', regulations: ['GB 50052', 'GB 50054', 'GB 51348'] },
      { name: 'UPS', regulations: ['GB 50174'] },
      { name: '电缆与桥架', regulations: ['GB 50054', 'GB 50217'] },
      { name: '照明', regulations: ['GB 50034', 'GB 51309'] },
      { name: '防雷接地', regulations: ['GB 50057'] },
      { name: '消防电气', regulations: ['GB 50116'] },
    ],
  },
  {
    moduleName: '给排水',
    subTopics: [
      { name: '给水', regulations: ['GB 50015'] },
      { name: '排水分类', regulations: ['GB 50015', 'GB 50014'] },
      { name: '废水处理', regulations: ['GB 8978', 'GB 18466'] },
      { name: '消防水', regulations: ['GB 50974', 'GB 50016'] },
    ],
  },
  {
    moduleName: '消防',
    subTopics: [
      { name: '防火分区与疏散', regulations: ['GB 50016'] },
      { name: '防排烟', regulations: ['GB 51251'] },
      { name: '灭火器', regulations: ['GB 50140'] },
      { name: '消火栓与喷淋', regulations: ['GB 50974', 'GB 50084'] },
      { name: '火灾自动报警', regulations: ['GB 50116'] },
    ],
  },
  {
    moduleName: '智能化与自控',
    subTopics: [
      { name: '自控点位表', regulations: ['GB 50314', 'GB 50339'] },
      { name: '压差/温湿度监控', regulations: ['GB 50073'] },
      { name: '送排风联锁', regulations: ['GB 19489'] },
      { name: '门禁与互锁', regulations: ['GB 50348'] },
      { name: '能耗管理', regulations: ['GB 50189'] },
      { name: 'BIM', regulations: ['GB/T 51212'] },
      { name: '环境监控', regulations: ['GB 50073'] },
    ],
  },
  {
    moduleName: '集中供气',
    subTopics: [
      { name: '气瓶间/气站', regulations: ['GB 50029', 'GB 50030', 'GB 50031'] },
      { name: '管路', regulations: ['GB 50316', 'GB 50184'] },
      { name: '高纯气体', regulations: ['行业做法'] },
      { name: '泄漏检测', regulations: ['GB 50493'] },
    ],
  },
  {
    moduleName: '装饰装修',
    subTopics: [
      { name: '墙体/吊顶', regulations: ['GB 50073', 'GB 50591'] },
      { name: '地面', regulations: ['GB 50591'] },
      { name: '门窗/传递窗', regulations: ['GB 50591', 'GB/T 7106'] },
      { name: '材料性能', regulations: ['GB 8624'] },
      { name: '施工验收', regulations: ['GB 50591', 'GB 50300'] },
    ],
  },
  {
    moduleName: '平面工艺',
    subTopics: [
      { name: '人流物流', regulations: ['JGJ 91', 'GB 50346'] },
      { name: '分区逻辑', regulations: ['GB 50346', 'GB 19489'] },
      { name: '缓冲间/气闸', regulations: ['GB 19489'] },
      { name: '设备布置', regulations: ['行业做法'] },
      { name: '空间协调', regulations: ['行业做法'] },
    ],
  },
  {
    moduleName: '废气与废水',
    subTopics: [
      { name: '废气类型识别', regulations: ['GB 16297', 'GB 14554'] },
      { name: '处理工艺链', regulations: ['HJ 2026', 'HJ 2000'] },
      { name: '废气处理设备选型', regulations: ['行业做法'] },
      { name: '风机系统', regulations: ['GB 50019'] },
      { name: '排放达标', regulations: ['GB 16297', 'GB 37822'] },
      { name: '排放监测', regulations: ['HJ 819'] },
      { name: '废水分路', regulations: ['GB 50015'] },
      { name: '废水处理工艺链', regulations: ['GB 8978', 'GB 18466'] },
      { name: '废水达标核算', regulations: ['GB/T 31962'] },
    ],
  },
  {
    moduleName: '仪器设备与采购',
    subTopics: [
      { name: '设备选型', regulations: ['GB 19489', '行业做法'] },
      { name: '招标技术参数', regulations: ['行业做法'] },
      { name: '安装条件', regulations: ['行业做法'] },
      { name: '验证', regulations: ['GMP', '行业做法'] },
    ],
  },
];

async function main() {
  let moduleCount = 0;
  let subTopicCount = 0;

  for (const mod of KNOWLEDGE_MAP) {
    const moduleCode = `M-${mod.moduleName}`;
    for (const st of mod.subTopics) {
      await prisma.knowledgeModule.upsert({
        where: { subTopic: st.name },
        update: {
          moduleCode,
          moduleName: mod.moduleName,
          regulations: JSON.stringify(st.regulations),
        },
        create: {
          moduleCode,
          moduleName: mod.moduleName,
          subTopic: st.name,
          regulations: JSON.stringify(st.regulations),
        },
      });
      subTopicCount++;
    }
    moduleCount++;
  }

  console.log(`知识地图灌入完成：${moduleCount} 个模块，${subTopicCount} 个子主题`);
}

main()
  .catch((e) => {
    console.error('知识地图灌入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
