import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, formatUnits, isAddress, parseEther, parseUnits } from 'ethers';

import { useEthersSigner } from '../../hooks/useEthersSigner';
import { useZamaInstance } from '../../hooks/useZamaInstance';
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

export function BetPanel({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [token, setToken] = useState<TokenKey>('ETH');
  const [predictedPrice, setPredictedPrice] = useState<string>('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [stakeEth, setStakeEth] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const hasValidContractAddress = useMemo(() => {
    if (!isAddress(contractAddress)) return false;
    return contractAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000';
  }, [contractAddress]);

  const { data: dayIndex } = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'currentDayIndex',
    query: { enabled: hasValidContractAddress },
  });

  const tokenId = useMemo(() => TOKENS.find((t) => t.key === token)?.id ?? 0, [token]);

  const nextDay = dayIndex !== undefined ? (BigInt(dayIndex) + 1n).toString() : '-';

  const resetStatus = () => {
    setTxHash('');
    setSuccessMessage('');
    setErrorMessage('');
  };

  const canSubmit = !!address && !!instance && !!signerPromise && !zamaLoading && hasValidContractAddress;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStatus();

    if (!canSubmit || !address) {
      setErrorMessage('Connect wallet, ensure encryption service is ready, and set a valid contract address.');
      return;
    }

    let predictedScaled: bigint;
    let stakeWei: bigint;
    try {
      predictedScaled = parseUnits(predictedPrice.trim(), PRICE_DECIMALS);
      if (predictedScaled <= 0n) throw new Error('Predicted price must be > 0');
      if (predictedScaled > MAX_UINT64) throw new Error('Predicted price exceeds uint64');
    } catch (err) {
      setErrorMessage(`Invalid predicted price: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    try {
      stakeWei = parseEther(stakeEth.trim());
      if (stakeWei <= 0n) throw new Error('Stake must be > 0');
      if (stakeWei > MAX_UINT64) throw new Error('Stake exceeds uint64');
    } catch (err) {
      setErrorMessage(`Invalid stake: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    setSubmitting(true);
    try {
      const input = instance.createEncryptedInput(contractAddress, address);
      input.add64(predictedScaled);
      input.addBool(direction === 'above');
      const encrypted = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.placeBet(tokenId, encrypted.handles[0], encrypted.handles[1], encrypted.inputProof, {
        value: stakeWei,
      });

      setTxHash(tx.hash);
      const receipt = await tx.wait();

      const betPlaced = receipt?.logs
        ?.map((l: any) => {
          try {
            return contract.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((p: any) => p?.name === 'BetPlaced');

      const day = betPlaced?.args?.day?.toString?.() ?? nextDay;

      setSuccessMessage(`Bet submitted for day ${day}. Claim is available the day after the oracle posts that day's price.`);
      setPredictedPrice('');
      setStakeEth('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Place Bet (for next UTC day)</h2>

      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <div className="kv">
          <div className="kv-label">Target day</div>
          <div className="kv-value mono">{nextDay}</div>
        </div>
        <div className="kv">
          <div className="kv-label">Price decimals</div>
          <div className="kv-value mono">{PRICE_DECIMALS}</div>
        </div>
      </div>

      {zamaError && <div className="notice">Encryption service error: {zamaError}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="grid-2">
          <div className="field">
            <label className="label">Token</label>
            <select className="input" value={token} onChange={(e) => setToken(e.target.value as TokenKey)}>
              {TOKENS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Direction</label>
            <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
              <option value="above">Actual price &gt; predicted (true)</option>
              <option value="below">Actual price &lt; predicted (false)</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="label">Predicted price</label>
            <input
              className="input"
              placeholder={token === 'ETH' ? 'e.g. 4000.0' : 'e.g. 100000.0'}
              value={predictedPrice}
              onChange={(e) => setPredictedPrice(e.target.value)}
            />
            <div className="hint">
              Sent encrypted (scaled by 1e{PRICE_DECIMALS}). Example: 1.23 =&gt; {formatUnits(123000000n, PRICE_DECIMALS)}.
            </div>
          </div>

          <div className="field">
            <label className="label">Stake (ETH)</label>
            <input className="input" placeholder="e.g. 0.01" value={stakeEth} onChange={(e) => setStakeEth(e.target.value)} />
            <div className="hint">Stake is paid in ETH. If your prediction is correct, you receive the same amount of encrypted points.</div>
          </div>
        </div>

        <button className="button" type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Submitting...' : 'Submit Bet'}
        </button>
      </form>

      {txHash && (
        <div className="mono" style={{ marginTop: '0.75rem' }}>
          tx: {txHash}
        </div>
      )}
      {successMessage && <div className="success">{successMessage}</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}
    </section>
  );
}
