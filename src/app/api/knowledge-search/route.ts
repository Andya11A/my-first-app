import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const keyword = request.nextUrl.searchParams.get('keyword') || '';
    const source = request.nextUrl.searchParams.get('source') || 'all';

    if (!keyword.trim()) {
      return NextResponse.json(
        { success: false, error: '请输入搜索关键词' },
        { status: 400 }
      );
    }

    const results: {
      source: string;
      sourceName: string;
      title: string;
      url: string;
      snippet: string;
    }[] = [];

    // 根据来源生成搜索链接
    const encodedKeyword = encodeURIComponent(keyword);

    if (source === 'all' || source === 'standard') {
      // 国家标准全文公开系统
      results.push({
        source: 'standard',
        sourceName: '国家标准全文公开系统',
        title: `搜索「${keyword}」相关国家标准`,
        url: `https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p1=0&p.p90=circulation_date&p.p91=desc&p.p2=${encodedKeyword}`,
        snippet: '国家标准全文公开系统（国家标准化管理委员会），可查询和在线阅读GB标准全文。',
      });

      // 住建部标准
      results.push({
        source: 'standard',
        sourceName: '住建部标准定额',
        title: `搜索「${keyword}」相关工程建设标准`,
        url: `https://www.mohurd.gov.cn/gongkai/zhengce/index.html?search=${encodedKeyword}`,
        snippet: '住房和城乡建设部标准定额，可查询工程建设国家标准和行业标准。',
      });
    }

    if (source === 'all' || source === 'bid') {
      // 中国政府采购网
      results.push({
        source: 'bid',
        sourceName: '中国政府采购网',
        title: `搜索「${keyword}」相关招标公告`,
        url: `https://search.ccgp.gov.cn/bxsearch?searchtype=1&page_index=1&bidSort=0&buyerName=&projectId=&pinMu=0&bidType=0&dbselect=bidx&kw=${encodedKeyword}&start_time=2023%3A01%3A01&end_time=2025%3A12%3A31&timeType=6&displayZone=&zoneId=&pppStatus=0&agentName=`,
        snippet: '中国政府采购网，查询政府采购招标公告和中标结果。',
      });

      // 全国公共资源交易平台
      results.push({
        source: 'bid',
        sourceName: '全国公共资源交易平台',
        title: `搜索「${keyword}」相关公共资源交易信息`,
        url: `https://www.ggzy.gov.cn/searchPro.html?type=1&kw=${encodedKeyword}`,
        snippet: '全国公共资源交易平台，查询工程建设招标、中标信息。',
      });
    }

    if (source === 'all' || source === 'tech') {
      // 百度学术
      results.push({
        source: 'tech',
        sourceName: '百度学术',
        title: `搜索「${keyword}」相关学术文献`,
        url: `https://xueshu.baidu.com/s?wd=${encodedKeyword}`,
        snippet: '百度学术，查询实验室相关技术论文和研究文献。',
      });

      // 知网
      results.push({
        source: 'tech',
        sourceName: '中国知网',
        title: `搜索「${keyword}」相关论文`,
        url: `https://kns.cnki.net/kns8s/defaultresult/index?kw=${encodedKeyword}`,
        snippet: '中国知网，查询学术论文、硕博论文、会议论文。',
      });
    }

    if (source === 'all' || source === 'general') {
      // 必应搜索
      results.push({
        source: 'general',
        sourceName: '必应搜索',
        title: `搜索「${keyword}」`,
        url: `https://www.bing.com/search?q=${encodedKeyword}+实验室`,
        snippet: '必应搜索引擎，综合搜索相关信息。',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        keyword,
        resultCount: results.length,
        results,
      },
    });
  } catch (error) {
    console.error('知识检索失败:', error);
    return NextResponse.json(
      { success: false, error: '检索失败' },
      { status: 500 }
    );
  }
}
