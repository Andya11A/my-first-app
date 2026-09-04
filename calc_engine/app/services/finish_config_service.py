"""装修配置方案服务（工程级）：实验室类型 × 洁净等级 → 材料自动推荐 + 造价估算

数据来源：
- finish_material_db.py（7大类52种材料：地面/墙面/吊顶/门窗/台面/辅材/固定家具）
- wall_system_db.py（2大类11种材料：墙体隔断结构层 + 墙面饰面层）

依据规范：
- GB 50346-2011 生物安全实验室建筑技术规范
- GB 50073-2013 洁净厂房设计规范
- GB 50591-2010 洁净室施工及验收规范
- GB 14925-2023 实验动物环境及设施
- GB 50447-2019 实验动物设施建筑技术规范
- GB 19489-2008 实验室生物安全通用要求
- JGJ 91-2019 科学实验建筑设计规范
- GMP 药品生产质量管理规范
"""

import re

from app.services.finish_material_db import MATERIAL_DB
from app.services.wall_system_db import WALL_SYSTEM_DB


# ================================================================
# 部位 → 材料库映射
# 墙体（结构层）查 wall_system_db；墙面（饰面层）先查 material_db 再查 wall_system_db
# ================================================================
PART_LOOKUP = {
    "地面": [(MATERIAL_DB, "地面")],
    "墙体": [(WALL_SYSTEM_DB, "墙体隔断")],
    "墙面": [(MATERIAL_DB, "墙面"), (WALL_SYSTEM_DB, "墙面饰面")],
    "吊顶": [(MATERIAL_DB, "吊顶")],
    "门窗": [(MATERIAL_DB, "门窗")],
    "台面": [(MATERIAL_DB, "台面")],
}


# ================================================================
# 装修配置规则库：12 大类 × 洁净等级
# 每个等级配置 6 个部位：地面/墙体/墙面/吊顶/门窗/台面
# 墙体=结构层（隔断系统），墙面=饰面层（表面材料），分开配置
# 门窗可含 transfer_box（传递窗），洁净区标配
# ================================================================
FINISH_CONFIG_RULES = {
    # ----------------------------------------------------------------
    # 1. PCR / 分子诊断类
    # ----------------------------------------------------------------
    "PCR分子诊断类": {
        "name": "PCR / 分子诊断实验室",
        "industry": "医学检验 / 分子诊断",
        "standards": ["GB 50346-2011", "GB 50073-2013", "医疗机构临床基因扩增检验实验室管理办法"],
        "clean_levels": {
            "十万级": {
                "env": {
                    "air_changes": "15-25次/h（GB 50073 ISO8 十万级）",
                    "airflow": "乱流（顶送下回）",
                    "filter": "H13高效送风口（每10-15㎡设1台高效送风口）",
                    "ffu_config": "以高效送风口为主，非FFU满布；不设独立FFU层流罩",
                    "pressure": "产物分析区-10~-15Pa负压，其余区-5~-10Pa",
                },
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝热熔焊接、耐消毒剂、防滑，PCR核心区标准做法（GB 50346 4.2）"},
                "墙体": {"material": "彩钢板隔墙", "reason": "气密性好、A级防火、板缝密封防气溶胶泄漏，四区物理分隔必备"},
                "墙面": {"material": "手工彩钢板", "reason": "表面光滑不积尘、易擦拭消毒、阴阳角R≥50mm圆弧过渡消除死角"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "与墙面形成整体密闭空间，便于压差梯度控制，顶棚不得设检修口"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "气密门维持区域压差防交叉污染；传递窗双门互锁+UV杀菌实现人物分流单向传递"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "耐消毒剂擦拭、耐一般试剂、性价比高，试剂准备区/样本制备区通用"},
            },
            "万级": {
                "env": {
                    "air_changes": "25-40次/h（GB 50073 ISO7 万级，较十万级提升1.5-2倍）",
                    "airflow": "乱流（顶送侧回），产物分析区可设局部百级层流罩",
                    "filter": "H13/H14高效送风口",
                    "ffu_config": "高效送风口 + 产物分析区FFU层流罩（1-2台，局部ISO5），按需配置",
                    "pressure": "产物分析区-15~-20Pa最大负压，压差梯度控制更严格",
                },
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接、耐消毒、万级洁净区标配，接缝热熔焊接零积尘"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁/岩棉芯A级防火，气密性满足万级压差控制"},
                "墙面": {"material": "玻镁彩钢板", "reason": "玻镁芯防潮不霉变、表面光滑耐擦拭，万级洁净度要求更高时优选"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合FFU/高效送风口，维持万级洁净度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "气密门+UV传递窗，产物分析区维持最大负压防气溶胶外泄"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "耐消毒剂、耐试剂，万级区操作台面通用"},
            },
        },
        "special_notes": [
            "四区独立物理分隔：试剂准备→样本制备→扩增→产物分析，人员物品单向流动",
            "各区间设传递窗（双门互锁+UV），禁止直接相通",
            "压差梯度：产物分析区负压最大（-10~-15Pa），空气由洁向污单向流",
            "墙角/顶角/地角全部R≥50mm圆弧过渡，地面与墙面交界圆弧处理",
            "所有穿墙管线须用专用穿墙密封件压紧密封，不得留缝",
        ],
    },

    # ----------------------------------------------------------------
    # 2. 微生物 / 生物安全类（BSL-2 / BSL-3）
    # ----------------------------------------------------------------
    "微生物生物安全类": {
        "name": "微生物 / 生物安全实验室",
        "industry": "疾控 / 医疗 / 科研",
        "standards": ["GB 50346-2011", "GB 19489-2008", "GB 50073-2013"],
        "clean_levels": {
            "十万级": {
                "ground": "BSL-2 基础配置",
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接、耐消毒剂、防滑，BSL-2地面标准做法（GB 50346 4.2.1）"},
                "墙体": {"material": "彩钢板隔墙", "reason": "气密彩钢板隔断，岩棉芯A级防火，满足BSL-2负压密闭要求"},
                "墙面": {"material": "手工彩钢板", "reason": "光滑不积尘、耐消毒擦拭，阴阳角圆弧过渡R≥30mm（GB 50346 4.2.1）"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合负压控制，防护区内顶棚不得设检修口（GB 50346 4.2.7）"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "主入口门自动关闭+门锁（GB 50346 4.2.5）；传递窗UV杀菌防生物气溶胶"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀、耐高温灭菌、易消毒，微生物操作区首选"},
            },
            "万级": {
                "ground": "BSL-2 高配 / BSL-3 缓冲",
                "地面": {"material": "环氧自流平地坪", "reason": "无缝防滑耐腐蚀，万级洁净+生物安全双重要求优选（GB 50346 4.2.1）"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁芯彩钢板气密隔断，A级防火防潮，满足万级+BSL-2密闭要求"},
                "墙面": {"material": "玻镁彩钢板", "reason": "防潮不霉变、耐消毒，万级洁净度下表面更易清洁"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持万级洁净度与负压梯度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "气密门+双门互锁传递窗，BSL-2核心区负压-10Pa以上"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀耐灭菌，生物安全柜操作区配套不锈钢台面"},
            },
            "百级": {
                "ground": "BSL-3 主实验室",
                "地面": {"material": "环氧自流平地坪", "reason": "三级四级实验室须无缝防滑耐腐蚀地面（GB 50346 4.2.1），环氧自流平满足"},
                "墙体": {"material": "彩钢板隔墙", "reason": "气密彩钢板+不锈钢板分区，BSL-3排风须HEPA过滤后排放"},
                "墙面": {"material": "不锈钢墙板", "reason": "污染区用不锈钢板（耐腐蚀、可反复消毒），清洁区用彩钢板分区处理"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶，BSL-3防护区顶棚严禁检修口（GB 50346 4.2.7）"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（层流式）", "reason": "BSL-3主实验室及缓冲间须气密门（GB 50346 4.2.5）；层流传递窗带HEPA"},
                "台面": {"material": "陶瓷台面", "reason": "耐除HF外所有酸、耐800°C高温、抗菌，BSL-3高防护区台面优选"},
            },
        },
        "special_notes": [
            "BSL-2核心区门向缓冲间开启，负压≥10Pa；BSL-3须气密门+独立排风+HEPA",
            "地面与墙面相交位置R≥30mm圆弧处理（GB 50346 4.2.1）",
            "BSL-3/4防护区内顶棚严禁设置检修口（GB 50346 4.2.7）",
            "排风经HEPA过滤后排放，BSL-3须独立排风系统不得共用",
            "建议彩钢板+不锈钢板分区：洁净区彩钢板，污染区不锈钢板",
        ],
    },

    # ----------------------------------------------------------------
    # 3. 理化 / 化学类
    # ----------------------------------------------------------------
    "理化化学类": {
        "name": "理化 / 化学实验室",
        "industry": "化工 / 检测 / 科研",
        "standards": ["JGJ 91-2019", "GB 50016 建筑设计防火规范"],
        "clean_levels": {
            "普通": {
                "地面": {"material": "环氧自流平地坪", "reason": "耐酸碱腐蚀、无缝易清洁，化学实验室地面首选"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "经济实用、隔音好，普通理化实验室隔墙标配；通风柜后墙耐火≥1h"},
                "墙面": {"material": "实验室瓷砖", "reason": "耐酸碱腐蚀、易擦洗、造价适中，试剂区墙面贴至1.8m高"},
                "吊顶": {"material": "石膏板吊顶", "reason": "普通环境无需密闭吊顶，经济实用；防潮区用耐水石膏板"},
                "门窗": {"material": "钢制门", "reason": "普通环境无需气密，钢制门耐腐蚀性价比高"},
                "台面": {"material": "不锈钢台面", "material_grade": "201", "reason": "经济型201不锈钢，坚固耐用易清洁，普通理化实验室性价比之选"},
            },
            "十万级": {
                "地面": {"material": "环氧自流平地坪", "reason": "耐腐蚀+无缝满足十万级洁净要求"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，满足十万级洁净密闭"},
                "墙面": {"material": "手工彩钢板", "reason": "光滑耐擦拭、阴阳角圆弧，十万级洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合高效送风口，维持十万级洁净度"},
                "门窗": {"material": "钢制门", "transfer_box": "传递窗（机械式）", "reason": "净化型钢制门+机械互锁传递窗，十万级洁净区分区"},
                "台面": {"material": "环氧树脂台面", "reason": "耐强酸强碱、一体成型无孔隙，高腐蚀化学实验优选"},
            },
        },
        "special_notes": [
            "试剂储存区墙面贴耐酸瓷砖至1.8m高，通风柜后墙耐火≥1h",
            "地面设排水沟坡度0.5%坡向地漏，防化学品泄漏积聚",
            "强酸强碱操作区台面升级为环氧树脂或陶瓷台面",
            "通风柜台面耐温耐腐，与台面接缝打耐酸密封胶",
        ],
    },

    # ----------------------------------------------------------------
    # 4. 动物实验类（普通 / SPF）
    # ----------------------------------------------------------------
    "动物实验类": {
        "name": "动物实验室",
        "industry": "生物医药 / 药理毒理",
        "standards": ["GB 14925-2023", "GB 50447-2019", "GB 19489-2008"],
        "clean_levels": {
            "普通级": {
                "ground": "普通环境（CV清洁动物）",
                "地面": {"material": "环氧自流平地坪", "reason": "无缝耐冲洗、耐消毒剂、耐动物排泄物腐蚀"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "普通环境隔墙，表面做防潮处理"},
                "墙面": {"material": "抗菌涂料", "reason": "抗菌防霉、易清洁，普通动物房墙面经济方案"},
                "吊顶": {"material": "石膏板吊顶", "reason": "普通环境吊顶，防潮区用耐水石膏板"},
                "门窗": {"material": "钢制门", "reason": "普通环境钢制门，配观察窗"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐冲洗、耐消毒、易灭菌，动物操作区台面"},
            },
            "十万级": {
                "ground": "清洁级（CL）",
                "地面": {"material": "环氧自流平地坪", "reason": "无缝耐冲洗耐消毒，十万级洁净+动物房双重需求"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，十万级屏障环境隔断"},
                "墙面": {"material": "手工彩钢板", "reason": "光滑耐擦拭、圆弧角无死角，便于冲洗消毒"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合屏障环境压差控制"},
                "门窗": {"material": "实验室气密门", "reason": "净化密闭门带观察窗，维持屏障环境压差"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐冲洗耐消毒，动物解剖/操作区台面"},
            },
            "万级": {
                "ground": "SPF 屏障环境",
                "地面": {"material": "环氧自流平地坪", "reason": "3mm环氧自流平+无缝，耐高压冲洗、耐消毒，SPF级标配（GB 14925）"},
                "墙体": {"material": "彩钢板隔墙", "reason": "50mm玻镁岩棉夹芯彩钢板A级防火（GB 50447），阴阳角R=50mm"},
                "墙面": {"material": "不锈钢墙板", "reason": "满焊无死角、耐高压冲洗、耐动物抓咬，SPF级墙面首选"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "50mm玻镁岩棉彩钢板密闭吊顶，配合MAU+FFU三级过滤"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "净化密闭门气密性达ISO 7级；传递窗UV杀菌+双扉灭菌柜实现物料单向灭菌传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐冲洗耐高温灭菌，SPF级动物操作台面"},
            },
        },
        "special_notes": [
            "SPF级压差梯度：洁净走廊+20Pa→饲养室+15Pa→污物走廊-5Pa",
            "墙面不锈钢板满焊无死角，可高压冲洗；墙角圆弧R≥50mm一体成型",
            "地面设排水沟坡向地漏，便于冲洗排污；换气次数≥15次/h",
            "传递窗+双扉高压灭菌器实现物料单向灭菌传递，人物流严格单向",
            "普通级换气8-10次/h，SPF级≥15次/h，三级过滤G4→F8→H14",
        ],
    },

    # ----------------------------------------------------------------
    # 5. 医院临床类（检验科 / 病理 / 输血）
    # ----------------------------------------------------------------
    "医院临床类": {
        "name": "医院检验科 / 病理 / 输血",
        "industry": "医疗机构",
        "standards": ["GB 50346-2011", "GB 50881-2013 医院洁净手术部建筑技术规范", "GB 15982 医院消毒卫生标准"],
        "clean_levels": {
            "普通": {
                "地面": {"material": "PVC卷材（同质透心）", "reason": "医院标准做法，易清洁耐消毒、脚感舒适、防滑"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "普通检验区隔墙，表面抗菌涂料处理"},
                "墙面": {"material": "抗菌涂料", "reason": "抗菌率>99%、0级防霉、耐洗刷>5000次，医院走廊/检验区墙面"},
                "吊顶": {"material": "铝扣板吊顶", "reason": "便于检修、防潮，医院辅助区标配"},
                "门窗": {"material": "钢制门", "reason": "普通区域钢制门配观察窗，无需气密"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "耐一般试剂、性价比高，常规检验台面"},
            },
            "十万级": {
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接耐消毒，十万级洁净检验区标配"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，十万级洁净区隔断"},
                "墙面": {"material": "医用洁净板（冰火板）", "reason": "A级防火抗菌、安装快、耐擦拭，医院洁净区墙面优选"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合高效送风口，维持十万级洁净度"},
                "门窗": {"material": "钢制门", "transfer_box": "传递窗（机械式）", "reason": "净化型钢制门+机械互锁传递窗，检验区分区传递"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "耐消毒剂擦拭、性价比高，洁净检验台面"},
            },
        },
        "special_notes": [
            "采血区设独立隔断，地面防滑；微生物区墙面贴瓷砖至顶",
            "污物通道独立，地面耐冲洗；病理区须独立排风（甲醛/二甲苯）",
            "输血科须洁净环境，血液检测区按十万级配置",
        ],
    },

    # ----------------------------------------------------------------
    # 6. 制药 GMP 类
    # ----------------------------------------------------------------
    "制药GMP类": {
        "name": "制药 GMP 车间",
        "industry": "制药 / 生物制品",
        "standards": ["GMP 药品生产质量管理规范", "GB 50073-2013", "GB 50457 医药工业洁净厂房设计规范"],
        "clean_levels": {
            "十万级": {
                "ground": "D 级（GMP）",
                "地面": {"material": "环氧自流平地坪", "reason": "无缝耐消毒、耐腐蚀，GMP D级车间地面首选"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，GMP车间隔断标配"},
                "墙面": {"material": "手工彩钢板", "reason": "表面光滑不产尘、耐消毒擦拭，阴阳角圆弧R≥50mm"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持D级洁净度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（机械式）", "reason": "气密门维持压差；传递窗机械互锁实现物料单向传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀易灭菌，GMP车间操作台面首选"},
            },
            "万级": {
                "ground": "C 级（GMP）",
                "地面": {"material": "环氧自流平地坪", "reason": "2-3mm环氧自流平，无缝满足C级洁净要求"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁芯彩钢板防潮不变形，C级洁净区隔断"},
                "墙面": {"material": "玻镁彩钢板", "reason": "防潮不霉变、表面光洁，C级洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+FFU/高效送风口，维持C级洁净度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（层流式）", "reason": "气密门+层流传递窗（HEPA H14），C级区物料传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "316L", "reason": "316L不锈钢耐腐蚀耐灭菌，GMP无菌操作台面"},
            },
            "百级": {
                "ground": "A/B 级（GMP）",
                "地面": {"material": "环氧自流平地坪", "reason": "3mm环氧自流平，无菌核心区地面"},
                "墙体": {"material": "铝蜂窝板隔墙", "reason": "铝蜂窝板高强度高平整度，A/B级核心区围护"},
                "墙面": {"material": "铝蜂窝板（全铝）", "reason": "全铝蜂窝板表面PVDF涂层、可擦拭消毒、不产尘，A级核心区墙面"},
                "吊顶": {"material": "FFU龙骨吊顶（T-Grid系统）", "reason": "T-Grid模块化吊顶+FFU满布，维持百级垂直层流"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（层流式）", "reason": "气密门+层流传递窗，A/B级无菌区物料传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "316L", "reason": "316L不锈钢，无菌灌装/核心区操作台面"},
            },
        },
        "special_notes": [
            "GMP A/B/C/D级对应ISO 5/5/7/8，百级区须垂直层流FFU满布",
            "压差梯度：高洁净区对低洁净区≥10Pa，对非洁净区≥15Pa",
            "所有阴阳角R≥50mm圆弧过渡，地面墙面交界cove圆弧处理",
            "A级区采用隔离器/RABS，环境在线监测悬浮粒子",
        ],
    },

    # ----------------------------------------------------------------
    # 7. 食品检测类
    # ----------------------------------------------------------------
    "食品检测类": {
        "name": "食品检测实验室",
        "industry": "食品 / 农产品检测",
        "standards": ["GB 50073-2013", "HACCP", "GB 4789 食品微生物检验"],
        "clean_levels": {
            "普通": {
                "地面": {"material": "聚氨酯地坪", "reason": "耐水耐潮、耐冲洗、耐温变，食品检测区洗消间/潮湿区优选"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "普通检测区隔墙，表面防潮处理"},
                "墙面": {"material": "抗菌涂料", "reason": "抗菌防霉、易清洁，食品检测区墙面经济方案"},
                "吊顶": {"material": "石膏板吊顶", "reason": "普通环境吊顶，防潮区用耐水石膏板"},
                "门窗": {"material": "钢制门", "reason": "普通环境钢制门，配观察窗"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀易冲洗、食品级，食品检测台面首选"},
            },
            "十万级": {
                "地面": {"material": "环氧自流平地坪", "reason": "无缝耐冲洗耐消毒，十万级食品微生物检测区地面"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，十万级洁净区隔断"},
                "墙面": {"material": "手工彩钢板", "reason": "光滑耐擦拭、圆弧角无死角，十万级洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶配合高效送风口，维持十万级洁净度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（机械式）", "reason": "气密门+机械互锁传递窗，洁净区物料传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "304不锈钢耐腐蚀易冲洗，食品微生物检测台面"},
            },
        },
        "special_notes": [
            "微生物检测区按十万级配置，无菌室须配超净工作台",
            "样品处理区地面耐水耐冲洗，设排水沟",
            "试剂区台面升级为环氧树脂或陶瓷（耐有机溶剂）",
        ],
    },

    # ----------------------------------------------------------------
    # 8. 电子 / 半导体类
    # ----------------------------------------------------------------
    "电子半导体类": {
        "name": "电子 / 半导体实验室",
        "industry": "电子 / 半导体 / 精密仪器",
        "standards": ["GB 50073-2013", "IEC 61340 防静电", "SEMI 标准"],
        "clean_levels": {
            "万级": {
                "ground": "ISO 7",
                "地面": {"material": "防静电环氧地坪", "reason": "导静电10⁶-10⁹Ω、耐化学腐蚀，电子实验室防静电地面首选"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，万级洁净区隔断"},
                "墙面": {"material": "手工彩钢板", "reason": "表面防静电涂层、不产尘，万级电子洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持万级洁净度"},
                "门窗": {"material": "实验室气密门", "reason": "气密门维持压差，配双层中空玻璃观察窗"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "防静电型理化板，电子实验室操作台面"},
            },
            "千级": {
                "ground": "ISO 6",
                "地面": {"material": "防静电环氧地坪", "reason": "导电铜网+防静电面漆，表面电阻10⁶-10⁹Ω，千级区导静电"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁芯彩钢板，千级洁净区高气密隔断"},
                "墙面": {"material": "铝蜂窝彩钢板", "reason": "高强度高平整度、表面防静电，千级区墙面优选"},
                "吊顶": {"material": "FFU龙骨吊顶（T-Grid系统）", "reason": "T-Grid+FFU部分满布，维持千级洁净度"},
                "门窗": {"material": "实验室气密门", "reason": "气密门+防静电处理，千级区压差控制"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "防静电型理化板，精密电子操作台面"},
            },
            "百级": {
                "ground": "ISO 5",
                "地面": {"material": "防静电环氧地坪", "reason": "2mm导电环氧+铜网接地，百级核心区防静电地面"},
                "墙体": {"material": "铝蜂窝板隔墙", "reason": "铝蜂窝板高强度高平整度不产尘，百级核心区围护"},
                "墙面": {"material": "铝蜂窝板（全铝）", "reason": "全铝蜂窝板PVDF涂层、防静电、可擦拭消毒，百级区墙面"},
                "吊顶": {"material": "FFU龙骨吊顶（T-Grid系统）", "reason": "T-Grid+FFU满布80%+，垂直层流维持百级"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（层流式）", "reason": "气密门+层流传递窗（HEPA），百级区物料传递"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "防静电型理化板，半导体操作台面"},
            },
        },
        "special_notes": [
            "全程防静电：地面导电铜网接地<4Ω、墙面防静电涂层、人员防静电服/腕带",
            "百级区FFU满布≥80%，垂直层流截面风速0.36-0.54m/s",
            "压差：百级对万级≥10Pa，万级对非洁净≥15Pa",
            "AMC（分子级污染物）控制：活性炭+分子筛化学过滤",
        ],
    },

    # ----------------------------------------------------------------
    # 9. 恒温恒湿类
    # ----------------------------------------------------------------
    "恒温恒湿类": {
        "name": "恒温恒湿实验室",
        "industry": "计量 / 标定 / 精密仪器 / 留样",
        "standards": ["JGJ 91-2019", "GB 50073-2013"],
        "clean_levels": {
            "普通": {
                "地面": {"material": "PVC卷材（同质透心）", "reason": "脚感舒适、温湿度变化稳定，恒温恒湿区地面"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "双层石膏板+岩棉保温层，减少外界热传导"},
                "墙面": {"material": "抗菌涂料", "reason": "表面光滑、温湿度变化不脱落，恒温恒湿区墙面"},
                "吊顶": {"material": "石膏板吊顶", "reason": "保温吊顶减少顶部热传导，表面刮腻子刷乳胶漆"},
                "门窗": {"material": "钢制门", "reason": "保温门+密封条，减少冷热桥效应"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "温湿度稳定不变形，精密仪器/标定台面"},
            },
            "十万级": {
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接、温湿度变化稳定，十万级恒温恒湿区地面"},
                "墙体": {"material": "彩钢板隔墙", "reason": "PU芯保温彩钢板，减少热传导同时满足洁净密闭"},
                "墙面": {"material": "手工彩钢板", "reason": "表面光滑保温、耐温湿度变化，十万级区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "保温密闭吊顶+高效送风口，维持洁净度+恒温恒湿"},
                "门窗": {"material": "实验室气密门", "reason": "保温气密门+缓冲间，减少冷热桥和外界干扰"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "温湿度稳定不变形，洁净恒温恒湿区台面"},
            },
        },
        "special_notes": [
            "墙体须做保温层（岩棉/PU），减少外界热传导影响温控精度",
            "入口设缓冲间，门配密封条减少冷热桥效应",
            "温控精度±0.5-1℃、湿控±5%，空调须选精密恒温恒湿机组",
            "避免阳光直射，窗户做遮阳处理或无窗设计",
        ],
    },

    # ----------------------------------------------------------------
    # 10. 细胞培养类
    # ----------------------------------------------------------------
    "细胞培养类": {
        "name": "细胞培养实验室",
        "industry": "生物医学 / 细胞治疗 / 干细胞",
        "standards": ["GB 50073-2013", "GB 50346-2011", "细胞治疗产品生产质量管理规范"],
        "clean_levels": {
            "万级": {
                "ground": "ISO 7 背景环境",
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接耐消毒，细胞培养区万级背景环境地面"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁芯彩钢板防潮不霉变，万级洁净区隔断"},
                "墙面": {"material": "玻镁彩钢板", "reason": "防潮不霉变、耐消毒擦拭，细胞培养区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持万级背景环境"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（机械式）", "reason": "气密门+传递窗，细胞培养区物料传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀易灭菌，细胞操作（生物安全柜内）配套台面"},
            },
            "百级": {
                "ground": "ISO 5 局部百级",
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接耐消毒，百级细胞操作区地面"},
                "墙体": {"material": "铝蜂窝板隔墙", "reason": "铝蜂窝板高强度高洁净度，百级核心区围护"},
                "墙面": {"material": "铝蜂窝板（全铝）", "reason": "全铝蜂窝板不产尘、可消毒，百级细胞操作区墙面"},
                "吊顶": {"material": "FFU龙骨吊顶（T-Grid系统）", "reason": "T-Grid+FFU满布，垂直层流维持百级无菌操作环境"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（层流式）", "reason": "气密门+层流传递窗（HEPA），百级区无菌物料传递"},
                "台面": {"material": "不锈钢台面", "material_grade": "316L", "reason": "316L不锈钢耐腐蚀易灭菌，百级细胞操作台面"},
            },
        },
        "special_notes": [
            "百级为局部层流（生物安全柜/超净台内），背景环境万级",
            "CO₂培养箱区域须独立排风，温湿度20-26℃/40-65%RH",
            "细胞操作须在生物安全柜（A2型）内进行，台面耐消毒",
        ],
    },

    # ----------------------------------------------------------------
    # 11. 疾控 / 公卫类
    # ----------------------------------------------------------------
    "疾控公卫类": {
        "name": "疾控 / 公共卫生实验室",
        "industry": "疾控中心 / 海关 / 第三方检测",
        "standards": ["GB 50346-2011", "GB 19489-2008", "GB 50073-2013"],
        "clean_levels": {
            "十万级": {
                "地面": {"material": "PVC卷材（同质透心）", "reason": "无缝焊接耐消毒，疾控常规检测区十万级地面"},
                "墙体": {"material": "彩钢板隔墙", "reason": "岩棉芯彩钢板A级防火，十万级洁净区隔断"},
                "墙面": {"material": "手工彩钢板", "reason": "光滑耐擦拭、圆弧角无死角，十万级洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持十万级洁净度"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "气密门+UV传递窗，疾控病原检测区防交叉污染"},
                "台面": {"material": "理化板（威盛亚/富美家）", "reason": "耐消毒剂、耐试剂，常规检测台面"},
            },
            "万级": {
                "ground": "病原检测高配",
                "地面": {"material": "环氧自流平地坪", "reason": "无缝耐消毒，万级病原检测区地面"},
                "墙体": {"material": "彩钢板隔墙", "reason": "玻镁芯彩钢板气密隔断，万级洁净+生物安全"},
                "墙面": {"material": "玻镁彩钢板", "reason": "防潮不霉变耐消毒，万级洁净区墙面"},
                "吊顶": {"material": "彩钢板吊顶", "reason": "密闭吊顶+高效送风口，维持万级洁净度+负压"},
                "门窗": {"material": "实验室气密门", "transfer_box": "传递窗（带消毒UV）", "reason": "气密门+UV传递窗，病原检测区负压防气溶胶外泄"},
                "台面": {"material": "不锈钢台面", "material_grade": "304", "reason": "耐腐蚀易灭菌，病原检测操作台面"},
            },
        },
        "special_notes": [
            "疾控须设BSL-2核心区（负压+生物安全柜），按GB 50346配置",
            "病原检测区排风经HEPA过滤后排放，独立排风系统",
            "样本接收区与检测区分隔，设传递窗传递",
        ],
    },

    # ----------------------------------------------------------------
    # 12. 教学 / 通用类
    # ----------------------------------------------------------------
    "教学通用类": {
        "name": "教学 / 通用实验室",
        "industry": "高校 / 中学 / 企业研发",
        "standards": ["JGJ 91-2019", "GB 50016 建筑设计防火规范"],
        "clean_levels": {
            "普通": {
                "地面": {"material": "水磨石", "reason": "耐磨耐腐蚀、造价低、寿命长，学校化学/生物实验室传统地面"},
                "墙体": {"material": "轻钢龙骨石膏板隔墙", "reason": "经济实用、隔音好，教学实验室隔墙标配"},
                "墙面": {"material": "抗菌涂料", "reason": "造价低、施工快、抗菌防霉，教学实验室墙面"},
                "吊顶": {"material": "石膏板吊顶", "reason": "经济实用，教学实验室吊顶"},
                "门窗": {"material": "钢制门", "reason": "普通环境钢制门，配观察窗"},
                "台面": {"material": "不锈钢台面", "material_grade": "201", "reason": "经济型201不锈钢，耐用抗造易清洁，教学/通用实验台面性价比之选"},
            },
        },
        "special_notes": [
            "根据实际使用需求可升级材料档次（如PVC卷材替代水磨石）",
            "化学教学区设通风柜，台面耐酸碱",
            "地面设地漏排水，坡度0.5%",
        ],
    },
}


# ================================================================
# 别名映射（用户输入→规则库 key）
# ================================================================
LAB_TYPE_ALIASES = {
    "pcr": "PCR分子诊断类", "pcr实验室": "PCR分子诊断类", "分子诊断": "PCR分子诊断类", "基因扩增": "PCR分子诊断类",
    "微生物": "微生物生物安全类", "生物安全": "微生物生物安全类", "bsl-2": "微生物生物安全类", "bsl2": "微生物生物安全类",
    "bsl-3": "微生物生物安全类", "bsl3": "微生物生物安全类", "生物安全p2": "微生物生物安全类", "生物安全p3": "微生物生物安全类",
    "理化": "理化化学类", "化学": "理化化学类", "理化实验室": "理化化学类", "化学实验室": "理化化学类",
    "动物": "动物实验类", "动物实验室": "动物实验类", "动物房": "动物实验类", "spf": "动物实验类", "spf级": "动物实验类",
    "动物spf": "动物实验类", "动物spf级": "动物实验类", "动物实验室spf级": "动物实验类",
    "医院": "医院临床类", "检验科": "医院临床类", "医院检验科": "医院临床类", "病理": "医院临床类", "输血": "医院临床类",
    "制药": "制药GMP类", "gmp": "制药GMP类", "药厂": "制药GMP类", "制药gmp类": "制药GMP类",
    "食品": "食品检测类", "食品检测": "食品检测类", "食品实验室": "食品检测类",
    "电子": "电子半导体类", "半导体": "电子半导体类", "电子实验室": "电子半导体类", "防静电": "电子半导体类",
    "恒温恒湿": "恒温恒湿类", "恒温恒湿实验室": "恒温恒湿类", "计量": "恒温恒湿类", "标定": "恒温恒湿类",
    "细胞": "细胞培养类", "细胞培养": "细胞培养类", "细胞培养室": "细胞培养类", "干细胞": "细胞培养类",
    "疾控": "疾控公卫类", "公卫": "疾控公卫类", "疾控公卫类": "疾控公卫类", "疾控中心": "疾控公卫类", "海关": "疾控公卫类",
    "教学": "教学通用类", "通用": "教学通用类", "学校": "教学通用类", "高校": "教学通用类",
}

CLEAN_LEVEL_ALIASES = {
    "百级": "百级", "iso5": "百级", "iso 5": "百级", "a级": "百级", "b级": "百级",
    "千级": "千级", "iso6": "千级", "iso 6": "千级",
    "万级": "万级", "iso7": "万级", "iso 7": "万级", "c级": "万级",
    "十万级": "十万级", "iso8": "十万级", "iso 8": "十万级", "d级": "十万级",
    "普通": "普通", "无": "普通", "非洁净": "普通", "常规": "普通",
    "spf级": "万级", "spf": "万级", "屏障": "万级",
    "普通级": "普通级", "清洁级": "十万级", "cl": "十万级",
}


# ================================================================
# 辅助函数
# ================================================================

def _normalize_lab_type(lab_type: str) -> str:
    """归一化实验室类型名（支持别名）"""
    key = lab_type.strip().lower().replace(" ", "")
    if lab_type in FINISH_CONFIG_RULES:
        return lab_type
    if key in LAB_TYPE_ALIASES:
        return LAB_TYPE_ALIASES[key]
    # 模糊匹配
    for rule_key in FINISH_CONFIG_RULES:
        if lab_type in rule_key or rule_key in lab_type:
            return rule_key
    return ""


def _normalize_clean_level(clean_level: str) -> str:
    """归一化洁净等级名"""
    if not clean_level:
        return ""
    key = clean_level.strip().lower().replace(" ", "")
    if clean_level in CLEAN_LEVEL_ALIASES:
        return CLEAN_LEVEL_ALIASES[clean_level]
    if key in CLEAN_LEVEL_ALIASES:
        return CLEAN_LEVEL_ALIASES[key]
    return clean_level


def _lookup_material(part: str, material_name: str) -> dict:
    """跨材料库查找材料详情（精确→包含→兜底）"""
    for db, cat in PART_LOOKUP.get(part, []):
        cat_data = db.get(cat, {})
        # 精确匹配
        if material_name in cat_data:
            return dict(cat_data[material_name])
        # 包含匹配
        for db_name, db_info in cat_data.items():
            if material_name in db_name or db_name in material_name:
                return dict(db_info)
    return {}


def _parse_price_tiers(price_str: str, grade: str = None) -> tuple:
    """从价格字符串提取 (低, 中, 高) 三档单价

    解析 "N-N元" 范围和 "N元" 单值。
    对于含分号的多档价格（如"201材质 600-1200；304材质 1000-2500；316L 2000-4000"）：
    - 指定 grade（如"201"/"304"/"316L"）→ 取包含该材质档位的分段
    - 未指定 grade → 取第一段（主流/经济款档次），避免高端档混入常规三档
    """
    if not price_str:
        return (0.0, 0.0, 0.0)
    text = str(price_str)
    # 分号分隔的多档价格：按材质档位取对应分段
    segments = re.split(r'[；;]', text)
    if grade:
        text = next((seg for seg in segments if grade in seg), segments[0])
    elif len(segments) > 1:
        text = segments[0]
    # 匹配 "N-N元" 或 "N元"（N可为小数）
    matches = re.findall(r'(\d+(?:\.\d+)?)\s*(?:[-~至]\s*(\d+(?:\.\d+)?)\s*)?元', text)
    lows = []
    highs = []
    for m in matches:
        lo = float(m[0])
        hi = float(m[1]) if m[1] else lo
        lows.append(lo)
        highs.append(hi)
    if not lows:
        # 兜底：提取所有≥5的数字
        nums = [float(x) for x in re.findall(r'\d+(?:\.\d+)?', text) if float(x) >= 5]
        if nums:
            nums.sort()
            return (nums[0], nums[len(nums) // 2], nums[-1])
        return (0.0, 0.0, 0.0)
    low = min(lows)
    high = max(highs)
    mid = (sum(lows) + sum(highs)) / (len(lows) + len(highs))
    return (low, mid, high)


def _is_integrated_wall(wall_struct_mat: str, wall_finish_mat: str) -> bool:
    """判断墙体（结构层）与墙面（饰面层）是否为一体化围护产品

    洁净区彩钢板隔墙本身就是双面彩钢板面板，墙体的造价已含两侧饰面，
    此时墙面部位不应再单独计价，避免重复。
    """
    integrated_kw = ["彩钢板", "铝蜂窝", "玻镁"]
    ws = any(k in wall_struct_mat for k in integrated_kw)
    wf = any(k in wall_finish_mat for k in integrated_kw)
    return ws and wf


# 台面宽度系数（相对750mm标准边台）
# 不同台型对应不同台面宽度，造价需按宽度系数折算
COUNTERTOP_WIDTH_FACTOR = {
    "天平台": 0.8,      # 600mm
    "边台": 1.0,        # 750mm 标准
    "仪器台": 1.2,      # 900mm
    "中央台": 2.0,      # 1500mm 双侧
}


def _build_part_detail(part: str, cfg: dict) -> dict:
    """构建单个部位的详情（含材料库关联信息）"""
    material_name = cfg.get("material", "")
    info = _lookup_material(part, material_name)
    detail = {
        "material": material_name,
        "reason": cfg.get("reason", ""),
        "spec": info.get("spec", ""),
        "price_range": info.get("price_range", ""),
        "construction": info.get("construction", ""),
        "brands": info.get("brands", []),
    }
    if cfg.get("material_grade"):
        detail["material_grade"] = cfg["material_grade"]
    # 门窗含传递窗
    if part == "门窗" and cfg.get("transfer_box"):
        tb_name = cfg["transfer_box"]
        tb_info = _lookup_material("门窗", tb_name)
        detail["transfer_box"] = tb_name
        detail["transfer_box_spec"] = tb_info.get("spec", "")
        detail["transfer_box_price_range"] = tb_info.get("price_range", "")
        detail["transfer_box_brands"] = tb_info.get("brands", [])
    return detail


# ================================================================
# 核心服务函数
# ================================================================

def list_lab_types() -> list:
    """列出所有实验室大类"""
    return [
        {"key": k, "name": v["name"], "industry": v.get("industry", ""),
         "clean_levels": list(v["clean_levels"].keys()),
         "standards": v.get("standards", [])}
        for k, v in FINISH_CONFIG_RULES.items()
    ]


def recommend_finish_config(lab_type: str, clean_level: str = None) -> dict:
    """根据实验室类型+洁净等级推荐装修配置（不含造价）

    Args:
        lab_type: 实验室类型（支持别名）
        clean_level: 洁净等级（可选，不传则取该类型第一个等级）
    """
    matched_key = _normalize_lab_type(lab_type)
    if not matched_key:
        # 兜底通用
        matched_key = "教学通用类"
        match_status = "generic"
    else:
        match_status = "exact"

    rule = FINISH_CONFIG_RULES[matched_key]
    available_levels = list(rule["clean_levels"].keys())

    # 归一化洁净等级
    target_level = None
    if clean_level:
        norm = _normalize_clean_level(clean_level)
        # 优先精确匹配
        for lv in available_levels:
            if lv == norm or lv == clean_level:
                target_level = lv
                break
        # 别名匹配
        if not target_level:
            for lv in available_levels:
                if norm and (norm in lv or lv in norm):
                    target_level = lv
                    break
        # 大小写不敏感
        if not target_level:
            cl_lower = clean_level.lower().replace(" ", "")
            for lv in available_levels:
                if lv.lower().replace(" ", "") == cl_lower:
                    target_level = lv
                    break

    if not target_level:
        target_level = available_levels[0]

    level_cfg = rule["clean_levels"][target_level]
    # 去掉非部位辅助字段（如 ground 注释）
    parts = ["地面", "墙体", "墙面", "吊顶", "门窗", "台面"]
    config_detail = {}
    for part in parts:
        if part in level_cfg:
            config_detail[part] = _build_part_detail(part, level_cfg[part])

    return {
        "lab_type": lab_type,
        "matched_key": matched_key,
        "matched": match_status,
        "name": rule["name"],
        "industry": rule.get("industry", ""),
        "clean_level": target_level,
        "available_clean_levels": available_levels,
        "standards": rule.get("standards", []),
        "env": level_cfg.get("env") or {},
        "config": config_detail,
        "special_notes": rule.get("special_notes", []),
    }


def generate_finish_plan(lab_type: str, clean_level: str, area: float, countertop_type: str = "边台") -> dict:
    """生成装修方案 + 造价估算（低/中/高三档）

    造价逻辑：
    - 地面/吊顶：面积 × 单价
    - 墙体（隔断）：面积 × 2.5系数（估算隔断面积）× 单价
    - 墙面（饰面）：周长×层高-门窗洞口 ≈ 面积×2.2 × 单价；
      洁净区彩钢板墙体与墙面为一体化围护时，墙面造价已含于墙体，不重复计价
    - 门窗：每20㎡1樘门 × 单价 + 传递窗按功能区数量
    - 台面：面积 × 0.3系数（估算延米）× 宽度系数 × 单价
      宽度系数：边台1.0/中央台2.0/仪器台1.2/天平台0.8（台面单价口径为@750标准边台）
    """
    if area <= 0:
        raise ValueError("面积必须大于0")

    # 校验台面类型
    if countertop_type not in COUNTERTOP_WIDTH_FACTOR:
        raise ValueError(f"不支持的台面类型: {countertop_type}，可选: {list(COUNTERTOP_WIDTH_FACTOR.keys())}")

    config = recommend_finish_config(lab_type, clean_level)

    # 估算量
    floor_area = area                      # 地面/吊顶面积
    partition_area = area * 2.5            # 墙体隔断面积估算
    # 墙面饰面面积：周长×层高-门窗洞口 ≈ 面积×2.2
    # 洁净区彩钢板墙体与墙面为一体化产品（双面彩钢板），墙面造价已含于墙体，不重复计价
    wall_struct_mat = config["config"].get("墙体", {}).get("material", "")
    wall_finish_mat = config["config"].get("墙面", {}).get("material", "")
    wall_integrated = _is_integrated_wall(wall_struct_mat, wall_finish_mat)
    wall_finish_area = 0.0 if wall_integrated else area * 2.2
    door_count = max(1, round(area / 20))  # 门数量
    # 传递窗数量：洁净区按每60㎡1台，PCR/BSL等按功能区加量
    transfer_box_count = 0
    lab_key = config["matched_key"]
    if config["config"].get("门窗", {}).get("transfer_box"):
        if "PCR" in lab_key:
            transfer_box_count = max(3, round(area / 40))   # PCR四区至少3个传递窗
        elif "生物安全" in lab_key or "动物" in lab_key:
            transfer_box_count = max(2, round(area / 50))
        else:
            transfer_box_count = max(1, round(area / 60))
    bench_lm = area * 0.3                  # 台面延米估算（标准750mm边台）
    countertop_factor = COUNTERTOP_WIDTH_FACTOR[countertop_type]  # 台面宽度系数

    total_low = 0.0
    total_mid = 0.0
    total_high = 0.0
    cost_detail = []

    for part, detail in config["config"].items():
        price_str = detail.get("price_range", "")
        # 台面材质档位（如不锈钢201/304/316L）决定取哪段价格区间
        grade = detail.get("material_grade")
        low_p, mid_p, high_p = _parse_price_tiers(price_str, grade)

        # 确定工程量
        if part == "地面":
            qty, unit = floor_area, "㎡"
        elif part == "墙体":
            qty, unit = partition_area, "㎡"
        elif part == "墙面":
            qty, unit = wall_finish_area, "㎡"
        elif part == "吊顶":
            qty, unit = floor_area, "㎡"
        elif part == "门窗":
            qty, unit = door_count, "樘"
        elif part == "台面":
            qty, unit = bench_lm, "延米"
        else:
            qty, unit = area, "㎡"

        # 台面需乘宽度系数（边台1.0/中央台2.0/仪器台1.2/天平台0.8）
        eff_factor = countertop_factor if part == "台面" else 1.0
        part_low = low_p * qty * eff_factor
        part_mid = mid_p * qty * eff_factor
        part_high = high_p * qty * eff_factor

        # 传递窗费用（门窗部位）
        tb_low = tb_mid = tb_high = 0.0
        if part == "门窗" and transfer_box_count > 0 and detail.get("transfer_box"):
            tb_price_str = detail.get("transfer_box_price_range", "")
            tb_low_p, tb_mid_p, tb_high_p = _parse_price_tiers(tb_price_str)
            tb_low = tb_low_p * transfer_box_count
            tb_mid = tb_mid_p * transfer_box_count
            tb_high = tb_high_p * transfer_box_count
            part_low += tb_low
            part_mid += tb_mid
            part_high += tb_high

        total_low += part_low
        total_mid += part_mid
        total_high += part_high

        item = {
            "part": part,
            "material": detail["material"],
            "qty": round(qty, 1),
            "unit": unit,
            "unit_price_low": round(low_p, 1),
            "unit_price_mid": round(mid_p, 1),
            "unit_price_high": round(high_p, 1),
            "cost_low": round(part_low, 0),
            "cost_mid": round(part_mid, 0),
            "cost_high": round(part_high, 0),
        }
        if part == "墙面" and wall_integrated:
            item["included_in_wall"] = True
            item["cost_note"] = "墙面与墙体为一体化彩钢板围护，造价已含于墙体，不重复计价"
        if part == "台面":
            item["countertop_type"] = countertop_type
            item["width_factor"] = countertop_factor
            if detail.get("material_grade"):
                item["material_grade"] = detail["material_grade"]
                item["cost_note"] = (f"台面造价={detail['material_grade']}材质延米单价"
                                     f"×{qty}延米×宽度系数{countertop_factor}（{countertop_type}）")
            else:
                item["cost_note"] = f"台面造价=延米单价×{qty}延米×宽度系数{countertop_factor}（{countertop_type}）"
        if part == "门窗" and transfer_box_count > 0 and detail.get("transfer_box"):
            item["transfer_box"] = detail["transfer_box"]
            item["transfer_box_qty"] = transfer_box_count
            item["transfer_box_cost_low"] = round(tb_low, 0)
            item["transfer_box_cost_mid"] = round(tb_mid, 0)
            item["transfer_box_cost_high"] = round(tb_high, 0)
        cost_detail.append(item)

    return {
        "lab_type": lab_type,
        "matched_key": config["matched_key"],
        "matched": config["matched"],
        "name": config["name"],
        "industry": config["industry"],
        "clean_level": config["clean_level"],
        "available_clean_levels": config["available_clean_levels"],
        "standards": config["standards"],
        "env": config.get("env") or {},
        "area_m2": area,
        "countertop_type": countertop_type,
        "config": config["config"],
        "special_notes": config["special_notes"],
        "cost_estimate": {
            "total_low_yuan": round(total_low, 0),
            "total_mid_yuan": round(total_mid, 0),
            "total_high_yuan": round(total_high, 0),
            "unit_low_yuan_per_m2": round(total_low / area, 0) if area else 0,
            "unit_mid_yuan_per_m2": round(total_mid / area, 0) if area else 0,
            "unit_high_yuan_per_m2": round(total_high / area, 0) if area else 0,
            "detail": cost_detail,
            "note": "造价为材料费估算（含隔断/饰面/门窗/台面），不含人工/辅材/机电/空调；"
                    "墙体按面积×2.5估算隔断面积，墙面按面积×2.2估算（洁净区彩钢板一体化时不重复计价），"
                    "台面按面积×0.3估算延米×宽度系数（边台1.0/中央台2.0/仪器台1.2/天平台0.8）；"
                    "实际以供应商报价为准",
        },
    }
