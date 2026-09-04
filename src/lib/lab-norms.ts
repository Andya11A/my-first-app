/**
 * 实验室设计内置规范库
 *
 * 收录实验室设计常用国家/行业规范的关键条款要点，作为智能建议引擎的
 * "规范依据"数据源。条款内容为设计要点摘编（人工维护，可持续补充），
 * 引用时以规范原文为准。
 */

export interface NormClause {
  topic: string;
  text: string;
}

export interface NormDoc {
  code: string;       // 规范编号
  title: string;      // 规范名称
  profession: string; // hvac / cleanroom / gas / electrical / fire / decoration / intelligence
  keywords: string[]; // 触发关键词
  clauses: NormClause[];
}

export const NORM_DOCS: NormDoc[] = [
  {
    code: 'GB 50019-2015',
    title: '工业建筑供暖通风与空气调节设计规范',
    profession: 'hvac',
    keywords: ['通风', '排风', '换气', '补风', '通风柜', '面风速', '风管', '风速', '空调', '负荷', '暖通'],
    clauses: [
      { topic: '通风柜面风速', text: '通风柜操作面风速宜控制在 0.4~0.6 m/s；排风系统应保证通风柜视窗开启时有害物不外逸。' },
      { topic: '换气次数', text: '化学实验室换气次数不宜低于 6 次/h，一般取 8~12 次/h；事故通风换气次数不应低于 12 次/h。' },
      { topic: '补风', text: '设置局部排风的房间宜设机械补风，补风量宜为排风量的 80%~90%，房间保持 5~10Pa 负压。' },
      { topic: '排风处理', text: '含腐蚀性、有害气体的排风应经净化处理（酸雾喷淋塔/活性炭吸附）达标后高空排放，排气口高于屋面 3m 以上。' },
      { topic: '风管风速', text: '风管内风速：主风管宜 6~8 m/s，支风管宜 4~6 m/s；输送含腐蚀性介质的风管应采用耐腐蚀材料。' },
    ],
  },
  {
    code: 'GB 19489-2008',
    title: '实验室 生物安全通用要求',
    profession: 'cleanroom',
    keywords: ['生物安全', 'BSL', '生物', '安全柜', '压差', '负压', '缓冲', '消毒'],
    clauses: [
      { topic: '压差梯度', text: 'BSL-2 实验室相对相邻区域应保持负压，压差宜为 -5~-10Pa，缓冲间与实验室压差应形成梯度。' },
      { topic: '换气次数', text: 'BSL-2 实验室全新风系统换气次数不宜低于 12 次/h；排风应经高效过滤（HEPA）后排放。' },
      { topic: '生物安全柜', text: 'II 级生物安全柜安装位置应避开气流干扰区（远离门、窗、送风口），排风可排入房间或经管道外排。' },
    ],
  },
  {
    code: 'GB 50346-2011',
    title: '生物安全实验室建筑技术规范',
    profession: 'cleanroom',
    keywords: ['生物安全', '洁净', '气流组织', '排风过滤', '围护', '传递窗'],
    clauses: [
      { topic: '气流组织', text: '生物安全实验室应采用上送下排的气流组织方式，送排风口布置应避免室内气流短路。' },
      { topic: '围护结构', text: '围护结构内表面应光滑、耐腐蚀、防水、无渗漏，阴阳角宜采用圆弧处理，便于清洁消毒。' },
    ],
  },
  {
    code: 'GB 50073-2013',
    title: '洁净厂房设计规范',
    profession: 'cleanroom',
    keywords: ['洁净', '洁净度', '万级', '十万级', '百级', '千级', '层流', '洁净室'],
    clauses: [
      { topic: '洁净度换气次数', text: '7 级（万级）洁净室换气次数宜取 15~25 次/h，8 级（十万级）宜取 10~15 次/h。' },
      { topic: '温湿度', text: '洁净室温度宜 18~26℃，相对湿度宜 45%~65%；工艺有特殊要求的按工艺确定。' },
      { topic: '压差', text: '不同等级洁净室之间及洁净区与非洁净区之间压差不应小于 5Pa，洁净区对室外不应小于 10Pa。' },
      { topic: '照度', text: '洁净室一般照明照度宜为 300~500lx，辅助用房不宜低于 150lx。' },
    ],
  },
  {
    code: 'JGJ 91-2019',
    title: '科研建筑设计标准',
    profession: 'hvac',
    keywords: ['科研建筑', '实验建筑', '实验台', '实验室布局', '净高', '开间'],
    clauses: [
      { topic: '实验建筑净高', text: '实验室净高不宜低于 2.7m（设吊顶及风管时宜保证 2.6m 以上），走道净宽不宜小于 1.5m。' },
      { topic: '实验台间距', text: '实验台之间通道净宽不应小于 1.2~1.5m，双面操作台间距宜 1.5~1.8m。' },
    ],
  },
  {
    code: 'GB 50316 / GB/T 20801',
    title: '工业金属管道设计规范及压力管道相关要求',
    profession: 'gas',
    keywords: ['供气', '气体管道', '气瓶', '汇流排', '减压', '管材', '不锈钢管', '氧气', '氢气', '乙炔'],
    clauses: [
      { topic: '管材选择', text: '腐蚀性、高纯气体管道应采用 316L 不锈钢管（高纯系统内表面 BA/EP 级），全程自动焊连接，减少卡套接头。' },
      { topic: '氧气管道', text: '氧气管道及阀件必须严格脱脂禁油，流速不应超过 8 m/s，禁用含油密封材料。' },
      { topic: '可燃气体', text: '可燃气体（H2、C2H2 等）管道应设可燃气体探测报警并联动紧急切断阀；乙炔必须设专用回火防止器。' },
      { topic: '气瓶间', text: '气瓶应存放于专用气瓶间（防爆、通风、防晒），用气点与气瓶间距离较长时应设二级减压；有毒气体气瓶应置于连续排风的气瓶柜。' },
    ],
  },
  {
    code: 'GB 50052 / GB 50054',
    title: '供配电系统设计规范 / 低压配电设计规范',
    profession: 'electrical',
    keywords: ['电气', '配电', '电缆', '负荷', '断路器', '供电', '备用电源', 'ups'],
    clauses: [
      { topic: '负荷等级', text: '生物安全实验室、洁净实验室的主要工艺设备供电宜按二级负荷考虑，关键设备（如生物安全柜、培养箱）宜配 UPS。' },
      { topic: '线路敷设', text: '实验室内配电线路宜采用桥架或穿管敷设，腐蚀环境区应选用防腐蚀电缆或采取防护措施。' },
      { topic: '插座配置', text: '实验台电源插座应采用防水防溅型，独立回路供电，每台实验设备宜设独立保护电器。' },
    ],
  },
  {
    code: 'GB 50016-2014（2018年版）',
    title: '建筑设计防火规范',
    profession: 'fire',
    keywords: ['防火', '疏散', '耐火', '安全出口', '泄爆', '防火分区'],
    clauses: [
      { topic: '安全疏散', text: '实验室安全出口不应少于 2 个（面积小于一定限值时可设 1 个），疏散距离应符合耐火等级要求。' },
      { topic: '防火分区', text: '实验室与疏散通道之间应采用耐火极限不低于 1.0h 的隔墙分隔；气瓶间宜靠外墙布置并采用泄爆措施。' },
    ],
  },
  {
    code: 'GB 50591-2010',
    title: '洁净室施工及验收规范',
    profession: 'decoration',
    keywords: ['装修', '验收', '吊顶', '地面', '彩钢板', '密封', '地坪', '墙面'],
    clauses: [
      { topic: '围护材料', text: '洁净室围护应采用不产尘、不积尘、耐腐蚀材料（彩钢夹芯板、电解钢板等），板缝应密封处理。' },
      { topic: '地面', text: '地面应采用整体性好、耐磨、耐腐蚀、防静电（有要求时）材料，如环氧自流平/PVC 卷材，阴阳角圆弧处理。' },
      { topic: '验收泄漏率', text: '洁净室围护结构应在验收时进行泄漏检测，送风口与吊顶接缝处应严密不漏风。' },
    ],
  },
  {
    code: 'GB 50210-2018',
    title: '建筑装饰装修工程质量验收标准',
    profession: 'decoration',
    keywords: ['装饰', '涂饰', '地面工程', '吊顶工程', '验收标准'],
    clauses: [
      { topic: '吊顶工程', text: '吊顶饰面板安装应牢固、接缝均匀；有洁净要求的吊顶应采用密封嵌缝处理。' },
    ],
  },
  {
    code: 'GB 50314-2015',
    title: '智能建筑设计标准',
    profession: 'intelligence',
    keywords: ['智能化', '监控', '门禁', '点位', '能耗监测', '传感器', '报警'],
    clauses: [
      { topic: '环境监控', text: '实验室应按工艺要求设置温湿度、压差、VOC 等环境传感器，数据宜集中接入监控平台并留有报警输出。' },
      { topic: '安防', text: '重点区域（气瓶间、危化品间、数据中心机房）应设视频监控与门禁，出入记录留存时间不宜少于 30 天。' },
    ],
  },
  {
    code: 'GB/T 37527 / WS 233',
    title: '实验室给排水及废水处理相关要求',
    profession: 'plumbing',
    keywords: ['给排水', '废水', '污水处理', '中和', '纯水'],
    clauses: [
      { topic: '废水处理', text: '实验废水应按性质分类收集，酸碱废水宜经中和处理达标后排入市政管网，含重金属/有机废水应委托有资质单位处置。' },
    ],
  },
];

export interface NormMatch {
  doc: NormDoc;
  score: number;
  clauses: NormClause[];
}

/**
 * 规范匹配：按问题文本命中关键词计分，返回 Top N 规范及其最相关条款
 */
export function matchNorms(question: string, topN = 3, clausesPerDoc = 2): NormMatch[] {
  const q = question.toLowerCase();
  const scored = NORM_DOCS.map((doc) => {
    let score = 0;
    for (const kw of doc.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length >= 3 ? 2 : 1;
    }
    if (q.includes(doc.code.toLowerCase())) score += 3;
    // 选与问题词面最相关的条款
    const clauseScored = doc.clauses
      .map((clause) => {
        let cs = 0;
        for (const kw of doc.keywords) {
          if (clause.topic.includes(kw) || clause.text.includes(kw)) cs += 1;
          if (q.includes(clause.topic.toLowerCase())) cs += 2;
        }
        return { clause, cs };
      })
      .sort((a, b) => b.cs - a.cs);
    return { doc, score, clauses: clauseScored.slice(0, clausesPerDoc).map((c) => c.clause) };
  });

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
