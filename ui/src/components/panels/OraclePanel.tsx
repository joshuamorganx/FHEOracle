import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, formatUnits, isAddress, parseUnits } from 'ethers';

import { useEthersSigner } from '../../hooks/useEthersSigner';
import { CONTRACT_ABI } from '../../config/contracts';
import '../../styles/Panels.css';

const PRICE_DECIMALS = 8;
const MAX_UINT64 = (1n << 64n) - 1n;

type TokenKey = 'ETH' | 'BTC';
const TOKENS: Array<{ key: TokenKey; id: number }> = [
  { key: 'ETH', id: 0 },
  { key: 'BTC', id: 1 },
];

type Props = { contractAddress: string };

function isZeroAddress(addr: string) {
  return addr.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

export function OraclePanel({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();

  const [token, setToken] = useState<TokenKey>('ETH');
  const [price, setPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const hasValidContractAddress = useMemo(() => isAddress(contractAddress) && !isZeroAddress(contractAddress), [contractAddress]);

  const oracleRead = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'oracle',
    query: { enabled: hasValidContractAddress },
  });

  const dayRead = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'currentDayIndex',
    query: { enabled: hasValidContractAddress },
  });

  const tokenId = useMemo(() => TOKENS.find((t) => t.key === token)?.id ?? 0, [token]);
  const day = useMemo(() => {
    const v = dayRead.data as unknown;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    return undefined;
  }, [dayRead.data]);

  const todayPrice = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'getDailyPrice',
    args: day !== undefined ? [tokenId, day] : undefined,
    query: { enabled: hasValidContractAddress && day !== undefined },
  });

  const oracleAddress = (oracleRead.data as string | undefined) ?? undefined;
  const isOracle = !!address && !!oracleAddress && address.toLowerCase() === oracleAddress.toLowerCase();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxHash('');
    setSuccess('');
    setError('');

    if (!isOracle || !signerPromise || !hasValidContractAddress) {
      setError('Only the configured oracle can update prices.');
      return;
    }

    let scaled: bigint;
    try {
      scaled = parseUnits(price.trim(), PRICE_DECIMALS);
      if (scaled <= 0n) throw new Error('Price must be > 0');
      if (scaled > MAX_UINT64) throw new Error('Price exceeds uint64');
    } catch (err) {
      setError(`Invalid price: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    setSubmitting(true);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.updateDailyPrice(tokenId, scaled);
      setTxHash(tx.hash);
      await tx.wait();
      setSuccess('Price updated for today.');
      setPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const todayPriceExists = todayPrice.data?.[2] as boolean | undefined;
  const todayPriceValue = todayPrice.data?.[0] as bigint | undefined;

  return (
    <section className="card">
      <h2 className="card-title">Oracle (daily UTC 00:00 update)</h2>

      <div className="row">
        <div className="kv">
          <div className="kv-label">Oracle address</div>
          <div className="kv-value mono">{oracleAddress ?? '-'}</div>
        </div>
        <div className="kv">
          <div className="kv-label">You are oracle</div>
          <div className="kv-value mono">{isOracle ? 'true' : 'false'}</div>
        </div>
      </div>

      <div className="token-card" style={{ marginTop: '1rem' }}>
        <div className="token-header">
          <div className="token-title">Today&apos;s price</div>
          <div className="token-subtitle mono">day: {day !== undefined ? day.toString() : '-'}</div>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label className="label">Token</label>
            <select className="input" value={token} onChange={(e) => setToken(e.target.value as TokenKey)}>
              {TOKENS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label className="label">Current stored price</label>
            <div className="pill mono">
              {todayPriceExists ? formatUnits(todayPriceValue ?? 0n, PRICE_DECIMALS) : '-'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="form" style={{ marginTop: '1rem' }}>
        <div className="grid-2">
          <div className="field">
            <label className="label">New price</label>
            <input className="input" placeholder="e.g. 4000.0" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="hint">Stored as uint64 with 1e{PRICE_DECIMALS} decimals.</div>
          </div>
          <div className="field">
            <label className="label">Action</label>
            <button className="button" type="submit" disabled={!isOracle || submitting || !hasValidContractAddress}>
              {submitting ? 'Updating...' : 'Update today price'}
            </button>
          </div>
        </div>
      </form>

      {txHash && (
        <div className="mono" style={{ marginTop: '0.75rem' }}>
          tx: {txHash}
        </div>
      )}
      {success && <div className="success">{success}</div>}
      {error && <div className="error">{error}</div>}
    </section>
  );
}
