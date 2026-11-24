import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "MT5 已平仓日记",
  description: "MT5 的单笔成交不是一条已平仓记录。部分平仓在全部平完后合并。未平仓和账户密码不会进入公开页面。",
  keywords: ["MT5 交易日记", "已平仓", "部分平仓", "成交和持仓"],
  alternates: { canonical: "/guide/mt5-journal/" },
};

export default function Mt5JournalGuidePage() {
  return (
    <GuideArticle kicker="MT5 JOURNAL" title="日记记录的是已经平掉的回合">
      <p>
        MT5 历史里的一笔 deal 只是开仓、平仓或资金变动的一条。公开页和本地日记使用的是完全平掉的回合。
        <Link href="/#records"> 查看平仓记录 </Link>
        在没有发布文件时保持未连接。
      </p>
      <h2>怎样才算一条已平仓</h2>
      <ul>
        <li>同一笔持仓的开仓量，被一笔或多笔平仓量结清。</li>
        <li>多笔部分平仓在结清后合并成一条，净盈亏把价格盈亏、佣金和库存费加总。</li>
        <li>还有剩余手数的，不进入表格，也不算进胜率。</li>
        <li>反向开仓 inout 这套格式不支持，整笔排除，而不是猜哪一部分是平仓。</li>
        <li>余额变动是出入金。信用额调整忽略。两者都不是交易盈亏。</li>
      </ul>
      <h2>公开和本地不是一回事</h2>
      <p>
        只读导出写到你自己的电脑，并带上“仅本地”标记。网站拒绝展示仍带这个标记的文件。确认没有登录号、服务器和未平仓之后，才由你手动放进公开数据文件。
        <Link href="/tools/#journal"> 导入本地日记 </Link>
        不会完成这一步，数据停在这台浏览器里。
      </p>
      <h2>现在没有的东西</h2>
      <p>
        没有实时或延迟报价，没有持仓推送，也没有代你连接终端的网页按钮。权益曲线不会用成交编出来。若以后的持续分析要收费，入口在
        <Link href="/pricing/"> 价格 </Link>
        ，而且现在还不能购买。
      </p>
    </GuideArticle>
  );
}
