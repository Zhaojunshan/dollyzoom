import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "可接受使用",
  description: "交易观察的使用边界：不得伪称已验证收益，不得提交账户凭证，不得把本站当成经纪商或跟单服务。",
  alternates: { canonical: "/acceptable-use/" },
};

export default function AcceptableUsePage() {
  return (
    <LegalDocument title="可接受使用" updated="2026-11-24">
      <p>
        这些规则是 <Link href="/terms/">使用条款</Link> 的一部分。
      </p>
      <h2>请这样使用</h2>
      <ul>
        <li>把公开页当作自行申报、未核验的已平仓记录。</li>
        <li>只发布你有权公开、并且已经去掉账号和未平仓明细的文件。</li>
        <li>把仓位计算器当成算术工具，合约规格以你自己的经纪商说明为准。</li>
      </ul>
      <h2>请不要这样做</h2>
      <ul>
        <li>把示例数据、未连接状态或未验证记录说成真实、已审核或保证获利的战绩。</li>
        <li>在公开文件或日记里放入密码、登录号、服务器、会话或他人未授权的记录。</li>
        <li>把本站描述成经纪商、信号服务、跟单系统或自动交易程序。</li>
        <li>利用页面上的示意价格伪造已经付款或已经开通。</li>
      </ul>
      <h2>年龄</h2>
      <p>本站讨论交易记录，不面向 18 岁以下的人。</p>
      <p>本站没有接收凭证或留言的表单。如果一份准备公开的文件里出现了凭证，不要上传它，并在你自己的经纪商处更换相关密码。</p>
    </LegalDocument>
  );
}
