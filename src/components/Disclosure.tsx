export function Disclosure() {
  return (
    <aside className="rounded-xl border border-card-border bg-card px-4 py-4 text-sm leading-6 text-muted sm:px-5">
      <h2 className="text-base font-semibold text-foreground">Risk and data status</h2>
      <p className="mt-2">
        Records shown here are self-reported. They are not checked by a broker, an auditor, or this site. Account type stays unknown until the file says otherwise. A demo or live label is still not a verified funded record.
        Net P&amp;L includes commission and swap. Deposits and withdrawals are not P&amp;L. Deals alone cannot rebuild mark-to-market equity, so realized P&amp;L drawdown is never labeled as equity drawdown.
      </p>
      <p className="mt-2">
        This is not a broker. It does not give investment advice, trade signals, copy trading, or order entry, and it cannot send instructions to a terminal. Past results are not future results. The position calculator only does arithmetic with the contract terms you type.
      </p>
    </aside>
  );
}
