// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Chainlink AggregatorV3-compatible ETH/USD feed for Hardhat Local.
contract MockEthUsdFeed {
    uint8 public constant decimals = 8;
    string public constant description = "ETH / USD";
    uint80 private _roundId;
    int256 private _answer;
    uint256 private _updatedAt;

    constructor(int256 initialAnswer) {
        _setAnswer(initialAnswer);
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80)
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }

    function setAnswer(int256 answer) external {
        _setAnswer(answer);
    }

    function _setAnswer(int256 answer) private {
        require(answer > 0, "invalid answer");
        _roundId++;
        _answer = answer;
        _updatedAt = block.timestamp;
    }
}
