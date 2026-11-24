import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";
import { OPERATOR_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "使用条款",
  description: "交易观察的使用条款。本站不是经纪商，不提供交易信号或收益保证，订阅尚未开放。",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <LegalDocument title="使用条款" updated="2026-11-24">
      <p>
        这些条款适用于 {SITE_URL} 上的交易观察。运营者是 {OPERATOR_NAME}（“我们”）。这是一个展示已平仓记录和提供浏览器本地计算的网站，不是经纪商、投资顾问或交易终端。
      </p>
      <h2>服务范围</h2>
      <p>
        公开页面可以展示一份经过人工发布的静态 JSON。默认文件是未连接状态，不包含业绩。工具页的仓位计算和日记在你的浏览器里运行。我们不接收下单指令，也不连接你的交易账户。
      </p>
      <p>
        计划中的分析功能还没开放。页面上的示意价格不能购买，本站目前没有结账。详见 <Link href="/pricing/">价格</Link>。
      </p>
      <h2>不是建议，也不是战绩认证</h2>
      <p>
        记录由持有人自行申报，未经我们核验。模拟、实盘或未知账户类型都不会被标成已验证入金战绩。过往结果不代表未来表现。你根据这些页面做的决定由你自己负责。
      </p>
      <h2>数据与示例</h2>
      <p>
        示例数据是虚构的，只用于看界面。把示例说成真实结果，或者在文件里放入账号、密码、服务器或未平仓明细，都不符合这些条款。可接受使用见{" "}
        <Link href="/acceptable-use/">可接受使用</Link>。
      </p>
      <h2>资格</h2>
      <p>你需要年满 18 岁，并且有权使用你导入或发布的记录。</p>
      <h2>责任</h2>
      <p>
        网站按现状提供。我们不保证数据完整、计算符合某一家经纪商的合约规格，也不保证网站不中断。在法律允许的范围内，我们不对使用本站造成的交易损失负责。本地日记存在你的浏览器里，清除站点数据后我们无法恢复。
      </p>
      <h2>联系</h2>
      <p>
        条款问题请发邮件到 <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>。本站没有留言表单。
      </p>
    </LegalDocument>
  );
}
