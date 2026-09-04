const BASE = 'http://localhost:3000';

const nodes = [
  // ========== 智能化系统（8个） ==========
  {nodeCode:'KN-智能化-001', industry:'通用洁净室', facilityType:'全形态', environment:'点位编号+量程精度+安装位置+信号类型+DDC容量预留20%', title:'自控点位表系统'},
  {nodeCode:'KN-智能化-002', industry:'通用洁净室', facilityType:'全形态', environment:'压差取样位置+避开风口+可检修+量程匹配', title:'传感器安装系统'},
  {nodeCode:'KN-智能化-003', industry:'通用洁净室', facilityType:'全形态', environment:'硬互锁+消防优先+一键解锁+门开向', title:'门禁互锁系统'},
  {nodeCode:'KN-智能化-004', industry:'通用洁净室', facilityType:'全形态', environment:'时序逻辑+排风先启+UPS联动+变频补偿', title:'送排风联锁系统'},
  {nodeCode:'KN-智能化-005', industry:'通用洁净室', facilityType:'全形态', environment:'摄像头布置+洁净走线+防尘+存储周期', title:'视频监控系统'},
  {nodeCode:'KN-智能化-006', industry:'通用洁净室', facilityType:'全形态', environment:'分项计量+趋势分析+能耗指标+节能联动', title:'能耗管理系统'},
  {nodeCode:'KN-智能化-007', industry:'通用洁净室', facilityType:'全形态', environment:'碰撞检查+净高核查+运维信息+交付标准', title:'BIM应用系统'},
  {nodeCode:'KN-智能化-008', industry:'医药GMP', facilityType:'生产线', environment:'温湿度+压差+粒子在线+报警+数据记录', title:'环境监控系统'},

  // ========== 集中供气系统（8个） ==========
  {nodeCode:'KN-供气-001', industry:'通用洁净室', facilityType:'全形态', environment:'防爆+泄爆+通风+泄漏报警+分库+钢瓶固定', title:'气瓶间与气站系统'},
  {nodeCode:'KN-供气-002', industry:'通用洁净室', facilityType:'全形态', environment:'管材选择+坡度+穿越密封+标识+可断点', title:'供气管路敷设系统'},
  {nodeCode:'KN-供气-003', industry:'通用洁净室', facilityType:'全形态', environment:'两级减压+终端压力+流量+材质兼容', title:'终端减压系统'},
  {nodeCode:'KN-供气-004', industry:'通用洁净室', facilityType:'全形态', environment:'探测器布置+气体密度+联动切断+报警分级', title:'泄漏检测系统'},
  {nodeCode:'KN-供气-005', industry:'通用洁净室', facilityType:'全形态', environment:'吹扫+保压+检漏+置换+验收', title:'吹扫保压检漏系统'},
  {nodeCode:'KN-供气-006', industry:'半导体', facilityType:'生产线', environment:'内抛光+洁净度+特殊接头+氦检漏+防污染', title:'高纯气体系统'},
  {nodeCode:'KN-供气-007', industry:'通用洁净室', facilityType:'全形态', environment:'单双瓶+排风+报警+防倾倒+耐火', title:'气瓶柜系统'},
  {nodeCode:'KN-供气-008', industry:'通用洁净室', facilityType:'全形态', environment:'切断阀位置+联动逻辑+手动紧急+分区切断', title:'紧急切断系统'},

  // ========== 工艺设备系统（8个） ==========
  {nodeCode:'KN-设备-001', industry:'通用洁净室', facilityType:'全形态', environment:'面风速0.4-0.6+排风接口+水电气点位+防爆', title:'通风柜安装系统'},
  {nodeCode:'KN-设备-002', industry:'生物安全实验室', facilityType:'全形态', environment:'A2/B2排风方式+远离门口+气流扰动+认证', title:'生物安全柜系统'},
  {nodeCode:'KN-设备-003', industry:'生物安全实验室', facilityType:'全形态', environment:'双扉+排汽处理+给排水+电源容量+容积', title:'灭菌器系统'},
  {nodeCode:'KN-设备-004', industry:'通用洁净室', facilityType:'全形态', environment:'水电气点位+承重+材质+可调脚+检修', title:'实验台系统'},
  {nodeCode:'KN-设备-005', industry:'通用洁净室', facilityType:'全形态', environment:'散热+独立回路+监控报警+搬运通道', title:'超低温冰箱系统'},
  {nodeCode:'KN-设备-006', industry:'生物安全实验室', facilityType:'全形态', environment:'CO2供气+温度监控+断电报警+摆放位置', title:'培养箱系统'},
  {nodeCode:'KN-设备-007', industry:'通用洁净室', facilityType:'全形态', environment:'排水+排汽+通风+耐冲洗+防滑地面', title:'洗消间设备系统'},
  {nodeCode:'KN-设备-008', industry:'通用洁净室', facilityType:'全形态', environment:'减振+承重+找平+独立基础+设备进出', title:'设备基础系统'},

  // ========== 跨系统集成节点（10个） ==========
  {nodeCode:'KN-集成-001', industry:'通用洁净室', facilityType:'全形态', environment:'风管水管桥架气路在吊顶内综合排布+检修空间+上下分层', title:'吊顶内管线综合系统'},
  {nodeCode:'KN-集成-002', industry:'通用洁净室', facilityType:'全形态', environment:'技术夹层+检修通道+各专业分层+荷载+照明', title:'技术夹层系统'},
  {nodeCode:'KN-集成-003', industry:'通用洁净室', facilityType:'全形态', environment:'压差界面+气密+人流物流+缓冲间+传递窗', title:'洁净区与非洁净区界面系统'},
  {nodeCode:'KN-集成-004', industry:'通用洁净室', facilityType:'全形态', environment:'管线穿越楼板+防火封堵+密封+检修+防水', title:'设备夹层穿越系统'},
  {nodeCode:'KN-集成-005', industry:'通用洁净室', facilityType:'全形态', environment:'排水+排汽+通风+耐冲洗+不锈钢+圆弧角', title:'洗消间集成系统'},
  {nodeCode:'KN-集成-006', industry:'生物安全实验室', facilityType:'全形态', environment:'互锁+压差+缓冲+气密门+方向', title:'气闸室系统'},
  {nodeCode:'KN-集成-007', industry:'通用洁净室', facilityType:'全形态', environment:'机房集中+减振+散热+检修+噪音+运输通道', title:'机房集中布置系统'},
  {nodeCode:'KN-集成-008', industry:'通用洁净室', facilityType:'全形态', environment:'传递窗布局+防交叉+单向流+样品跟踪', title:'样品流转通道系统'},
  {nodeCode:'KN-集成-009', industry:'生物安全实验室', facilityType:'全形态', environment:'独立通道+负压+密封+消毒+不穿越洁净区', title:'污物通道系统'},
  {nodeCode:'KN-集成-010', industry:'通用洁净室', facilityType:'全形态', environment:'参观路线+观察窗+与操作流线分离+照明', title:'参观通道系统'},
];

async function main() {
  // 登录
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.log('登录失败:', loginData.error);
    return;
  }
  const token = loginData.data?.token || loginData.token;
  console.log('登录成功，开始批量生成...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    console.log(`[${i + 1}/${nodes.length}] 生成 ${node.nodeCode} ${node.title}...`);

    try {
      const res = await fetch(`${BASE}/api/assistant/knowledge-nodes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...node, modelId: 'deepseek', autoSubmitReview: true }),
      });
      const data = await res.json();
      if (data.success) {
        successCount++;
        console.log(`  ✓ 成功 id=${data.data.id} status=${data.data.status}`);
      } else {
        failCount++;
        console.log(`  ✗ 失败: ${data.error}`);
      }
    } catch (e) {
      failCount++;
      console.log(`  ✗ 异常: ${e.message}`);
    }

    // 间隔2秒避免限流
    if (i < nodes.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n========== 汇总 ==========`);
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);

  // 查询最终列表
  const listRes = await fetch(`${BASE}/api/assistant/knowledge-nodes?status=draft`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json();
  if (listData.success) {
    console.log(`\n当前 draft 状态节点共 ${listData.data.length} 个：`);
    for (const n of listData.data) {
      console.log(`  - ${n.nodeCode} | ${n.title} | 更新于 ${n.updatedAt}`);
    }
  }
}

main().catch((e) => console.error('脚本错误:', e));
