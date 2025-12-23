import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, formatEther, formatUnits, isAddress } from 'ethers';

import { useEthersSigner } from '../../hooks/useEthersSigner';
import { CONTRACT_ABI } from '../../config/contracts';
import '../../styles/Panels.css';

const PRICE_DECIMALS = 8;

type TokenKey = 'ETH' | 'BTC';
const TOKENS: Array<{ key: TokenKey; id: number }> = [
  { key: 'ETH', id: 0 },
  { key: 'BTC', id: 1 },
];

type Props = { contractAddress: string };

function isZeroAddress(addr: string) {
  return addr.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

function tokenLabel(tokenId: number): TokenKey {
  return tokenId === 1 ? 'BTC' : 'ETH';
}

export function BetsPanel({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [busyKey, setBusyKey] = useState<string>('');

  const hasValidContractAddress = useMemo(() => isAddress(contractAddress) && !isZeroAddress(contractAddress), [contractAddress]);

  const { data: dayIndex } = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'currentDayIndex',
    query: { enabled: hasValidContractAddress },
  });

  const today = dayIndex !== undefined ? BigInt(dayIndex) : undefined;
  const yesterday = today !== undefined && today > 0n ? today - 1n : undefined;
  const tomorrow = today !== undefined ? today + 1n : undefined;

  const handleClaim = async (tokenId: number, day: bigint) => {
    setError('');
    setTxHash('');
    if (!address || !signerPromise || !hasValidContractAddress) {
      setError('Connect wallet and set a valid contract address.');
      return;
    }

    const key = `${tokenId}-${day.toString()}`;
    setBusyKey(key);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.claim(tokenId, Number(day));
      setTxHash(tx.hash);
      await tx.wait();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">My Bets</h2>
      <div className="hint">
        Bets are always for the next UTC day. Claim is available the day after the oracle posts that day&apos;s price.
      </div>

      {!address && <div className="notice" style={{ marginTop: '0.75rem' }}>Connect your wallet to view bets.</div>}

      {address && today !== undefined && (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <div className="kv">
            <div className="kv-label">Yesterday</div>
            <div className="kv-value mono">{yesterday?.toString() ?? '-'}</div>
          </div>
          <div className="kv">
            <div className="kv-label">Today</div>
            <div className="kv-value mono">{today.toString()}</div>
          </div>
          <div className="kv">
            <div className="kv-label">Tomorrow</div>
            <div className="kv-value mono">{tomorrow?.toString() ?? '-'}</div>
          </div>
        </div>
      )}

      {address && today !== undefined && (
        <div style={{ marginTop: '1rem' }}>
          {TOKENS.map((t) => (
            <TokenBets
              key={t.key}
              contractAddress={contractAddress}
              userAddress={address}
              tokenId={t.id}
              yesterday={yesterday}
              tomorrow={tomorrow}
              onClaim={handleClaim}
              busyKey={busyKey}
            />
          ))}
        </div>
      )}

      {txHash && (
        <div className="mono" style={{ marginTop: '0.75rem' }}>
          tx: {txHash}
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </section>
  );
}

function TokenBets(props: {
  contractAddress: string;
  userAddress: `0x${string}`;
  tokenId: number;
  yesterday?: bigint;
  tomorrow?: bigint;
  onClaim: (tokenId: number, day: bigint) => void;
  busyKey: string;
}) {
  const { contractAddress, userAddress, tokenId, yesterday, tomorrow, onClaim, busyKey } = props;

  const settledDay = yesterday;
  const upcomingDay = tomorrow;

  const betSettled = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getBet',
    args: settledDay !== undefined ? [userAddress, tokenId, Number(settledDay)] : undefined,
    query: { enabled: settledDay !== undefined },
  });

  const betUpcoming = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getBet',
    args: upcomingDay !== undefined ? [userAddress, tokenId, Number(upcomingDay)] : undefined,
    query: { enabled: upcomingDay !== undefined },
  });

  const claimable = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'isBetClaimable',
    args: settledDay !== undefined ? [userAddress, tokenId, Number(settledDay)] : undefined,
    query: { enabled: settledDay !== undefined },
  });

  const settledPrice = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getDailyPrice',
    args: settledDay !== undefined ? [tokenId, Number(settledDay)] : undefined,
    query: { enabled: settledDay !== undefined },
  });

  const upcomingLabel = upcomingDay !== undefined ? upcomingDay.toString() : '-';
  const settledLabel = settledDay !== undefined ? settledDay.toString() : '-';

  const renderBetRow = (label: string, betData: any, extra?: ReactNode) => {
    const exists = betData?.[0] as boolean | undefined;
    const stakeWei = betData?.[1] as bigint | undefined;
    const claimed = betData?.[2] as boolean | undefined;

    return (
      <div className="bet-row">
        <div className="bet-left">
          <div className="bet-title">
            {label}
            <span className="pill mono" style={{ marginLeft: '0.5rem' }}>
              {exists ? 'exists' : 'none'}
            </span>
          </div>
          {exists && (
            <div className="bet-meta">
              <span className="mono">stake: {formatEther(stakeWei ?? 0n)} ETH</span>
              <span className="mono">claimed: {claimed ? 'true' : 'false'}</span>
            </div>
          )}
        </div>
        {extra}
      </div>
    );
  };

  const settledExists = betSettled.data?.[0] as boolean | undefined;
  const settledClaimed = betSettled.data?.[2] as boolean | undefined;
  const isClaimable = !!claimable.data;
  const settledPriceExists = settledPrice.data?.[2] as boolean | undefined;
  const settledPriceValue = settledPrice.data?.[0] as bigint | undefined;

  const claimKey = `${tokenId}-${settledDay?.toString() ?? ''}`;
  const claimDisabled = !settledExists || settledClaimed || !isClaimable || busyKey === claimKey;

  return (
    <div className="token-card">
      <div className="token-header">
        <div className="token-title">{tokenLabel(tokenId)}</div>
        <div className="token-subtitle mono">price decimals: {PRICE_DECIMALS}</div>
      </div>

      {renderBetRow(`Upcoming bet (day ${upcomingLabel})`, betUpcoming.data)}

      {renderBetRow(
        `Settled bet (day ${settledLabel})`,
        betSettled.data,
        <div className="bet-actions">
          <button className="button button-secondary" disabled={claimDisabled} onClick={() => settledDay && onClaim(tokenId, settledDay)}>
            {busyKey === claimKey ? 'Claiming...' : isClaimable ? 'Claim' : 'Not claimable'}
          </button>
          <div className="hint" style={{ marginTop: '0.5rem' }}>
            {settledPriceExists ? (
              <>
                settled price: <span className="mono">{formatUnits(settledPriceValue ?? 0n, PRICE_DECIMALS)}</span>
              </>
            ) : (
              <>settled price: -</>
            )}
          </div>
        </div>,
      )}
    </div>
  );
}
