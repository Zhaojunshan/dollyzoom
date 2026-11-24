import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { OPERATOR_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "交易观察如何处理公开静态文件和浏览器本地日记。本站不收集账号密码，也没有注册。",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="隐私说明" updated="2026-11-24">
      <p>
        本说明适用于 {SITE_URL}。运营者是 {OPERATOR_NAME}。联系邮箱是{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>。
      </p>
      <h2>公开静态文件</h2>
      <p>
        概览读取网站上的 performance.json。那是一份人工放上去的静态文件，不是实时账户接口。它应当只包含已平仓统计、你批准的时点余额或权益，以及货币、时区和 as-of。它不应该包含账号、密码、服务器、会话或未平仓明细。
      </p>
      <h2>我们不通过这个网站收集的内容</h2>
      <p>没有注册，没有通讯订阅，也没有留言表单。仓位计算和日记导入不会把文件发到我们的服务器。我们也不在页面里放置支付密钥。</p>
      <h2>浏览器本地存储</h2>
      <p>
        两个开关会写在你的浏览器里：是否正在查看虚构示例，以及本地日记。它们留在这台设备上。我们读不到另一台设备上的日记。你可以用工具页的清除按钮或浏览器的站点数据设置删掉它们。
      </p>
      <h2>托管</h2>
      <p>
        页面是静态文件，由 GitHub Pages 提供。浏览器向这个域名请求 HTML、脚本和 JSON 时，托管方会按它自己的政策处理连接日志。本站没有另建账户数据库。
      </p>
      <h2>示例数据</h2>
      <p>示例文件是虚构的，用来展示界面。打开示例不会把你的终端或日记上传出去。</p>
    </LegalDocument>
  );
}
