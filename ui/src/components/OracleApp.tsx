import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { isAddress } from 'ethers';

import { Header } from './Header';
import { BetPanel } from './panels/BetPanel';
import { BetsPanel } from './panels/BetsPanel';
import { PointsPanel } from './panels/PointsPanel';
import { OraclePanel } from './panels/OraclePanel';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/OracleApp.css';

type TabKey = 'bet' | 'bets' | 'points' | 'oracle';

export function OracleApp() {
  const { address } = useAccount();
  const [tab, setTab] = useState<TabKey>('bet');
  const [overrideAddress, setOverrideAddress] = useState<string>('');

  const contractAddress = useMemo(() => {
    const trimmed = overrideAddress.trim();
    if (trimmed.length > 0 && isAddress(trimmed)) return trimmed;
    return CONTRACT_ADDRESS;
  }, [overrideAddress]);

  const hasValidContractAddress = isAddress(contractAddress) && contractAddress !== '0x0000000000000000000000000000000000000000';

  const { data: dayIndex } = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'currentDayIndex',
    query: { enabled: hasValidContractAddress },
  });

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        <div className="app-container">
          <section className="card">
            <h2 className="card-title">Contract</h2>
            <div className="row">
              <div className="kv">
                <div className="kv-label">Address</div>
                <div className="kv-value mono">{contractAddress}</div>
              </div>
              <div className="kv">
                <div className="kv-label">Today (UTC day index)</div>
                <div className="kv-value mono">{dayIndex !== undefined ? dayIndex.toString() : '-'}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: '0.75rem' }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Override contract address (optional)</label>
                <input
                  className="input"
                  placeholder="0x..."
                  value={overrideAddress}
                  onChange={(e) => setOverrideAddress(e.target.value)}
                />
                <div className="hint">
                  Use this only if you deployed a new contract and haven&apos;t run the ABI sync task yet.
                </div>
              </div>
              <div className="field" style={{ width: '16rem' }}>
                <label className="label">Wallet</label>
                <div className="pill mono">{address ?? 'Not connected'}</div>
              </div>
            </div>

            {!hasValidContractAddress && (
              <div className="notice" style={{ marginTop: '0.75rem' }}>
                Contract address is not set. Deploy to Sepolia, then run `npx hardhat task:sync-ui-abi --network sepolia`.
              </div>
            )}
          </section>

          <section className="tabs">
            <button className={tab === 'bet' ? 'tab tab-active' : 'tab'} onClick={() => setTab('bet')}>
              Place Bet
            </button>
            <button className={tab === 'bets' ? 'tab tab-active' : 'tab'} onClick={() => setTab('bets')}>
              My Bets
            </button>
            <button className={tab === 'points' ? 'tab tab-active' : 'tab'} onClick={() => setTab('points')}>
              Points
            </button>
            <button className={tab === 'oracle' ? 'tab tab-active' : 'tab'} onClick={() => setTab('oracle')}>
              Oracle
            </button>
          </section>

          {tab === 'bet' && <BetPanel contractAddress={contractAddress} />}
          {tab === 'bets' && <BetsPanel contractAddress={contractAddress} />}
          {tab === 'points' && <PointsPanel contractAddress={contractAddress} />}
          {tab === 'oracle' && <OraclePanel contractAddress={contractAddress} />}
        </div>
      </main>
    </div>
  );
}

