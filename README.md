# 交易观察 Trade Journal

`https://dollyzoom.top/` 上的公开页面是一份已平仓交易记录和本地工具，不是经纪商，也不提供交易信号、跟单或自动下单。

生产环境默认读取 `public/data/performance.json`。这份文件的 `source` 是 `unconnected`：账户类型、余额、权益、胜率和曲线都是未知，不会用 0 或虚构曲线冒充。示例数据在 `public/data/demo-performance.json`，只有访客主动打开后才显示，并一直标着 **示例数据 DEMO**。

记录是自行申报的，本站不核验，也不能把模拟账户说成已验证的实盘战绩。

## 本地运行

```bash
npm install
npm test
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

```bash
npm run build
npm run preview
```

`npm run build` 使用 `output: "export"`，生成 `out/`。不要设置 `NEXT_PUBLIC_BASE_PATH`。GitHub Pages 工作流会设置 `NEXT_PUBLIC_RELATIVE_ASSETS=1`，让同一份 `_next` 资源在自定义域名根路径和 `github.io` 项目路径上都能加载。

## 部署

主域名是 **https://dollyzoom.top/**。`public/CNAME` 的内容是 `dollyzoom.top`。推到 `main` 或 `master` 时，`.github/workflows/deploy-pages.yml` 会构建静态文件、把 `dollyzoom.top` 写入 `out/CNAME`，再用 GitHub Pages 发布。不要删掉这个域名。

本仓库不托管 API。不要加需要 Node 服务器的功能，也不要在前端放密钥。

## 页面

| URL | 作用 |
| --- | --- |
| `/` | 连接状态、as-of、已平仓摘要、曲线和表格 |
| `/tools/` | 仓位计算、本地日记、品种/月份/费用拖累和 CSV 导出 |
| `/guide/` | 仓位、回撤和 MT5 日记说明 |
| `/pricing/` | 现在免费；计划中的订阅尚未开放 |
| `/terms/` | 使用条款 |
| `/privacy/` | 隐私说明 |
| `/acceptable-use/` | 可接受使用 |

## 数字怎么定义

一条已平仓记录是一个完全平掉的回合，不是 MT5 的单笔 deal。

- 同一 `positionId` 上可以有多笔 `out`。平仓量等于开仓量时合并成一条，净盈亏把这些成交的价格盈亏、佣金和库存费加在一起。
- 还有剩余手数的仓位不进入公开表。
- `inout`（反向开仓）整笔排除，并在 `warnings` 里计数。
- `balance` 成交是出入金，不是盈亏。入金为正，出金在文件里写成 `withdrawal` 加正数金额。
- `credit` 忽略。
- 胜率 = 净盈亏大于 0 的笔数 / 已平仓笔数。打平不算赢。没有已平仓记录时胜率是空值，不是 0%。
- 已实现余额 = 期初余额 + 出入金 + 已平仓净盈亏。没有期初余额时，这条曲线不可用。
- 权益回撤只从 `equitySnapshots` 计算，而且至少要两个点。快照之间的路径未知。不能用成交还原盯市权益，页面也不会把已实现盈亏回撤标成权益回撤。
- 收益率在期初余额、时间和出入金都够用时，按已实现余额计算修正迪茨（Modified Dietz）。这不是权益时间加权收益。分母不是正数或时间区间无效时显示不可用。
- 货币和时区来自文件。缺失就显示未知。
- 快照的 `asOf` 超过 7 天会标成旧文件。这不是“延迟行情”，本站也没有做强制延迟。

公开 JSON 里禁止出现密码、登录号、服务器、会话、未平仓 `positions` 和原始 `deals`。解析器遇到这些字段会拒绝整份文件。导出脚本写出的文件带 `localOnly: true`，站点也会拒绝，直到你审阅后删掉这个字段。

Schema 在 `schema/performance-v1.schema.json`。夹具在 `fixtures/partial-closes.json`。

## 手动发布一份真实快照

1. 在已经登录的 MT5 终端所在的电脑上运行下面的导出。不要把密码、登录号或服务器名放进命令行。这个脚本不会替你下单，也不会上传。
2. 打开生成的 `mt5-export.local.json`，确认没有账号、服务器和未平仓。确认 `account.class` 与终端一致，`verified` 仍是 `false`。
3. 成交历史不能还原权益曲线，所以 `equitySnapshots` 是空的。只有你自己另外记录了权益时点，才可以按 schema 加进去。期初余额也不会被猜出来；知道的话用 `--starting-balance` 和 `--starting-balance-time` 一起传入。
4. 确认可以公开后，删掉 `localOnly`，把文件保存为 `public/data/performance.json`，`source` 保持 `manual-static-export`。
5. 再跑 `npm test` 和 `npm run build`，然后按你自己的流程合并并发布 Pages。

当前没有认证过的上传接口。不要做公开的、不鉴权的写入端点，也不要把密钥放进前端。以后如果要做上传，至少需要：只有持有人能用的身份、服务端校验 schema、去掉敏感字段、拒绝未平仓，以及一次明确的“可以公开”确认。在那之前，唯一的发布方式就是上面的人工复制。

`public/data/feed.json` 只配置两份静态文件的路径，不是上传地址。

## 只读导出

依赖本机已经打开并登录的 MetaTrader 5，以及 Python 包 `MetaTrader5`。不要在没有终端的环境里安装或运行连接。本仓库的测试不会连接终端。

```bash
python3 scripts/mt5_closed_export.py \
  --i-understand-this-reads-the-open-terminal \
  --include-current-overview \
  --timezone Asia/Shanghai \
  --out mt5-export.local.json
```

`--include-current-overview` 才会写入一个时点的余额和权益。不加它就只有已平仓汇总。脚本调用的是已打开终端上的只读历史，不接收密码，也不包含下单方法。

`mt5-export.local.json` 已在 `.gitignore` 里。不要提交它。

只想检查聚合、不打开终端时：

```bash
python3 scripts/mt5_closed_export.py --aggregate-fixture fixtures/partial-closes.json
```

## 本地工具

`/tools/` 的仓位计算要求你提供 tick size、tick value、手数步长、最小手数、止损的价格距离和风险金额。手数向下取整。黄金没有内置点值。

日记导入接受上述 schema 的 JSON，或 README 工具页里写明表头的 CSV。导入前要勾选隐私确认。数据进 `localStorage`，键名 `tj.journal.v1`，可以导出 CSV 或清除。导入不会改 `performance.json`。

示例开关存在 `tj.demo.v1`。它只影响概览页的展示。

## 测试

```bash
npm test
```

覆盖：出入金不进盈亏、费用进净盈亏、部分平仓未平完则排除、平完后合并、无效导入、敏感字段不回显、计算器向下取整、默认未连接、权益回撤不从成交编造、Python 与 JavaScript 聚合一致，以及导出文件不带登录号。`server/` 里原有的测试仍会一起跑。

## 还没做、也不要假装已经做了

- 没有你的真实 MT5 数据。发布前概览就是未连接。
- 没有权益历史，除非你自己提供快照。
- 没有支付。`$9/月` 只是计划中的示意价格，订阅尚未开放，本站没有结账。
- 没有登录、通讯订阅或留言表单。
- 本页不能下单，也不能读取环境里的实时账户。

## 旧的视频目录

`server/` 和 `scripts/make-demo-media.py` 留在仓库里，是以前的视频产品代码。这次没有删除外部的 Creem 商店、Cloudflare Worker 或相关账号，也没有在新页面上保留结账、上传或视频宣传。不要从公开页面再链回去。部署这个静态站不会发布或关闭那个 Worker。
