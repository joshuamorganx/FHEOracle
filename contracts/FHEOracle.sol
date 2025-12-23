// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEbool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHEOracle is ZamaEthereumConfig {
    enum Token {
        ETH,
        BTC
    }

    uint8 public constant PRICE_DECIMALS = 8;

    address public owner;
    address public oracle;

    struct DailyPrice {
        uint64 price;
        uint32 updatedAt;
        bool exists;
    }

    struct Bet {
        euint64 predictedPrice;
        ebool directionIsGreater;
        uint64 stakeWei;
        uint32 targetDay;
        bool claimed;
        bool exists;
    }

    mapping(Token => mapping(uint32 => DailyPrice)) private _dailyPrices;
    mapping(address => mapping(Token => mapping(uint32 => Bet))) private _bets;
    mapping(address => euint64) private _points;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event DailyPriceUpdated(Token indexed token, uint32 indexed day, uint64 price);
    event BetPlaced(address indexed user, Token indexed token, uint32 indexed day, uint64 stakeWei);
    event BetClaimed(address indexed user, Token indexed token, uint32 indexed day);
    event Withdrawal(address indexed to, uint256 amount);

    error NotOwner();
    error NotOracle();
    error ZeroAddress();
    error InvalidStake();
    error BetAlreadyExists();
    error BetNotFound();
    error BetNotClaimable();
    error PriceNotAvailable();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(address initialOracle) {
        if (initialOracle == address(0)) revert ZeroAddress();
        owner = msg.sender;
        oracle = initialOracle;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OracleUpdated(address(0), initialOracle);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    function withdraw(address payable to, uint256 amountWei) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToWithdraw();
        if (amountWei > bal) amountWei = bal;
        (bool ok,) = to.call{value: amountWei}("");
        require(ok, "WITHDRAW_FAILED");
        emit Withdrawal(to, amountWei);
    }

    function dayIndex(uint256 timestamp) public pure returns (uint32) {
        return uint32(timestamp / 1 days);
    }

    function currentDayIndex() public view returns (uint32) {
        return dayIndex(block.timestamp);
    }

    function getDailyPrice(Token token, uint32 day) external view returns (uint64 price, uint32 updatedAt, bool exists) {
        DailyPrice memory dp = _dailyPrices[token][day];
        return (dp.price, dp.updatedAt, dp.exists);
    }

    function updateDailyPrice(Token token, uint64 price) external onlyOracle {
        uint32 day = currentDayIndex();
        _dailyPrices[token][day] = DailyPrice({price: price, updatedAt: uint32(block.timestamp), exists: true});
        emit DailyPriceUpdated(token, day, price);
    }

    function getBet(address user, Token token, uint32 day)
        external
        view
        returns (bool exists, uint64 stakeWei, bool claimed, uint32 targetDay, euint64 predictedPrice, ebool directionIsGreater)
    {
        Bet storage b = _bets[user][token][day];
        return (b.exists, b.stakeWei, b.claimed, b.targetDay, b.predictedPrice, b.directionIsGreater);
    }

    function isBetClaimable(address user, Token token, uint32 day) external view returns (bool) {
        Bet storage b = _bets[user][token][day];
        if (!b.exists || b.claimed) return false;
        if (!_dailyPrices[token][day].exists) return false;
        return currentDayIndex() >= day + 1;
    }

    function getEncryptedPoints(address user) external view returns (euint64) {
        return _points[user];
    }

    function placeBet(
        Token token,
        externalEuint64 predictedPriceExternal,
        externalEbool directionExternal,
        bytes calldata inputProof
    ) external payable returns (uint32 targetDay) {
        if (msg.value == 0 || msg.value > type(uint64).max) revert InvalidStake();

        uint32 day = currentDayIndex() + 1;
        Bet storage existing = _bets[msg.sender][token][day];
        if (existing.exists) revert BetAlreadyExists();

        euint64 predictedPrice = FHE.fromExternal(predictedPriceExternal, inputProof);
        ebool directionIsGreater = FHE.fromExternal(directionExternal, inputProof);

        _bets[msg.sender][token][day] = Bet({
            predictedPrice: predictedPrice,
            directionIsGreater: directionIsGreater,
            stakeWei: uint64(msg.value),
            targetDay: day,
            claimed: false,
            exists: true
        });

        FHE.allowThis(predictedPrice);
        FHE.allow(predictedPrice, msg.sender);
        FHE.allowThis(directionIsGreater);
        FHE.allow(directionIsGreater, msg.sender);

        emit BetPlaced(msg.sender, token, day, uint64(msg.value));
        return day;
    }

    function claim(Token token, uint32 day) external {
        Bet storage b = _bets[msg.sender][token][day];
        if (!b.exists) revert BetNotFound();
        if (b.claimed) revert BetNotClaimable();
        if (!_dailyPrices[token][day].exists) revert PriceNotAvailable();
        if (currentDayIndex() < day + 1) revert BetNotClaimable();

        uint64 actualPriceClear = _dailyPrices[token][day].price;
        euint64 actualPrice = FHE.asEuint64(actualPriceClear);

        ebool isGreater = FHE.gt(actualPrice, b.predictedPrice);
        ebool isLess = FHE.lt(actualPrice, b.predictedPrice);
        ebool win = FHE.or(FHE.and(b.directionIsGreater, isGreater), FHE.and(FHE.not(b.directionIsGreater), isLess));

        euint64 stakeEnc = FHE.asEuint64(b.stakeWei);
        euint64 pointsToAdd = FHE.select(win, stakeEnc, FHE.asEuint64(0));

        _points[msg.sender] = FHE.add(_points[msg.sender], pointsToAdd);
        FHE.allowThis(_points[msg.sender]);
        FHE.allow(_points[msg.sender], msg.sender);

        b.claimed = true;
        emit BetClaimed(msg.sender, token, day);
    }
}
