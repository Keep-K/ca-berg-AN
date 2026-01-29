import { useMemo, useState } from 'react';
import DataTable from '../DataTable';

interface BottomTabsProps {
  positions: any[];
  positionColumns: any[];
  openOrders: any[];
  orderColumns: any[];
  orderHistory: any[];
  historyOrderColumns: any[];
  tradeHistory: any[];
  tradeColumns: any[];
}

type TabKey =
  | 'positions'
  | 'openOrders'
  | 'orderHistory'
  | 'tradeHistory'
  | 'transactions'
  | 'assets';

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'positions', label: 'Positions' },
  { key: 'openOrders', label: 'Open Orders' },
  { key: 'orderHistory', label: 'Order History' },
  { key: 'tradeHistory', label: 'Trade History' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'assets', label: 'Assets' },
];

const TX_TYPES = ['Deposit', 'Withdrawal', 'Transfer', 'Fee'] as const;
const TX_STATUS = ['Completed', 'Pending', 'Rejected'] as const;

function buildTransactions() {
  return Array.from({ length: 20 }).map((_, i) => {
    const type = TX_TYPES[i % TX_TYPES.length];
    const status = TX_STATUS[i % TX_STATUS.length];
    const amount = (Math.random() * 2).toFixed(4);
    const asset = ['USDT', 'BTC', 'ETH', 'SOL'][i % 4];
    return {
      time: new Date(Date.now() - i * 60_000).toLocaleString(),
      exchange: 'BINANCE',
      type,
      asset,
      amount,
      status,
      txid: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      rawTxId: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    };
  });
}

export default function BottomTabs({
  positions,
  positionColumns,
  openOrders,
  orderColumns,
  orderHistory,
  historyOrderColumns,
  tradeHistory,
  tradeColumns,
}: BottomTabsProps) {
  const [active, setActive] = useState<TabKey>('openOrders');
  const transactions = useMemo(() => buildTransactions(), []);

  return (
    <div className="bottom-tabs">
      <div className="tabs-row">
        {TAB_LABELS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${active === t.key ? 'active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {active === 'positions' && (
          <DataTable columns={positionColumns} data={positions} emptyMessage="No open positions" />
        )}
        {active === 'openOrders' && (
          <DataTable columns={orderColumns} data={openOrders} emptyMessage="No open orders" />
        )}
        {active === 'orderHistory' && (
          <DataTable columns={historyOrderColumns} data={orderHistory} emptyMessage="No order history" />
        )}
        {active === 'tradeHistory' && (
          <DataTable columns={tradeColumns} data={tradeHistory} emptyMessage="No trade history" />
        )}
        {active === 'transactions' && (
          <div className="panel-body table dense scroll">
            <div className="row header">
              <span>Time</span>
              <span>Exchange</span>
              <span>Type</span>
              <span>Asset</span>
              <span>Amount</span>
              <span>Status</span>
              <span>TxID</span>
            </div>
            {transactions.map((tx, idx) => (
              <div key={`${tx.rawTxId}-${idx}`} className="row">
                <span>{tx.time}</span>
                <span>{tx.exchange}</span>
                <span>{tx.type}</span>
                <span>{tx.asset}</span>
                <span className="mono">{tx.amount}</span>
                <span className={`status ${tx.status.toLowerCase()}`}>{tx.status}</span>
                <span className="txid">
                  {tx.txid}
                  <button
                    type="button"
                    className="copy"
                    onClick={() => navigator.clipboard?.writeText(tx.rawTxId)}
                  >
                    Copy
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        {active === 'assets' && (
          <div className="empty-state compact">Coming soon</div>
        )}
      </div>
    </div>
  );
}
