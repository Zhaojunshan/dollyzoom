export function Disclosure() {
  return (
    <aside className="rounded-2xl border border-card-border bg-card px-4 py-4 text-sm leading-6 text-muted sm:px-5">
      <h2 className="text-base font-semibold text-foreground">风险与数据说明</h2>
      <p className="mt-2">
        这里的记录由持有人自行申报，未经经纪商、审计或本站核验。账户类型在数据文件写明之前是未知的；即使标明模拟或实盘，也不是已验证的入金战绩。
        净盈亏包含佣金和库存费。出入金不是盈亏。只有成交时，不能还原持仓期间的盯市权益，因此已实现盈亏回撤不会被标成权益回撤。
      </p>
      <p className="mt-2">
        本站不是经纪商，不提供投资建议、交易信号、跟单或自动下单，也不能代替你向终端发送指令。过往结果不代表未来表现。仓位计算器只按你输入的合约规格做算术。
      </p>
    </aside>
  );
}
