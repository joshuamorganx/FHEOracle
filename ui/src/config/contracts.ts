// Temporary placeholder. After deploying to Sepolia, run:
// `npx hardhat task:sync-ui-abi --network sepolia`
export const CONTRACT_ADDRESS = '0xb2668CFEDe811a46A26fEc63a0EB08bFA316AAac';

export const CONTRACT_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'initialOracle', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  { inputs: [], name: 'BetAlreadyExists', type: 'error' },
  { inputs: [], name: 'BetNotClaimable', type: 'error' },
  { inputs: [], name: 'BetNotFound', type: 'error' },
  { inputs: [], name: 'InvalidStake', type: 'error' },
  { inputs: [], name: 'NotOracle', type: 'error' },
  { inputs: [], name: 'NotOwner', type: 'error' },
  { inputs: [], name: 'NothingToWithdraw', type: 'error' },
  { inputs: [], name: 'PriceNotAvailable', type: 'error' },
  { inputs: [], name: 'ZeroAddress', type: 'error' },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { indexed: true, internalType: 'uint32', name: 'day', type: 'uint32' },
      { indexed: false, internalType: 'uint64', name: 'stakeWei', type: 'uint64' },
    ],
    name: 'BetPlaced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { indexed: true, internalType: 'uint32', name: 'day', type: 'uint32' },
    ],
    name: 'BetClaimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { indexed: true, internalType: 'uint32', name: 'day', type: 'uint32' },
      { indexed: false, internalType: 'uint64', name: 'price', type: 'uint64' },
    ],
    name: 'DailyPriceUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOracle', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOracle', type: 'address' },
    ],
    name: 'OracleUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'Withdrawal',
    type: 'event',
  },
  { inputs: [], name: 'PRICE_DECIMALS', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'oracle', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentDayIndex', outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ internalType: 'uint256', name: 'timestamp', type: 'uint256' }],
    name: 'dayIndex',
    outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { internalType: 'uint32', name: 'day', type: 'uint32' },
    ],
    name: 'getDailyPrice',
    outputs: [
      { internalType: 'uint64', name: 'price', type: 'uint64' },
      { internalType: 'uint32', name: 'updatedAt', type: 'uint32' },
      { internalType: 'bool', name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { internalType: 'uint32', name: 'day', type: 'uint32' },
    ],
    name: 'getBet',
    outputs: [
      { internalType: 'bool', name: 'exists', type: 'bool' },
      { internalType: 'uint64', name: 'stakeWei', type: 'uint64' },
      { internalType: 'bool', name: 'claimed', type: 'bool' },
      { internalType: 'uint32', name: 'targetDay', type: 'uint32' },
      { internalType: 'euint64', name: 'predictedPrice', type: 'bytes32' },
      { internalType: 'ebool', name: 'directionIsGreater', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getEncryptedPoints',
    outputs: [{ internalType: 'euint64', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { internalType: 'uint32', name: 'day', type: 'uint32' },
    ],
    name: 'isBetClaimable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { internalType: 'uint32', name: 'day', type: 'uint32' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' },
      { internalType: 'externalEuint64', name: 'predictedPriceExternal', type: 'bytes32' },
      { internalType: 'externalEbool', name: 'directionExternal', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'placeBet',
    outputs: [{ internalType: 'uint32', name: 'targetDay', type: 'uint32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'enum FHEOracle.Token', name: 'token', type: 'uint8' }, { internalType: 'uint64', name: 'price', type: 'uint64' }],
    name: 'updateDailyPrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOracle', type: 'address' }],
    name: 'setOracle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  { inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [{ internalType: 'address payable', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'amountWei', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

