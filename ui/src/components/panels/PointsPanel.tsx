import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther, isAddress } from 'ethers';

import { useEthersSigner } from '../../hooks/useEthersSigner';
import { useZamaInstance } from '../../hooks/useZamaInstance';
import { CONTRACT_ABI } from '../../config/contracts';
import '../../styles/Panels.css';

type Props = { contractAddress: string };

function isZeroAddress(addr: string) {
  return addr.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

export function PointsPanel({ contractAddress }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [decrypting, setDecrypting] = useState(false);
  const [clearPointsWei, setClearPointsWei] = useState<bigint | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const hasValidContractAddress = useMemo(() => isAddress(contractAddress) && !isZeroAddress(contractAddress), [contractAddress]);

  const pointsRead = useReadContract({
    address: hasValidContractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedPoints',
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasValidContractAddress },
  });

  const encryptedPoints = (pointsRead.data as `0x${string}` | undefined) ?? undefined;
  const canDecrypt = !!address && !!instance && !!signerPromise && !zamaLoading && !!encryptedPoints && encryptedPoints !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  const handleDecrypt = async () => {
    setErrorMessage('');
    setClearPointsWei(null);

    if (!canDecrypt || !address || !encryptedPoints) {
      setErrorMessage('Connect wallet, ensure points exist, and wait for the encryption service.');
      return;
    }

    setDecrypting(true);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [{ handle: encryptedPoints, contractAddress }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [contractAddress];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const raw = result[encryptedPoints as string];
      const asBigInt = typeof raw === 'bigint' ? raw : BigInt(raw);
      setClearPointsWei(asBigInt);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Points (encrypted)</h2>

      {zamaError && <div className="notice">Encryption service error: {zamaError}</div>}

      {!address && <div className="notice">Connect your wallet to view points.</div>}

      {address && (
        <div style={{ marginTop: '0.75rem' }}>
          <div className="kv">
            <div className="kv-label">Encrypted handle</div>
            <div className="kv-value mono">{encryptedPoints ?? '-'}</div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <button className="button" onClick={handleDecrypt} disabled={!canDecrypt || decrypting}>
              {decrypting ? 'Decrypting...' : 'Decrypt points'}
            </button>
            <div className="hint" style={{ marginTop: '0.5rem' }}>
              Decryption happens client-side via Zama Relayer and requires that the contract granted you ACL access.
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div className="kv">
              <div className="kv-label">Clear points (wei)</div>
              <div className="kv-value mono">{clearPointsWei !== null ? clearPointsWei.toString() : '-'}</div>
            </div>
            <div className="kv" style={{ marginTop: '0.5rem' }}>
              <div className="kv-label">Clear points (ETH)</div>
              <div className="kv-value mono">{clearPointsWei !== null ? formatEther(clearPointsWei) : '-'}</div>
            </div>
          </div>
        </div>
      )}

      {errorMessage && <div className="error">{errorMessage}</div>}
    </section>
  );
}

